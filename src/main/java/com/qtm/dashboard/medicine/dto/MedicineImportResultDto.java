package com.qtm.dashboard.medicine.dto;

/**
 * Esito dell'importazione incrementale del catalogo AIFA.
 */
public record MedicineImportResultDto(long importedRows, long skippedRows) {
}