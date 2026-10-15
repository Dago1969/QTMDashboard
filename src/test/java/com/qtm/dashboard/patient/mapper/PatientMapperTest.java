package com.qtm.dashboard.patient.mapper;

import com.qtm.commonlib.dto.PatientDto;
import com.qtm.dashboard.patient.entity.PatientEntity;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class PatientMapperTest {

    @Test
    void mapsConsentRevocationFieldsBetweenDtoAndEntity() {
        LocalDateTime revocationDateTime = LocalDateTime.of(2026, 10, 12, 12, 30);
        PatientDto dto = new PatientDto();
        dto.setDataProcessingConsent(false);
        dto.setDataProcessingConsentDateTime(LocalDateTime.of(2026, 10, 11, 10, 15));
        dto.setDataProcessingConsentRevocationDateTime(revocationDateTime);
        dto.setDataProcessingConsentRevocationReason("Richiesta del paziente");

        PatientMapper mapper = new PatientMapper();
        PatientEntity entity = mapper.toEntity(dto);
        PatientDto mappedDto = mapper.toDto(entity);

        assertThat(entity.getDataProcessingConsentRevocationDateTime()).isEqualTo(revocationDateTime);
        assertThat(entity.getDataProcessingConsentRevocationReason()).isEqualTo("Richiesta del paziente");
        assertThat(mappedDto.getDataProcessingConsentRevocationDateTime()).isEqualTo(revocationDateTime);
        assertThat(mappedDto.getDataProcessingConsentRevocationReason()).isEqualTo("Richiesta del paziente");
        assertThat(mappedDto.getConsentRevoked()).isTrue();
    }

    @Test
    void doesNotMarkConsentRevokedWhenConsentIsActiveWithRevocationHistory() {
        PatientEntity entity = new PatientEntity();
        entity.setDataProcessingConsent(true);
        entity.setDataProcessingConsentRevocationDateTime(LocalDateTime.of(2026, 10, 12, 12, 30));

        PatientDto mappedDto = new PatientMapper().toDto(entity);

        assertThat(mappedDto.getConsentRevoked()).isFalse();
    }
}
