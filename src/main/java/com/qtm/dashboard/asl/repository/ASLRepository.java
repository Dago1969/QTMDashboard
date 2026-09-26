package com.qtm.dashboard.asl.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.qtm.dashboard.asl.entity.ASLEntity;

@Repository
public interface ASLRepository extends JpaRepository<ASLEntity, Long> {
	
	List<ASLEntity> findByCodiceRegione(String codiceRegione);
}
