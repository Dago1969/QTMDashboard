package com.qtm.dashboard.hospital.service;

import com.qtm.commonlib.dto.HospitalDto;
import com.qtm.dashboard.asl.repository.ASLRepository;
import com.qtm.dashboard.hospital.entity.HospitalEntity;
import com.qtm.dashboard.hospital.mapper.HospitalMapper;
import com.qtm.dashboard.hospital.repository.HospitalRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HospitalServiceTest {

    @Mock
    private HospitalRepository hospitalRepository;

    @Mock
    private HospitalMapper hospitalMapper;

    @Mock
    private ASLRepository aslRepository;

    @Mock
    private RestClient restClient;

    @Mock
    private RestClient.RequestHeadersUriSpec<?> requestHeadersUriSpec;

    @Mock
    private RestClient.ResponseSpec responseSpec;

    @Test
    void findAllWithImportStatusShouldExposeAllHospitalsAndFlagImportedOnes() {
        HospitalService hospitalService = new HospitalService(hospitalRepository, hospitalMapper, restClient, "http://ticket.test");

        HospitalDto visibleHospital = HospitalDto.builder()
                .id(100L)
                .codiceRegione("01")
                .codiceAsl("201")
                .aslId(10L)
                .struttura("Ospedale Test")
                .build();
        HospitalDto hiddenHospital = HospitalDto.builder()
                .id(200L)
                .codiceRegione("01")
                .codiceAsl("999")
                .aslId(99L)
                .struttura("Ospedale Altro")
                .build();

        doReturn(requestHeadersUriSpec).when(restClient).get();
        doReturn(requestHeadersUriSpec).when(requestHeadersUriSpec).uri("/hospitals");
        when(requestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(HospitalDto[].class)).thenReturn(new HospitalDto[]{visibleHospital, hiddenHospital});

        HospitalEntity localHospital = new HospitalEntity();
        localHospital.setId(100L);
        when(hospitalRepository.findAll()).thenReturn(List.of(localHospital));

        var overview = hospitalService.findAllWithImportStatus();

        assertThat(overview).hasSize(2);
        assertThat(overview.get(0).getId()).isEqualTo(100L);
        assertThat(overview.get(0).getImported()).isTrue();
        assertThat(overview.get(1).getId()).isEqualTo(200L);
        assertThat(overview.get(1).getImported()).isFalse();
        verify(hospitalRepository).findAll();
    }
}
