package com.qtm.dashboard.hospital.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entità locale per gli ospedali associati da QTMTicket.
 */
@Entity
@Table(name = "hospital")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HospitalEntity {

    @Id
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "note", length = 1000)
    private String note;

    @Column(name = "codice_regione", length = 50)
    private String codiceRegione;

    @Column(name = "codice_asl", length = 50)
    private String codiceAsl;

    @Column(name = "struttura", length = 255)
    private String struttura;

    @Column(name = "referents_json", length = 8000)
    private String referentsJson;

    @Column(name = "codice_struttura", length = 100)
    private String codiceStruttura;

    @Column(name = "asl_id")
    private Long aslId;
}
