package com.qtm.dashboard.project.entity;

import com.qtm.dashboard.tenant.entity.TenantAppPointerEntity;
import com.qtm.commonlib.dto.ProjectAdministratorDto;
import jakarta.persistence.Convert;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity progetto centralizzata su QTMDashboard con riferimento al tenant cliente.
 */
@Entity
@Table(
        name = "projects",
        uniqueConstraints = @UniqueConstraint(name = "uk_projects_code_tenant", columnNames = {"code", "tenant_id"})
)
@Getter
@Setter
@NoArgsConstructor
public class ProjectEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", nullable = false, length = 255)
    private String code;

    /**
     * Descrizione del progetto.
     */
    @Column(name = "descrizione", length = 1024)
    private String descrizione;

    @Column(name = "logo", length = 1024)
    private String logo;

    @Column(name = "footer", columnDefinition = "TEXT")
    private String footer;

    @Column(name = "email_sender", length = 255)
    private String emailSender;

    /**
     * Data di inizio progetto.
     */
    @Column(name = "data_inizio")
    private LocalDate dataInizio;

    /**
     * Data di fine progetto.
     */
    @Column(name = "data_fine")
    private LocalDate dataFine;

    @Convert(converter = ProjectAdministratorsJsonConverter.class)
    @Column(name = "administrators_json", columnDefinition = "TEXT")
    private List<ProjectAdministratorDto> administrators = new ArrayList<>();

    @Convert(converter = StringListJsonConverter.class)
    @Column(name = "role_ids_json", columnDefinition = "TEXT")
    private List<String> roleIds = new ArrayList<>();

    @Convert(converter = StringListJsonConverter.class)
    @Column(name = "enabled_module_codes_json", columnDefinition = "TEXT")
    private List<String> enabledModuleCodes = new ArrayList<>();

    @Lob
    @Column(name = "json_visit", columnDefinition = "TEXT")
    private String jsonVisit;

    @Lob
    @Column(name = "json_survey", columnDefinition = "TEXT")
    private String jsonSurvey;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private TenantAppPointerEntity tenant;
}