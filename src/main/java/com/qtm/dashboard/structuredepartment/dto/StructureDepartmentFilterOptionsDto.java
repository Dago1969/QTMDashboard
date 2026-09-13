package com.qtm.dashboard.structuredepartment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Raccolta delle opzioni per i filtri regione, ASL e ospedale della pagina reparti.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class StructureDepartmentFilterOptionsDto {

    private List<StructureDepartmentFilterOptionDto> regions;
    private List<StructureDepartmentFilterOptionDto> asls;
    private List<StructureDepartmentFilterOptionDto> hospitals;
}