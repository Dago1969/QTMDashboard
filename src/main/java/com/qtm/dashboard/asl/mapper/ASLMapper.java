package com.qtm.dashboard.asl.mapper;

import java.util.List;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qtm.commonlib.dto.ASLDto;
import com.qtm.commonlib.dto.ReferentDto;
import com.qtm.dashboard.asl.entity.ASLEntity;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class ASLMapper {

    private static final TypeReference<List<ReferentDto>> REFERENT_LIST_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;

    public ASLDto entityToDto(ASLEntity entity) {
        if (entity == null) {
            return null;
        }

        return ASLDto.builder()
                .id(entity.getId())
                .codiceAzienda(entity.getCodiceAzienda())
                .denominazioneAzienda(entity.getDenominazioneAzienda())
                .note(entity.getNote())
                .referents(readReferents(entity.getReferentsJson()))
                .build();
    }

    public ASLEntity dtoToEntity(ASLDto dto) {
        if (dto == null) {
            return null;
        }

        return ASLEntity.builder()
                .id(dto.getId())
                .codiceAzienda(dto.getCodiceAzienda())
                .denominazioneAzienda(dto.getDenominazioneAzienda())
                .note(dto.getNote())
                .referentsJson(writeReferents(dto.getReferents()))
                .build();
    }

    public ASLEntity applyCodes(ASLEntity entity, String codiceAzienda, String codiceRegione) {
        if (entity == null) {
            return null;
        }
        entity.setCodiceAzienda(codiceAzienda);
        entity.setCodiceRegione(codiceRegione);
        return entity;
    }

    private List<ReferentDto> readReferents(String referentsJson) {
        if (referentsJson == null || referentsJson.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(referentsJson, REFERENT_LIST_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Impossibile leggere i referenti ASL", exception);
        }
    }

    private String writeReferents(List<ReferentDto> referents) {
        try {
            return objectMapper.writeValueAsString(referents == null ? List.of() : referents);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Impossibile serializzare i referenti ASL", exception);
        }
    }
}
