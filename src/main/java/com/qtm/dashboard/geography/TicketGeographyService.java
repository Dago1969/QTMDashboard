package com.qtm.dashboard.geography;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class TicketGeographyService {
    private final RestClient restClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<Long, TicketCity> cityCache = new ConcurrentHashMap<>();
    private final Map<String, TicketRegion> regionCache = new ConcurrentHashMap<>();
    private final Map<String, TicketProvince> provinceCache = new ConcurrentHashMap<>();

    public TicketGeographyService(@Value("${qtm.ticket.base-url:http://localhost:8084/api/ticket}") String ticketBaseUrl) {
        this.restClient = RestClient.builder().baseUrl(ticketBaseUrl).build();
    }

    public Optional<TicketCity> findCityById(Long cityId) {
        if (cityId == null) return Optional.empty();
        try {
            return Optional.ofNullable(cityCache.computeIfAbsent(cityId, id -> {
                try {
                    String body = restClient.get().uri("/cities/{id}", id).retrieve().body(String.class);
                    if (body == null || body.isBlank()) return null;
                    return objectMapper.readValue(body, TicketCity.class);
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
                    String body = restClient.get().uri(uri -> uri.path("/regions").queryParam("code", rc).build()).retrieve().body(String.class);
                    if (body == null || body.isBlank()) return null;
                    return objectMapper.readValue(body, TicketRegion.class);
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
                    String body = restClient.get().uri(uri -> uri.path("/provinces").queryParam("code", pc).build()).retrieve().body(String.class);
                    if (body == null || body.isBlank()) return null;
                    return objectMapper.readValue(body, TicketProvince.class);
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

    // Simple DTOs for mapping ticket responses (only required fields)
    public static class TicketCity {
        private Long id;
        private String name;
        private TicketProvince province;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public TicketProvince getProvince() { return province; }
        public void setProvince(TicketProvince province) { this.province = province; }
    }

    public static class TicketProvince {
        private Long id;
        private String code;
        private String name;
        private TicketRegion region;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public TicketRegion getRegion() { return region; }
        public void setRegion(TicketRegion region) { this.region = region; }
    }

    public static class TicketRegion {
        private Long id;
        private String regionCode;
        private String name;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getRegionCode() { return regionCode; }
        public void setRegionCode(String regionCode) { this.regionCode = regionCode; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }
}
