package com.qtm.dashboard.hospital.dto;

import com.qtm.commonlib.dto.HospitalDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class HospitalImportRequest {
    private List<Long> sourceIds;
    private List<HospitalDto> hospitals;
}
