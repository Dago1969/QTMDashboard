package com.qtm.dashboard.hospital.service;

import com.qtm.commonlib.dto.HospitalDto;
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
import java.util.stream.Collectors;

@Slf4j
@Service
public class HospitalService {

    private final HospitalRepository hospitalRepository;
    private final HospitalMapper hospitalMapper;
    private final RestClient restClient;
    private final String ticketBaseUrl;

    @Autowired
    public HospitalService(
            HospitalRepository hospitalRepository,
            HospitalMapper hospitalMapper,
            @Value("${app.ticket.base-url:http://localhost:8084/api/ticket}") String ticketBaseUrl
    ) {
        this(hospitalRepository, hospitalMapper, RestClient.builder().baseUrl(ticketBaseUrl).build(), ticketBaseUrl);
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
        this.ticketBaseUrl = Objects.requireNonNull(ticketBaseUrl, "app.ticket.base-url mancante");
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
    public List<HospitalDto> importFromSource(List<Long> sourceIds) {
        log.info("[HospitalService] importazione ospedali da sourceIds={}", sourceIds);
        return sourceIds.stream()
                .filter(Objects::nonNull)
                .map(this::importOneFromTicket)
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
            HospitalEntity entity = Objects.requireNonNull(hospitalMapper.dtoToEntity(dto), "Entity ospedale non valorizzata");
            hospitalRepository.findById(Objects.requireNonNull(sourceId, "Source hospital id mancante"))
                    .ifPresent(existing -> entity.setNote(existing.getNote()));
            HospitalDto saved = hospitalMapper.entityToDto(hospitalRepository.save(entity));
            log.info("[HospitalService] importOneFromTicket id={} salvata", sourceId);
            return saved;
        } catch (Exception ex) {
            log.error("[HospitalService] errore importOneFromTicket id={}", sourceId, ex);
            throw mapTicketException(ex, "/hospitals/" + sourceId);
        }
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
        String detail = String.format("Errore durante la chiamata a QTMTicket su %s.", targetUrl);
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, detail, exception);
    }
}
