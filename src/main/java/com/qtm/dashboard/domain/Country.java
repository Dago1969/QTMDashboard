package com.qtm.dashboard.domain;

import jakarta.persistence.*;
import lombok.*;
import java.util.List;

/**
 * Entity che rappresenta una nazione secondo il tracciato gi_db_comuni.
 */
@Entity
@Table(name = "country")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Country {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sigla_nazione", nullable = false, length = 6, unique = true)
    private String countryCode;

    @Column(name = "codice_belfiore", length = 8, unique = true)
    private String belfioreCode;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "denominazione_cittadinanza", nullable = false, length = 100)
    private String nationalityName;

//    @OneToMany(mappedBy = "country", cascade = CascadeType.ALL, orphanRemoval = true)
//    private List<Region> regions;
}
