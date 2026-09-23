package com.qtm.dashboard.patient.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

import java.time.LocalDate;

/**
 * Entity paziente persistita direttamente in QTMDB.
 */
@Entity
@Table(name = "patients")
@Getter
@Setter
@NoArgsConstructor
public class PatientEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assisted_id", unique = true)
    private String assistedId;

    /**
     * Data di nascita del paziente.
     */
    @Column(name = "birth_date")
    private LocalDate birthDate;

    /**
     * Sesso del paziente ('M'=maschio, 'F'=femmina).
     */
    @Column(name = "gender", length = 1)
    private String gender;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(name = "fiscal_code", nullable = false, unique = true)
    private String fiscalCode;

    @Column(name = "email")
    private String email;

    @Column(name = "primary_phone")
    private String primaryPhone;

    @Column(name = "secondary_phone")
    private String secondaryPhone;

    @Column(name = "region_id")
    private Long regionId;

    @Column(name = "region")
    private String region;

    @Column(name = "province_id")
    private Long provinceId;

    @Column(name = "province")
    private String province;

    @Column(name = "city_id")
    private Long cityId;

    @Column(name = "city")
    private String city;

    @Column(name = "delivery_address")
    private String deliveryAddress;

    @Column(name = "secondary_addresses", length = 2000)
    private String secondaryAddresses;

    @Column(name = "communication_channels")
    private String communicationChannels;

    @Column(name = "identification_document_reference", length = 2000)
    private String identificationDocumentReference;

    @Column(name = "data_processing_consent")
    private Boolean dataProcessingConsent;

    @Column(name = "data_processing_consent_datetime")
    private LocalDateTime dataProcessingConsentDateTime;

    @Column(name = "data_processing_consent_revocation_log", length = 4000)
    private String dataProcessingConsentRevocationLog;

    @Column(name = "additional_consents", length = 2000)
    private String additionalConsents;

    @Column(name = "therapy_status")
    private String therapyStatus;

    @Column(name = "prescribing_specialist")
    private Long prescribingSpecialist;

    @Column(name = "reference_hospital_structure")
    private String referenceHospitalStructure;

    @Column(name = "reference_pharmacy")
    private String referencePharmacy;

    @Column(name = "preferred_pickup_pharmacy")
    private String preferredPickupPharmacy;

    @Column(name = "delivery_mode")
    private String deliveryMode;

    @Column(name = "reminder_enabled")
    private Boolean reminderEnabled;

    @Column(name = "caregiver_full_name")
    private String caregiverFullName;

    @Column(name = "caregiver_phone")
    private String caregiverPhone;

    @Column(name = "preferred_contact")
    private String preferredContact;

    @Column(name = "structure_id")
    private Long structureId;

    @Column(name = "department_id")
    private Long departmentId;
}