package com.qtm.dashboard.dto;

import com.qtm.commonlib.dto.RegionDto;
import lombok.*;
import java.util.List;

/**
 * DTO per Country.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CountryDto {
    private Long id;
    private String countryCode;
    private String belfioreCode;
    private String name;
    private String nationalityName;
    private List<RegionDto> regions;
}
