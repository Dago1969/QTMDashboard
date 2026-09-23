package com.qtm.dashboard.patient.mapper;

import com.qtm.commonlib.dto.PatientDto;
import com.qtm.dashboard.patient.entity.PatientEntity;
import org.springframework.stereotype.Component;

/**
 * Mapper tra entity paziente locale e DTO condiviso.
 */
@Component
public class PatientMapper {

    public void updateEntity(PatientEntity entity, PatientDto dto) {
        entity.setAssistedId(dto.getAssistedId());
        entity.setFirstName(dto.getFirstName());
        entity.setLastName(dto.getLastName());
        entity.setFiscalCode(dto.getFiscalCode());
        entity.setEmail(dto.getEmail());
        entity.setPrimaryPhone(dto.getPrimaryPhone());
        entity.setSecondaryPhone(dto.getSecondaryPhone());
        entity.setRegionId(dto.getRegionId());
        entity.setRegion(dto.getRegion());
        entity.setProvinceId(dto.getProvinceId());
        entity.setProvince(dto.getProvince());
        entity.setCityId(dto.getCityId());
        entity.setCity(dto.getCity());
        entity.setDeliveryAddress(dto.getDeliveryAddress());
        entity.setSecondaryAddresses(dto.getSecondaryAddresses());
        entity.setCommunicationChannels(dto.getCommunicationChannels());
        entity.setIdentificationDocumentReference(dto.getIdentificationDocumentReference());
        entity.setDataProcessingConsent(dto.getDataProcessingConsent());
        entity.setDataProcessingConsentDateTime(dto.getDataProcessingConsentDateTime());
        entity.setDataProcessingConsentRevocationLog(dto.getDataProcessingConsentRevocationLog());
        entity.setAdditionalConsents(dto.getAdditionalConsents());
        entity.setTherapyStatus(dto.getTherapyStatus());
        entity.setPrescribingSpecialist(dto.getPrescribingSpecialist());
        entity.setReferenceHospitalStructure(dto.getReferenceHospitalStructure());
        entity.setReferencePharmacy(dto.getReferencePharmacy());
        entity.setPreferredPickupPharmacy(dto.getPreferredPickupPharmacy());
        entity.setDepartmentId(dto.getDepartmentId());
        entity.setDeliveryMode(dto.getDeliveryMode());
        entity.setReminderEnabled(dto.getReminderEnabled());
        entity.setCaregiverFullName(dto.getCaregiverFullName());
        entity.setCaregiverPhone(dto.getCaregiverPhone());
        entity.setPreferredContact(dto.getPreferredContact());
        entity.setStructureId(dto.getStructureId());
        entity.setBirthDate(dto.getBirthDate());
        // Sesso: 'M'=maschio, 'F'=femmina
        entity.setGender(dto.getGender());
    }

    public PatientDto toDto(PatientEntity entity) {
        PatientDto dto = new PatientDto();
        dto.setId(entity.getId());
        dto.setAssistedId(entity.getAssistedId());
        dto.setFirstName(entity.getFirstName());
        dto.setLastName(entity.getLastName());
        dto.setFiscalCode(entity.getFiscalCode());
        dto.setEmail(entity.getEmail());
        dto.setPrimaryPhone(entity.getPrimaryPhone());
        dto.setSecondaryPhone(entity.getSecondaryPhone());
        dto.setRegionId(entity.getRegionId());
        dto.setRegion(entity.getRegion());
        dto.setProvinceId(entity.getProvinceId());
        dto.setProvince(entity.getProvince());
        dto.setCityId(entity.getCityId());
        dto.setCity(entity.getCity());
        dto.setDeliveryAddress(entity.getDeliveryAddress());
        dto.setSecondaryAddresses(entity.getSecondaryAddresses());
        dto.setCommunicationChannels(entity.getCommunicationChannels());
        dto.setIdentificationDocumentReference(entity.getIdentificationDocumentReference());
        dto.setDataProcessingConsent(entity.getDataProcessingConsent());
        dto.setDataProcessingConsentDateTime(entity.getDataProcessingConsentDateTime());
        dto.setDataProcessingConsentRevocationLog(entity.getDataProcessingConsentRevocationLog());
        dto.setAdditionalConsents(entity.getAdditionalConsents());
        dto.setTherapyStatus(entity.getTherapyStatus());
        dto.setPrescribingSpecialist(entity.getPrescribingSpecialist());
        dto.setReferenceHospitalStructure(entity.getReferenceHospitalStructure());
        dto.setReferencePharmacy(entity.getReferencePharmacy());
        dto.setPreferredPickupPharmacy(entity.getPreferredPickupPharmacy());
        dto.setDepartmentId(entity.getDepartmentId());
        dto.setDeliveryMode(entity.getDeliveryMode());
        dto.setReminderEnabled(entity.getReminderEnabled());
        dto.setCaregiverFullName(entity.getCaregiverFullName());
        dto.setCaregiverPhone(entity.getCaregiverPhone());
        dto.setPreferredContact(entity.getPreferredContact());
        dto.setStructureId(entity.getStructureId());
        dto.setBirthDate(entity.getBirthDate());
        // Sesso: 'M'=maschio, 'F'=femmina
        dto.setGender(entity.getGender());
        return dto;
    }

    public PatientEntity toEntity(PatientDto dto) {
        PatientEntity entity = new PatientEntity();
        entity.setId(dto.getId());
        updateEntity(entity, dto);
        return entity;
    }
}