package com.qtm.dashboard.geography;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Espone a QTMDashboard le anagrafiche geografiche di QTMTicket tramite proxy backend.
 */
@RestController
@RequestMapping("/api/geography")
@RequiredArgsConstructor
@Slf4j
public class TicketGeographyController {

    private final TicketGeographyService ticketGeographyService;

    @GetMapping("/regions")
    public List<TicketGeographyService.TicketRegion> findRegions() {
        log.info("[TicketGeographyController] GET /api/geography/regions");
        return ticketGeographyService.findRegions();
    }

    @GetMapping("/provinces")
    public List<TicketGeographyService.TicketProvince> findProvinces() {
        log.info("[TicketGeographyController] GET /api/geography/provinces");
        return ticketGeographyService.findProvinces();
    }

    @GetMapping("/provinces/{id}")
    public TicketGeographyService.TicketProvince findProvinceById(@PathVariable Long id) {
        log.info("[TicketGeographyController] GET /api/geography/provinces/{}", id);
        return ticketGeographyService.findProvinceById(id)
                .orElse(null);
    }

    @GetMapping("/provinces/by-region/{regionId}")
    public List<TicketGeographyService.TicketProvince> findProvincesByRegionId(@PathVariable Long regionId) {
        log.info("[TicketGeographyController] GET /api/geography/provinces/by-region/{}", regionId);
        return ticketGeographyService.findProvincesByRegionId(regionId);
    }

    @GetMapping("/cities/by-province/{provinceId}")
    public List<TicketGeographyService.TicketCity> findCitiesByProvinceId(@PathVariable Long provinceId) {
        log.info("[TicketGeographyController] GET /api/geography/cities/by-province/{}", provinceId);
        return ticketGeographyService.findCitiesByProvinceId(provinceId);
    }
}