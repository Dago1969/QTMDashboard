package com.qtm.dashboard.structuredepartment.service;

import com.qtm.commonlib.dto.RegionDto;
import com.qtm.dashboard.asl.entity.ASLEntity;
import com.qtm.dashboard.asl.repository.ASLRepository;
import com.qtm.dashboard.hospital.entity.HospitalEntity;
import com.qtm.dashboard.hospital.repository.HospitalRepository;
import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentFilterOptionDto;
import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentFilterOptionsDto;
import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentImportRequest;
import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentOverviewDto;
import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentSourceDto;
import com.qtm.dashboard.structuredepartment.entity.StructureDepartmentEntity;
import com.qtm.dashboard.structuredepartment.repository.StructureDepartmentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Servizio che popola i filtri dai sorgenti associati e legge da QTMTicket solo i reparti delle strutture locali.
 */
@Slf4j
@Service
public class StructureDepartmentService {

    private static final String EMPTY_REFERENTS_JSON = "[]";

    private final ASLRepository aslRepository;
    private final HospitalRepository hospitalRepository;
    private final StructureDepartmentRepository structureDepartmentRepository;
    private final RestClient restClient;
    private final RestClient apiRootRestClient;
    private final String ticketApiRootUrl;

    @Autowired
    public StructureDepartmentService(
            ASLRepository aslRepository,
            HospitalRepository hospitalRepository,
            StructureDepartmentRepository structureDepartmentRepository,
            @Value("${app.ticket.base-url:http://localhost:8084/api/ticket}") String ticketBaseUrl
    ) {
        this(aslRepository, hospitalRepository, structureDepartmentRepository,
            RestClient.builder().baseUrl(deriveTicketApiRootUrl(ticketBaseUrl)).build(),
            RestClient.builder().baseUrl(deriveTicketApiRootUrl(ticketBaseUrl)).build(),
                ticketBaseUrl);
    }

    StructureDepartmentService(
            ASLRepository aslRepository,
            HospitalRepository hospitalRepository,
            StructureDepartmentRepository structureDepartmentRepository,
            RestClient restClient,
            RestClient apiRootRestClient,
            String ticketBaseUrl
    ) {
        this.aslRepository = aslRepository;
        this.hospitalRepository = hospitalRepository;
        this.structureDepartmentRepository = structureDepartmentRepository;
        this.restClient = restClient;
        this.apiRootRestClient = apiRootRestClient;
        this.ticketApiRootUrl = deriveTicketApiRootUrl(ticketBaseUrl);
    }

    @Transactional(readOnly = true)
    public StructureDepartmentFilterOptionsDto getFilterOptions() {
        Map<String, RegionDto> regionsByCode = loadRegionsByCode();
        List<ASLEntity> asls = aslRepository.findAll();
        Map<Long, ASLEntity> aslsById = loadAslsById(asls);
        Map<String, HospitalEntity> hospitalsByStructureCode = loadHospitalsByStructureCode();

        return StructureDepartmentFilterOptionsDto.builder()
                .regions(buildRegionOptions(regionsByCode))
                .asls(buildAslOptions(asls, regionsByCode))
                .hospitals(buildHospitalOptions(hospitalsByStructureCode, aslsById))
                .build();
    }

    @Transactional(readOnly = true)
    public List<StructureDepartmentOverviewDto> findAllWithImportStatus(String regionCode, String aslCode, String structureCode) {
        log.info("[StructureDepartmentService] overview region={} asl={} structure={}", regionCode, aslCode, structureCode);

        Map<String, RegionDto> regionsByCode = loadRegionsByCode();
        List<ASLEntity> asls = aslRepository.findAll();
        Map<String, ASLEntity> aslsByCode = asls.stream()
            .filter(asl -> StringUtils.hasText(asl.getCodiceAzienda()))
            .collect(Collectors.toMap(asl -> normalizeCode(asl.getCodiceAzienda()), Function.identity(), (first, second) -> first));
        Map<Long, ASLEntity> aslsById = loadAslsById(asls);
        Map<String, HospitalEntity> hospitalsByStructureCode = loadHospitalsByStructureCode();
        log.info("[StructureDepartmentService] normalized filters regionKey={} aslKey={} structureKey={}",
            normalizeCode(regionCode), normalizeCode(aslCode), normalizeCode(structureCode));
        List<String> associatedStructureCodes = resolveAssociatedStructureCodes(regionCode, aslCode, structureCode, hospitalsByStructureCode, aslsById);
        Map<String, StructureDepartmentEntity> localAssociationsByKey = structureDepartmentRepository.findAll().stream()
                .collect(Collectors.toMap(
                        entity -> buildAssociationKey(entity.getCodiceStruttura(), entity.getCodiceDisciplina()),
                        Function.identity(),
                        (first, second) -> first
                ));
        log.info("[StructureDepartmentService] qtmdb local association keys={}", localAssociationsByKey.keySet());

        List<StructureDepartmentSourceDto> ticketDepartments = associatedStructureCodes.stream()
            .peek(code -> log.info("[StructureDepartmentService] fetching departments from TICKET for structureCode={}", code))
            .flatMap(code -> fetchStructureDepartmentsByStructureCode(code).stream())
            .toList();
        log.info("[StructureDepartmentService] extracted {} departments from TICKET keys={}",
            ticketDepartments.size(),
            ticketDepartments.stream()
                .map(row -> buildAssociationKey(row.getCodiceStruttura(), row.getCodiceDisciplina()))
                .toList());

        List<StructureDepartmentOverviewDto> overview = ticketDepartments.stream()
            .map(sourceDepartment -> toOverview(sourceDepartment, regionsByCode, aslsByCode, aslsById, hospitalsByStructureCode, localAssociationsByKey))
            .toList();
        log.info("[StructureDepartmentService] enriched overview rows={} importedKeys={}",
            overview.size(),
            overview.stream()
                .filter(row -> Boolean.TRUE.equals(row.getImported()))
                .map(row -> buildAssociationKey(row.getCodiceStruttura(), row.getCodiceDisciplina()))
                .toList());
        return overview;
    }

    @Transactional
    public void importAssociation(StructureDepartmentImportRequest request) {
        String codiceStruttura = normalizeRequiredCode(request != null ? request.getCodiceStruttura() : null, "Codice struttura mancante");
        String codiceDisciplina = normalizeRequiredCode(request != null ? request.getCodiceDisciplina() : null, "Codice disciplina mancante");

        log.info("[StructureDepartmentService] associazione reparto struttura={} disciplina={}", codiceStruttura, codiceDisciplina);

        fetchStructureDepartmentsByStructureCode(codiceStruttura).stream()
                .filter(row -> Objects.equals(normalizeCode(row.getCodiceDisciplina()), codiceDisciplina))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        String.format("Reparto %s non trovato in QTMTicket per la struttura %s.", codiceDisciplina, codiceStruttura)
                ));

        StructureDepartmentEntity entity = structureDepartmentRepository
                .findByCodiceStrutturaAndCodiceDisciplina(codiceStruttura, codiceDisciplina)
                .orElseGet(StructureDepartmentEntity::new);
        entity.setCodiceStruttura(codiceStruttura);
        entity.setCodiceDisciplina(codiceDisciplina);
        entity.setReferentsJson(StringUtils.hasText(entity.getReferentsJson()) ? entity.getReferentsJson() : EMPTY_REFERENTS_JSON);
        structureDepartmentRepository.save(entity);
    }

    @Transactional
    public void deleteAssociation(String codiceStruttura, String codiceDisciplina) {
        String normalizedStructureCode = normalizeRequiredCode(codiceStruttura, "Codice struttura mancante");
        String normalizedDepartmentCode = normalizeRequiredCode(codiceDisciplina, "Codice disciplina mancante");

        if (!structureDepartmentRepository.existsByCodiceStrutturaAndCodiceDisciplina(normalizedStructureCode, normalizedDepartmentCode)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    String.format("Associazione non trovata per struttura %s e disciplina %s.", normalizedStructureCode, normalizedDepartmentCode)
            );
        }

        structureDepartmentRepository.deleteByCodiceStrutturaAndCodiceDisciplina(normalizedStructureCode, normalizedDepartmentCode);
    }

    private StructureDepartmentOverviewDto toOverview(
            StructureDepartmentSourceDto sourceDepartment,
            Map<String, RegionDto> regionsByCode,
            Map<String, ASLEntity> aslsByCode,
            Map<Long, ASLEntity> aslsById,
            Map<String, HospitalEntity> hospitalsByStructureCode,
            Map<String, StructureDepartmentEntity> localAssociationsByKey
    ) {
        String normalizedStructureCode = normalizeCode(sourceDepartment.getCodiceStruttura());
        HospitalEntity hospital = hospitalsByStructureCode.get(normalizedStructureCode);
        String resolvedAslCode = resolveHospitalAslCode(hospital, aslsById);
        ASLEntity asl = resolvedAslCode != null ? aslsByCode.get(normalizeCode(resolvedAslCode)) : null;
        String effectiveRegionCode = resolveHospitalRegionCode(hospital, aslsById);
        RegionDto region = regionsByCode.get(normalizeCode(effectiveRegionCode));
        String associationKey = buildAssociationKey(sourceDepartment.getCodiceStruttura(), sourceDepartment.getCodiceDisciplina());

        return StructureDepartmentOverviewDto.builder()
                .id(sourceDepartment.getId())
                .codiceRegione(effectiveRegionCode)
                .regione(region != null ? region.getName() : null)
                .codiceAsl(resolvedAslCode)
                .asl(asl != null ? asl.getDenominazioneAzienda() : null)
                .codiceStruttura(sourceDepartment.getCodiceStruttura())
                .struttura(hospital != null ? hospital.getStruttura() : null)
                .codiceDisciplina(sourceDepartment.getCodiceDisciplina())
            .disciplina(sourceDepartment.getDisciplina())
                .indirizzo(sourceDepartment.getIndirizzo())
                .imported(localAssociationsByKey.containsKey(associationKey))
                .build();
    }

    private Map<String, RegionDto> loadRegionsByCode() {
        return fetchAllRegionsFromTicket().stream()
                .filter(region -> StringUtils.hasText(region.getCode()))
                .collect(Collectors.toMap(region -> normalizeCode(region.getCode()), Function.identity(), (first, second) -> first));
    }

    private Map<String, HospitalEntity> loadHospitalsByStructureCode() {
        return hospitalRepository.findAll().stream()
                .filter(hospital -> StringUtils.hasText(hospital.getCodiceStruttura()))
                .collect(Collectors.toMap(
                        hospital -> normalizeCode(hospital.getCodiceStruttura()),
                        Function.identity(),
                        (first, second) -> first
                ));
    }

        private List<String> resolveAssociatedStructureCodes(
            String regionCode,
            String aslCode,
            String structureCode,
            Map<String, HospitalEntity> hospitalsByStructureCode,
            Map<Long, ASLEntity> aslsById
        ) {
        String normalizedRegionCode = normalizeCode(regionCode);
        String normalizedAslCode = normalizeCode(aslCode);
        String normalizedStructureCode = normalizeCode(structureCode);

        List<String> resolvedStructureCodes = hospitalsByStructureCode.values().stream()
            .filter(hospital -> StringUtils.hasText(hospital.getCodiceStruttura()))
            .filter(hospital -> normalizedStructureCode == null || Objects.equals(normalizeCode(hospital.getCodiceStruttura()), normalizedStructureCode))
            .filter(hospital -> matchesRegion(normalizedRegionCode, hospital, aslsById))
            .filter(hospital -> matchesAsl(normalizedAslCode, hospital, aslsById))
            .map(HospitalEntity::getCodiceStruttura)
                .map(this::normalizeCode)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
            log.info("[StructureDepartmentService] resolved hospital structure codes from QTMDB hospital={}", resolvedStructureCodes);
            return resolvedStructureCodes;
    }

    private boolean matchesRegion(String regionCode, HospitalEntity hospital, Map<Long, ASLEntity> aslsById) {
        return regionCode == null || Objects.equals(normalizeCode(resolveHospitalRegionCode(hospital, aslsById)), regionCode);
    }

    private boolean matchesAsl(String aslCode, HospitalEntity hospital, Map<Long, ASLEntity> aslsById) {
        return aslCode == null || Objects.equals(normalizeCode(resolveHospitalAslCode(hospital, aslsById)), aslCode);
    }

    private Map<Long, ASLEntity> loadAslsById(List<ASLEntity> asls) {
        return asls.stream()
                .filter(asl -> asl.getId() != null)
                .collect(Collectors.toMap(ASLEntity::getId, Function.identity(), (first, second) -> first));
    }

    private List<StructureDepartmentFilterOptionDto> buildRegionOptions(Map<String, RegionDto> regionsByCode) {
        return regionsByCode.values().stream()
                .sorted(Comparator.comparing(RegionDto::getName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(region -> StructureDepartmentFilterOptionDto.builder()
                        .code(region.getCode())
                        .label(StringUtils.hasText(region.getName()) ? region.getName() + " (" + region.getCode() + ")" : region.getCode())
                        .regionCode(region.getCode())
                        .build())
                .toList();
    }

    private List<StructureDepartmentFilterOptionDto> buildAslOptions(List<ASLEntity> asls, Map<String, RegionDto> regionsByCode) {
        return asls.stream()
                .filter(asl -> StringUtils.hasText(asl.getCodiceAzienda()))
                .sorted(Comparator.comparing(ASLEntity::getDenominazioneAzienda, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(asl -> {
                    RegionDto region = regionsByCode.get(normalizeCode(asl.getCodiceRegione()));
                    String label = StringUtils.hasText(asl.getDenominazioneAzienda())
                            ? asl.getDenominazioneAzienda() + " (" + asl.getCodiceAzienda() + ")"
                            : asl.getCodiceAzienda();
                    if (region != null && StringUtils.hasText(region.getName())) {
                        label = label + " - " + region.getName();
                    }
                    return StructureDepartmentFilterOptionDto.builder()
                            .code(asl.getCodiceAzienda())
                            .label(label)
                            .regionCode(asl.getCodiceRegione())
                            .aslCode(asl.getCodiceAzienda())
                            .build();
                })
                .toList();
    }

        private List<StructureDepartmentFilterOptionDto> buildHospitalOptions(
                Map<String, HospitalEntity> hospitalsByStructureCode,
                Map<Long, ASLEntity> aslsById
        ) {
        return hospitalsByStructureCode.values().stream()
            .filter(hospital -> StringUtils.hasText(hospital.getCodiceStruttura()))
            .sorted(Comparator.comparing(HospitalEntity::getStruttura, Comparator.nullsLast(String::compareToIgnoreCase)))
            .map(hospital -> {
                String resolvedRegionCode = resolveHospitalRegionCode(hospital, aslsById);
                String resolvedAslCode = resolveHospitalAslCode(hospital, aslsById);
                String label = StringUtils.hasText(hospital.getStruttura())
                    ? hospital.getStruttura() + " (" + hospital.getCodiceStruttura() + ")"
                        : hospital.getCodiceStruttura();
                return StructureDepartmentFilterOptionDto.builder()
                    .code(hospital.getCodiceStruttura())
                    .label(label)
                    .regionCode(resolvedRegionCode)
                    .aslCode(resolvedAslCode)
                    .build();
            })
            .toList();
        }

    private String resolveHospitalRegionCode(HospitalEntity hospital, Map<Long, ASLEntity> aslsById) {
        if (hospital == null) {
            return null;
        }
        if (StringUtils.hasText(hospital.getCodiceRegione())) {
            return hospital.getCodiceRegione();
        }
        ASLEntity asl = resolveHospitalAsl(hospital, aslsById);
        return asl != null ? asl.getCodiceRegione() : null;
    }

    private String resolveHospitalAslCode(HospitalEntity hospital, Map<Long, ASLEntity> aslsById) {
        if (hospital == null) {
            return null;
        }
        if (StringUtils.hasText(hospital.getCodiceAsl())) {
            return hospital.getCodiceAsl();
        }
        ASLEntity asl = resolveHospitalAsl(hospital, aslsById);
        return asl != null ? asl.getCodiceAzienda() : null;
    }

    private ASLEntity resolveHospitalAsl(HospitalEntity hospital, Map<Long, ASLEntity> aslsById) {
        if (hospital == null || hospital.getAslId() == null) {
            return null;
        }
        return aslsById.get(hospital.getAslId());
    }

    private List<RegionDto> fetchAllRegionsFromTicket() {
        String targetUrl = buildTicketApiUrl("regions");
        log.info("[StructureDepartmentService] chiamata QTMTicket per {}", targetUrl);
        try {
            RegionDto[] sourceRegions = apiRootRestClient.get()
                    .uri("regions")
                    .retrieve()
                    .body(RegionDto[].class);
            return sourceRegions == null ? new ArrayList<>() : Arrays.asList(sourceRegions);
        } catch (Exception exception) {
            log.error("[StructureDepartmentService] errore fetchAllRegionsFromTicket", exception);
            throw mapExternalException(exception, targetUrl);
        }
    }

    private List<StructureDepartmentSourceDto> fetchStructureDepartmentsByStructureCode(String codiceStruttura) {
        String targetUrl = buildTicketApiUrl("structure-departments?codiceStruttura=" + codiceStruttura);
        log.info("[StructureDepartmentService] chiamata QTMTicket per {}", targetUrl);
        try {
            StructureDepartmentSourceDto[] sourceDepartments = restClient.get()
                    .uri("structure-departments?codiceStruttura={codiceStruttura}", codiceStruttura)
                    .retrieve()
                    .body(StructureDepartmentSourceDto[].class);
            List<StructureDepartmentSourceDto> result = sourceDepartments == null ? new ArrayList<>() : Arrays.asList(sourceDepartments);
            log.info("[StructureDepartmentService] ticket rows for structure={} count={} keys={}",
                    codiceStruttura,
                    result.size(),
                    result.stream()
                            .map(row -> buildAssociationKey(row.getCodiceStruttura(), row.getCodiceDisciplina()))
                            .toList());
            return result;
        } catch (Exception exception) {
            log.error("[StructureDepartmentService] errore fetchStructureDepartmentsByStructureCode struttura={}", codiceStruttura, exception);
            throw mapExternalException(exception, targetUrl);
        }
    }

    /**
     * Public wrapper to expose structure_departments rows for a given structure code.
     * This is used by other services (Tenants-app) to obtain the list of departments
     * associated to a hospital (codice_struttura) from QTMTicket.
     */
    public List<StructureDepartmentSourceDto> listByStructureCode(String codiceStruttura) {
        log.info("[StructureDepartmentService] listByStructureCode called codiceStruttura={}", codiceStruttura);
        List<StructureDepartmentSourceDto> rows = fetchStructureDepartmentsByStructureCode(codiceStruttura);
        log.info("[StructureDepartmentService] returning {} rows for codiceStruttura={}", rows == null ? 0 : rows.size(), codiceStruttura);
        return rows;
    }

    private String buildTicketApiUrl(String resourcePath) {
        String normalizedResourcePath = resourcePath.startsWith("/") ? resourcePath.substring(1) : resourcePath;
        return ticketApiRootUrl + normalizedResourcePath;
    }

    private ResponseStatusException mapExternalException(Exception exception, String targetUrl) {
        if (exception instanceof ResponseStatusException responseStatusException) {
            return responseStatusException;
        }
        if (exception instanceof RestClientResponseException restClientResponseException) {
            String detail = String.format(
                    "QTMTicket ha risposto con stato %s durante la chiamata %s.",
                    restClientResponseException.getStatusCode().value(),
                    targetUrl
            );
            return new ResponseStatusException(HttpStatus.BAD_GATEWAY, detail, exception);
        }
        if (exception instanceof ResourceAccessException) {
            String detail = String.format(
                    "QTMTicket non raggiungibile su %s. Verifica che il servizio sia avviato e che app.ticket.base-url sia corretto.",
                    targetUrl
            );
            return new ResponseStatusException(HttpStatus.BAD_GATEWAY, detail, exception);
        }
        String detail = String.format("Errore durante la chiamata a QTMTicket su %s.", targetUrl);
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, detail, exception);
    }

    private String normalizeRequiredCode(String value, String errorMessage) {
        String normalizedValue = normalizeCode(value);
        if (!StringUtils.hasText(normalizedValue)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, errorMessage);
        }
        return normalizedValue;
    }

    private String normalizeCode(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String buildAssociationKey(String codiceStruttura, String codiceDisciplina) {
        return normalizeCode(codiceStruttura) + "||" + normalizeCode(codiceDisciplina);
    }

    private static String deriveTicketApiRootUrl(String ticketBaseUrl) {
        String normalizedBaseUrl = Objects.requireNonNull(ticketBaseUrl, "app.ticket.base-url mancante").trim();
        if (normalizedBaseUrl.endsWith("/")) {
            normalizedBaseUrl = normalizedBaseUrl.substring(0, normalizedBaseUrl.length() - 1);
        }
        if (normalizedBaseUrl.endsWith("/api")) {
            return normalizedBaseUrl + "/";
        }
        if (normalizedBaseUrl.endsWith("/api/ticket/api")) {
            return normalizedBaseUrl + "/";
        }
        if (normalizedBaseUrl.endsWith("/api/ticket")) {
            return normalizedBaseUrl + "/api/";
        }
        return normalizedBaseUrl + "/api/";
    }
}