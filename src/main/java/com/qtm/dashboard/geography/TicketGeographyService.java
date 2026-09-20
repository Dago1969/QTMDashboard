package com.qtm.dashboard.geography;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.extern.slf4j.Slf4j;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Slf4j
@Service
public class TicketGeographyService {
    private static final TicketRegionListTypeReference REGION_LIST_TYPE = new TicketRegionListTypeReference();
    private static final TicketProvinceListTypeReference PROVINCE_LIST_TYPE = new TicketProvinceListTypeReference();
    private static final TicketCityListTypeReference CITY_LIST_TYPE = new TicketCityListTypeReference();
    private static final String SERVICE_UNAVAILABLE_MESSAGE = "Servizio geografia QTMTicket non disponibile";
    private static final String MISSING_AUTHORIZATION_MESSAGE = "Token non presente per interrogare QTMTicket";

    private final RestClient restClient;
    private final Map<Long, TicketCity> cityCache = new ConcurrentHashMap<>();
    private final Map<Long, TicketProvince> provinceByIdCache = new ConcurrentHashMap<>();
    private final Map<String, TicketRegion> regionCache = new ConcurrentHashMap<>();
    private final Map<String, TicketProvince> provinceCache = new ConcurrentHashMap<>();

    public TicketGeographyService(@Value("${qtm.ticket.base-url:http://localhost:8084/api/ticket}") String ticketBaseUrl) {
        this.restClient = RestClient.builder().baseUrl(deriveTicketApiRootUrl(ticketBaseUrl)).build();
    }

    public Optional<TicketCity> findCityById(Long cityId) {
        if (cityId == null) return Optional.empty();
        try {
            return Optional.ofNullable(cityCache.computeIfAbsent(cityId, id -> {
                try {
                    String body = restClient.get().uri("/cities/{id}", id).retrieve().body(String.class);
                    if (body == null || body.isBlank()) return null;
                    return restClient.get()
                            .uri("/cities/{id}", id)
                            .headers(this::applyForwardedHeaders)
                            .retrieve()
                            .body(TicketCity.class);
                } catch (Exception e) {
                    log.warn("Impossibile caricare city {} da Ticket: {}", id, e.getMessage());
                    return null;
                }
            }));
        } catch (Exception ex) {
            log.warn("Errore nella lookup city {}: {}", cityId, ex.getMessage());
            return Optional.empty();
        }
    }

    public Optional<TicketRegion> findRegionByCode(String regionCode) {
        if (regionCode == null || regionCode.trim().isEmpty()) return Optional.empty();
        String norm = regionCode.trim();
        try {
            return Optional.ofNullable(regionCache.computeIfAbsent(norm, rc -> {
                try {
                    List<TicketRegion> regions = executeListRequest(uriBuilder -> uriBuilder.path("/regions").queryParam("code", rc).build(), REGION_LIST_TYPE);
                    return regions.stream()
                            .filter(Objects::nonNull)
                            .filter(region -> rc.equals(region.getRegionCode()))
                            .findFirst()
                            .orElse(null);
                } catch (Exception e) {
                    log.warn("Impossibile caricare region {} da Ticket: {}", rc, e.getMessage());
                    return null;
                }
            }));
        } catch (Exception ex) {
            log.warn("Errore nella lookup region {}: {}", regionCode, ex.getMessage());
            return Optional.empty();
        }
    }

    public Optional<TicketProvince> findProvinceByCode(String provinceCode) {
        if (provinceCode == null || provinceCode.trim().isEmpty()) return Optional.empty();
        String norm = provinceCode.trim();
        try {
            return Optional.ofNullable(provinceCache.computeIfAbsent(norm, pc -> {
                try {
                    List<TicketProvince> provinces = executeListRequest(uriBuilder -> uriBuilder.path("/provinces").queryParam("code", pc).build(), PROVINCE_LIST_TYPE);
                    return provinces.stream()
                            .filter(Objects::nonNull)
                            .filter(province -> pc.equals(province.getCode()))
                            .findFirst()
                            .orElse(null);
                } catch (Exception e) {
                    log.warn("Impossibile caricare province {} da Ticket: {}", pc, e.getMessage());
                    return null;
                }
            }));
        } catch (Exception ex) {
            log.warn("Errore nella lookup province {}: {}", provinceCode, ex.getMessage());
            return Optional.empty();
        }
    }

    public Optional<TicketProvince> findProvinceById(Long provinceId) {
        if (provinceId == null) return Optional.empty();
        try {
            return Optional.ofNullable(provinceByIdCache.computeIfAbsent(provinceId, id -> {
                try {
                    return restClient.get()
                            .uri("/provinces/{id}", id)
                            .headers(this::applyForwardedHeaders)
                            .retrieve()
                            .body(TicketProvince.class);
                } catch (Exception e) {
                    log.warn("Impossibile caricare province {} da Ticket: {}", id, e.getMessage());
                    return null;
                }
            }));
        } catch (Exception ex) {
            log.warn("Errore nella lookup province {}: {}", provinceId, ex.getMessage());
            return Optional.empty();
        }
    }

    public List<TicketRegion> findRegions() {
        return executeListRequest("/regions", REGION_LIST_TYPE);
    }

    public List<TicketProvince> findProvinces() {
        return executeListRequest("/provinces", PROVINCE_LIST_TYPE);
    }

    public List<TicketProvince> findProvincesByRegionId(Long regionId) {
        return executeListRequest("/provinces/by-region/" + regionId, PROVINCE_LIST_TYPE);
    }

    public List<TicketCity> findCitiesByProvinceId(Long provinceId) {
        return executeListRequest("/cities/by-province/" + provinceId, CITY_LIST_TYPE);
    }

    private <T> List<T> executeListRequest(String uri, ParameterizedTypeReference<List<T>> bodyType) {
        try {
            RestClient.RequestHeadersSpec<?> request = restClient.get().uri(uri).headers(this::applyForwardedHeaders);
            String authorizationHeader = resolveCurrentHeader(HttpHeaders.AUTHORIZATION);
            if (authorizationHeader == null || authorizationHeader.isBlank()) {
                throw new ResponseStatusException(UNAUTHORIZED, MISSING_AUTHORIZATION_MESSAGE);
            }
            List<T> response = request.retrieve().body(bodyType);
            return response == null ? List.of() : response;
        } catch (RestClientResponseException exception) {
            log.error("[TicketGeographyService] Downstream response error uri={} status={} body={}",
                    uri, exception.getStatusCode(), exception.getResponseBodyAsString(), exception);
            throw new ResponseStatusException(exception.getStatusCode(), buildDownstreamMessage(exception), exception);
        } catch (RestClientException exception) {
            log.error("[TicketGeographyService] Downstream connectivity error uri={}", uri, exception);
            throw new ResponseStatusException(BAD_GATEWAY, SERVICE_UNAVAILABLE_MESSAGE, exception);
        }
    }

    private <T> List<T> executeListRequest(java.util.function.Function<org.springframework.web.util.UriBuilder, java.net.URI> uriFunction,
                                           ParameterizedTypeReference<List<T>> bodyType) {
        try {
            RestClient.RequestHeadersSpec<?> request = restClient.get().uri(uriFunction).headers(this::applyForwardedHeaders);
            String authorizationHeader = resolveCurrentHeader(HttpHeaders.AUTHORIZATION);
            if (authorizationHeader == null || authorizationHeader.isBlank()) {
                throw new ResponseStatusException(UNAUTHORIZED, MISSING_AUTHORIZATION_MESSAGE);
            }
            List<T> response = request.retrieve().body(bodyType);
            return response == null ? List.of() : response;
        } catch (RestClientResponseException exception) {
            log.error("[TicketGeographyService] Downstream response error status={} body={}",
                    exception.getStatusCode(), exception.getResponseBodyAsString(), exception);
            throw new ResponseStatusException(exception.getStatusCode(), buildDownstreamMessage(exception), exception);
        } catch (RestClientException exception) {
            log.error("[TicketGeographyService] Downstream connectivity error", exception);
            throw new ResponseStatusException(BAD_GATEWAY, SERVICE_UNAVAILABLE_MESSAGE, exception);
        }
    }

    private void applyForwardedHeaders(HttpHeaders headers) {
        HttpServletRequest currentRequest = resolveCurrentRequest();
        if (currentRequest == null) {
            log.warn("[TicketGeographyService] No current request available, no headers forwarded");
            return;
        }

        copyHeader(currentRequest, headers, HttpHeaders.AUTHORIZATION);
        copyHeader(currentRequest, headers, "X-Selected-Role");
        copyHeader(currentRequest, headers, "X-Selected-Client");
        copyHeader(currentRequest, headers, "X-Selected-Project");
    }

    private void copyHeader(HttpServletRequest request, HttpHeaders headers, String headerName) {
        String value = request.getHeader(headerName);
        if (value != null && !value.isBlank()) {
            headers.set(headerName, value.trim());
        }
    }

    private String buildDownstreamMessage(RestClientResponseException exception) {
        String responseBody = exception.getResponseBodyAsString();
        if (responseBody == null || responseBody.isBlank()) {
            return "Errore restituito da QTMTicket durante il caricamento della geografia";
        }
        return responseBody;
    }

    private String resolveCurrentHeader(String headerName) {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return null;
        }

        HttpServletRequest request = attributes.getRequest();
        return request.getHeader(headerName);
    }

    private HttpServletRequest resolveCurrentRequest() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes == null ? null : attributes.getRequest();
    }

    private static String deriveTicketApiRootUrl(String ticketBaseUrl) {
        String normalizedBaseUrl = Objects.requireNonNull(ticketBaseUrl, "qtm.ticket.base-url mancante").trim();
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

    // Simple DTOs for mapping ticket responses (only required fields)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TicketCity {
        private Long id;
        private String name;
        @JsonAlias("provinceId")
        private Long provinceId;
        private TicketProvince province;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public Long getProvinceId() { return provinceId; }
        public void setProvinceId(Long provinceId) { this.provinceId = provinceId; }
        public TicketProvince getProvince() { return province; }
        public void setProvince(TicketProvince province) { this.province = province; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TicketProvince {
        private Long id;
        private String code;
        private String name;
        private Long regionId;
        private String sigla;
        private TicketRegion region;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public Long getRegionId() { return regionId; }
        public void setRegionId(Long regionId) { this.regionId = regionId; }
        public String getSigla() { return sigla; }
        public void setSigla(String sigla) { this.sigla = sigla; }
        public TicketRegion getRegion() { return region; }
        public void setRegion(TicketRegion region) { this.region = region; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TicketRegion {
        private Long id;
        @JsonAlias("code")
        private String regionCode;
        @JsonAlias("code")
        private String code;
        private String name;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getRegionCode() { return regionCode; }
        public void setRegionCode(String regionCode) { this.regionCode = regionCode; }
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }
}
