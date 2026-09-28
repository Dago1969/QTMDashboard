package com.qtm.dashboard.hospital.mapper;

import java.util.List;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qtm.commonlib.dto.HospitalDto;
import com.qtm.commonlib.dto.ReferentDto;
import com.qtm.dashboard.hospital.entity.HospitalEntity;
import org.springframework.stereotype.Component;

@Component
public class HospitalMapper {

    private static final TypeReference<List<ReferentDto>> REFERENT_LIST_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;

    public HospitalMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public HospitalDto entityToDto(HospitalEntity entity) {
        if (entity == null) {
            return null;
        }
        return HospitalDto.builder()
                .id(entity.getId())
                .codiceRegione(entity.getCodiceRegione())
                .codiceAsl(entity.getCodiceAsl())
                .struttura(entity.getStruttura())
                .codiceStruttura(entity.getCodiceStruttura())
                .aslId(entity.getAslId())
                .build();
    }

    public HospitalEntity dtoToEntity(HospitalDto dto) {
        if (dto == null) {
            return null;
        }
        return HospitalEntity.builder()
                .id(dto.getId())
                .codiceRegione(dto.getCodiceRegione())
                .codiceAsl(dto.getCodiceAsl())
                .struttura(dto.getStruttura())
                .codiceStruttura(dto.getCodiceStruttura())
                .build();
    }

    public List<ReferentDto> readReferents(String referentsJson) {
        if (referentsJson == null || referentsJson.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(referentsJson, REFERENT_LIST_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Impossibile leggere i referenti ospedale", exception);
        }
    }

    public String writeReferents(List<ReferentDto> referents) {
        try {
            return objectMapper.writeValueAsString(referents == null ? List.of() : referents);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Impossibile serializzare i referenti ospedale", exception);
        }
    }
}
