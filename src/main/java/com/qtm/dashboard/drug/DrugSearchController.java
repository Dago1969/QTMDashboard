package com.qtm.dashboard.drug;

import com.qtm.commonlib.dto.FarmacoDto;
import com.qtm.dashboard.medicine.service.MedicineService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Proxy QTMDashboard per esporre la ricerca farmaci centralizzata da QTMTicket al frontend.
 */
@RestController
@RequestMapping("/api/v1/drugs")
@RequiredArgsConstructor
public class DrugSearchController {

    private final MedicineService medicineService;

    @GetMapping("/search")
    public List<FarmacoDto> search(@RequestParam String query) {
        return medicineService.searchVisibleForTenants(query);
    }
}