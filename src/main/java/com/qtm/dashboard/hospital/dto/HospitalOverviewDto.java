package com.qtm.dashboard.hospital.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO di overview ospedale che include lo stato di associazione locale e i dati da QTMTicket.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class HospitalOverviewDto {
    private Long id;
    private Integer anno;
    private String codiceRegione;
    private String regione;
    private String codiceAsl;
    private String asl;
    private String codiceStruttura;
    private String struttura;
    private String comune;
    private String siglaProvincia;
    private String indirizzo;
    private Long hospitalTypeId;
    private String tipoStruttura;
    private Long aslId;
    private Boolean imported;
    private String note;
}
