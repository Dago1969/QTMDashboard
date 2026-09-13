package com.qtm.dashboard.structuredepartment.service;

import com.qtm.commonlib.dto.RegionDto;
import com.qtm.dashboard.asl.entity.ASLEntity;
import com.qtm.dashboard.asl.repository.ASLRepository;
import com.qtm.dashboard.hospital.entity.HospitalEntity;
import com.qtm.dashboard.hospital.repository.HospitalRepository;
import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentImportRequest;
import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentSourceDto;
import com.qtm.dashboard.structuredepartment.entity.StructureDepartmentEntity;
import com.qtm.dashboard.structuredepartment.repository.StructureDepartmentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StructureDepartmentServiceTest {

    @Mock
    private ASLRepository aslRepository;

    @Mock
    private HospitalRepository hospitalRepository;

    @Mock
    private StructureDepartmentRepository structureDepartmentRepository;

    @Mock
    private RestClient restClient;

        @Mock
        private RestClient apiRootRestClient;

    @Mock
    private RestClient.RequestHeadersUriSpec<?> requestHeadersUriSpec;

        @Mock
        private RestClient.RequestHeadersUriSpec<?> apiRootRequestHeadersUriSpec;

    @Mock
    private RestClient.ResponseSpec responseSpec;

    @Test
    void findAllWithImportStatusShouldExposeHospitalFieldsAndImportedFlag() {
        StructureDepartmentService service = new StructureDepartmentService(
                aslRepository,
                hospitalRepository,
                structureDepartmentRepository,
                restClient,
                apiRootRestClient,
                "http://ticket.test"
        );

        StructureDepartmentSourceDto sourceDepartment = StructureDepartmentSourceDto.builder()
                .id(7L)
                .codiceStruttura("H001")
                .codiceDisciplina("CARD")
                .disciplina("Cardiologia")
                .indirizzo("Via Reparti 1")
                .build();
        StructureDepartmentEntity localAssociation = StructureDepartmentEntity.builder()
                .id(1L)
                .codiceStruttura("H001")
                .codiceDisciplina("CARD")
                .referentsJson("[]")
                .build();

        doReturn(apiRootRequestHeadersUriSpec).when(apiRootRestClient).get();
        doReturn(apiRootRequestHeadersUriSpec).when(apiRootRequestHeadersUriSpec).uri("regions");
        when(apiRootRequestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(RegionDto[].class)).thenReturn(new RegionDto[]{
                RegionDto.builder().code("13").name("Abruzzo").build()
        });
        doReturn(requestHeadersUriSpec).when(restClient).get();
        doReturn(requestHeadersUriSpec).when(requestHeadersUriSpec).uri("structure-departments?codiceStruttura={codiceStruttura}", "H001");
        when(requestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(StructureDepartmentSourceDto[].class)).thenReturn(new StructureDepartmentSourceDto[]{sourceDepartment});

        when(aslRepository.findAll()).thenReturn(List.of(ASLEntity.builder()
                .id(10L)
                .codiceAzienda("201")
                .denominazioneAzienda("ASL L'Aquila")
                .codiceRegione("13")
                .build()));
        when(hospitalRepository.findAll()).thenReturn(List.of(HospitalEntity.builder()
                .id(100L)
                .codiceRegione("13")
                .codiceAsl("201")
                .codiceStruttura("H001")
                .struttura("Ospedale San Test")
                .build()));
        when(structureDepartmentRepository.findAll()).thenReturn(List.of(localAssociation));

        var overview = service.findAllWithImportStatus("13", "201", "H001");

        assertThat(overview).hasSize(1);
        assertThat(overview.get(0).getCodiceRegione()).isEqualTo("13");
        assertThat(overview.get(0).getRegione()).isEqualTo("Abruzzo");
        assertThat(overview.get(0).getAsl()).isEqualTo("ASL L'Aquila");
        assertThat(overview.get(0).getStruttura()).isEqualTo("Ospedale San Test");
        assertThat(overview.get(0).getDisciplina()).isEqualTo("Cardiologia");
        assertThat(overview.get(0).getImported()).isTrue();
        verify(structureDepartmentRepository).findAll();
    }

    @Test
    void findAllWithImportStatusShouldUseHospitalTableEvenWhenStructureTableIsEmpty() {
        StructureDepartmentService service = new StructureDepartmentService(
                aslRepository,
                hospitalRepository,
                structureDepartmentRepository,
                restClient,
                apiRootRestClient,
                "http://ticket.test"
        );

        StructureDepartmentSourceDto sourceDepartment = StructureDepartmentSourceDto.builder()
                .id(8L)
                .codiceStruttura("H002")
                .codiceDisciplina("NEUR")
                .disciplina("Neurologia")
                .indirizzo("Via Ticket 2")
                .build();

        doReturn(apiRootRequestHeadersUriSpec).when(apiRootRestClient).get();
        doReturn(apiRootRequestHeadersUriSpec).when(apiRootRequestHeadersUriSpec).uri("regions");
        when(apiRootRequestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(RegionDto[].class)).thenReturn(new RegionDto[]{
                RegionDto.builder().code("13").name("Abruzzo").build()
        });
        doReturn(requestHeadersUriSpec).when(restClient).get();
        doReturn(requestHeadersUriSpec).when(requestHeadersUriSpec).uri("structure-departments?codiceStruttura={codiceStruttura}", "H002");
        when(requestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(StructureDepartmentSourceDto[].class)).thenReturn(new StructureDepartmentSourceDto[]{sourceDepartment});

        when(aslRepository.findAll()).thenReturn(List.of(ASLEntity.builder()
                .id(11L)
                .codiceAzienda("202")
                .denominazioneAzienda("ASL Chieti")
                .codiceRegione("13")
                .build()));
        when(hospitalRepository.findAll()).thenReturn(List.of(HospitalEntity.builder()
                .id(101L)
                .codiceRegione("13")
                .codiceAsl("202")
                .codiceStruttura("H002")
                .struttura("Ospedale Solo Hospital")
                .build()));
        when(structureDepartmentRepository.findAll()).thenReturn(List.of());

        var overview = service.findAllWithImportStatus("13", "202", "");

        assertThat(overview).hasSize(1);
        assertThat(overview.get(0).getCodiceStruttura()).isEqualTo("H002");
        assertThat(overview.get(0).getStruttura()).isEqualTo("Ospedale Solo Hospital");
        assertThat(overview.get(0).getDisciplina()).isEqualTo("Neurologia");
        assertThat(overview.get(0).getImported()).isFalse();
        verify(restClient).get();
    }

    @Test
    void getFilterOptionsShouldExposeHospitalsFromHospitalTable() {
        StructureDepartmentService service = new StructureDepartmentService(
                aslRepository,
                hospitalRepository,
                structureDepartmentRepository,
                restClient,
                apiRootRestClient,
                "http://ticket.test"
        );

        doReturn(apiRootRequestHeadersUriSpec).when(apiRootRestClient).get();
        doReturn(apiRootRequestHeadersUriSpec).when(apiRootRequestHeadersUriSpec).uri("regions");
        when(apiRootRequestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(RegionDto[].class)).thenReturn(new RegionDto[]{
                RegionDto.builder().code("13").name("Abruzzo").build()
        });

        when(aslRepository.findAll()).thenReturn(List.of(ASLEntity.builder()
                .id(12L)
                .codiceAzienda("203")
                .denominazioneAzienda("ASL Pescara")
                .codiceRegione("13")
                .build()));
        when(hospitalRepository.findAll()).thenReturn(List.of(HospitalEntity.builder()
                .id(102L)
                .codiceRegione("13")
                .codiceAsl("203")
                .codiceStruttura("H003")
                .struttura("Ospedale Dal DB Hospital")
                .build()));

        var filterOptions = service.getFilterOptions();

        assertThat(filterOptions.getHospitals()).hasSize(1);
        assertThat(filterOptions.getHospitals().get(0).getCode()).isEqualTo("H003");
        assertThat(filterOptions.getHospitals().get(0).getAslCode()).isEqualTo("203");
        assertThat(filterOptions.getHospitals().get(0).getLabel()).isEqualTo("Ospedale Dal DB Hospital (H003)");
        verify(restClient, never()).get();
    }

    @Test
    void importAssociationShouldPersistNormalizedCodesAndDefaultReferentsJson() {
        StructureDepartmentService service = new StructureDepartmentService(
                aslRepository,
                hospitalRepository,
                structureDepartmentRepository,
                restClient,
                apiRootRestClient,
                "http://ticket.test"
        );

        StructureDepartmentImportRequest request = StructureDepartmentImportRequest.builder()
                .codiceStruttura(" H001 ")
                .codiceDisciplina(" CARD ")
                .build();
        StructureDepartmentSourceDto sourceDepartment = StructureDepartmentSourceDto.builder()
                .id(7L)
                .codiceStruttura("H001")
                .codiceDisciplina("CARD")
                .build();

        doReturn(requestHeadersUriSpec).when(restClient).get();
        doReturn(requestHeadersUriSpec).when(requestHeadersUriSpec).uri("structure-departments?codiceStruttura={codiceStruttura}", "H001");
        when(requestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(StructureDepartmentSourceDto[].class)).thenReturn(new StructureDepartmentSourceDto[]{sourceDepartment});

        when(structureDepartmentRepository.findByCodiceStrutturaAndCodiceDisciplina("H001", "CARD")).thenReturn(Optional.empty());

        service.importAssociation(request);

        verify(structureDepartmentRepository).save(any(StructureDepartmentEntity.class));
    }
}