package com.qtm.dashboard.dto;

import java.io.Serializable;
import java.util.Objects;

/**
 * Minimal DTO used to represent a project administrator inside the entity JSON column.
 * If you already have a canonical definition in another module, prefer moving this class there
 * or adding the appropriate dependency instead of keeping a duplicate.
 */
public class ProjectAdministratorDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long id;
    private String username;
    private String displayName;
    private String email;

    public ProjectAdministratorDto() {
    }

    public ProjectAdministratorDto(Long id, String username, String displayName, String email) {
        this.id = id;
        this.username = username;
        this.displayName = displayName;
        this.email = email;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ProjectAdministratorDto that = (ProjectAdministratorDto) o;
        return Objects.equals(id, that.id) && Objects.equals(username, that.username) && Objects.equals(email, that.email);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, username, email);
    }

    @Override
    public String toString() {
        return "ProjectAdministratorDto{" +
                "id=" + id +
                ", username='" + username + '\'' +
                ", displayName='" + displayName + '\'' +
                ", email='" + email + '\'' +
                '}';
    }
}
