package com.qtm.dashboard.project.service;

import com.qtm.commonlib.dto.ProjectDto;
import com.qtm.dashboard.project.entity.ProjectEntity;
import com.qtm.dashboard.project.mapper.ProjectMapper;
import com.qtm.dashboard.project.repository.ProjectRepository;
import com.qtm.dashboard.tenant.entity.TenantAppPointerEntity;
import com.qtm.dashboard.tenant.repository.TenantAppPointerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * Service CRUD dei progetti con risoluzione del tenant dal client selezionato in TENANTS-APP.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final TenantAppPointerRepository tenantAppPointerRepository;
    private final ProjectMapper projectMapper;
    private final ProjectAdministratorAssignmentService projectAdministratorAssignmentService;

    @Transactional
    public ProjectDto create(ProjectDto projectDto) {
        log.info("Avvio creazione project centralizzato: code={}, tenant={}, tenantId={}",
            projectDto.getCode(), projectDto.getTenant(), projectDto.getTenantId());
        log.info("[ProjectService] Amministratori ricevuti in create: {}",
            java.util.Optional.ofNullable(projectDto.getAdministrators()).orElse(java.util.List.of()).stream()
                .map(administrator -> administrator == null
                    ? "null"
                    : "{userId=" + administrator.getUserId()
                    + ", roleId=" + administrator.getRoleId()
                    + ", username=" + administrator.getUsername()
                    + ", email=" + administrator.getEmail() + "}")
                .toList());
        log.debug("[ProjectService] ProjectDto ricevuto: {}", projectDto);
        String normalizedCode = normalizeRequired(projectDto.getCode(), "Il codice progetto e obbligatorio");
        TenantAppPointerEntity tenant = resolveTenant(projectDto);
        validateUniqueCode(normalizedCode, tenant.getId(), null);

        ProjectEntity entity = new ProjectEntity();
        entity.setCode(normalizedCode);
        entity.setTenant(tenant);
        entity.setDescrizione(projectDto.getDescrizione());
        entity.setLogo(normalizeOptional(projectDto.getLogo()));
        entity.setFooter(normalizeOptional(projectDto.getFooter()));
        entity.setEmailSender(normalizeOptional(projectDto.getEmailSender()));
        entity.setDataInizio(projectDto.getDataInizio());
        entity.setDataFine(projectDto.getDataFine());
        entity.setAdministrators(projectDto.getAdministrators() == null
            ? java.util.List.of()
            : projectDto.getAdministrators());
        entity.setRoleIds(defaultList(projectDto.getRoleIds()));
        entity.setEnabledModuleCodes(defaultList(projectDto.getEnabledModuleCodes()));
        entity.setJsonVisit(normalizeOptional(projectDto.getJsonVisit()));
        entity.setJsonSurvey(normalizeOptional(projectDto.getJsonSurvey()));
        log.debug("[ProjectService] Entity da salvare: {}", entity);
        ProjectEntity savedProject = projectRepository.save(entity);
        projectAdministratorAssignmentService.synchronizeProjectAdministrators(savedProject);
        log.info("Project centralizzato creato: id={}, code={}, tenantId={}",
            savedProject.getId(), savedProject.getCode(), tenant.getId());
        return projectMapper.toDto(savedProject);
    }

    @Transactional(readOnly = true)
    public List<ProjectDto> findAll(String code, String tenant) {
            log.info("[Service] Ricerca progetti: code={}, tenant={}", code, tenant);
        String normalizedCode = normalizeFilter(code);
        String normalizedTenant = normalizeFilter(tenant);
        List<ProjectEntity> all = projectRepository.findAll();
        log.debug("[Service] Progetti totali in DB: {}", all.size());
        List<ProjectDto> filtered = all.stream()
                .filter(project -> matchesCode(project, normalizedCode))
                .filter(project -> matchesTenant(project, normalizedTenant))
                .map(projectMapper::toDto)
                .toList();
        log.info("[Service] Progetti filtrati restituiti: {}", filtered.size());
        return filtered;
    }

    @Transactional(readOnly = true)
    public ProjectDto findById(Long id) {
        log.debug("Avvio lettura project centralizzato: id={}", id);
        return projectMapper.toDto(findEntityById(id));
    }

    @Transactional
    public ProjectDto update(Long id, ProjectDto projectDto) {
        log.info("Avvio aggiornamento project centralizzato: id={}, code={}, tenant={}, tenantId={}",
                id, projectDto.getCode(), projectDto.getTenant(), projectDto.getTenantId());
        log.info("[ProjectService] Amministratori ricevuti in update: {}",
            java.util.Optional.ofNullable(projectDto.getAdministrators()).orElse(java.util.List.of()).stream()
                .map(administrator -> administrator == null
                    ? "null"
                    : "{userId=" + administrator.getUserId()
                    + ", roleId=" + administrator.getRoleId()
                    + ", username=" + administrator.getUsername()
                    + ", email=" + administrator.getEmail() + "}")
                .toList());
        ProjectEntity entity = findEntityById(id);
        String normalizedCode = normalizeRequired(projectDto.getCode(), "Il codice progetto e obbligatorio");
        TenantAppPointerEntity tenant = resolveTenant(projectDto);
        validateUniqueCode(normalizedCode, tenant.getId(), id);

        entity.setCode(normalizedCode);
        entity.setTenant(tenant);
        entity.setDescrizione(projectDto.getDescrizione());
        entity.setLogo(normalizeOptional(projectDto.getLogo()));
        entity.setFooter(normalizeOptional(projectDto.getFooter()));
        entity.setEmailSender(normalizeOptional(projectDto.getEmailSender()));
        entity.setDataInizio(projectDto.getDataInizio());
        entity.setDataFine(projectDto.getDataFine());
        if (projectDto.getAdministrators() != null) {
            entity.setAdministrators(projectDto.getAdministrators());
        }
        entity.setRoleIds(defaultList(projectDto.getRoleIds()));
        entity.setEnabledModuleCodes(defaultList(projectDto.getEnabledModuleCodes()));
        entity.setJsonVisit(normalizeOptional(projectDto.getJsonVisit()));
        entity.setJsonSurvey(normalizeOptional(projectDto.getJsonSurvey()));
        ProjectEntity savedProject = projectRepository.save(entity);
        if (projectDto.getAdministrators() != null) {
            projectAdministratorAssignmentService.synchronizeProjectAdministrators(savedProject);
        }
        log.info("Project centralizzato aggiornato: id={}, code={}, tenantId={}",
                savedProject.getId(), savedProject.getCode(), tenant.getId());
        return projectMapper.toDto(savedProject);
    }

    @Transactional
    public void delete(Long id) {
        log.info("Avvio eliminazione project centralizzato: id={}", id);
        projectRepository.delete(findEntityById(id));
        log.info("Project centralizzato eliminato: id={}", id);
    }

    private ProjectEntity findEntityById(Long id) {
        log.debug("Ricerca entity project centralizzato: id={}", id);
        return projectRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Project non trovato"));
    }

    private TenantAppPointerEntity resolveTenant(ProjectDto projectDto) {
        log.debug("Risoluzione tenant per project: tenantId={}, tenant={}", projectDto.getTenantId(), projectDto.getTenant());
        if (projectDto.getTenantId() != null) {
            return tenantAppPointerRepository.findById(projectDto.getTenantId())
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Tenant non trovato"));
        }

        String normalizedTenant = normalizeOptional(projectDto.getTenant());
        if (normalizedTenant == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Il tenant progetto e obbligatorio");
        }

    TenantAppPointerEntity resolvedTenant = tenantAppPointerRepository.findByClientNameIgnoreCaseAndEnabledTrue(normalizedTenant)
                .or(() -> tenantAppPointerRepository.findByClientCodeAndEnabledTrue(normalizedTenant))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Tenant non trovato per client: " + normalizedTenant));
    log.debug("Tenant risolto per project: tenantId={}, clientCode={}, clientName={}",
        resolvedTenant.getId(), resolvedTenant.getClientCode(), resolvedTenant.getClientName());
    return resolvedTenant;
    }

    private void validateUniqueCode(String code, Long tenantId, Long currentId) {
        boolean alreadyExists = currentId == null
                ? projectRepository.existsByCodeIgnoreCaseAndTenant_Id(code, tenantId)
                : projectRepository.existsByCodeIgnoreCaseAndTenant_IdAndIdNot(code, tenantId, currentId);

    log.debug("Verifica unicita project: code={}, tenantId={}, currentId={}, alreadyExists={}",
        code, tenantId, currentId, alreadyExists);
        if (alreadyExists) {
            throw new ResponseStatusException(CONFLICT, "Esiste gia un project con lo stesso code per il tenant selezionato");
        }
    }

    private boolean matchesCode(ProjectEntity entity, String code) {
        return code == null || entity.getCode().toLowerCase(Locale.ROOT).contains(code);
    }

    private boolean matchesTenant(ProjectEntity entity, String tenant) {
        if (tenant == null) {
            return true;
        }

        String clientName = entity.getTenant().getClientName();
        String clientCode = entity.getTenant().getClientCode();
        return (clientName != null && clientName.toLowerCase(Locale.ROOT).contains(tenant))
                || (clientCode != null && clientCode.toLowerCase(Locale.ROOT).contains(tenant));
    }

    private String normalizeRequired(String value, String message) {
        String normalized = normalizeOptional(value);
        if (normalized == null) {
            throw new ResponseStatusException(BAD_REQUEST, message);
        }
        return normalized;
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeFilter(String value) {
        String normalized = normalizeOptional(value);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private List<String> defaultList(List<String> values) {
        return values == null ? List.of() : values;
    }
}