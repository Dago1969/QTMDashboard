package com.qtm.dashboard.hospital.service;

import com.qtm.dashboard.hospital.entity.HospitalEntity;
import com.qtm.dashboard.hospital.mapper.HospitalMapper;
import com.qtm.dashboard.hospital.repository.HospitalRepository;
import com.qtm.dashboard.asl.repository.ASLRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HospitalServiceTest {

    @Mock
    private HospitalRepository hospitalRepository;

    @Mock
    private ASLRepository aslRepository;

    @Mock
    private HospitalMapper hospitalMapper;

    @Test
    void findAllWithImportStatusShouldExposeAllHospitalsAndFlagImportedOnes() {
        HospitalService hospitalService = new HospitalService(hospitalRepository, hospitalMapper, aslRepository, null, "http://ticket.test");

        HospitalEntity localHospital = new HospitalEntity();
        localHospital.setId(100L);
        localHospital.setStruttura("Ospedale Test");
        HospitalEntity otherLocalHospital = new HospitalEntity();
        otherLocalHospital.setId(200L);
        otherLocalHospital.setStruttura("Ospedale Altro");
        when(hospitalRepository.findAll()).thenReturn(List.of(localHospital, otherLocalHospital));
        when(aslRepository.findAll()).thenReturn(List.of());

        var overview = hospitalService.findAllWithImportStatus(null, null);

        assertThat(overview).hasSize(2);
        assertThat(overview.get(0).getId()).isEqualTo(100L);
        assertThat(overview.get(0).getImported()).isTrue();
        assertThat(overview.get(1).getId()).isEqualTo(200L);
        assertThat(overview.get(1).getImported()).isTrue();
        verify(hospitalRepository).findAll();
    }
}
