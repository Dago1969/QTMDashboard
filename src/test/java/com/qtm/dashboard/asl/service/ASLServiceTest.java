package com.qtm.dashboard.asl.service;

import com.qtm.commonlib.dto.ASLDto;
import com.qtm.dashboard.asl.entity.ASLEntity;
import com.qtm.dashboard.asl.mapper.ASLMapper;
import com.qtm.dashboard.asl.repository.ASLRepository;
import com.qtm.dashboard.domain.City;
import com.qtm.dashboard.domain.Province;
import com.qtm.dashboard.domain.Region;
import com.qtm.dashboard.repository.CityRepository;
import com.qtm.dashboard.repository.RegionRepository;
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
    private CityRepository cityRepository;

        @Mock
        private RegionRepository regionRepository;

    @Mock
    private RestClient restClient;

    @Mock
    private RestClient.RequestHeadersUriSpec<?> requestHeadersUriSpec;

    @Mock
    private RestClient.ResponseSpec responseSpec;

    @Test
    void findAllWithImportStatusShouldExposeAnnoProvinceAndRegion() {
                ASLService aslService = new ASLService(aslRepository, aslMapper, cityRepository, regionRepository, restClient, "http://ticket.test");

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

        Region region = Region.builder().id(13L).name("Abruzzo").regionCode("13").build();
        Province province = Province.builder().id(6L).name("L'Aquila").region(region).build();
        City city = City.builder().id(5394L).name("Avezzano").province(province).build();

        when(aslRepository.findAll()).thenReturn(List.of(localEntity));
        when(cityRepository.findAllById(List.of(5394L))).thenReturn(List.of(city));
        when(regionRepository.findByRegionCodeIn(List.of("13"))).thenReturn(List.of(region));
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
                ASLService aslService = new ASLService(aslRepository, aslMapper, cityRepository, regionRepository, restClient, "http://ticket.test");

                ASLDto source = ASLDto.builder()
                                .id(91L)
                                .anno(2015)
                                .codiceAzienda("101")
                                .denominazioneAzienda("RM/A")
                                .codiceRegione("12")
                                .cityId(6068L)
                                .indirizzo("VIA ARIOSTO 3/9")
                                .build();

                Region lazio = Region.builder().id(12L).name("Lazio").regionCode("12").build();
                Region campania = Region.builder().id(15L).name("Campania").regionCode("15").build();
                Province avellino = Province.builder().id(64L).name("Avellino").region(campania).build();
                City mismatchedCity = City.builder().id(6068L).name("Avellino").province(avellino).build();

                when(aslRepository.findAll()).thenReturn(List.of());
                when(cityRepository.findAllById(List.of(6068L))).thenReturn(List.of(mismatchedCity));
                when(regionRepository.findByRegionCodeIn(List.of("12"))).thenReturn(List.of(lazio));
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
                ASLService aslService = new ASLService(aslRepository, aslMapper, cityRepository, regionRepository, restClient, "http://ticket.test");

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
