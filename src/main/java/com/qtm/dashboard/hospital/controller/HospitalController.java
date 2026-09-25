package com.qtm.dashboard.hospital.controller;

import com.qtm.commonlib.dto.HospitalDto;
import com.qtm.dashboard.hospital.dto.HospitalImportRequest;
import com.qtm.dashboard.hospital.dto.HospitalOverviewDto;
import com.qtm.dashboard.hospital.service.HospitalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping({"/api/hospital", "/hospital"})
@RequiredArgsConstructor
public class HospitalController {

    private final HospitalService hospitalService;

    @GetMapping("/overview")
    public ResponseEntity<List<HospitalOverviewDto>> findAllWithImportStatus() {
        log.info("[HospitalController] GET /api/hospital/overview");
        List<HospitalOverviewDto> result = hospitalService.findAllWithImportStatus();
        log.info("[HospitalController] GET /api/hospital/overview returned {} records", result.size());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/import")
    public ResponseEntity<List<HospitalDto>> importFromSource(@RequestBody HospitalImportRequest request) {
        log.info("[HospitalController] POST /api/hospital/import sourceIds={} hospitals={}",
                request != null ? request.getSourceIds() : List.of(),
                request != null && request.getHospitals() != null ? request.getHospitals().size() : 0);
        List<HospitalDto> imported = hospitalService.importFromSource(request);
        log.info("[HospitalController] POST /api/hospital/import imported {} records", imported.size());
        return ResponseEntity.ok(imported);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAssociation(@PathVariable Long id) {
        log.info("[HospitalController] DELETE /api/hospital/{}", id);
        hospitalService.deleteAssociation(id);
        log.info("[HospitalController] DELETE /api/hospital/{} completed", id);
        return ResponseEntity.noContent().build();
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<HospitalDto> findById(@PathVariable Long id) {
        log.info("[HospitalController] GET /api/hospital/{}", id);
        HospitalDto hospital = hospitalService.findById(id); // o il corrispondente metodo del tuo service
        if (hospital == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(hospital);
    }
}
