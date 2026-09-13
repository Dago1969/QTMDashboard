package com.qtm.dashboard.structure.repository;

import com.qtm.dashboard.structure.entity.StructureEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface StructureRepository extends JpaRepository<StructureEntity, Long> {
}