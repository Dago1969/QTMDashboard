package com.qtm.dashboard.user.service;

import com.qtm.commonlib.dto.UserDto;
import com.qtm.dashboard.auth.dto.LoginRequest;
import com.qtm.dashboard.auth.service.KeycloakAuthService;
import com.qtm.dashboard.config.KeycloakProperties;
import com.qtm.dashboard.mail.entity.MailTemplateEntity;
import com.qtm.dashboard.mail.repository.MailTemplateRepository;
import com.qtm.dashboard.mail.service.MailService;
import com.qtm.dashboard.user.entity.RoleEntity;
import com.qtm.dashboard.user.entity.UserEntity;
import com.qtm.dashboard.user.mapper.UserMapper;
import com.qtm.dashboard.user.repository.RoleRepository;
import com.qtm.dashboard.user.repository.UserRepository;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.keycloak.admin.client.resource.ClientResource;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.RolesResource;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.ClientRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.LinkedHashSet;
import java.util.stream.Stream;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

/**
 * Service dedicato al provisioning utente su Keycloak e sul DB locale.
 * Riceve un UserDto, verifica l'utente su DB e Keycloak, associa il client richiesto,
 * genera una password definitiva, la applica su Keycloak e inserisce l'utente nel DB se assente.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserProvisioningService {

    private static final int PASSWORD_VALIDITY_MONTHS = 6;

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserMapper userMapper;
    private final KeycloakProperties keycloakProperties;
    private final KeycloakAuthService keycloakAuthService;
    private final MailTemplateRepository mailTemplateRepository;
    private final MailService mailService;
    private final UserRoleProfileService userRoleProfileService;

    @Value("${app.tenants.default-tenant-app-url:http://localhost:4201/dashboard}")
    private String loginUrl;

    @Transactional
    public UserDto provisionUser(UserDto userDto) {
        String normalizedUsername = normalizeRequired(userDto.getUsername(), "Username obbligatorio");
        String requestedClientId = resolveRequestedClientId(userDto);
        String generatedPassword = generatePassword();

        log.info("[UserProvisioningService] Avvio provisioning Keycloak: username={}, email={}, enabled={}, roleId={}, requestedClientId={}",
            normalizedUsername,
            userDto.getEmail(),
            userDto.isEnabled(),
            userDto.getRoleId(),
            requestedClientId);

        Optional<UserEntity> existingDbUser = userRepository.findByUsernameIgnoreCase(normalizedUsername);

        Keycloak keycloak = buildAdminClient();
        try {
            RealmResource realmResource = keycloak.realm(requiredRealm());
            ClientRepresentation requestedClient = resolveClient(realmResource, requestedClientId);
            List<String> requestedRealmRoleNames = resolveRequestedRealmRoleNames(userDto.getRoleId());
            List<String> requestedClientRoleNames = resolveRequestedClientRoleNames(userDto.getRoleId());

            log.info("[UserProvisioningService] Client Keycloak risolto: requestedClientId={}, resolvedClientUuid={}, requestedRealmRoleNames={}, requestedClientRoleNames={}",
                requestedClient != null ? requestedClient.getClientId() : null,
                requestedClient != null ? requestedClient.getId() : null,
                requestedRealmRoleNames,
                requestedClientRoleNames);

            UserResource keycloakUserResource = upsertKeycloakUser(
                    realmResource,
                    userDto,
                    normalizedUsername,
                    requestedClient,
                    requestedRealmRoleNames,
                    requestedClientRoleNames);

                log.info("[UserProvisioningService] Password temporanea generata per username={}", normalizedUsername);
            applyPassword(keycloakUserResource, generatedPassword);
                log.info("[UserProvisioningService] Password applicata in Keycloak per username={}", normalizedUsername);

            UserEntity persistedEntity = upsertDatabaseUser(userDto, normalizedUsername, generatedPassword, existingDbUser.orElse(null));
                log.info("[UserProvisioningService] Utente persistito nel database username={}, userId={}",
                    normalizedUsername, persistedEntity.getId());

            UserDto result = userMapper.toDto(persistedEntity);
            result.setClientId(requestedClientId);
            result.setPassword(generatedPassword);
            result.setTemporaryPassword(true);
            sendOnboardingMail(result, generatedPassword);
            return result;
        } catch (Exception exception) {
            log.error("[UserProvisioningService] Errore durante provisioning: username={}, email={}, roleId={}, requestedClientId={}, details={}",
                    normalizedUsername,
                    userDto.getEmail(),
                    userDto.getRoleId(),
                    requestedClientId,
                    summarizeExceptionChain(exception),
                    exception);
            throw exception;
        } finally {
            keycloak.close();
        }
    }

    private void sendOnboardingMail(UserDto userDto, String generatedPassword) {
        // Se il client esterno gestisce l'invio della mail, salta
        if (userDto.isSkipOnboardingMail()) {
            log.info("[UserProvisioningService] Invio onboarding saltato per username={}: skipOnboardingMail=true", userDto.getUsername());
            return;
        }

        if (userDto.getEmail() == null || userDto.getEmail().isBlank()) {
            log.info("[UserProvisioningService] Invio onboarding saltato: email assente per username={}", userDto.getUsername());
            return;
        }

        MailTemplateEntity template = mailTemplateRepository
                .findByCodeAndLanguageAndEnabledTrue("ONBOARDING", "it")
                .or(() -> mailTemplateRepository.findByCodeAndEnabledTrue("ONBOARDING"))
                .orElse(null);

        if (template == null) {
            log.warn("[UserProvisioningService] Nessun template ONBOARDING abilitato trovato");
            return;
        }

        String body = template.getBody()
                .replace("${firstName}", userDto.getUsername())
                .replace("${username}", userDto.getUsername())
                .replace("${password}", generatedPassword)
                .replace("${loginUrl}", loginUrl);

        boolean sent = mailService.send(userDto.getEmail(), template.getSubject(), body);
        if (sent) {
            log.info("[UserProvisioningService] Mail onboarding inviata a {}", userDto.getEmail());
        }
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void synchronizeExistingUserClientRoles(Long userId, String requestedClientId, List<String> roleIds) {
        UserEntity userEntity = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Utente non trovato: " + userId));

        String normalizedUsername = normalizeRequired(userEntity.getUsername(), "Username utente mancante");
        String normalizedClientId = normalizeRequired(requestedClientId, "Client Keycloak mancante");
        List<String> requestedClientRoleNames = resolveRequestedClientRoleNames(roleIds);

        log.info("[UserProvisioningService] Avvio synchronizeExistingUserClientRoles: userId={}, username={}, requestedClientId={}, roleIds={}, resolvedClientRoleNames={}",
            userId,
            normalizedUsername,
            normalizedClientId,
            Optional.ofNullable(roleIds).orElse(List.of()),
            requestedClientRoleNames);

        Keycloak keycloak = buildAdminClient();
        try {
            RealmResource realmResource = keycloak.realm(requiredRealm());
            ClientRepresentation requestedClient = resolveClient(realmResource, normalizedClientId);
            UserRepresentation existingUser = findKeycloakUser(realmResource, normalizedUsername);
            if (existingUser == null) {
                log.error("[UserProvisioningService] Utente Keycloak non trovato durante la sincronizzazione: userId={}, username={}, clientId={}",
                    userId,
                    normalizedUsername,
                    normalizedClientId);
                throw new ResponseStatusException(NOT_FOUND, "Utente Keycloak non trovato: " + normalizedUsername);
            }

            log.info("[UserProvisioningService] Risorse Keycloak risolte: realm={}, clientId={}, clientUuid={}, keycloakUserId={}, keycloakUsername={}, enabled={}",
                requiredRealm(),
                requestedClient != null ? requestedClient.getClientId() : null,
                requestedClient != null ? requestedClient.getId() : null,
                existingUser.getId(),
                existingUser.getUsername(),
                existingUser.isEnabled());

            UserResource userResource = realmResource.users().get(existingUser.getId());
            synchronizeClientAssociation(userResource, normalizedClientId);
            synchronizeClientRoleAssociation(userResource, realmResource, requestedClient, requestedClientRoleNames);
            log.info("[UserProvisioningService] Sincronizzazione Keycloak completata: userId={}, username={}, clientId={}",
                userId,
                normalizedUsername,
                normalizedClientId);
        } catch (Exception exception) {
            log.error("[UserProvisioningService] Errore durante synchronizeExistingUserClientRoles: userId={}, username={}, requestedClientId={}, roleIds={}, resolvedClientRoleNames={}, details={}",
                userId,
                normalizedUsername,
                normalizedClientId,
                Optional.ofNullable(roleIds).orElse(List.of()),
                requestedClientRoleNames,
                summarizeExceptionChain(exception),
                exception);
            throw exception;
        } finally {
            keycloak.close();
        }
    }

    /**
     * Elimina l'utente da Keycloak se presente, usando lo username locale come identificativo canonico.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void deleteUserFromKeycloak(String username) {
        String normalizedUsername = normalizeRequired(username, "Username obbligatorio per cancellazione Keycloak");

        Keycloak keycloak = buildAdminClient();
        try {
            RealmResource realmResource = keycloak.realm(requiredRealm());
            UserRepresentation existingUser = findKeycloakUser(realmResource, normalizedUsername);
            if (existingUser == null) {
                log.warn("[UserProvisioningService] Cancellazione Keycloak saltata: utente non trovato per username={}", normalizedUsername);
                return;
            }

            realmResource.users().delete(existingUser.getId());
            log.info("[UserProvisioningService] Utente Keycloak eliminato: username={}, keycloakUserId={}",
                    normalizedUsername,
                    existingUser.getId());
        } catch (Exception exception) {
            log.error("[UserProvisioningService] Errore durante la cancellazione utente Keycloak: username={}, details={}",
                    normalizedUsername,
                    summarizeExceptionChain(exception),
                    exception);
            throw exception;
        } finally {
            keycloak.close();
        }
    }

    private String generatePassword() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[12];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private Keycloak buildAdminClient() {
        String serverUrl = normalizeRequired(keycloakProperties.getServerUrl(), "Server URL Keycloak mancante");
        String configuredGrantType = normalizeNullable(keycloakProperties.getAdminGrantType());
        String adminClientId = normalizeNullable(keycloakProperties.getAdminClientId());
        String adminClientSecret = normalizeNullable(keycloakProperties.getAdminClientSecret());
        String adminUsername = normalizeNullable(keycloakProperties.getAdminUsername());
        String adminPassword = normalizeNullable(keycloakProperties.getAdminPassword());
        String adminUserRealm = normalizeNullable(keycloakProperties.getAdminUserRealm());

        if (configuredGrantType == null) {
            configuredGrantType = adminClientSecret != null ? "client_credentials" : (adminUsername != null && adminPassword != null ? "password" : null);
        }

        if (configuredGrantType == null) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Configurazione admin Keycloak mancante: valorizza APP_KEYCLOAK_ADMIN_CLIENT_ID/SECRET oppure APP_KEYCLOAK_ADMIN_USERNAME/PASSWORD");
        }

        List<String> authenticationModes = resolveAdminAuthenticationModes(
                configuredGrantType,
                adminClientId,
                adminClientSecret,
                adminUsername,
                adminPassword);
        Exception lastException = null;

        for (int index = 0; index < authenticationModes.size(); index++) {
            String authenticationMode = authenticationModes.get(index);
            boolean fallbackAttempt = index > 0;
            List<String> adminClientSecretCandidates = "client_credentials".equals(authenticationMode)
                    ? resolveAdminClientSecretCandidates(adminClientSecret)
                    : Collections.singletonList(adminClientSecret);

            for (int secretIndex = 0; secretIndex < adminClientSecretCandidates.size(); secretIndex++) {
                String adminClientSecretCandidate = adminClientSecretCandidates.get(secretIndex);
                boolean credentialFallbackAttempt = fallbackAttempt || secretIndex > 0;
                Keycloak keycloak = buildAdminClientForMode(
                        authenticationMode,
                        credentialFallbackAttempt,
                        serverUrl,
                        adminClientId,
                        adminClientSecretCandidate,
                        adminUsername,
                        adminPassword,
                        adminUserRealm);

                try {
                    keycloak.tokenManager().getAccessTokenString();
                    verifyAdminPermissions(keycloak, authenticationMode);
                    if (credentialFallbackAttempt) {
                        log.warn("[UserProvisioningService] Autenticazione admin Keycloak riuscita al tentativo fallback con mode={}", authenticationMode);
                    }
                    return keycloak;
                } catch (Exception exception) {
                    keycloak.close();
                    lastException = exception;
                    log.warn("[UserProvisioningService] Autenticazione admin Keycloak fallita con mode={}: {}",
                            authenticationMode,
                            Objects.toString(exception.getMessage(), "<no-message>"));
                }
            }
        }

        throw new ResponseStatusException(
                UNAUTHORIZED,
                "Autenticazione admin Keycloak fallita o priva dei permessi admin sul realm target: verifica APP_KEYCLOAK_ADMIN_CLIENT_ID/SECRET con i ruoli realm-management del realm oppure configura APP_KEYCLOAK_ADMIN_USERNAME/PASSWORD",
                lastException);
    }

    private void verifyAdminPermissions(Keycloak keycloak, String authenticationMode) {
        String realm = requiredRealm();
        String probeClientId = normalizeNullable(keycloakProperties.getClientId());
        if (probeClientId == null) {
            probeClientId = normalizeNullable(keycloakProperties.getAdminClientId());
        }

        if (probeClientId == null) {
            return;
        }

        try {
            keycloak.realm(realm).clients().findByClientId(probeClientId);
        } catch (ForbiddenException exception) {
            throw new ResponseStatusException(
                    UNAUTHORIZED,
                    "Il principal admin Keycloak autenticato con mode=" + authenticationMode
                            + " non ha permessi sufficienti sul realm " + realm
                            + ": assegna i ruoli realm-management necessari oppure usa APP_KEYCLOAK_ADMIN_GRANT_TYPE=password con admin-user-realm",
                    exception);
        }
    }

    private List<String> resolveAdminAuthenticationModes(String configuredGrantType,
                                                         String adminClientId,
                                                         String adminClientSecret,
                                                         String adminUsername,
                                                         String adminPassword) {
        boolean hasClientCredentials = adminClientId != null && adminClientSecret != null;
        boolean hasPasswordCredentials = adminUsername != null && adminPassword != null;

        if (!hasClientCredentials && !hasPasswordCredentials) {
            return List.of();
        }

        String normalizedConfiguredGrantType = configuredGrantType != null ? configuredGrantType.trim().toLowerCase(Locale.ROOT) : null;
        if (normalizedConfiguredGrantType == null) {
            normalizedConfiguredGrantType = hasClientCredentials ? "client_credentials" : "password";
        }

        List<String> authenticationModes = new ArrayList<>();
        addAdminAuthenticationMode(authenticationModes, normalizedConfiguredGrantType, hasClientCredentials, hasPasswordCredentials);
        addAdminAuthenticationMode(authenticationModes, "client_credentials", hasClientCredentials, hasPasswordCredentials);
        addAdminAuthenticationMode(authenticationModes, "password", hasClientCredentials, hasPasswordCredentials);
        return authenticationModes;
    }

    private void addAdminAuthenticationMode(List<String> authenticationModes,
                                            String candidateMode,
                                            boolean hasClientCredentials,
                                            boolean hasPasswordCredentials) {
        if (candidateMode == null || authenticationModes.contains(candidateMode)) {
            return;
        }

        boolean supportedMode = "client_credentials".equals(candidateMode) || "password".equals(candidateMode);
        if (!supportedMode) {
            throw new ResponseStatusException(BAD_REQUEST, "Grant type admin Keycloak non supportato: " + candidateMode);
        }

        if ("client_credentials".equals(candidateMode) && hasClientCredentials) {
            authenticationModes.add(candidateMode);
        }
        if ("password".equals(candidateMode) && hasPasswordCredentials) {
            authenticationModes.add(candidateMode);
        }
    }

    private List<String> resolveAdminClientSecretCandidates(String adminClientSecret) {
        List<String> candidates = Optional.ofNullable(adminClientSecret)
                .stream()
                .flatMap(secret -> java.util.Arrays.stream(secret.split(",")))
                .map(this::normalizeNullable)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        return candidates.isEmpty() ? List.of((String) null) : candidates;
    }

    private Keycloak buildAdminClientForMode(String authenticationMode,
                                             boolean fallbackAttempt,
                                             String serverUrl,
                                             String adminClientId,
                                             String adminClientSecret,
                                             String adminUsername,
                                             String adminPassword,
                                             String adminUserRealm) {
        if ("client_credentials".equals(authenticationMode)) {
            String resolvedAdminClientId = normalizeRequired(adminClientId, "Admin clientId Keycloak mancante");
            String resolvedAdminClientSecret = normalizeRequired(adminClientSecret, "Admin clientSecret Keycloak mancante");
            String realm = requiredRealm();

            log.info("[UserProvisioningService] Creazione admin client Keycloak: mode=client_credentials, fallbackAttempt={}, serverUrl={}, realm={}, adminClientId={}, adminClientSecretMasked={}",
                    fallbackAttempt,
                    serverUrl,
                    realm,
                    resolvedAdminClientId,
                    maskSecret(resolvedAdminClientSecret));

            return KeycloakBuilder.builder()
                    .serverUrl(serverUrl)
                    .realm(realm)
                    .grantType("client_credentials")
                    .clientId(resolvedAdminClientId)
                    .clientSecret(resolvedAdminClientSecret)
                    .build();
        }

        if ("password".equals(authenticationMode)) {
            String resolvedAdminClientId = fallbackAttempt ? "admin-cli" : (adminClientId != null ? adminClientId : "admin-cli");
            String resolvedAdminUsername = normalizeRequired(adminUsername, "Admin username Keycloak mancante");
            String resolvedAdminPassword = normalizeRequired(adminPassword, "Admin password Keycloak mancante");
            String realm = adminUserRealm != null ? adminUserRealm : "master";

            log.info("[UserProvisioningService] Creazione admin client Keycloak: mode=password, fallbackAttempt={}, serverUrl={}, realm={}, adminClientId={}, adminUsername={}",
                    fallbackAttempt,
                    serverUrl,
                    realm,
                    resolvedAdminClientId,
                    resolvedAdminUsername);

            KeycloakBuilder builder = KeycloakBuilder.builder()
                    .serverUrl(serverUrl)
                    .realm(realm)
                    .grantType("password")
                    .clientId(resolvedAdminClientId)
                    .username(resolvedAdminUsername)
                    .password(resolvedAdminPassword);

            if (!fallbackAttempt && adminClientSecret != null) {
                builder.clientSecret(adminClientSecret);
            }

            return builder.build();
        }

        throw new ResponseStatusException(BAD_REQUEST, "Grant type admin Keycloak non supportato: " + authenticationMode);
    }

    private String requiredRealm() {
        return normalizeRequired(keycloakProperties.getRealmCode(), "Realm Keycloak mancante");
    }

    private String resolveRequestedClientId(UserDto userDto) {
        String dtoClientId = normalizeNullable(userDto.getClientId());
        if (dtoClientId != null) {
            return dtoClientId;
        }

        return normalizeNullable(keycloakProperties.getClientId());
    }

    private ClientRepresentation resolveClient(RealmResource realmResource, String clientId) {
        if (clientId == null) {
            return null;
        }

        List<ClientRepresentation> matchingClients = realmResource.clients().findByClientId(clientId);
        log.info("[UserProvisioningService] resolveClient: requestedClientId={}, matchesFound={}, matchedClientUuids={}",
                clientId,
                matchingClients.size(),
                matchingClients.stream().map(ClientRepresentation::getId).filter(Objects::nonNull).toList());

        return matchingClients.stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Client Keycloak non trovato: " + clientId));
    }

    private UserResource upsertKeycloakUser(RealmResource realmResource,
                                            UserDto userDto,
                                            String normalizedUsername,
                                            ClientRepresentation requestedClient,
                                            List<String> requestedRealmRoleNames,
                                            List<String> requestedClientRoleNames) {
        String requestedClientId = requestedClient != null ? requestedClient.getClientId() : null;
        UserRepresentation existingUser = findKeycloakUser(realmResource, normalizedUsername);
        if (existingUser == null) {
            String createdUserId = createKeycloakUser(realmResource, userDto, normalizedUsername, requestedClientId);
            UserResource createdUserResource = realmResource.users().get(createdUserId);
            synchronizeClientAssociation(createdUserResource, requestedClientId);
            synchronizeRealmRoleAssociation(createdUserResource, realmResource, requestedRealmRoleNames);
            synchronizeClientRoleAssociation(createdUserResource, realmResource, requestedClient, requestedClientRoleNames);
            return createdUserResource;
        }

        UserResource existingUserResource = realmResource.users().get(existingUser.getId());
        synchronizeExistingUser(existingUserResource, userDto, normalizedUsername, requestedClientId);
        synchronizeRealmRoleAssociation(existingUserResource, realmResource, requestedRealmRoleNames);
        synchronizeClientRoleAssociation(existingUserResource, realmResource, requestedClient, requestedClientRoleNames);
        return existingUserResource;
    }

    private UserRepresentation findKeycloakUser(RealmResource realmResource, String username) {
        List<UserRepresentation> searchByUsernameResults = realmResource.users().searchByUsername(username, true);
        List<UserRepresentation> searchExactResults = realmResource.users().search(username, true);
        List<UserRepresentation> searchPagedResults = realmResource.users().search(username, 0, 20);

        log.info("[UserProvisioningService] findKeycloakUser: username={}, searchByUsernameCount={}, searchExactCount={}, searchPagedCount={}",
            username,
            searchByUsernameResults.size(),
            searchExactResults.size(),
            searchPagedResults.size());

        return Stream.of(
            searchByUsernameResults.stream(),
            searchExactResults.stream(),
            searchPagedResults.stream())
            .flatMap(stream -> stream)
            .filter(Objects::nonNull)
            .filter(user -> user.getUsername() != null && user.getUsername().equalsIgnoreCase(username))
                .findFirst()
                .orElse(null);
    }

    private String createKeycloakUser(RealmResource realmResource,
                                      UserDto userDto,
                                      String normalizedUsername,
                                      String requestedClientId) {
        UserRepresentation representation = new UserRepresentation();
        String normalizedEmail = normalizeNullable(userDto.getEmail());
        representation.setUsername(normalizedUsername);
        representation.setEmail(normalizedEmail);
        representation.setEmailVerified(normalizedEmail != null);
        representation.setFirstName(resolveKeycloakFirstName(normalizedUsername, normalizedEmail));
        representation.setLastName(resolveKeycloakLastName(normalizedUsername, normalizedEmail));
        representation.setEnabled(Boolean.TRUE.equals(userDto.isEnabled()) || userDto.isEnabled());
        representation.setRequiredActions(new ArrayList<>(List.of("UPDATE_PASSWORD")));
        representation.setAttributes(buildAssociationAttributes(requestedClientId));

        try (Response response = realmResource.users().create(representation)) {
            if (response.getStatus() == Response.Status.CREATED.getStatusCode()) {
                return extractCreatedId(response);
            }

            if (response.getStatus() == Response.Status.CONFLICT.getStatusCode()) {
                UserRepresentation existing = findKeycloakUser(realmResource, normalizedUsername);
                if (existing != null) {
                    log.info("[UserProvisioningService] Utente Keycloak gia' esistente per username={}, riutilizzo id={}",
                            normalizedUsername, existing.getId());
                    return existing.getId();
                }
            }

            throw new ResponseStatusException(BAD_REQUEST,
                    "Impossibile creare l'utente su Keycloak. HTTP status=" + response.getStatus()
                            + formatKeycloakErrorDetails(response));
        }
    }

    private String formatKeycloakErrorDetails(Response response) {
        String responseBody = response.readEntity(String.class);
        if (responseBody == null || responseBody.isBlank()) {
            return "";
        }

        return ", dettagli=" + responseBody;
    }

    private void synchronizeExistingUser(UserResource userResource,
                                         UserDto userDto,
                                         String normalizedUsername,
                                         String requestedClientId) {
        UserRepresentation representation = userResource.toRepresentation();
        boolean changed = false;

        if (!normalizedUsername.equalsIgnoreCase(Objects.toString(representation.getUsername(), ""))) {
            representation.setUsername(normalizedUsername);
            changed = true;
        }

        String normalizedEmail = normalizeNullable(userDto.getEmail());
        if (normalizedEmail != null && !normalizedEmail.equalsIgnoreCase(Objects.toString(representation.getEmail(), ""))) {
            representation.setEmail(normalizedEmail);
            changed = true;
        }

        String expectedFirstName = resolveKeycloakFirstName(normalizedUsername, normalizedEmail);
        if (!expectedFirstName.equals(Objects.toString(representation.getFirstName(), ""))) {
            representation.setFirstName(expectedFirstName);
            changed = true;
        }

        String expectedLastName = resolveKeycloakLastName(normalizedUsername, normalizedEmail);
        if (!expectedLastName.equals(Objects.toString(representation.getLastName(), ""))) {
            representation.setLastName(expectedLastName);
            changed = true;
        }

        boolean expectedEmailVerified = normalizedEmail != null;
        if (representation.isEmailVerified() == null || representation.isEmailVerified() != expectedEmailVerified) {
            representation.setEmailVerified(expectedEmailVerified);
            changed = true;
        }

        if (representation.isEnabled() == null || representation.isEnabled() != userDto.isEnabled()) {
            representation.setEnabled(userDto.isEnabled());
            changed = true;
        }

        Map<String, List<String>> mergedAttributes = mergeClientAssociation(representation.getAttributes(), requestedClientId);
        if (!Objects.equals(mergedAttributes, representation.getAttributes())) {
            representation.setAttributes(mergedAttributes);
            changed = true;
        }

        if (changed) {
            userResource.update(representation);
        }
    }

    private void synchronizeClientAssociation(UserResource userResource, String requestedClientId) {
        if (requestedClientId == null) {
            return;
        }

        UserRepresentation representation = userResource.toRepresentation();
        Map<String, List<String>> mergedAttributes = mergeClientAssociation(representation.getAttributes(), requestedClientId);
        log.info("[UserProvisioningService] synchronizeClientAssociation: username={}, requestedClientId={}, currentAttributes={}, mergedAttributes={}",
                representation.getUsername(),
                requestedClientId,
                representation.getAttributes(),
                mergedAttributes);
        if (!Objects.equals(mergedAttributes, representation.getAttributes())) {
            representation.setAttributes(mergedAttributes);
            userResource.update(representation);
            log.info("[UserProvisioningService] Attributi client aggiornati per username={} clientId={}",
                    representation.getUsername(),
                    requestedClientId);
        }
    }

    private void synchronizeRealmRoleAssociation(UserResource userResource,
                                                 RealmResource realmResource,
                                                 List<String> requestedRealmRoleNames) {
        List<String> normalizedRequestedRoleNames = Optional.ofNullable(requestedRealmRoleNames)
                .orElse(List.of())
                .stream()
                .map(this::normalizeRoleName)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (normalizedRequestedRoleNames.isEmpty()) {
            return;
        }

        List<RoleRepresentation> rolesToAssign = normalizedRequestedRoleNames.stream()
                .map(roleName -> resolveRealmRoleRepresentation(realmResource, roleName))
                .filter(Objects::nonNull)
                .toList();

        log.info("[UserProvisioningService] Verifica realm roles per username={}, requestedRealmRoleNames={}, rolesToAssign={}",
                userResource.toRepresentation().getUsername(),
                normalizedRequestedRoleNames,
                rolesToAssign.stream().map(RoleRepresentation::getName).filter(Objects::nonNull).toList());

        if (rolesToAssign.isEmpty()) {
            return;
        }

        userResource.roles().realmLevel().add(rolesToAssign);
        log.info("[UserProvisioningService] Associati realm roles {}", rolesToAssign.stream().map(RoleRepresentation::getName).toList());
    }

    private RoleRepresentation resolveRealmRoleRepresentation(RealmResource realmResource, String roleName) {
        try {
            return realmResource.roles().get(roleName).toRepresentation();
        } catch (Exception exception) {
            log.warn("[UserProvisioningService] Realm role Keycloak non risolvibile: roleName={} cause={}",
                    roleName,
                    summarizeExceptionChain(exception));
            return null;
        }
    }

    private void synchronizeClientRoleAssociation(UserResource userResource,
                                                  RealmResource realmResource,
                                                  ClientRepresentation requestedClient,
                                                  List<String> requestedClientRoleNames) {
        if (requestedClient == null || requestedClient.getId() == null) {
            return;
        }

        List<RoleRepresentation> currentClientRoles = Optional.ofNullable(
                userResource.roles().clientLevel(requestedClient.getId()).listAll())
            .orElse(List.of());

        List<RoleRepresentation> clientRoles = Optional.ofNullable(
                realmResource.clients().get(requestedClient.getId()).roles().list())
            .orElse(List.of());

        clientRoles = ensureRequestedClientRolesExist(
                realmResource,
                requestedClient,
                clientRoles,
                requestedClientRoleNames);

        List<RoleRepresentation> availableRoles = Optional.ofNullable(
                userResource.roles().clientLevel(requestedClient.getId()).listAvailable())
            .orElse(List.of());

        log.info("[UserProvisioningService] Verifica ruoli client per username={}, clientId={}, clientUuid={}, requestedClientRoleNames={}, currentClientRoles={}, clientRoles={}, availableClientRoles={}",
            userResource.toRepresentation().getUsername(),
            requestedClient.getClientId(),
            requestedClient.getId(),
            requestedClientRoleNames,
            currentClientRoles.stream().map(RoleRepresentation::getName).filter(Objects::nonNull).toList(),
            clientRoles.stream().map(RoleRepresentation::getName).filter(Objects::nonNull).toList(),
            availableRoles.stream().map(RoleRepresentation::getName).filter(Objects::nonNull).toList());

        List<RoleRepresentation> rolesToAssign = resolveClientRolesToAssign(
                requestedClient,
                currentClientRoles,
                clientRoles,
                requestedClientRoleNames);
        if (rolesToAssign.isEmpty()) {
            log.info("[UserProvisioningService] Nessun nuovo ruolo client da assegnare per client {} e utente corrente",
                    requestedClient.getClientId());
            return;
        }

        userResource.roles().clientLevel(requestedClient.getId()).add(rolesToAssign);
        log.info("[UserProvisioningService] Associati al client {} i ruoli {}",
                requestedClient.getClientId(),
                rolesToAssign.stream().map(RoleRepresentation::getName).toList());
    }

    private List<RoleRepresentation> ensureRequestedClientRolesExist(RealmResource realmResource,
                                                                     ClientRepresentation requestedClient,
                                                                     List<RoleRepresentation> clientRoles,
                                                                     List<String> requestedClientRoleNames) {
        if (requestedClient == null || requestedClient.getId() == null) {
            return Optional.ofNullable(clientRoles).orElse(List.of());
        }

        String requestedClientId = requestedClient != null ? requestedClient.getClientId() : null;
        List<String> normalizedRequestedRoleNames = Optional.ofNullable(requestedClientRoleNames)
                .orElse(List.of())
                .stream()
                .map(this::normalizeRoleName)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (normalizedRequestedRoleNames.isEmpty()) {
            return Optional.ofNullable(clientRoles).orElse(List.of());
        }

        List<String> normalizedExistingRoleNames = Optional.ofNullable(clientRoles)
                .orElse(List.of())
                .stream()
                .map(RoleRepresentation::getName)
                .map(this::normalizeRoleName)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        List<String> missingRoleNames = normalizedRequestedRoleNames.stream()
                .filter(roleName -> !normalizedExistingRoleNames.contains(roleName))
                .toList();
        if (missingRoleNames.isEmpty()) {
            return Optional.ofNullable(clientRoles).orElse(List.of());
        }

        ClientResource clientResource = realmResource.clients().get(requestedClient.getId());
        for (String missingRoleName : missingRoleNames) {
            RoleRepresentation roleRepresentation = new RoleRepresentation();
            roleRepresentation.setName(missingRoleName);
            roleRepresentation.setDescription(missingRoleName);

            try {
                clientResource.roles().create(roleRepresentation);
            } catch (Exception exception) {
            log.warn("[UserProvisioningService] Impossibile creare il ruolo client Keycloak {} per client {}. Proseguo con i ruoli gia' esistenti del client. cause={}",
                missingRoleName,
                requestedClientId,
                summarizeExceptionChain(exception));
            return Optional.ofNullable(clientResource.roles().list()).orElse(Optional.ofNullable(clientRoles).orElse(List.of()));
            }

            log.info("[UserProvisioningService] Ruolo client Keycloak creato o gia' esistente: clientId={}, roleName={}",
                    requestedClientId,
                    missingRoleName);
        }

        return Optional.ofNullable(clientResource.roles().list()).orElse(List.of());
    }

    private List<RoleRepresentation> resolveClientRolesToAssign(ClientRepresentation requestedClient,
                                                                List<RoleRepresentation> currentClientRoles,
                                                                List<RoleRepresentation> clientRoles,
                                                                List<String> requestedClientRoleNames) {
        String requestedClientId = requestedClient != null ? requestedClient.getClientId() : null;
        List<String> normalizedRequestedRoleNames = Optional.ofNullable(requestedClientRoleNames)
                .orElse(List.of())
                .stream()
                .map(this::normalizeRoleName)
                .filter(Objects::nonNull)
                .toList();

            log.info("[UserProvisioningService] Risoluzione ruoli per client {}: normalizedRequestedRoleNames={}, currentRoleNames={}, availableRoleNames={}",
            requestedClientId,
                normalizedRequestedRoleNames,
                Optional.ofNullable(currentClientRoles).orElse(List.of()).stream().map(RoleRepresentation::getName).filter(Objects::nonNull).toList(),
                Optional.ofNullable(clientRoles).orElse(List.of()).stream().map(RoleRepresentation::getName).filter(Objects::nonNull).toList());

        if (!normalizedRequestedRoleNames.isEmpty()) {
            List<RoleRepresentation> explicitRoles = findMatchingRoles(clientRoles, normalizedRequestedRoleNames);
            if (explicitRoles.isEmpty()) {
                List<RoleRepresentation> alreadyAssignedExplicitRoles = findMatchingRoles(currentClientRoles, normalizedRequestedRoleNames);
                if (!alreadyAssignedExplicitRoles.isEmpty()) {
                    log.info("[UserProvisioningService] I ruoli client richiesti sono gia' assegnati al client {}: {}",
                    requestedClientId,
                            alreadyAssignedExplicitRoles.stream().map(RoleRepresentation::getName).filter(Objects::nonNull).toList());
                    return List.of();
                }

                log.warn("[UserProvisioningService] Nessun ruolo client esplicito trovato: clientId={}, requestedRoleNamesOriginal={}, requestedRoleNamesNormalized={}, availableRoleNames={}. Provo fallback a ruolo tecnico di accesso.",
                    requestedClientId,
                    requestedClientRoleNames,
                    normalizedRequestedRoleNames,
                    Optional.ofNullable(clientRoles).orElse(List.of()).stream().map(RoleRepresentation::getName).filter(Objects::nonNull).toList());
            } else {
                return excludeAlreadyAssignedRoles(explicitRoles, currentClientRoles);
            }
        }

        if (clientRoles == null || clientRoles.isEmpty()) {
            return List.of();
        }

        List<String> preferredRoleNames = Stream.of("user", "default", "access", requestedClientId)
            .filter(Objects::nonNull)
            .map(this::normalizeRoleName)
            .filter(Objects::nonNull)
            .distinct()
            .toList();

        List<RoleRepresentation> preferredRoles = findMatchingRoles(clientRoles, preferredRoleNames);
        if (!preferredRoles.isEmpty()) {
            return excludeAlreadyAssignedRoles(preferredRoles, currentClientRoles);
        }

        List<RoleRepresentation> nonPrivilegedRoles = clientRoles.stream()
                .filter(Objects::nonNull)
                .filter(role -> isLikelyAssociationRole(role.getName()))
                .toList();
        if (nonPrivilegedRoles.size() == 1) {
            return excludeAlreadyAssignedRoles(nonPrivilegedRoles, currentClientRoles);
        }

        return List.of();
    }

    private List<String> resolveRequestedClientRoleNames(String roleId) {
        String normalizedRoleId = normalizeNullable(roleId);
        if (normalizedRoleId == null) {
            return List.of();
        }

        Optional<RoleEntity> requestedRole = roleRepository.findById(normalizedRoleId);
        if (requestedRole.isEmpty()) {
            log.warn("[UserProvisioningService] Ruolo {} non trovato su DB centralizzato, uso fallback diretto per la risoluzione ruoli client", normalizedRoleId);
            return List.of(normalizedRoleId);
        }

        LinkedHashSet<String> candidateRoleNames = Stream.of(
                    requestedRole.get().getId(),
                    requestedRole.get().getName(),
                    requestedRole.get().getDescription(),
                    "NURSE_QTM".equalsIgnoreCase(normalizedRoleId) ? "Nurse_QTM" : null)
                .map(this::normalizeRoleName)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        log.info("[UserProvisioningService] Role DB risolto: roleId={}, roleName={}, roleDescription={}, candidateClientRoleNames={}",
                requestedRole.get().getId(),
                requestedRole.get().getName(),
                requestedRole.get().getDescription(),
                candidateRoleNames);

        return List.copyOf(candidateRoleNames);
    }

    private List<String> resolveRequestedRealmRoleNames(String roleId) {
        String normalizedRoleId = normalizeNullable(roleId);
        if (normalizedRoleId == null) {
            return List.of();
        }

        Optional<RoleEntity> requestedRole = roleRepository.findById(normalizedRoleId);
        if (requestedRole.isEmpty()) {
            return List.of(normalizedRoleId);
        }

        LinkedHashSet<String> candidateRoleNames = Stream.of(
                        requestedRole.get().getId(),
                        requestedRole.get().getName())
                .map(this::normalizeRoleName)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        return List.copyOf(candidateRoleNames);
    }

    private List<String> resolveRequestedClientRoleNames(List<String> roleIds) {
        return Optional.ofNullable(roleIds)
                .orElse(List.of())
                .stream()
                .map(this::resolveRequestedClientRoleNames)
                .flatMap(List::stream)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private List<RoleRepresentation> findMatchingRoles(List<RoleRepresentation> availableRoles,
                                                       List<String> normalizedRoleNames) {
        if (availableRoles == null || availableRoles.isEmpty() || normalizedRoleNames == null || normalizedRoleNames.isEmpty()) {
            return List.of();
        }

        return availableRoles.stream()
                .filter(Objects::nonNull)
                .filter(role -> normalizedRoleNames.contains(normalizeRoleName(role.getName())))
                .toList();
    }

    private List<RoleRepresentation> excludeAlreadyAssignedRoles(List<RoleRepresentation> candidateRoles,
                                                                 List<RoleRepresentation> currentClientRoles) {
        List<String> currentRoleNames = Optional.ofNullable(currentClientRoles)
                .orElse(List.of())
                .stream()
                .map(RoleRepresentation::getName)
                .map(this::normalizeRoleName)
                .filter(Objects::nonNull)
                .toList();

        return Optional.ofNullable(candidateRoles)
                .orElse(List.of())
                .stream()
                .filter(role -> !currentRoleNames.contains(normalizeRoleName(role.getName())))
                .toList();
    }

    private boolean isLikelyAssociationRole(String roleName) {
        String normalizedRoleName = normalizeRoleName(roleName);
        if (normalizedRoleName == null) {
            return false;
        }

        return !normalizedRoleName.contains("admin")
                && !normalizedRoleName.contains("manage")
                && !normalizedRoleName.contains("owner")
                && !normalizedRoleName.contains("uma");
    }

    private String normalizeRoleName(String roleName) {
        if (roleName == null || roleName.isBlank()) {
            return null;
        }

        return roleName.trim();
    }

    private String maskSecret(String value) {
        if (value == null || value.isBlank()) {
            return "<empty>";
        }
        if (value.length() <= 4) {
            return "****";
        }
        return value.substring(0, 2) + "***" + value.substring(value.length() - 2);
    }

    private String summarizeExceptionChain(Throwable throwable) {
        List<String> parts = new ArrayList<>();
        Throwable current = throwable;
        while (current != null) {
            parts.add(current.getClass().getSimpleName() + ": " + Objects.toString(current.getMessage(), "<no-message>"));
            current = current.getCause();
        }
        return parts.toString();
    }

    /**
     * Imposta sempre una password temporanea e registra l'azione UPDATE_PASSWORD affinche' il primo accesso passi dal cambio password applicativo.
     */
    private void applyPassword(UserResource userResource, String generatedPassword) {
        CredentialRepresentation credentialRepresentation = new CredentialRepresentation();
        credentialRepresentation.setType(CredentialRepresentation.PASSWORD);
        credentialRepresentation.setValue(generatedPassword);
        credentialRepresentation.setTemporary(true);
        userResource.resetPassword(credentialRepresentation);
        requirePasswordUpdate(userResource);
    }

    /**
     * Mantiene l'azione richiesta di cambio password al primo accesso, preservando i metadati utente necessari.
     */
    private void requirePasswordUpdate(UserResource userResource) {
        UserRepresentation representation = userResource.toRepresentation();
        boolean changed = synchronizeUserMetadata(representation);

        List<String> requiredActions = new ArrayList<>(Optional.ofNullable(representation.getRequiredActions()).orElse(List.of()));
        if (!requiredActions.contains("UPDATE_PASSWORD")) {
            requiredActions.add("UPDATE_PASSWORD");
            representation.setRequiredActions(requiredActions);
            changed = true;
        }

        if (changed) {
            userResource.update(representation);
        }
    }

    /**
     * Rimuove gli stati che impediscono il direct grant, come required actions residue ed email non verificata.
     */
    private void sanitizeUserForDirectGrant(UserResource userResource) {
        UserRepresentation representation = userResource.toRepresentation();
        boolean changed = false;

        List<String> requiredActions = new ArrayList<>(Optional.ofNullable(representation.getRequiredActions()).orElse(List.of()));
        if (!requiredActions.isEmpty()) {
            log.warn("[UserProvisioningService] Required actions residue per username={}: {}. Le rimuovo per consentire il direct grant.",
                    representation.getUsername(), requiredActions);
            requiredActions.clear();
            representation.setRequiredActions(requiredActions);
            changed = true;
        }

        changed = synchronizeUserMetadata(representation) || changed;

        if (changed) {
            userResource.update(representation);
        }
    }

    private boolean synchronizeUserMetadata(UserRepresentation representation) {
        boolean changed = false;

        boolean shouldVerifyEmail = normalizeNullable(representation.getEmail()) != null;
        if (shouldVerifyEmail && !Boolean.TRUE.equals(representation.isEmailVerified())) {
            representation.setEmailVerified(true);
            changed = true;
        }

        String sanitizedUsername = normalizeNullable(representation.getUsername());
        String sanitizedEmail = normalizeNullable(representation.getEmail());
        String expectedFirstName = resolveKeycloakFirstName(sanitizedUsername, sanitizedEmail);
        if (!expectedFirstName.equals(Objects.toString(representation.getFirstName(), ""))) {
            representation.setFirstName(expectedFirstName);
            changed = true;
        }

        String expectedLastName = resolveKeycloakLastName(sanitizedUsername, sanitizedEmail);
        if (!expectedLastName.equals(Objects.toString(representation.getLastName(), ""))) {
            representation.setLastName(expectedLastName);
            changed = true;
        }

        return changed;
    }

    String resolveKeycloakFirstName(String username, String email) {
        List<String> profileTokens = extractProfileTokens(username, email);
        if (!profileTokens.isEmpty()) {
            return profileTokens.get(0);
        }

        return "Utente";
    }

    String resolveKeycloakLastName(String username, String email) {
        List<String> profileTokens = extractProfileTokens(username, email);
        if (profileTokens.size() > 1) {
            return profileTokens.get(profileTokens.size() - 1);
        }
        if (profileTokens.size() == 1) {
            return "Qtm";
        }

        return "Qtm";
    }

    private List<String> extractProfileTokens(String username, String email) {
        String baseValue = normalizeNullable(email);
        if (baseValue != null && baseValue.contains("@")) {
            baseValue = baseValue.substring(0, baseValue.indexOf('@'));
        }
        if (baseValue == null) {
            baseValue = normalizeNullable(username);
        }
        if (baseValue == null) {
            return List.of();
        }

        return Stream.of(baseValue.split("[^\\p{L}]+"))
                .map(this::normalizeNullable)
                .filter(Objects::nonNull)
                .map(this::capitalizeProfileToken)
                .distinct()
                .toList();
    }

    private String capitalizeProfileToken(String token) {
        String lowerCaseToken = token.toLowerCase(Locale.ROOT);
        if (lowerCaseToken.isEmpty()) {
            return lowerCaseToken;
        }

        return lowerCaseToken.substring(0, 1).toUpperCase(Locale.ROOT) + lowerCaseToken.substring(1);
    }

    /**
     * Verifica immediatamente che le credenziali appena assegnate siano accettate dal token endpoint Keycloak.
     */
    void verifyKeycloakLogin(String username, String password) {
        log.info("[UserProvisioningService] Verifica accesso Keycloak con username={} e password={}", username, password);

        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername(username);
        loginRequest.setPassword(password);

        try {
            keycloakAuthService.login(loginRequest);
            log.info("[UserProvisioningService] Verifica accesso Keycloak riuscita per username={} e password={}", username, password);
        } catch (ResponseStatusException ex) {
            log.error("[UserProvisioningService] Verifica accesso Keycloak fallita per username={} e password={}", username, password, ex);
            throw new ResponseStatusException(
                    UNAUTHORIZED,
                    "Accesso fallito: verifica le credenziali Keycloak.",
                    ex);
        }
    }

    private UserEntity upsertDatabaseUser(UserDto userDto,
                                          String normalizedUsername,
                                          String generatedPassword,
                                          UserEntity existingDbUser) {
        UserEntity entity = existingDbUser != null ? existingDbUser : userMapper.toEntity(userDto);
        entity.setUsername(normalizedUsername);
        entity.setEnabled(userDto.isEnabled());
        entity.setEmail(normalizeNullable(userDto.getEmail()));
        entity.setStructureId(userDto.getStructureId());
        entity.setRole(findRoleById(userDto.getRoleId()));
        entity.setPasswordHash(generatedPassword);
        entity.setDataFineValiditaPassword(LocalDate.now().plusMonths(PASSWORD_VALIDITY_MONTHS));
        UserEntity savedEntity = userRepository.save(entity);
        userRoleProfileService.saveForUser(
            savedEntity.getId(),
            userDto.getClientId(),
            savedEntity.getRole() != null ? savedEntity.getRole().getId() : null,
            userDto.getProjectId());
        return savedEntity;
    }

    private RoleEntity findRoleById(String roleId) {
        String normalizedRoleId = normalizeNullable(roleId);
        if (normalizedRoleId == null) {
            return null;
        }

        return roleRepository.findById(normalizedRoleId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Ruolo non trovato: " + normalizedRoleId));
    }

    private Map<String, List<String>> buildAssociationAttributes(String requestedClientId) {
        if (requestedClientId == null) {
            return null;
        }

        Map<String, List<String>> attributes = new HashMap<>();
        attributes.put(clientAssociationAttributeKey(), new ArrayList<>(List.of(requestedClientId)));
        return attributes;
    }

    private Map<String, List<String>> mergeClientAssociation(Map<String, List<String>> currentAttributes, String requestedClientId) {
        if (requestedClientId == null) {
            return currentAttributes;
        }

        Map<String, List<String>> merged = new HashMap<>();
        if (currentAttributes != null) {
            currentAttributes.forEach((key, value) -> merged.put(key, value == null ? new ArrayList<>() : new ArrayList<>(value)));
        }

        List<String> associatedClients = merged.computeIfAbsent(clientAssociationAttributeKey(), ignored -> new ArrayList<>());
        boolean alreadyPresent = associatedClients.stream().anyMatch(value -> value.equalsIgnoreCase(requestedClientId));
        if (!alreadyPresent) {
            associatedClients.add(requestedClientId);
            log.info("[UserProvisioningService] Associazione client {} aggiunta all'utente Keycloak", requestedClientId);
        }
        return merged;
    }

    private String clientAssociationAttributeKey() {
        String configured = normalizeNullable(keycloakProperties.getClientAssociationAttribute());
        return configured != null ? configured : "qtm-client-id";
    }

    private String extractCreatedId(Response response) {
        if (response.getLocation() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Keycloak non ha restituito l'id dell'utente creato");
        }

        String path = response.getLocation().getPath();
        int lastSlash = path.lastIndexOf('/');
        return lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
    }

    private String normalizeRequired(String value, String message) {
        String normalized = normalizeNullable(value);
        if (normalized == null) {
            throw new ResponseStatusException(BAD_REQUEST, message);
        }
        return normalized;
    }

    private String normalizeNullable(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return null;
        }

        return normalized.toLowerCase(Locale.ROOT).equals(normalized) ? normalized : value.trim();
    }
}
