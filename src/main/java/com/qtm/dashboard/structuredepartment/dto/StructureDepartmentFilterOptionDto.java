package com.qtm.dashboard.structuredepartment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Opzione di filtro per la pagina reparti con metadati per i select dipendenti.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class StructureDepartmentFilterOptionDto {

    private String code;
    private String label;
    private String regionCode;
    private String aslCode;
}