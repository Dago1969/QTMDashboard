package com.qtm.dashboard.service;

import com.qtm.dashboard.domain.Province;
import com.qtm.dashboard.dto.ProvinceDto;
import com.qtm.dashboard.mapper.ProvinceMapper;
import com.qtm.dashboard.repository.ProvinceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;

/**
 * Service per Province. Orchestration tra repository e mapper.
 */
@Service
public class ProvinceService {
    private final ProvinceRepository provinceRepository;
    private final ProvinceMapper provinceMapper;
    private final RestClient restClient;
    private final String ticketBaseUrl;

    @Autowired
    public ProvinceService(
            ProvinceRepository provinceRepository,
            ProvinceMapper provinceMapper,
            @Value("${qtm.ticket.base-url:http://localhost:8084/api/ticket}") String ticketBaseUrl
    ) {
        this(provinceRepository, provinceMapper, RestClient.builder().baseUrl(ticketBaseUrl).build(), ticketBaseUrl);
    }

    ProvinceService(
            ProvinceRepository provinceRepository,
            ProvinceMapper provinceMapper,
            RestClient restClient,
            String ticketBaseUrl
    ) {
        this.provinceRepository = provinceRepository;
        this.provinceMapper = provinceMapper;
        this.restClient = restClient;
        this.ticketBaseUrl = Objects.requireNonNull(ticketBaseUrl, "qtm.ticket.base-url mancante");
    }

    public List<ProvinceDto> findAll() {
        try {
            ProvinceDto[] dto = restClient.get()
                    .uri("/api/provinces")
                    .retrieve()
                    .body(ProvinceDto[].class);
            return dto == null ? List.of() : List.of(dto);
        } catch (Exception ex) {
            throw mapTicketException(ex, "/api/provinces");
        }
    }
    public ProvinceDto findById(Long id) {
        return provinceRepository.findById(id).map(provinceMapper::toDto).orElse(null);
    }
    public ProvinceDto save(ProvinceDto dto) {
        Province entity = provinceMapper.toEntity(dto);
        return provinceMapper.toDto(provinceRepository.save(entity));
    }
    public void delete(Long id) {
        provinceRepository.deleteById(id);
    }

    /**
     * Restituisce tutte le province di una regione specifica.
     * @param regionId id della regione
     * @return lista di province DTO
     */
    public List<ProvinceDto> findByRegionId(Long regionId) {
        try {
            ProvinceDto[] dto = restClient.get()
                    .uri("/api/provinces/by-region/{regionId}", regionId)
                    .retrieve()
                    .body(ProvinceDto[].class);
            return dto == null ? List.of() : List.of(dto);
        } catch (Exception ex) {
            return provinceRepository.findByRegionId(regionId).stream()
                    .map(provinceMapper::toDto)
                    .toList();
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
                    "QTMTicket non raggiungibile su %s. Verifica che il servizio sia avviato e che qtm.ticket.base-url sia corretto.",
                    targetUrl
            );
            return new ResponseStatusException(HttpStatus.BAD_GATEWAY, detail, exception);
        }
        String detail = String.format("Errore durante la chiamata a QTMTicket su %s.", targetUrl);
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, detail, exception);
    }
}
