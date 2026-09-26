package com.qtm.dashboard.hospital.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.qtm.dashboard.hospital.entity.HospitalEntity;

@Repository
public interface HospitalRepository extends JpaRepository<HospitalEntity, Long> {
	
	// Ricerca per solo codice regione
    List<HospitalEntity> findByCodiceRegione(String codiceRegione);

    // Ricerca per codice regione E codice asl
    List<HospitalEntity> findByCodiceRegioneAndCodiceAsl(String codiceRegione, String codiceAsl);

    // Ricerca per solo codice asl
    List<HospitalEntity> findByCodiceAsl(String codiceAsl);
}
