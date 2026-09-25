package com.qtm.dashboard.hospital.service;

import com.qtm.commonlib.dto.HospitalDto;
import com.qtm.dashboard.hospital.dto.HospitalImportRequest;
import com.qtm.dashboard.hospital.dto.HospitalOverviewDto;
import com.qtm.dashboard.hospital.entity.HospitalEntity;
import com.qtm.dashboard.hospital.mapper.HospitalMapper;
import com.qtm.dashboard.hospital.repository.HospitalRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
public class HospitalService {

    private final HospitalRepository hospitalRepository;
    private final HospitalMapper hospitalMapper;
    private final RestClient restClient;
    private final String ticketBaseUrl;
    private final String ticketApiRootUrl;

    @Autowired
    public HospitalService(
            HospitalRepository hospitalRepository,
            HospitalMapper hospitalMapper,
                @Value("${qtm.ticket.base-url:http://localhost:8084/api/ticket}") String ticketBaseUrl
    ) {
        this(
            hospitalRepository,
            hospitalMapper,
            RestClient.builder().baseUrl(deriveTicketApiRootUrl(ticketBaseUrl)).build(),
            ticketBaseUrl
        );
    }

    HospitalService(
            HospitalRepository hospitalRepository,
            HospitalMapper hospitalMapper,
            RestClient restClient,
            String ticketBaseUrl
    ) {
        this.hospitalRepository = hospitalRepository;
        this.hospitalMapper = hospitalMapper;
        this.restClient = restClient;
        this.ticketBaseUrl = Objects.requireNonNull(ticketBaseUrl, "qtm.ticket.base-url mancante");
        this.ticketApiRootUrl = deriveTicketApiRootUrl(ticketBaseUrl);
    }

    @Transactional(readOnly = true)
    public HospitalDto findById(Long id) {
        log.info("[HospitalService] ricerca ospedale id={}", id);
        Objects.requireNonNull(id, "Hospital ID non può essere null");

        // 1. Cerca prima nel database locale
        Optional<HospitalEntity> localEntity = hospitalRepository.findById(id);
        if (localEntity.isPresent()) {
            return hospitalMapper.entityToDto(localEntity.get());
        }

        // 2. Se non è salvato localmente, tenta il recupero dal servizio sorgente (QTMTicket)
        try {
            HospitalDto dto = restClient.get()
                    .uri("/hospitals/{id}", id)
                    .retrieve()
                    .body(HospitalDto.class);

            if (dto != null) {
                dto.setId(id);
                return dto;
            }
        } catch (Exception ex) {
            log.warn("[HospitalService] Impossibile recuperare ospedale id={} da QTMTicket: {}", id, ex.getMessage());
        }

        return null;
    }
    
    @Transactional(readOnly = true)
    public List<HospitalOverviewDto> findAllWithImportStatus() {
        log.info("[HospitalService] richiesta overview ospedali con stato associazione");
        List<HospitalDto> sourceHospitals = fetchAllHospitalsFromTicket();
        Map<Long, HospitalEntity> localHospitalMap = hospitalRepository.findAll().stream()
                .collect(Collectors.toMap(HospitalEntity::getId, entity -> entity));

        log.info("[HospitalService] sourceHospitals={} localHospitalMap={}", sourceHospitals.size(), localHospitalMap.size());

        return sourceHospitals.stream()
                .map(hospital -> {
                    HospitalEntity localEntity = localHospitalMap.get(hospital.getId());
                    return HospitalOverviewDto.builder()
                            .id(hospital.getId())
                            .anno(hospital.getAnno())
                            .codiceRegione(hospital.getCodiceRegione())
                            .regione(hospital.getRegione())
                            .codiceAsl(hospital.getCodiceAsl())
                            .asl(hospital.getAsl())
                            .codiceStruttura(hospital.getCodiceStruttura())
                            .struttura(hospital.getStruttura())
                            .comune(hospital.getComune())
                            .siglaProvincia(hospital.getSiglaProvincia())
                            .indirizzo(hospital.getIndirizzo())
                            .hospitalTypeId(hospital.getHospitalTypeId())
                            .tipoStruttura(hospital.getTipoStruttura())
                            .aslId(hospital.getAslId())
                            .imported(localEntity != null)
                            .note(localEntity != null ? localEntity.getNote() : null)
                            .build();
                })
                .toList();
    }

    @Transactional
    public void deleteAssociation(Long id) {
        log.info("[HospitalService] disassociazione ospedale id={}", id);
        hospitalRepository.deleteById(Objects.requireNonNull(id, "Hospital id mancante"));
    }

    @Transactional
        public List<HospitalDto> importFromSource(HospitalImportRequest request) {
        List<Long> sourceIds = request != null && request.getSourceIds() != null ? request.getSourceIds() : List.of();
        List<HospitalDto> providedHospitals = request != null && request.getHospitals() != null ? request.getHospitals() : List.of();

        log.info("[HospitalService] importazione ospedali da sourceIds={} providedHospitals={}", sourceIds, providedHospitals.size());

        Map<Long, HospitalDto> providedHospitalMap = providedHospitals.stream()
            .filter(Objects::nonNull)
            .filter(hospital -> hospital.getId() != null)
            .collect(Collectors.toMap(HospitalDto::getId, hospital -> hospital, (left, right) -> left));

        List<HospitalDto> importedFromIds = sourceIds.stream()
            .filter(Objects::nonNull)
            .map(sourceId -> Optional.ofNullable(providedHospitalMap.get(sourceId))
                .map(this::saveImportedHospital)
                .orElseGet(() -> importOneFromTicket(sourceId)))
            .toList();

        List<HospitalDto> importedOnlyFromPayload = providedHospitals.stream()
            .filter(Objects::nonNull)
            .filter(hospital -> hospital.getId() != null)
            .filter(hospital -> !sourceIds.contains(hospital.getId()))
            .map(this::saveImportedHospital)
            .toList();

        return java.util.stream.Stream.concat(importedFromIds.stream(), importedOnlyFromPayload.stream())
            .toList();
    }

    private HospitalDto importOneFromTicket(Long sourceId) {
        log.info("[HospitalService] chiamata QTMTicket per import ospedale id={}", sourceId);
        try {
            HospitalDto dto = restClient.get()
                    .uri("/hospitals/{id}", sourceId)
                    .retrieve()
                    .body(HospitalDto.class);

            if (dto == null) {
                throw new IllegalArgumentException("Ospedale non trovato in QTMTicket: " + sourceId);
            }

            dto.setId(sourceId);
            HospitalDto saved = saveImportedHospital(dto);
            log.info("[HospitalService] importOneFromTicket id={} salvata", sourceId);
            return saved;
        } catch (Exception ex) {
            log.error("[HospitalService] errore importOneFromTicket id={}", sourceId, ex);
            throw mapTicketException(ex, "/hospitals/" + sourceId);
        }
    }

    private HospitalDto saveImportedHospital(HospitalDto hospitalDto) {
        HospitalEntity entity = Objects.requireNonNull(hospitalMapper.dtoToEntity(hospitalDto), "Entity ospedale non valorizzata");
        hospitalRepository.findById(Objects.requireNonNull(hospitalDto.getId(), "Source hospital id mancante"))
                .ifPresent(existing -> entity.setNote(existing.getNote()));
        return hospitalMapper.entityToDto(hospitalRepository.save(entity));
    }

    private List<HospitalDto> fetchAllHospitalsFromTicket() {
        log.info("[HospitalService] chiamata QTMTicket per fetch ospedali lista /hospitals");
        try {
            HospitalDto[] sourceHospitals = restClient.get()
                    .uri("/hospitals")
                    .retrieve()
                    .body(HospitalDto[].class);
            List<HospitalDto> list = sourceHospitals == null ? new ArrayList<>() : Arrays.asList(sourceHospitals);
            log.info("[HospitalService] fetchAllHospitalsFromTicket restituisce {} record", list.size());
            return list;
        } catch (Exception ex) {
            log.error("[HospitalService] errore fetchAllHospitalsFromTicket", ex);
            throw mapTicketException(ex, "/hospitals");
        }
    }

    private ResponseStatusException mapTicketException(Exception exception, String resourcePath) {
        String targetUrl = ticketApiRootUrl + resourcePath;
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
                    "QTMTicket non raggiungibile su %s. Verifica che il servizio sia avviato e che qtm.ticket.base-url sia corretto.",
                    targetUrl
            );
            return new ResponseStatusException(HttpStatus.BAD_GATEWAY, detail, exception);
        }
        String detail = String.format("Errore durante la chiamata a QTMTicket su %s.", targetUrl);
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, detail, exception);
    }

    private static String deriveTicketApiRootUrl(String ticketBaseUrl) {
        String normalizedBaseUrl = Objects.requireNonNull(ticketBaseUrl, "qtm.ticket.base-url mancante").trim();
        if (normalizedBaseUrl.endsWith("/")) {
            normalizedBaseUrl = normalizedBaseUrl.substring(0, normalizedBaseUrl.length() - 1);
        }
        if (normalizedBaseUrl.endsWith("/api")) {
            return normalizedBaseUrl;
        }
        if (normalizedBaseUrl.endsWith("/api/ticket/api")) {
            return normalizedBaseUrl;
        }
        if (normalizedBaseUrl.endsWith("/api/ticket")) {
            return normalizedBaseUrl + "/api";
        }
        return normalizedBaseUrl + "/api";
    }
}
