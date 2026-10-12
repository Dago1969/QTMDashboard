package com.qtm.dashboard.medicine.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qtm.commonlib.dto.FarmacoDto;
import com.qtm.commonlib.dto.MedicineDto;
import com.qtm.dashboard.medicine.dto.MedicineImportResultDto;
import com.qtm.dashboard.medicine.dto.MedicineVisibilityRequestDto;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;

/**
 * Client REST verso QTMTicket, proprietario del catalogo farmaci condiviso.
 */
@Service
public class TicketMedicineClient {

    private static final ParameterizedTypeReference<List<MedicineDto>> MEDICINE_LIST_TYPE = new ParameterizedTypeReference<>() {
    };
    private static final ParameterizedTypeReference<List<FarmacoDto>> DRUG_LIST_TYPE = new ParameterizedTypeReference<>() {
    };

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public TicketMedicineClient(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${services.ticket-service.url:http://localhost:8084/api/ticket}") String ticketUrl
    ) {
        this.restClient = restClientBuilder.baseUrl(ticketUrl).build();
        this.objectMapper = objectMapper;
    }

    public List<MedicineDto> search(MedicineSearchCriteria criteria) {
        return execute(() -> restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/medicines")
                        .queryParamIfPresent("codiceAic", Optional.ofNullable(criteria.codiceAic()))
                        .queryParamIfPresent("codFarmaco", Optional.ofNullable(criteria.codFarmaco()))
                        .queryParamIfPresent("codConfezione", Optional.ofNullable(criteria.codConfezione()))
                        .queryParamIfPresent("denominazione", Optional.ofNullable(criteria.denominazione()))
                        .queryParamIfPresent("descrizione", Optional.ofNullable(criteria.descrizione()))
                        .queryParamIfPresent("codiceAtc", Optional.ofNullable(criteria.codiceAtc()))
                        .queryParamIfPresent("ragioneSociale", Optional.ofNullable(criteria.ragioneSociale()))
                        .queryParamIfPresent("statoAmministrativo", Optional.ofNullable(criteria.statoAmministrativo()))
                        .build())
                .headers(this::applyForwardedHeaders)
                .retrieve()
                .body(MEDICINE_LIST_TYPE));
    }

    public List<MedicineDto> lookup(String query) {
        return execute(() -> restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/medicines/lookup")
                        .queryParamIfPresent("query", Optional.ofNullable(query))
                        .build())
                .headers(this::applyForwardedHeaders)
                .retrieve()
                .body(MEDICINE_LIST_TYPE));
    }

    public List<FarmacoDto> searchVisibleForTenants(String query) {
        return execute(() -> restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/tenants/ticket/drugs/search")
                        .queryParam("query", query)
                        .build())
                .headers(this::applyForwardedHeaders)
                .retrieve()
                .body(DRUG_LIST_TYPE));
    }

    public Page<MedicineDto> searchAssociations(MedicineSearchCriteria criteria, int page, int size) {
        return execute(() -> {
            JsonNode response = restClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/medicines/associations")
                            .queryParamIfPresent("codiceAic", Optional.ofNullable(criteria.codiceAic()))
                            .queryParamIfPresent("codFarmaco", Optional.ofNullable(criteria.codFarmaco()))
                            .queryParamIfPresent("codConfezione", Optional.ofNullable(criteria.codConfezione()))
                            .queryParamIfPresent("denominazione", Optional.ofNullable(criteria.denominazione()))
                            .queryParamIfPresent("descrizione", Optional.ofNullable(criteria.descrizione()))
                            .queryParamIfPresent("codiceAtc", Optional.ofNullable(criteria.codiceAtc()))
                            .queryParamIfPresent("ragioneSociale", Optional.ofNullable(criteria.ragioneSociale()))
                            .queryParamIfPresent("statoAmministrativo", Optional.ofNullable(criteria.statoAmministrativo()))
                            .queryParam("page", page)
                            .queryParam("size", size)
                            .build())
                    .headers(this::applyForwardedHeaders)
                    .retrieve()
                    .body(JsonNode.class);
            if (response == null) {
                return Page.empty(PageRequest.of(Math.max(page, 0), Math.max(size, 1)));
            }
            List<MedicineDto> content = objectMapper.convertValue(response.path("content"), new TypeReference<>() {
            });
            int resultPage = response.path("number").asInt(page);
            int resultSize = response.path("size").asInt(Math.max(size, 1));
            long total = response.path("totalElements").asLong(content.size());
            return new PageImpl<>(content, PageRequest.of(resultPage, resultSize, Sort.by("denominazione").ascending()), total);
        });
    }

    public MedicineDto updateTenantVisibility(Long id, boolean visible) {
        return execute(() -> restClient.put()
                .uri("/medicines/{id}/tenant-visibility", id)
                .headers(this::applyForwardedHeaders)
                .body(new MedicineVisibilityRequestDto(visible))
                .retrieve()
                .body(MedicineDto.class));
    }

    public MedicineImportResultDto importFromAifa() {
        return execute(() -> restClient.post()
                .uri("/medicines/import/aifa")
                .headers(this::applyForwardedHeaders)
                .retrieve()
                .body(MedicineImportResultDto.class));
    }

    public MedicineDto findByCodiceAic(String codiceAic) {
        return execute(() -> restClient.get()
                .uri("/medicines/codice-aic/{codiceAic}", codiceAic)
                .headers(this::applyForwardedHeaders)
                .retrieve()
                .body(MedicineDto.class));
    }

    public MedicineDto findById(Long id) {
        return execute(() -> restClient.get()
                .uri("/medicines/{id}", id)
                .headers(this::applyForwardedHeaders)
                .retrieve()
                .body(MedicineDto.class));
    }

    public MedicineDto create(MedicineDto medicineDto) {
        return execute(() -> restClient.post()
                .uri("/medicines")
                .headers(this::applyForwardedHeaders)
                .body(medicineDto)
                .retrieve()
                .body(MedicineDto.class));
    }

    public MedicineDto update(Long id, MedicineDto medicineDto) {
        return execute(() -> restClient.put()
                .uri("/medicines/{id}", id)
                .headers(this::applyForwardedHeaders)
                .body(medicineDto)
                .retrieve()
                .body(MedicineDto.class));
    }

    public void delete(Long id) {
        execute(() -> restClient.delete()
                .uri("/medicines/{id}", id)
                .headers(this::applyForwardedHeaders)
                .retrieve()
                .toBodilessEntity());
    }

    private void applyForwardedHeaders(HttpHeaders headers) {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            copyHeader(request, headers, HttpHeaders.AUTHORIZATION);
            copyHeader(request, headers, "X-Selected-Role");
            copyHeader(request, headers, "X-Selected-Client");
            copyHeader(request, headers, "X-Selected-Project");
        }
    }

    private void copyHeader(HttpServletRequest request, HttpHeaders headers, String headerName) {
        String value = request.getHeader(headerName);
        if (value != null && !value.isBlank()) {
            headers.set(headerName, value.trim());
        }
    }

    private <T> T execute(RestCall<T> call) {
        try {
            return call.execute();
        } catch (RestClientResponseException exception) {
            String body = exception.getResponseBodyAsString();
            throw new ResponseStatusException(exception.getStatusCode(),
                    body == null || body.isBlank() ? "Errore restituito da QTMTicket durante la gestione farmaci" : body,
                    exception);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(BAD_GATEWAY, "Servizio catalogo farmaci QTMTicket non disponibile", exception);
        }
    }

    @FunctionalInterface
    private interface RestCall<T> {
        T execute();
    }
}