package com.qtm.dashboard.structuredepartment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO locale che rispecchia il payload REST esposto da QTMTicket per i reparti struttura.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StructureDepartmentSourceDto {

    private Long id;
    private String codiceStruttura;
    private String codiceDisciplina;
    private String disciplina;
    private String indirizzo;
}