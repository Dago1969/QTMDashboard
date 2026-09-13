package com.qtm.dashboard.structuredepartment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Overview dei reparti TICKET arricchita con filtri ospedale e stato di associazione locale.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class StructureDepartmentOverviewDto {

    private Long id;
    private String codiceRegione;
    private String regione;
    private String codiceAsl;
    private String asl;
    private String codiceStruttura;
    private String struttura;
    private String codiceDisciplina;
    private String disciplina;
    private String indirizzo;
    private Boolean imported;
}