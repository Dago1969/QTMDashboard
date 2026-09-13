package com.qtm.dashboard.structuredepartment.repository;

import com.qtm.dashboard.structuredepartment.entity.StructureDepartmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Repository delle associazioni locali reparto-struttura gestite da QTMDB.
 */
public interface StructureDepartmentRepository extends JpaRepository<StructureDepartmentEntity, Long> {

    Optional<StructureDepartmentEntity> findByCodiceStrutturaAndCodiceDisciplina(String codiceStruttura, String codiceDisciplina);

    boolean existsByCodiceStrutturaAndCodiceDisciplina(String codiceStruttura, String codiceDisciplina);

    void deleteByCodiceStrutturaAndCodiceDisciplina(String codiceStruttura, String codiceDisciplina);
}