package com.qtm.dashboard.medicine.controller;

import com.qtm.commonlib.dto.MedicineDto;
import com.qtm.dashboard.medicine.dto.MedicineImportResultDto;
import com.qtm.dashboard.medicine.dto.MedicineVisibilityRequestDto;
import com.qtm.dashboard.medicine.service.MedicineSearchCriteria;
import com.qtm.dashboard.medicine.service.MedicineService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * API compatibile per la gestione del catalogo farmaci persistito in QTMTicket.
 */
@RestController
@RequestMapping("/api/medicines")
@RequiredArgsConstructor
public class MedicineController {

    private final MedicineService medicineService;

    @GetMapping
    public ResponseEntity<List<MedicineDto>> search(
            @RequestParam(required = false) String codiceAic,
            @RequestParam(required = false) String codFarmaco,
            @RequestParam(required = false) String codConfezione,
            @RequestParam(required = false) String denominazione,
            @RequestParam(required = false) String descrizione,
            @RequestParam(required = false) String codiceAtc,
            @RequestParam(required = false) String ragioneSociale,
            @RequestParam(required = false) String statoAmministrativo
    ) {
        MedicineSearchCriteria criteria = new MedicineSearchCriteria(
                codiceAic,
                codFarmaco,
                codConfezione,
                denominazione,
                descrizione,
                codiceAtc,
                ragioneSociale,
                statoAmministrativo
        );
        return ResponseEntity.ok(medicineService.search(criteria));
    }

    @GetMapping("/lookup")
    public ResponseEntity<List<MedicineDto>> lookup(@RequestParam(required = false) String query) {
        return ResponseEntity.ok(medicineService.lookup(query));
    }

    @GetMapping("/associations")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN_QTM')")
    public ResponseEntity<Page<MedicineDto>> searchAssociations(
            @RequestParam(required = false) String codiceAic,
            @RequestParam(required = false) String codFarmaco,
            @RequestParam(required = false) String codConfezione,
            @RequestParam(required = false) String denominazione,
            @RequestParam(required = false) String descrizione,
            @RequestParam(required = false) String codiceAtc,
            @RequestParam(required = false) String ragioneSociale,
            @RequestParam(required = false) String statoAmministrativo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        MedicineSearchCriteria criteria = new MedicineSearchCriteria(codiceAic, codFarmaco, codConfezione,
            denominazione, descrizione, codiceAtc, ragioneSociale, statoAmministrativo);
        return ResponseEntity.ok(medicineService.searchAssociations(criteria, page, size));
    }

    @PutMapping("/{id}/tenant-visibility")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN_QTM')")
    public ResponseEntity<MedicineDto> updateTenantVisibility(
            @PathVariable Long id,
            @RequestBody MedicineVisibilityRequestDto request
    ) {
        return ResponseEntity.ok(medicineService.updateTenantVisibility(id, request.visibleForTenants()));
    }

    @PostMapping("/import/aifa")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN_QTM')")
    public ResponseEntity<MedicineImportResultDto> importAifaCatalog() {
        return ResponseEntity.ok(medicineService.importFromAifa());
    }

    @GetMapping("/codice-aic/{codiceAic}")
    public ResponseEntity<MedicineDto> findByCodiceAic(@PathVariable String codiceAic) {
        return ResponseEntity.ok(medicineService.findByCodiceAic(codiceAic));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MedicineDto> findById(@PathVariable Long id) {
        return ResponseEntity.ok(medicineService.findById(id));
    }

    @PostMapping
    public ResponseEntity<MedicineDto> create(@Valid @RequestBody MedicineDto medicineDto) {
        return ResponseEntity.ok(medicineService.create(medicineDto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MedicineDto> update(@PathVariable Long id, @Valid @RequestBody MedicineDto medicineDto) {
        return ResponseEntity.ok(medicineService.update(id, medicineDto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        medicineService.delete(id);
        return ResponseEntity.noContent().build();
    }
}