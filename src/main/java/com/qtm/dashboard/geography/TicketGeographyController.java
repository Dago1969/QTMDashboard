package com.qtm.dashboard.geography;

import com.qtm.commonlib.dto.CityDto;
import com.qtm.commonlib.dto.ProvinceDto;
import com.qtm.commonlib.dto.RegionDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Espone a QTMDashboard le anagrafiche geografiche fornite dal servizio dedicato.
 */
@RestController
@RequestMapping("/api/geography")
@RequiredArgsConstructor
@Slf4j
public class TicketGeographyController {

    private final TicketGeographyService ticketGeographyService;

    @GetMapping("/regions")
    public List<RegionDto> findRegions() {
        log.info("[TicketGeographyController] GET /api/geography/regions");
        return ticketGeographyService.findRegions();
    }

    @GetMapping("/provinces")
    public List<ProvinceDto> findProvinces() {
        log.info("[TicketGeographyController] GET /api/geography/provinces");
        return ticketGeographyService.findProvinces();
    }

    @GetMapping("/provinces/{id}")
    public ProvinceDto findProvinceById(@PathVariable Long id) {
        log.info("[TicketGeographyController] GET /api/geography/provinces/{}", id);
        return ticketGeographyService.findProvinceById(id)
                .orElse(null);
    }

    @GetMapping("/provinces/by-region/{regionId}")
    public List<ProvinceDto> findProvincesByRegionId(@PathVariable Long regionId) {
        log.info("[TicketGeographyController] GET /api/geography/provinces/by-region/{}", regionId);
        return ticketGeographyService.findProvincesByRegionId(regionId);
    }

    @GetMapping("/cities/by-province/{provinceId}")
    public List<CityDto> findCitiesByProvinceId(@PathVariable Long provinceId) {
        log.info("[TicketGeographyController] GET /api/geography/cities/by-province/{}", provinceId);
        return ticketGeographyService.findCitiesByProvinceId(provinceId);
    }
}