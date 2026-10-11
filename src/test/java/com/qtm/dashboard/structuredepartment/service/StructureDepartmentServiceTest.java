package com.qtm.dashboard.structuredepartment.service;

import com.qtm.commonlib.dto.RegionDto;
import com.qtm.commonlib.dto.HospitalDto;
import com.qtm.dashboard.asl.entity.ASLEntity;
import com.qtm.dashboard.asl.repository.ASLRepository;
import com.qtm.dashboard.hospital.entity.HospitalEntity;
import com.qtm.dashboard.hospital.repository.HospitalRepository;
import com.qtm.dashboard.geography.TicketGeographyService;
import com.qtm.dashboard.structuredepartment.dto.StructureDepartmentImportRequest;
import com.qtm.commonlib.dto.StructureDepartmentSourceDto;
import com.qtm.dashboard.structuredepartment.entity.StructureDepartmentEntity;
import com.qtm.dashboard.structuredepartment.repository.StructureDepartmentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
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
        private TicketGeographyService ticketGeographyService;

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
                ticketGeographyService,
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

        when(ticketGeographyService.findRegions()).thenReturn(List.of(
                RegionDto.builder().code("13").name("Abruzzo").build()
        ));
        stubTicketHospitalCatalog(HospitalDto.builder()
                .id(100L)
                .codiceRegione("13")
                .codiceAsl("201")
                .codiceStruttura("H001")
                .struttura("Ospedale TICKET")
                .build());
        stubTicketDepartmentCatalog(sourceDepartment);

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
        void findAllWithImportStatusShouldUseTicketCatalogWhenLocalHospitalTableIsEmpty() {
        StructureDepartmentService service = new StructureDepartmentService(
                aslRepository,
                hospitalRepository,
                structureDepartmentRepository,
                ticketGeographyService,
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

        when(ticketGeographyService.findRegions()).thenReturn(List.of(
                RegionDto.builder().code("13").name("Abruzzo").build()
        ));
        stubTicketHospitalCatalog(HospitalDto.builder()
                .id(101L)
                .codiceRegione("13")
                .codiceAsl("202")
                .codiceStruttura("H002")
                .struttura("Ospedale Solo TICKET")
                .build());
        stubTicketDepartmentCatalog(sourceDepartment);

        when(aslRepository.findAll()).thenReturn(List.of(ASLEntity.builder()
                .id(11L)
                .codiceAzienda("202")
                .denominazioneAzienda("ASL Chieti")
                .codiceRegione("13")
                .build()));
        when(hospitalRepository.findAll()).thenReturn(List.of());
        when(structureDepartmentRepository.findAll()).thenReturn(List.of());

        var overview = service.findAllWithImportStatus("13", "202", "");

        assertThat(overview).hasSize(1);
        assertThat(overview.get(0).getCodiceStruttura()).isEqualTo("H002");
        assertThat(overview.get(0).getStruttura()).isEqualTo("Ospedale Solo TICKET");
        assertThat(overview.get(0).getDisciplina()).isEqualTo("Neurologia");
        assertThat(overview.get(0).getImported()).isFalse();
        verify(restClient).get();
        verify(structureDepartmentRepository, never()).save(any());
    }

    /**
     * Verifica che la denominazione ASL sia risolta con regione e codice azienda quando il codice è duplicato.
     */
    @Test
    void findAllWithImportStatusShouldResolveAslByRegionAndCompanyCode() {
        StructureDepartmentService service = new StructureDepartmentService(
                aslRepository,
                hospitalRepository,
                structureDepartmentRepository,
                ticketGeographyService,
                restClient,
                apiRootRestClient,
                "http://ticket.test"
        );

        StructureDepartmentSourceDto sourceDepartment = StructureDepartmentSourceDto.builder()
                .id(9L)
                .codiceStruttura("090623")
                .codiceDisciplina("CARD")
                .build();

        when(ticketGeographyService.findRegions()).thenReturn(List.of(
                RegionDto.builder().code("09").name("Toscana").build()
        ));
        stubTicketHospitalCatalog(HospitalDto.builder()
                .id(191L)
                .codiceRegione("09")
                .codiceAsl("203")
                .codiceStruttura("090623")
                .struttura("OSPEDALE S.ANDREA MASSA MARITTIMA")
                .build());
        stubTicketDepartmentCatalog(sourceDepartment);

        when(aslRepository.findAll()).thenReturn(List.of(
                ASLEntity.builder()
                        .id(105L)
                        .codiceAzienda("203")
                        .denominazioneAzienda("ASL PESCARA")
                        .codiceRegione("13")
                        .build(),
                ASLEntity.builder()
                        .id(923L)
                        .codiceAzienda("203")
                        .denominazioneAzienda("AZIENDA USL TOSCANA SUD-EST")
                        .codiceRegione("09")
                        .build()
        ));
        when(hospitalRepository.findAll()).thenReturn(List.of(HospitalEntity.builder()
                .id(191L)
                .codiceRegione("09")
                .codiceAsl("203")
                .codiceStruttura("090623")
                .struttura("OSPEDALE S.ANDREA MASSA MARITTIMA")
                .build()));
        when(structureDepartmentRepository.findAll()).thenReturn(List.of());

        var overview = service.findAllWithImportStatus("09", "203", "090623");

        assertThat(overview).hasSize(1);
        assertThat(overview.get(0).getCodiceRegione()).isEqualTo("09");
        assertThat(overview.get(0).getCodiceAsl()).isEqualTo("203");
        assertThat(overview.get(0).getAsl()).isEqualTo("AZIENDA USL TOSCANA SUD-EST");
    }

        @Test
        void getFilterOptionsShouldExposeHospitalsFromTicketWhenLocalHospitalTableIsEmpty() {
        StructureDepartmentService service = new StructureDepartmentService(
                aslRepository,
                hospitalRepository,
                structureDepartmentRepository,
                ticketGeographyService,
                restClient,
                apiRootRestClient,
                "http://ticket.test"
        );

        when(ticketGeographyService.findRegions()).thenReturn(List.of(
                RegionDto.builder().code("13").name("Abruzzo").build()
        ));
        stubTicketHospitalCatalog(HospitalDto.builder()
                .id(102L)
                .codiceRegione("13")
                .codiceAsl("203")
                .codiceStruttura("H003")
                .struttura("Ospedale Dal TICKET")
                .build());

        when(aslRepository.findAll()).thenReturn(List.of(ASLEntity.builder()
                .id(12L)
                .codiceAzienda("203")
                .denominazioneAzienda("ASL Pescara")
                .codiceRegione("13")
                .build(), ASLEntity.builder()
                .id(13L)
                .codiceAzienda("203")
                .denominazioneAzienda("ASL Pescara")
                .codiceRegione("13")
                .build(), ASLEntity.builder()
                .id(14L)
                .codiceAzienda("204")
                .denominazioneAzienda("ASL non associata")
                .codiceRegione("13")
                .build()));
        when(hospitalRepository.findAll()).thenReturn(List.of());

        var filterOptions = service.getFilterOptions();

        assertThat(filterOptions.getAsls()).hasSize(1);
        assertThat(filterOptions.getAsls().get(0).getCode()).isEqualTo("203");
        assertThat(filterOptions.getAsls().get(0).getLabel()).isEqualTo("ASL Pescara (203) - Abruzzo");
        assertThat(filterOptions.getHospitals()).hasSize(1);
        assertThat(filterOptions.getHospitals().get(0).getCode()).isEqualTo("H003");
        assertThat(filterOptions.getHospitals().get(0).getAslCode()).isEqualTo("203");
        assertThat(filterOptions.getHospitals().get(0).getLabel()).isEqualTo("Ospedale Dal TICKET (H003)");
        verify(ticketGeographyService).findRegions();
        verify(apiRootRequestHeadersUriSpec, never()).uri("regions");
        verify(restClient, never()).get();
        verify(structureDepartmentRepository, never()).save(any());
    }

    @Test
    void importAssociationShouldPersistNormalizedCodesAndDefaultReferentsJson() {
        StructureDepartmentService service = new StructureDepartmentService(
                aslRepository,
                hospitalRepository,
                structureDepartmentRepository,
                ticketGeographyService,
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

        verify(structureDepartmentRepository).save(argThat(entity ->
                Objects.equals(entity.getTicketStructureDepartmentId(), 7L)
                        && Objects.equals(entity.getCodiceStruttura(), "H001")
                        && Objects.equals(entity.getCodiceDisciplina(), "CARD")
                        && Objects.equals(entity.getReferentsJson(), "[]")
        ));
    }

        private void stubTicketHospitalCatalog(HospitalDto... hospitals) {
                lenient().doReturn(apiRootRequestHeadersUriSpec).when(apiRootRestClient).get();
                doReturn(apiRootRequestHeadersUriSpec).when(apiRootRequestHeadersUriSpec).uri("hospitals");
                when(apiRootRequestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
                lenient().when(responseSpec.body(HospitalDto[].class)).thenReturn(hospitals);
        }

        private void stubTicketDepartmentCatalog(StructureDepartmentSourceDto... departments) {
                doReturn(requestHeadersUriSpec).when(restClient).get();
                doReturn(requestHeadersUriSpec).when(requestHeadersUriSpec).uri("structure-departments");
                when(requestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
                when(responseSpec.body(StructureDepartmentSourceDto[].class)).thenReturn(departments);
        }
}