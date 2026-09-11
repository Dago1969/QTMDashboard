package com.qtm.dashboard.asl.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO di overview ASL che include stato di importazione locale e campi letti da QTMTicket.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class ASLOverviewDto {
    private Long id;
    private Integer anno;
    private String codiceAzienda;
    private String denominazioneAzienda;
    private String codiceRegione;
    private Long provinciaId;
    private String provinciaDescrizione;
    private String regioneDescrizione;
    private String indirizzo;
    private String email;
    private String telefono;
    private Boolean imported;
    private String note;
}
