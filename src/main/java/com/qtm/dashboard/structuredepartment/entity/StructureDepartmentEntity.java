package com.qtm.dashboard.structuredepartment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entita locale che memorizza l'associazione reparto-struttura con i referenti gestiti in QTMDB.
 */
@Entity
@Table(name = "structure_department", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"codice_struttura", "codice_disciplina"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StructureDepartmentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codice_struttura", nullable = false, length = 100)
    private String codiceStruttura;

    @Column(name = "codice_disciplina", nullable = false, length = 100)
    private String codiceDisciplina;

    @Column(name = "referents_json", nullable = false, length = 8000)
    private String referentsJson;
}