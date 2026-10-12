package com.qtm.dashboard.medicine.dto;

/**
 * Aggiornamento dell'associazione di visibilità di un farmaco verso TENAPP.
 */
public record MedicineVisibilityRequestDto(boolean visibleForTenants) {
}