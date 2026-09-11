package com.qtm.dashboard.repository;

import com.qtm.dashboard.domain.Region;
import com.qtm.dashboard.dto.RegionDto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
/**
 * Repository per Region.
 */
import java.util.List;

public interface RegionRepository extends JpaRepository<Region, Long> {
	/**
	 * Trova tutte le regioni di un country.
	 */
	List<Region> findByCountryId(Long countryId);

    List<Region> findAllByOrderByName();

	List<Region> findByRegionCodeIn(Collection<String> regionCodes);
}
