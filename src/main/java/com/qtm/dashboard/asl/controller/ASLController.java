package com.qtm.dashboard.asl.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.qtm.commonlib.dto.ASLDto;
import com.qtm.commonlib.dto.ASLImportRequest;
import com.qtm.commonlib.dto.ASLOverviewDto;
import com.qtm.commonlib.dto.ReferentDto;
import com.qtm.dashboard.asl.service.ASLService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/asl")
@RequiredArgsConstructor
public class ASLController {

    private final ASLService aslService;

    @GetMapping
    public ResponseEntity<List<ASLDto>> findAll() {
        log.info("[ASLController] GET /api/asl");
        List<ASLDto> result = aslService.findAll();
        log.info("[ASLController] GET /api/asl returned {} records", result.size());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/overview")
    public ResponseEntity<List<ASLOverviewDto>> findAllWithImportStatus(@RequestParam(required = false) String regionCode) {
        log.info("[ASLController] GET /api/asl/overview regionCode={}", regionCode);
        List<ASLOverviewDto> result = aslService.findAllWithImportStatus(regionCode);
        log.info("[ASLController] GET /api/asl/overview returned {} records", result.size());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ASLDto> findById(@PathVariable Long id) {
        log.info("[ASLController] GET /api/asl/{}", id);
        ASLDto dto = aslService.findById(id);
        log.info("[ASLController] GET /api/asl/{} found={}", id, dto != null);
        return dto != null ? ResponseEntity.ok(dto) : ResponseEntity.notFound().build();
    }

    @PostMapping("/import")
    public ResponseEntity<List<ASLDto>> importFromSource(@RequestBody ASLImportRequest request) {
        log.info("[ASLController] POST /api/asl/import sourceIds={}", request != null ? request.getSourceIds() : List.of());
        List<ASLDto> imported = aslService.importFromSource(request != null ? request.getSourceIds() : List.of());
        log.info("[ASLController] POST /api/asl/import imported {} records", imported.size());
        return ResponseEntity.ok(imported);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAssociation(@PathVariable Long id) {
        log.info("[ASLController] DELETE /api/asl/{}", id);
        aslService.deleteAssociation(id);
        log.info("[ASLController] DELETE /api/asl/{} completed", id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<ASLDto> update(@PathVariable Long id, @RequestBody ASLDto dto) {
        log.info("[ASLController] PUT /api/asl/{} note={} referents={}", id, dto != null ? dto.getNote() : null,
                dto != null && dto.getReferents() != null ? dto.getReferents().size() : 0);
        ASLDto updated = aslService.update(id, dto);
        log.info("[ASLController] PUT /api/asl/{} updated", id);
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/{id}/referents")
    public ResponseEntity<List<ReferentDto>> findReferents(@PathVariable Long id) {
        return ResponseEntity.ok(aslService.findReferents(id));
    }

    @PostMapping("/{id}/referents")
    public ResponseEntity<List<ReferentDto>> addReferent(@PathVariable Long id, @RequestBody ReferentDto referent) {
        return ResponseEntity.ok(aslService.addReferent(id, referent));
    }

    @PutMapping("/{id}/referents/{referentId}")
    public ResponseEntity<List<ReferentDto>> updateReferent(@PathVariable Long id, @PathVariable Long referentId,
            @RequestBody ReferentDto referent) {
        return ResponseEntity.ok(aslService.updateReferent(id, referentId, referent));
    }

    @DeleteMapping("/{id}/referents/{referentId}")
    public ResponseEntity<Void> removeReferent(@PathVariable Long id, @PathVariable Long referentId) {
        aslService.removeReferent(id, referentId);
        return ResponseEntity.noContent().build();
    }
}
