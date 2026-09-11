package com.qtm.dashboard.asl.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qtm.commonlib.dto.ASLDto;
import com.qtm.dashboard.asl.dto.ASLOverviewDto;
import com.qtm.dashboard.asl.entity.ASLEntity;
import com.qtm.dashboard.asl.mapper.ASLMapper;
import com.qtm.dashboard.asl.repository.ASLRepository;
import com.qtm.dashboard.domain.City;
import com.qtm.dashboard.domain.Region;
import com.qtm.dashboard.repository.CityRepository;
import com.qtm.dashboard.repository.RegionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ASLService {

    private final ASLRepository aslRepository;
    private final ASLMapper aslMapper;
    private final CityRepository cityRepository;
    private final RegionRepository regionRepository;
    private final RestClient restClient;
    private final String ticketBaseUrl;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public ASLService(
            ASLRepository aslRepository,
            ASLMapper aslMapper,
            CityRepository cityRepository,
            RegionRepository regionRepository,
            @Value("${app.ticket.base-url:http://localhost:8084/api/ticket}") String ticketBaseUrl
    ) {
        this.aslRepository = aslRepository;
        this.aslMapper = aslMapper;
        this.cityRepository = cityRepository;
        this.regionRepository = regionRepository;
        this.ticketBaseUrl = Objects.requireNonNull(ticketBaseUrl, "app.ticket.base-url mancante");
        // RestClient usato per chiamare le API QTMTicket; la base URL è configurabile in application.properties
        this.restClient = RestClient.builder().baseUrl(this.ticketBaseUrl).build();
        log.info("[ASLService] inizializzato con ticketBaseUrl={}", ticketBaseUrl);
    }

    ASLService(
            ASLRepository aslRepository,
            ASLMapper aslMapper,
            CityRepository cityRepository,
            RegionRepository regionRepository,
            RestClient restClient,
            String ticketBaseUrl
    ) {
        this.aslRepository = aslRepository;
        this.aslMapper = aslMapper;
        this.cityRepository = cityRepository;
        this.regionRepository = regionRepository;
        this.ticketBaseUrl = Objects.requireNonNull(ticketBaseUrl, "app.ticket.base-url mancante");
        this.restClient = restClient;
    }

    @Transactional(readOnly = true)
    public List<ASLDto> findAll() {
        return aslRepository.findAll().stream()
                .map(aslMapper::entityToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public ASLDto findById(Long id) {
        return aslRepository.findById(id)
                .map(aslMapper::entityToDto)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<ASLOverviewDto> findAllWithImportStatus() {
        log.info("[ASLService] richiesta overview ASL con stato import");
        List<ASLDto> sourceAsls = fetchAllAslsFromTicket();
        Map<Long, ASLEntity> localAslMap = aslRepository.findAll().stream()
                .collect(Collectors.toMap(ASLEntity::getId, entity -> entity));
        Map<Long, City> cityMap = loadCitiesById(sourceAsls);
        Map<String, Region> regionMap = loadRegionsByCode(sourceAsls);

        return sourceAsls.stream()
            .map(source -> toOverviewDto(source, localAslMap.get(source.getId()), cityMap.get(source.getCityId()), regionMap))
                .toList();
    }

        /**
         * Arricchisce l'overview ASL con anno e anagrafiche geografiche derivate dal comune sorgente.
         */
        private ASLOverviewDto toOverviewDto(ASLDto source, ASLEntity localEntity, City city, Map<String, Region> regionMap) {
        var province = city != null ? city.getProvince() : null;
        var cityRegion = province != null ? province.getRegion() : null;
        String normalizedRegionCode = normalizeRegionCode(source.getCodiceRegione());
        Region regionFromCode = normalizedRegionCode == null ? null : regionMap.get(normalizedRegionCode);
        boolean cityRegionMatchesSource = cityRegion != null
                && normalizedRegionCode != null
                && normalizedRegionCode.equals(normalizeRegionCode(cityRegion.getRegionCode()));
        var resolvedProvince = cityRegionMatchesSource ? province : null;
        var resolvedRegion = regionFromCode != null ? regionFromCode : (cityRegionMatchesSource ? cityRegion : null);
        return ASLOverviewDto.builder()
            .id(source.getId())
            .anno(source.getAnno())
            .codiceAzienda(source.getCodiceAzienda())
            .denominazioneAzienda(source.getDenominazioneAzienda())
            .codiceRegione(source.getCodiceRegione())
            .provinciaId(resolvedProvince != null ? resolvedProvince.getId() : null)
            .provinciaDescrizione(resolvedProvince != null ? resolvedProvince.getName() : null)
            .regioneDescrizione(resolvedRegion != null ? resolvedRegion.getName() : null)
            .indirizzo(source.getIndirizzo())
            .email(source.getEmail())
            .telefono(source.getTelefono())
            .imported(localEntity != null)
            .note(localEntity != null ? localEntity.getNote() : null)
            .build();
        }

        private Map<Long, City> loadCitiesById(List<ASLDto> sourceAsls) {
        List<Long> cityIds = sourceAsls.stream()
            .map(ASLDto::getCityId)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
        return cityRepository.findAllById(cityIds).stream()
            .collect(Collectors.toMap(City::getId, city -> city));
        }

        private Map<String, Region> loadRegionsByCode(List<ASLDto> sourceAsls) {
        List<String> regionCodes = sourceAsls.stream()
            .map(ASLDto::getCodiceRegione)
            .map(this::normalizeRegionCode)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
        return regionRepository.findByRegionCodeIn(regionCodes).stream()
            .collect(Collectors.toMap(region -> normalizeRegionCode(region.getRegionCode()), region -> region));
        }

        private String normalizeRegionCode(String regionCode) {
        if (regionCode == null) {
            return null;
        }
        String trimmed = regionCode.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() == 1 ? "0" + trimmed : trimmed;
        }

    @Transactional
    public ASLDto update(Long id, ASLDto dto) {
        ASLEntity entity = aslRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("ASL non trovata: " + id));
        if (dto.getNote() != null) {
            entity.setNote(dto.getNote());
        }
        entity.setReferentsJson(aslMapper.dtoToEntity(dto).getReferentsJson());
        return aslMapper.entityToDto(aslRepository.save(entity));
    }

    @Transactional
    public void deleteAssociation(Long id) {
        log.info("[ASLService] disassociazione ASL id={}", id);
        aslRepository.deleteById(Objects.requireNonNull(id, "ASL id mancante"));
    }

    @Transactional
    public List<ASLDto> importFromSource(List<Long> sourceIds) {
        log.info("[ASLService] importazione ASL da sourceIds={}", sourceIds);
        return sourceIds.stream()
                .filter(Objects::nonNull)
                .map(this::importOneFromTicket)
                .toList();
    }

    /**
     * Importa una singola ASL da QTMTicket e la salva nella tabella locale.
     * Il note locale viene preservato se l'ASL esiste già.
     */
    private ASLDto importOneFromTicket(Long sourceId) {
        log.info("[ASLService] chiamata QTMTicket per import ASL id={}", sourceId);
        try {
            String responseBody = restClient.get()
                    .uri("/asl/{id}", sourceId)
                    .retrieve()
                    .body(String.class);

            if (responseBody == null || responseBody.isBlank()) {
                throw new IllegalArgumentException("ASL non trovata in QTMTicket: " + sourceId);
            }

            JsonNode payload = objectMapper.readTree(responseBody);
            ASLDto dto = objectMapper.treeToValue(payload, ASLDto.class);
            if (dto == null) {
                throw new IllegalArgumentException("ASL non trovata in QTMTicket: " + sourceId);
            }

            dto.setId(sourceId);
            ASLEntity entity = Objects.requireNonNull(aslMapper.dtoToEntity(dto), "Entity ASL non valorizzata");
            JsonNode codiceAziendaNode = payload.has("codiceAzienda") ? payload.get("codiceAzienda") : payload.path("codice_azienda");
            JsonNode codiceRegioneNode = payload.has("codiceRegione") ? payload.get("codiceRegione") : payload.path("codice_regione");
            String codiceAzienda = (codiceAziendaNode == null || codiceAziendaNode.isMissingNode() || codiceAziendaNode.isNull()) ? dto.getCodiceAzienda() : codiceAziendaNode.asText();
            String codiceRegione = (codiceRegioneNode == null || codiceRegioneNode.isMissingNode() || codiceRegioneNode.isNull()) ? null : codiceRegioneNode.asText();
            aslMapper.applyCodes(entity, codiceAzienda, codiceRegione);
            aslRepository.findById(Objects.requireNonNull(sourceId, "Source ASL id mancante"))
                    .ifPresent(existing -> {
                        entity.setNote(existing.getNote());
                        entity.setReferentsJson(existing.getReferentsJson());
                    });
            ASLDto saved = aslMapper.entityToDto(aslRepository.save(entity));
            log.info("[ASLService] importOneFromTicket id={} salvata con codiceAzienda={} codiceRegione={}", sourceId, entity.getCodiceAzienda(), entity.getCodiceRegione());
            return saved;
        } catch (JsonProcessingException ex) {
            log.error("[ASLService] errore parsing JSON importOneFromTicket id={}", sourceId, ex);
            throw mapTicketException(ex, "/asl/" + sourceId);
        } catch (Exception ex) {
            log.error("[ASLService] errore importOneFromTicket id={}", sourceId, ex);
            throw mapTicketException(ex, "/asl/" + sourceId);
        }
    }

    /**
     * Recupera l'elenco completo delle ASL pubblicate da QTMTicket.
     */
    private List<ASLDto> fetchAllAslsFromTicket() {
        log.info("[ASLService] chiamata QTMTicket per fetch ASL lista /asl");
        try {
            ASLDto[] sourceAsls = restClient.get()
                    .uri("/asl")
                    .retrieve()
                    .body(ASLDto[].class);
            int size = sourceAsls == null ? 0 : sourceAsls.length;
            log.info("[ASLService] fetchAllAslsFromTicket restituisce {} record", size);
            return sourceAsls == null ? new ArrayList<>() : Arrays.asList(sourceAsls);
        } catch (Exception ex) {
            log.error("[ASLService] errore fetchAllAslsFromTicket", ex);
            throw mapTicketException(ex, "/asl");
        }
    }

    private ResponseStatusException mapTicketException(Exception exception, String resourcePath) {
        String targetUrl = ticketBaseUrl + resourcePath;
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
        String detail = String.format(
                "Errore durante la chiamata a QTMTicket su %s.",
                targetUrl
        );
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, detail, exception);
    }
}
