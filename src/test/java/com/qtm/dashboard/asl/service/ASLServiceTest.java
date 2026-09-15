package com.qtm.dashboard.asl.service;

import com.qtm.commonlib.dto.ASLDto;
import com.qtm.dashboard.asl.entity.ASLEntity;
import com.qtm.dashboard.asl.mapper.ASLMapper;
import com.qtm.dashboard.asl.repository.ASLRepository;
import com.qtm.dashboard.geography.TicketGeographyService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ASLServiceTest {

    @Mock
    private ASLRepository aslRepository;

    @Mock
    private ASLMapper aslMapper;

    @Mock
    private TicketGeographyService ticketGeographyService;

    @Mock
    private RestClient restClient;

    @Mock
    private RestClient.RequestHeadersUriSpec<?> requestHeadersUriSpec;

    @Mock
    private RestClient.ResponseSpec responseSpec;

    @Test
    void findAllWithImportStatusShouldExposeAnnoProvinceAndRegion() {
        ASLService aslService = new ASLService(aslRepository, aslMapper, ticketGeographyService, restClient, "http://ticket.test");

        ASLDto source = ASLDto.builder()
                .id(103L)
                .anno(2026)
                .codiceAzienda("201")
                .denominazioneAzienda("ASL AVEZZANO-SULMONA-L'AQUILA")
                .codiceRegione("13")
                .cityId(5394L)
                .indirizzo("VIA G. BELLISARI SNC")
                .telefono("0862.3681")
                .email("direzione.generale@asl-laquila.it")
                .build();

        ASLEntity localEntity = new ASLEntity();
        localEntity.setId(103L);
        localEntity.setNote("nota locale");

        TicketGeographyService.TicketRegion region = new TicketGeographyService.TicketRegion();
        region.setId(13L);
        region.setRegionCode("13");
        region.setName("Abruzzo");
        TicketGeographyService.TicketProvince province = new TicketGeographyService.TicketProvince();
        province.setId(6L);
        province.setName("L'Aquila");
        province.setRegion(region);
        TicketGeographyService.TicketCity city = new TicketGeographyService.TicketCity();
        city.setId(5394L);
        city.setName("Avezzano");
        city.setProvince(province);

        when(aslRepository.findAll()).thenReturn(List.of(localEntity));
        when(ticketGeographyService.findCityById(5394L)).thenReturn(java.util.Optional.of(city));
        when(ticketGeographyService.findRegionByCode("13")).thenReturn(java.util.Optional.of(region));
        doReturn(requestHeadersUriSpec).when(restClient).get();
        doReturn(requestHeadersUriSpec).when(requestHeadersUriSpec).uri("/asl");
        when(requestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(ASLDto[].class)).thenReturn(new ASLDto[]{source});

        var overview = aslService.findAllWithImportStatus();

        assertThat(overview).hasSize(1);
        assertThat(overview.get(0).getAnno()).isEqualTo(2026);
        assertThat(overview.get(0).getProvinciaId()).isEqualTo(6L);
        assertThat(overview.get(0).getProvinciaDescrizione()).isEqualTo("L'Aquila");
        assertThat(overview.get(0).getRegioneDescrizione()).isEqualTo("Abruzzo");
        assertThat(overview.get(0).getImported()).isTrue();
    }

    @Test
    void findAllWithImportStatusShouldUseSourceRegionCodeWhenCityRegionIsInconsistent() {
        ASLService aslService = new ASLService(aslRepository, aslMapper, ticketGeographyService, restClient, "http://ticket.test");

        ASLDto source = ASLDto.builder()
                .id(91L)
                .anno(2015)
                .codiceAzienda("101")
                .denominazioneAzienda("RM/A")
                .codiceRegione("12")
                .cityId(6068L)
                .indirizzo("VIA ARIOSTO 3/9")
                .build();

        TicketGeographyService.TicketRegion lazio = new TicketGeographyService.TicketRegion();
        lazio.setId(12L); lazio.setRegionCode("12"); lazio.setName("Lazio");
        TicketGeographyService.TicketRegion campania = new TicketGeographyService.TicketRegion();
        campania.setId(15L); campania.setRegionCode("15"); campania.setName("Campania");
        TicketGeographyService.TicketProvince avellino = new TicketGeographyService.TicketProvince();
        avellino.setId(64L); avellino.setName("Avellino"); avellino.setRegion(campania);
        TicketGeographyService.TicketCity mismatchedCity = new TicketGeographyService.TicketCity();
        mismatchedCity.setId(6068L); mismatchedCity.setName("Avellino"); mismatchedCity.setProvince(avellino);

        when(aslRepository.findAll()).thenReturn(List.of());
        when(ticketGeographyService.findCityById(6068L)).thenReturn(java.util.Optional.of(mismatchedCity));
        when(ticketGeographyService.findRegionByCode("12")).thenReturn(java.util.Optional.of(lazio));
        doReturn(requestHeadersUriSpec).when(restClient).get();
        doReturn(requestHeadersUriSpec).when(requestHeadersUriSpec).uri("/asl");
        when(requestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(ASLDto[].class)).thenReturn(new ASLDto[]{source});

        var overview = aslService.findAllWithImportStatus();

        assertThat(overview).hasSize(1);
        assertThat(overview.get(0).getRegioneDescrizione()).isEqualTo("Lazio");
        assertThat(overview.get(0).getProvinciaDescrizione()).isNull();
        assertThat(overview.get(0).getProvinciaId()).isNull();
    }

    @Test
    void importFromSourceShouldPersistEntitiesUsingProvidedIds() {
        ASLService aslService = new ASLService(aslRepository, aslMapper, ticketGeographyService, restClient, "http://ticket.test");

        ASLDto dto = ASLDto.builder()
                .id(321L)
                .codiceAzienda("001")
                .denominazioneAzienda("ASL Test")
                .codiceRegione("13")
                .build();

        ASLEntity entity = new ASLEntity();
        entity.setId(321L);
        doReturn(requestHeadersUriSpec).when(restClient).get();
        doReturn(requestHeadersUriSpec).when(requestHeadersUriSpec).uri("/asl/{id}", 321L);
        when(requestHeadersUriSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.body(String.class)).thenReturn("""
                {
                    \"id\": 321,
                    \"codiceAzienda\": \"001\",
                    \"denominazioneAzienda\": \"ASL Test\",
                    \"codiceRegione\": \"13\"
                }
                """);

        when(aslMapper.dtoToEntity(dto)).thenReturn(entity);
        when(aslMapper.applyCodes(entity, "001", "13")).thenReturn(entity);
        when(aslRepository.findById(321L)).thenReturn(java.util.Optional.empty());
        when(aslRepository.save(any(ASLEntity.class))).thenReturn(entity);
        when(aslMapper.entityToDto(entity)).thenReturn(dto);

        List<ASLDto> imported = aslService.importFromSource(List.of(321L));

        assertThat(imported).hasSize(1);
        assertThat(imported.get(0).getId()).isEqualTo(321L);
        verify(aslRepository).save(any(ASLEntity.class));
        verify(aslMapper).applyCodes(eq(entity), eq("001"), eq("13"));
    }
}
