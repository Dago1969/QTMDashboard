package com.qtm.dashboard.structuredepartment.controller;

import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentFilterOptionsDto;
import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentSourceDto;
import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentImportRequest;
import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentOverviewDto;
import com.qtm.dashboard.structuredepartment.service.StructureDepartmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controller REST per consultare e gestire le associazioni locali dei reparti struttura.
 */
@Slf4j
@RestController
@RequestMapping("/api/structure-departments")
@RequiredArgsConstructor
public class StructureDepartmentController {

    private final StructureDepartmentService structureDepartmentService;

    @GetMapping("/filter-options")
    public ResponseEntity<StructureDepartmentFilterOptionsDto> getFilterOptions() {
        log.info("[StructureDepartmentController] GET /api/structure-departments/filter-options");
        return ResponseEntity.ok(structureDepartmentService.getFilterOptions());
    }

    @GetMapping("/overview")
    public ResponseEntity<List<StructureDepartmentOverviewDto>> findAllWithImportStatus(
            @RequestParam(required = false) String regionCode,
            @RequestParam(required = false) String aslCode,
            @RequestParam(required = false) String structureCode
    ) {
        log.info("[StructureDepartmentController] GET /api/structure-departments/overview region={} asl={} structure={}", regionCode, aslCode, structureCode);
        List<StructureDepartmentOverviewDto> result = structureDepartmentService.findAllWithImportStatus(regionCode, aslCode, structureCode);
        log.info("[StructureDepartmentController] GET /api/structure-departments/overview returned {} records", result.size());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/by-structure")
    public ResponseEntity<List<StructureDepartmentSourceDto>> listByStructureCode(
            @RequestParam String codiceStruttura
    ) {
        log.info("[StructureDepartmentController] GET /api/structure-departments/by-structure codiceStruttura={}", codiceStruttura);
        List<StructureDepartmentSourceDto> result = structureDepartmentService.listByStructureCode(codiceStruttura);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/import")
    public ResponseEntity<Void> importAssociation(@RequestBody StructureDepartmentImportRequest request) {
        log.info("[StructureDepartmentController] POST /api/structure-departments/import struttura={} disciplina={}",
                request != null ? request.getCodiceStruttura() : null,
                request != null ? request.getCodiceDisciplina() : null);
        structureDepartmentService.importAssociation(request);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAssociation(
            @RequestParam String codiceStruttura,
            @RequestParam String codiceDisciplina
    ) {
        log.info("[StructureDepartmentController] DELETE /api/structure-departments struttura={} disciplina={}", codiceStruttura, codiceDisciplina);
        structureDepartmentService.deleteAssociation(codiceStruttura, codiceDisciplina);
        return ResponseEntity.noContent().build();
    }
}