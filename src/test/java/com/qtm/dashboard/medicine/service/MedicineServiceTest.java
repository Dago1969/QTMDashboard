package com.qtm.dashboard.medicine.service;

import com.qtm.dashboard.medicine.service.TicketMedicineClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MedicineServiceTest {

    @Mock
    private TicketMedicineClient ticketMedicineClient;

    @InjectMocks
    private MedicineService medicineService;

    @Test
    void searchVisibleForTenantsShouldDelegateToTicket() {
        when(ticketMedicineClient.searchVisibleForTenants(" asp ")).thenReturn(List.of());

        assertTrue(medicineService.searchVisibleForTenants(" asp ").isEmpty());

        verify(ticketMedicineClient).searchVisibleForTenants(" asp ");
    }

    @Test
    void searchVisibleForTenantsShouldForwardShortQueriesToTicketForValidation() {
        when(ticketMedicineClient.searchVisibleForTenants("ab")).thenReturn(List.of());

        assertTrue(medicineService.searchVisibleForTenants("ab").isEmpty());
        verify(ticketMedicineClient).searchVisibleForTenants("ab");
    }
}