package com.qtm.dashboard.project.mapper;

import com.qtm.commonlib.dto.ProjectDto;
import com.qtm.dashboard.project.entity.ProjectEntity;
import org.springframework.stereotype.Component;

/**
 * Mapper entity/DTO dei progetti centralizzati.
 */
@Component
public class ProjectMapper {

    public ProjectDto toDto(ProjectEntity entity) {
        ProjectDto dto = new ProjectDto();
        dto.setId(entity.getId());
        dto.setCode(entity.getCode());
        dto.setTenantId(entity.getTenant().getId());
        dto.setTenant(entity.getTenant().getClientName());
        dto.setClientCode(entity.getTenant().getClientCode());
        dto.setDescrizione(entity.getDescrizione());
        dto.setLogo(entity.getLogo());
        dto.setFooter(entity.getFooter());
        dto.setEmailSender(entity.getEmailSender());
        dto.setDataInizio(entity.getDataInizio());
        dto.setDataFine(entity.getDataFine());
        dto.setAdministrators(entity.getAdministrators());
        dto.setRoleIds(entity.getRoleIds());
        dto.setEnabledModuleCodes(entity.getEnabledModuleCodes());
        dto.setJsonVisit(entity.getJsonVisit());
        dto.setJsonSurvey(entity.getJsonSurvey());
        // Log di mapping DTO
        org.slf4j.LoggerFactory.getLogger(ProjectMapper.class).debug("[ProjectMapper] toDto: entity={}, dto={}", entity, dto);
        return dto;
    }
    
    public ProjectEntity toEntity(ProjectDto dto) {
        ProjectEntity entity = new ProjectEntity();
        entity.setId(dto.getId());
        entity.setCode(dto.getCode());
        // tenant va gestito dal service
        entity.setDescrizione(dto.getDescrizione());
        entity.setLogo(dto.getLogo());
        entity.setFooter(dto.getFooter());
        entity.setEmailSender(dto.getEmailSender());
        entity.setDataInizio(dto.getDataInizio());
        entity.setDataFine(dto.getDataFine());
        entity.setAdministrators(dto.getAdministrators());
        entity.setRoleIds(dto.getRoleIds());
        entity.setEnabledModuleCodes(dto.getEnabledModuleCodes());
        entity.setJsonVisit(dto.getJsonVisit());
        entity.setJsonSurvey(dto.getJsonSurvey());
        org.slf4j.LoggerFactory.getLogger(ProjectMapper.class).debug("[ProjectMapper] toEntity: dto={}, entity={}", dto, entity);
        return entity;
    }
}