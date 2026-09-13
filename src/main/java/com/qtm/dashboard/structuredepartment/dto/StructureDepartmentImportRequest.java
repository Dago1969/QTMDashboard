package com.qtm.dashboard.structuredepartment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Richiesta REST per associare localmente un reparto proveniente da QTMTicket.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StructureDepartmentImportRequest {

    private String codiceStruttura;
    private String codiceDisciplina;
}