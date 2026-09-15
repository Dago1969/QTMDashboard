package com.qtm.dashboard.service;

import com.qtm.dashboard.domain.Region;
import com.qtm.dashboard.dto.RegionDto;
import com.qtm.dashboard.mapper.RegionMapper;
import com.qtm.dashboard.repository.RegionRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

/**
 * Service per Region. Orchestration tra repository e mapper.
 */
@Service
public class RegionService {
    private final RegionRepository regionRepository;
    private final RegionMapper regionMapper;

    private final RestClient restClient;
    private final String ticketBaseUrl;

    @Autowired
    public RegionService(RegionRepository regionRepository, RegionMapper regionMapper,
                         @Value("${qtm.ticket.base-url:http://localhost:8084/api/ticket}") String ticketBaseUrl) {
        this(regionRepository, regionMapper, RestClient.builder().baseUrl(ticketBaseUrl).build(), ticketBaseUrl);
    }

    RegionService(RegionRepository regionRepository, RegionMapper regionMapper, RestClient restClient, String ticketBaseUrl) {
        this.regionRepository = regionRepository;
        this.regionMapper = regionMapper;
        this.restClient = restClient;
        this.ticketBaseUrl = Objects.requireNonNull(ticketBaseUrl, "app.ticket.base-url mancante");
    }

    public List<RegionDto> findAll() {
        try {
            RegionDto[] dto = restClient.get()
                    .uri("/api/regions")
                    .retrieve()
                    .body(RegionDto[].class);
            return dto == null ? List.of() : Arrays.asList(dto);
        } catch (Exception ex) {
            throw mapTicketException(ex, "/api/regions");
        }
    }

    public RegionDto findById(Long id) {
        // Keep local behaviour for single entity retrieval
        return regionRepository.findById(id).map(regionMapper::toDto).orElse(null);
    }

    public RegionDto save(RegionDto dto) {
        Region entity = regionMapper.toEntity(dto);
        return regionMapper.toDto(regionRepository.save(entity));
    }

    public void delete(Long id) {
        regionRepository.deleteById(id);
    }

    /**
     * Restituisce tutte le regioni di un country specifico.
     * @param countryId id del country
     * @return lista di regioni DTO
     */
    public List<RegionDto> findByCountryId(Long countryId) {
        try {
                RegionDto[] dto = restClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/api/regions").queryParam("countryId", countryId).build())
                    .retrieve()
                    .body(RegionDto[].class);
            return dto == null ? List.of() : Arrays.asList(dto);
        } catch (Exception ex) {
            // fallback to local DB if ticket call fails
            return regionRepository.findByCountryId(countryId).stream()
                    .map(regionMapper::toDto)
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
                    "QTMTicket non raggiungibile su %s. Verifica che il servizio sia avviato e che app.ticket.base-url sia corretto.",
                    targetUrl
            );
            return new ResponseStatusException(HttpStatus.BAD_GATEWAY, detail, exception);
        }
        String detail = String.format("Errore durante la chiamata a QTMTicket su %s.", targetUrl);
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, detail, exception);
    }
}
