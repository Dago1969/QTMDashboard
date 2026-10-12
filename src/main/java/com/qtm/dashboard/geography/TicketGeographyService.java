package com.qtm.dashboard.geography;

import com.qtm.commonlib.dto.CityDto;
import com.qtm.commonlib.dto.ProvinceDto;
import com.qtm.commonlib.dto.RegionDto;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Slf4j
@Service
public class TicketGeographyService {
    private static final ParameterizedTypeReference<List<RegionDto>> REGION_LIST = new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<ProvinceDto>> PROVINCE_LIST = new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<CityDto>> CITY_LIST = new ParameterizedTypeReference<>() {};

    private final RestClient restClient;

    public TicketGeographyService(
            @Value("${services.qtm-geography-service.url:http://localhost:8088/api/geography}") String geographyServiceUrl) {
        this.restClient = RestClient.builder().baseUrl(geographyServiceUrl).build();
    }

    public List<RegionDto> findRegions() { return executeListRequest("/regions", REGION_LIST); }
    public List<ProvinceDto> findProvinces() { return executeListRequest("/provinces", PROVINCE_LIST); }
    public List<ProvinceDto> findProvincesByRegionId(Long regionId) {
        return executeListRequest("/provinces/by-region/" + regionId, PROVINCE_LIST);
    }
    public Optional<ProvinceDto> findProvinceById(Long provinceId) {
        return findById("/provinces/" + provinceId, ProvinceDto.class);
    }
    public List<CityDto> findCitiesByProvinceId(Long provinceId) {
        return executeListRequest("/cities/by-province/" + provinceId, CITY_LIST);
    }
    public Optional<RegionDto> findRegionByCode(String regionCode) {
        return findRegions().stream().filter(region -> regionCode != null
                && regionCode.trim().equals(region.getCode())).findFirst();
    }
    private <T> Optional<T> findById(String uri, Class<T> responseType) {
        try {
            return Optional.ofNullable(restClient.get().uri(uri).headers(this::applyForwardedHeaders)
                    .retrieve().body(responseType));
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == 404) return Optional.empty();
            throw downstreamException(exception);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(BAD_GATEWAY, "Servizio geografia non disponibile", exception);
        }
    }

    private <T> List<T> executeListRequest(String uri, ParameterizedTypeReference<List<T>> responseType) {
        try {
            requireAuthorization();
            List<T> response = restClient.get().uri(uri).headers(this::applyForwardedHeaders)
                    .retrieve().body(responseType);
            return response == null ? List.of() : response;
        } catch (RestClientResponseException exception) {
            throw downstreamException(exception);
        } catch (RestClientException exception) {
            log.error("Errore di collegamento al servizio geografia, uri={}", uri, exception);
            throw new ResponseStatusException(BAD_GATEWAY, "Servizio geografia non disponibile", exception);
        }
    }

    private void requireAuthorization() {
        HttpServletRequest request = resolveCurrentRequest();
        if (request == null || request.getHeader(HttpHeaders.AUTHORIZATION) == null) {
            throw new ResponseStatusException(UNAUTHORIZED, "Token non presente per interrogare il servizio geografia");
        }
    }

    private void applyForwardedHeaders(HttpHeaders headers) {
        HttpServletRequest request = resolveCurrentRequest();
        if (request == null) return;
        copyHeader(request, headers, HttpHeaders.AUTHORIZATION);
        copyHeader(request, headers, "X-Selected-Role");
        copyHeader(request, headers, "X-Selected-Client");
        copyHeader(request, headers, "X-Selected-Project");
    }

    private void copyHeader(HttpServletRequest request, HttpHeaders headers, String name) {
        String value = request.getHeader(name);
        if (value != null && !value.isBlank()) headers.set(name, value.trim());
    }

    private HttpServletRequest resolveCurrentRequest() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes == null ? null : attributes.getRequest();
    }

    private ResponseStatusException downstreamException(RestClientResponseException exception) {
        String message = exception.getResponseBodyAsString();
        return new ResponseStatusException(exception.getStatusCode(),
                message == null || message.isBlank() ? "Errore restituito dal servizio geografia" : message, exception);
    }
}
