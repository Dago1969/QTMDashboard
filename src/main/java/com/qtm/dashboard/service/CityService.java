package com.qtm.dashboard.service;

import com.qtm.dashboard.domain.City;
import com.qtm.dashboard.dto.CityDto;
import com.qtm.dashboard.dto.GeographicOptionDto;
import com.qtm.dashboard.mapper.CityMapper;
import com.qtm.dashboard.repository.CityRepository;
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
 * Service per City. Orchestration tra repository e mapper.
 */
@Service
public class CityService {
    private final CityRepository cityRepository;
    private final CityMapper cityMapper;
    private final RestClient restClient;
    private final String ticketBaseUrl;

    @Autowired
    public CityService(
            CityRepository cityRepository,
            CityMapper cityMapper,
            @Value("${qtm.ticket.base-url:http://localhost:8084/api/ticket}") String ticketBaseUrl
    ) {
        this(cityRepository, cityMapper, RestClient.builder().baseUrl(ticketBaseUrl).build(), ticketBaseUrl);
    }

    CityService(
            CityRepository cityRepository,
            CityMapper cityMapper,
            RestClient restClient,
            String ticketBaseUrl
    ) {
        this.cityRepository = cityRepository;
        this.cityMapper = cityMapper;
        this.restClient = restClient;
        this.ticketBaseUrl = Objects.requireNonNull(ticketBaseUrl, "qtm.ticket.base-url mancante");
    }

    public List<CityDto> findAll() {
        try {
            CityDto[] dto = restClient.get()
                    .uri("/api/cities")
                    .retrieve()
                    .body(CityDto[].class);
            return dto == null ? List.of() : List.of(dto);
        } catch (Exception ex) {
            throw mapTicketException(ex, "/api/cities");
        }
    }
    public CityDto findById(Long id) {
        return cityRepository.findById(id).map(cityMapper::toDto).orElse(null);
    }
    public CityDto save(CityDto dto) {
        City entity = cityMapper.toEntity(dto);
        return cityMapper.toDto(cityRepository.save(entity));
    }
    public void delete(Long id) {
        cityRepository.deleteById(id);
    }

    /**
     * Restituisce tutte le città di una provincia specifica.
     * @param provinceId id della provincia
     * @return lista di città DTO
     */
    public List<CityDto> findByProvinceId(Long provinceId) {
        try {
            CityDto[] dto = restClient.get()
                    .uri("/api/cities/by-province/{provinceId}", provinceId)
                    .retrieve()
                    .body(CityDto[].class);
            return dto == null ? List.of() : List.of(dto);
        } catch (Exception ex) {
            return cityRepository.findByProvinceId(provinceId).stream()
                    .map(cityMapper::toDto)
                    .toList();
        }
    }

    public List<GeographicOptionDto> findOptionsByProvinceId(Long provinceId) {
        return findByProvinceId(provinceId).stream()
                .map(city -> new GeographicOptionDto(city.getId(), city.getName()))
                .toList();
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
