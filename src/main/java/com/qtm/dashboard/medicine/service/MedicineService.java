package com.qtm.dashboard.medicine.service;

import com.qtm.commonlib.dto.FarmacoDto;
import com.qtm.commonlib.dto.MedicineDto;
import com.qtm.dashboard.medicine.dto.MedicineImportResultDto;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Facade compatibile per le API Dashboard, con persistenza delegata al catalogo QTMTicket.
 */
@Service
public class MedicineService {

    private final TicketMedicineClient ticketMedicineClient;

    public MedicineService(TicketMedicineClient ticketMedicineClient) {
        this.ticketMedicineClient = ticketMedicineClient;
    }

    public MedicineDto create(MedicineDto medicineDto) {
        return ticketMedicineClient.create(medicineDto);
    }

    public List<MedicineDto> search(MedicineSearchCriteria criteria) {
        return ticketMedicineClient.search(criteria);
    }

    public MedicineDto findById(Long id) {
        return ticketMedicineClient.findById(id);
    }

    public MedicineDto findByCodiceAic(String codiceAic) {
        return ticketMedicineClient.findByCodiceAic(codiceAic);
    }

    public List<MedicineDto> lookup(String query) {
        return ticketMedicineClient.lookup(query);
    }

    public List<FarmacoDto> searchVisibleForTenants(String query) {
        return ticketMedicineClient.searchVisibleForTenants(query);
    }

    public Page<MedicineDto> searchAssociations(MedicineSearchCriteria criteria, int page, int size) {
        return ticketMedicineClient.searchAssociations(criteria, page, size);
    }

    public MedicineDto updateTenantVisibility(Long id, boolean visible) {
        return ticketMedicineClient.updateTenantVisibility(id, visible);
    }

    public MedicineDto update(Long id, MedicineDto medicineDto) {
        return ticketMedicineClient.update(id, medicineDto);
    }

    public void delete(Long id) {
        ticketMedicineClient.delete(id);
    }

    public MedicineImportResultDto importFromAifa() {
        return ticketMedicineClient.importFromAifa();
    }
}