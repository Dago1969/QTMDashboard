package com.qtm.dashboard.structure.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entita legacy delle strutture gia associate in QTMDB.
 */
@Entity
@Table(name = "structures")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StructureEntity {

    @Id
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "code", length = 255)
    private String code;

    @Column(name = "name", length = 255)
    private String name;

    @Column(name = "address", length = 255)
    private String address;

    @Column(name = "region", length = 255)
    private String region;

    @Column(name = "region_id")
    private Long regionId;
}