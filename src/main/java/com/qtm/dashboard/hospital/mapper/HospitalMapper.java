package com.qtm.dashboard.hospital.mapper;

import com.qtm.commonlib.dto.HospitalDto;
import com.qtm.dashboard.hospital.entity.HospitalEntity;
import org.springframework.stereotype.Component;

@Component
public class HospitalMapper {

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
                .referentsJson(null)
                .build();
    }
}
