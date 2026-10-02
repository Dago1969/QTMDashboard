package com.qtm.dashboard.auth.service;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import com.qtm.dashboard.auth.dto.ChangePasswordRequest;
import com.qtm.dashboard.auth.dto.LoginRequest;
import com.qtm.dashboard.auth.dto.LoginResponse;
import com.qtm.dashboard.config.KeycloakProperties;
import com.qtm.dashboard.user.entity.UserEntity;
import com.qtm.dashboard.user.repository.UserRepository;

import jakarta.ws.rs.ForbiddenException;
import lombok.extern.slf4j.Slf4j;

/**
 * Service dedicato all'accesso verso endpoint OIDC token di Keycloak.
 */
@Service
@Slf4j
public class KeycloakAuthService {

    private static final String ROBUST_PASSWORD_REGEX = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d\\s])\\S{8,}$";
    private static final int PASSWORD_VALIDITY_MONTHS = 6;

    private final RestClient restClient;
    private final KeycloakProperties keycloakProperties;
    private final UserRepository userRepository;
    private final Environment environment;

    public KeycloakAuthService(KeycloakProperties keycloakProperties,
                               UserRepository userRepository,
                               Environment environment) {
        this.restClient = RestClient.builder().build();
        this.keycloakProperties = keycloakProperties;
        this.userRepository = userRepository;
        this.environment = environment;
    }

    public LoginResponse login(LoginRequest loginRequest) {
        logResolvedLoginConfiguration(loginRequest);
        List<String> loginIdentifiers = resolveLoginIdentifiers(loginRequest.getUsername());
        log.info("[KeycloakAuthService] Tentativo login per identificativo={}, candidati={}",
                loginRequest.getUsername(), loginIdentifiers);
        ResponseStatusException lastFailure = null;

        for (String loginIdentifier : loginIdentifiers) {
            try {
                LoginResponse response = loginWithIdentifier(loginIdentifier, loginRequest.getPassword());
                log.info("[KeycloakAuthService] Login Keycloak riuscito con identificativo={}", loginIdentifier);
                return response;
            } catch (ResponseStatusException ex) {
                log.warn("[KeycloakAuthService] Login Keycloak fallito con identificativo={}", loginIdentifier);
                try {
                    if (requiresPasswordUpdate(loginIdentifier)) {
                        return mustChangePasswordResponse();
                    }
                } catch (ResponseStatusException passwordUpdateCheckException) {
                    log.warn("[KeycloakAuthService] Verifica UPDATE_PASSWORD non disponibile per identificativo={}: {}",
                            loginIdentifier,
                            passwordUpdateCheckException.getReason());
                }
                lastFailure = ex;
            }
        }

        if (lastFailure != null) {
            throw lastFailure;
        }

        throw new ResponseStatusException(UNAUTHORIZED, "Credenziali non valide");
    }

    /**
     * Cambia la password utente tramite Admin API Keycloak e rimuove l'action UPDATE_PASSWORD quando completata.
     */
    public void changePassword(ChangePasswordRequest request) {
        String normalizedIdentifier = normalizeLoginIdentifier(request.getUsername());
        String currentPassword = normalizeRequiredValue(request.getCurrentPassword(), "Password attuale obbligatoria");
        String newPassword = normalizeRequiredValue(request.getNewPassword(), "Nuova password obbligatoria");
        String confirmPassword = normalizeRequiredValue(request.getConfirmPassword(), "Conferma password obbligatoria");

        if (!newPassword.equals(confirmPassword)) {
            throw new ResponseStatusException(BAD_REQUEST, "Le nuove password non coincidono");
        }

        validateRobustPassword(newPassword);

        UserEntity userEntity = resolveUserEntity(normalizedIdentifier)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Utente non trovato: " + normalizedIdentifier));

        String canonicalUsername = normalizeLoginIdentifier(userEntity.getUsername());
        validateCurrentPassword(canonicalUsername, currentPassword, userEntity);

        applyPasswordUpdate(userEntity, canonicalUsername, newPassword);
        verifyNewPasswordIsActive(canonicalUsername, newPassword);
        verifyOldPasswordIsRejected(canonicalUsername, currentPassword);
    }

    /**
     * Reset password via token: aggiorna sempre Keycloak e rinnova la scadenza password a 6 mesi.
     */
    public void resetPassword(com.qtm.dashboard.auth.dto.ResetPasswordRequest request) {
        String token = normalizeRequiredValue(request.getToken(), "Token reset password obbligatorio");
        String newPassword = normalizeRequiredValue(request.getNewPassword(), "Nuova password obbligatoria");

        log.info("[KeycloakAuthService] Avvio reset password tramite tokenLength={}", token.length());

        validateRobustPassword(newPassword);

        UserEntity userEntity = userRepository.findByPasswordResetToken(token)
                .filter(user -> user.getPasswordResetTokenExpiry() != null)
                .filter(user -> user.getPasswordResetTokenExpiry().isAfter(java.time.LocalDateTime.now()))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Token reset password non valido o scaduto"));

        String canonicalUsername = normalizeLoginIdentifier(userEntity.getUsername());
        applyPasswordUpdate(userEntity, canonicalUsername, newPassword);
        verifyNewPasswordIsActive(canonicalUsername, newPassword);
    }

    List<String> resolveLoginIdentifiers(String rawLoginIdentifier) {
        String normalizedIdentifier = normalizeLoginIdentifier(rawLoginIdentifier);
        Set<String> candidates = new LinkedHashSet<>();
        candidates.add(normalizedIdentifier);

        resolveCanonicalUsername(userRepository.findByUsernameIgnoreCase(normalizedIdentifier))
                .ifPresent(candidates::add);
        resolveCanonicalUsername(userRepository.findByEmailIgnoreCase(normalizedIdentifier))
                .ifPresent(candidates::add);

        return new ArrayList<>(candidates);
    }

    private Optional<String> resolveCanonicalUsername(Optional<UserEntity> userEntity) {
        return userEntity
                .map(UserEntity::getUsername)
                .map(this::normalizeLoginIdentifier);
    }

    private String normalizeLoginIdentifier(String loginIdentifier) {
        String normalizedIdentifier = Objects.requireNonNull(loginIdentifier, "Username obbligatorio").trim();
        if (normalizedIdentifier.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "Username obbligatorio");
        }
        return normalizedIdentifier;
    }

    private void logResolvedLoginConfiguration(LoginRequest loginRequest) {
        log.info("[KeycloakAuthService] Diagnostica configurazione login: activeProfiles={}, qtmdbEnv={}, springProfilesActive={}, loginIdentifierRaw={}, passwordLength={}, envServerUrl={}, sysServerUrl={}, envLegacyRealm={}, sysLegacyRealm={}, envRealmCode={}, sysRealmCode={}, envTokenUrl={}, sysTokenUrl={}, propServerUrl={}, propRealm={}, propRealmCode={}, propTokenUrl={}, resolvedServerUrl={}, resolvedRealm={}, resolvedRealmCode={}, resolvedTokenUrl={}, clientId={}, grantType={}, clientSecretPresent={}, adminClientId={}, adminGrantType={}, adminUsername={}, adminUserRealm={}, adminClientSecretPresent={}, adminPasswordPresent={}",
                Arrays.toString(environment.getActiveProfiles()),
            environment.getProperty("QTMDB_ENV"),
            environment.getProperty("spring.profiles.active"),
                loginRequest.getUsername(),
                safeLength(loginRequest.getPassword()),
                environment.getProperty("APP_KEYCLOAK_SERVER_URL"),
                System.getProperty("APP_KEYCLOAK_SERVER_URL"),
                environment.getProperty("APP_KEYCLOAK_REALM"),
                System.getProperty("APP_KEYCLOAK_REALM"),
                environment.getProperty("APP_KEYCLOAK_REALM_CODE"),
                System.getProperty("APP_KEYCLOAK_REALM_CODE"),
                environment.getProperty("APP_KEYCLOAK_TOKEN_URL"),
                System.getProperty("APP_KEYCLOAK_TOKEN_URL"),
                environment.getProperty("app.keycloak.server-url"),
                environment.getProperty("app.keycloak.realm"),
                environment.getProperty("app.keycloak.realm-code"),
                environment.getProperty("app.keycloak.token-url"),
                keycloakProperties.getServerUrl(),
                keycloakProperties.getRealm(),
                keycloakProperties.getRealmCode(),
                keycloakProperties.getTokenUrl(),
                keycloakProperties.getClientId(),
                keycloakProperties.getGrantType(),
                StringUtils.hasText(keycloakProperties.getClientSecret()),
                keycloakProperties.getAdminClientId(),
                keycloakProperties.getAdminGrantType(),
                keycloakProperties.getAdminUsername(),
                keycloakProperties.getAdminUserRealm(),
                StringUtils.hasText(keycloakProperties.getAdminClientSecret()),
                StringUtils.hasText(keycloakProperties.getAdminPassword()));
    }

    private int safeLength(String value) {
        return value == null ? 0 : value.length();
    }

    private LoginResponse loginWithIdentifier(String loginIdentifier, String password) {
        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        formData.add("client_id", keycloakProperties.getClientId());
        formData.add("grant_type", keycloakProperties.getGrantType());
        if (keycloakProperties.getClientSecret() != null && !keycloakProperties.getClientSecret().isBlank()) {
            formData.add("client_secret", keycloakProperties.getClientSecret());
        }
        // Solo per grant_type password aggiungi username/password
        if ("password".equalsIgnoreCase(keycloakProperties.getGrantType())) {
            formData.add("username", loginIdentifier);
            formData.add("password", password);
        }

        log.info("[KeycloakAuthService] Chiamata Keycloak token endpoint: url={}, grantType={}, clientId={}, loginIdentifier={}",
                keycloakProperties.getTokenUrl(),
                keycloakProperties.getGrantType(),
                keycloakProperties.getClientId(),
                loginIdentifier);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> keycloakResponse = restClient.post()
                    .uri(Objects.requireNonNull(keycloakProperties.getTokenUrl(), "Token URL Keycloak mancante"))
                    .contentType(Objects.requireNonNull(MediaType.APPLICATION_FORM_URLENCODED))
                    .body(formData)
                    .retrieve()
                    .body(Map.class);

            if (keycloakResponse == null || !keycloakResponse.containsKey("access_token")) {
                throw new ResponseStatusException(BAD_REQUEST, "Risposta non valida da Keycloak");
            }

            log.info("[KeycloakAuthService] Risposta Keycloak token endpoint: loginIdentifier={}, tokenType={}, expiresIn={}, refreshExpiresIn={}",
                    loginIdentifier,
                    String.valueOf(keycloakResponse.getOrDefault("token_type", "Bearer")),
                    keycloakResponse.getOrDefault("expires_in", "0"),
                    keycloakResponse.getOrDefault("refresh_expires_in", "0"));

            return mapToLoginResponse(keycloakResponse);
        } catch (HttpStatusCodeException ex) {
            String responseBody = ex.getResponseBodyAsString();
            log.error("[KeycloakAuthService] Errore Keycloak login: status={}, body={}", ex.getStatusCode(), responseBody);
            throw new ResponseStatusException(UNAUTHORIZED, "Credenziali non valide", ex);
        }
    }

    private LoginResponse mustChangePasswordResponse() {
        LoginResponse response = new LoginResponse();
        response.setMustChangePassword(true);
        return response;
    }

    private boolean requiresPasswordUpdate(String loginIdentifier) {
        Keycloak keycloak = buildAdminClient();
        try {
            RealmResource realmResource = keycloak.realm(requiredRealm());
            return resolveKeycloakUserForLoginIdentifier(realmResource, loginIdentifier)
                    .map(UserRepresentation::getRequiredActions)
                    .stream()
                    .flatMap(List::stream)
                    .anyMatch(action -> "UPDATE_PASSWORD".equalsIgnoreCase(action));
        } finally {
            keycloak.close();
        }
    }

    private Optional<UserRepresentation> resolveKeycloakUserForLoginIdentifier(RealmResource realmResource, String loginIdentifier) {
        Optional<UserEntity> userEntity = resolveUserEntity(loginIdentifier);
        if (userEntity.isPresent()) {
            return findKeycloakUser(realmResource, normalizeLoginIdentifier(userEntity.get().getUsername()));
        }

        return findKeycloakUser(realmResource, loginIdentifier);
    }

    private Optional<UserEntity> resolveUserEntity(String loginIdentifier) {
        Optional<UserEntity> byUsername = userRepository.findByUsernameIgnoreCase(loginIdentifier);
        if (byUsername.isPresent()) {
            return byUsername;
        }

        return userRepository.findByEmailIgnoreCase(loginIdentifier);
    }

    private Optional<UserRepresentation> findKeycloakUser(RealmResource realmResource, String loginIdentifier) {
        List<UserRepresentation> matches = new ArrayList<>();
        matches.addAll(Optional.ofNullable(realmResource.users().searchByUsername(loginIdentifier, true)).orElse(List.of()));
        matches.addAll(Optional.ofNullable(realmResource.users().search(loginIdentifier, true)).orElse(List.of()));

        return matches.stream()
                .filter(Objects::nonNull)
                .filter(user -> equalsIgnoreCase(user.getUsername(), loginIdentifier) || equalsIgnoreCase(user.getEmail(), loginIdentifier))
                .findFirst();
    }

    private void validateCurrentPassword(String canonicalUsername, String currentPassword, UserEntity userEntity) {
        if (Objects.equals(userEntity.getPasswordHash(), currentPassword)) {
            return;
        }

        try {
            loginWithIdentifier(canonicalUsername, currentPassword);
        } catch (ResponseStatusException exception) {
            throw new ResponseStatusException(UNAUTHORIZED, "Password attuale non valida", exception);
        }
    }

    private void applyPasswordUpdate(UserEntity userEntity, String canonicalUsername, String newPassword) {
        Keycloak keycloak = buildAdminClient();
        try {
            RealmResource realmResource = keycloak.realm(requiredRealm());
            log.info("[KeycloakAuthService] Chiamata Keycloak search user per password update: realm={}, username={}",
                requiredRealm(),
                canonicalUsername);
            UserRepresentation keycloakUser = findKeycloakUser(realmResource, canonicalUsername)
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Utente Keycloak non trovato: " + canonicalUsername));

            log.info("[KeycloakAuthService] Risposta Keycloak search user: username={}, keycloakUserId={}, enabled={}",
                canonicalUsername,
                keycloakUser.getId(),
                keycloakUser.isEnabled());

            UserResource userResource = realmResource.users().get(keycloakUser.getId());
            CredentialRepresentation credentialRepresentation = new CredentialRepresentation();
            credentialRepresentation.setType(CredentialRepresentation.PASSWORD);
            credentialRepresentation.setValue(newPassword);
            credentialRepresentation.setTemporary(false);

            log.info("[KeycloakAuthService] Chiamata Keycloak resetPassword: realm={}, username={}, keycloakUserId={}, temporary={}",
                requiredRealm(),
                canonicalUsername,
                keycloakUser.getId(),
                credentialRepresentation.isTemporary());
            userResource.resetPassword(credentialRepresentation);
            log.info("[KeycloakAuthService] Risposta Keycloak resetPassword: username={}, keycloakUserId={}, outcome=SUCCESS",
                canonicalUsername,
                keycloakUser.getId());

            log.info("[KeycloakAuthService] Chiamata Keycloak toRepresentation per lettura requiredActions: username={}, keycloakUserId={}",
                canonicalUsername,
                keycloakUser.getId());
            UserRepresentation representation = userResource.toRepresentation();
            List<String> requiredActions = new ArrayList<>(Optional.ofNullable(representation.getRequiredActions()).orElse(List.of()));
            requiredActions.removeIf(action -> "UPDATE_PASSWORD".equalsIgnoreCase(action));
            representation.setRequiredActions(requiredActions);

            log.info("[KeycloakAuthService] Chiamata Keycloak update user: username={}, keycloakUserId={}, requiredActions={}",
                canonicalUsername,
                keycloakUser.getId(),
                requiredActions);
            userResource.update(representation);
            log.info("[KeycloakAuthService] Risposta Keycloak update user: username={}, keycloakUserId={}, outcome=SUCCESS",
                canonicalUsername,
                keycloakUser.getId());

            userEntity.setPasswordHash(newPassword);
            userEntity.setDataFineValiditaPassword(LocalDate.now().plusMonths(PASSWORD_VALIDITY_MONTHS));
            userEntity.setPasswordResetToken(null);
            userEntity.setPasswordResetTokenExpiry(null);
            userRepository.save(userEntity);
        } finally {
            keycloak.close();
        }
    }

    private void verifyNewPasswordIsActive(String canonicalUsername, String newPassword) {
        try {
            log.info("[KeycloakAuthService] Chiamata Keycloak verifica nuova password: username={}", canonicalUsername);
            loginWithIdentifier(canonicalUsername, newPassword);
            log.info("[KeycloakAuthService] Risposta Keycloak verifica nuova password: username={}, outcome=SUCCESS",
                    canonicalUsername);
        } catch (ResponseStatusException exception) {
            throw new ResponseStatusException(UNAUTHORIZED,
                    "Password aggiornata localmente ma non attiva su Keycloak",
                    exception);
        }
    }

    private void verifyOldPasswordIsRejected(String canonicalUsername, String oldPassword) {
        try {
            log.info("[KeycloakAuthService] Chiamata Keycloak verifica rigetto vecchia password: username={}", canonicalUsername);
            loginWithIdentifier(canonicalUsername, oldPassword);
        } catch (ResponseStatusException exception) {
            if (UNAUTHORIZED.equals(exception.getStatusCode())) {
                log.info("[KeycloakAuthService] Risposta Keycloak verifica vecchia password: username={}, outcome=REJECTED_OLD_PASSWORD",
                        canonicalUsername);
                return;
            }
            throw exception;
        }

        throw new ResponseStatusException(UNAUTHORIZED,
                "Keycloak continua ad accettare la password precedente dopo il cambio");
    }

    private Keycloak buildAdminClient() {
        String serverUrl = normalizeRequiredValue(keycloakProperties.getServerUrl(), "Server URL Keycloak mancante");
        String configuredGrantType = normalizeOptionalValue(keycloakProperties.getAdminGrantType());
        String adminClientId = normalizeOptionalValue(keycloakProperties.getAdminClientId());
        String adminClientSecret = normalizeOptionalValue(keycloakProperties.getAdminClientSecret());
        String adminUsername = normalizeOptionalValue(keycloakProperties.getAdminUsername());
        String adminPassword = normalizeOptionalValue(keycloakProperties.getAdminPassword());
        String adminUserRealm = normalizeOptionalValue(keycloakProperties.getAdminUserRealm());

        if (configuredGrantType == null) {
            configuredGrantType = adminClientSecret != null ? "client_credentials" : (adminUsername != null && adminPassword != null ? "password" : null);
        }

        if (configuredGrantType == null) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Configurazione admin Keycloak mancante: valorizza APP_KEYCLOAK_ADMIN_CLIENT_ID/SECRET oppure APP_KEYCLOAK_ADMIN_USERNAME/PASSWORD");
        }

        Keycloak keycloak;
        if ("client_credentials".equalsIgnoreCase(configuredGrantType)) {
            keycloak = KeycloakBuilder.builder()
                    .serverUrl(serverUrl)
                    .realm(requiredRealm())
                    .grantType("client_credentials")
                    .clientId(normalizeRequiredValue(adminClientId, "Admin clientId Keycloak mancante"))
                    .clientSecret(normalizeRequiredValue(adminClientSecret, "Admin clientSecret Keycloak mancante"))
                    .build();
        } else if ("password".equalsIgnoreCase(configuredGrantType)) {
            KeycloakBuilder builder = KeycloakBuilder.builder()
                    .serverUrl(serverUrl)
                    .realm(adminUserRealm != null ? adminUserRealm : "master")
                    .grantType("password")
                    .clientId(adminClientId != null ? adminClientId : "admin-cli")
                    .username(normalizeRequiredValue(adminUsername, "Admin username Keycloak mancante"))
                    .password(normalizeRequiredValue(adminPassword, "Admin password Keycloak mancante"));

            if (adminClientSecret != null) {
                builder.clientSecret(adminClientSecret);
            }

            keycloak = builder.build();
        } else {
            throw new ResponseStatusException(BAD_REQUEST, "Grant type admin Keycloak non supportato: " + configuredGrantType);
        }

        try {
            keycloak.tokenManager().getAccessTokenString();
            verifyAdminPermissions(keycloak);
            return keycloak;
        } catch (Exception exception) {
            keycloak.close();
            throw new ResponseStatusException(UNAUTHORIZED,
                    "Autenticazione admin Keycloak fallita o priva dei permessi admin sul realm target: verifica la configurazione admin e i ruoli realm-management",
                    exception);
        }
    }

    private void verifyAdminPermissions(Keycloak keycloak) {
        String realm = requiredRealm();
        String probeClientId = normalizeOptionalValue(keycloakProperties.getClientId());
        if (probeClientId == null) {
            probeClientId = normalizeOptionalValue(keycloakProperties.getAdminClientId());
        }

        if (probeClientId == null) {
            return;
        }

        try {
            keycloak.realm(realm).clients().findByClientId(probeClientId);
        } catch (ForbiddenException exception) {
            throw new ResponseStatusException(UNAUTHORIZED,
                    "Il principal admin Keycloak autenticato non ha permessi sufficienti sul realm " + realm
                            + ": assegna i ruoli realm-management necessari oppure usa APP_KEYCLOAK_ADMIN_GRANT_TYPE=password con admin-user-realm",
                    exception);
        }
    }

    private String requiredRealm() {
        return normalizeRequiredValue(keycloakProperties.getRealm(), "Realm Keycloak mancante");
    }

    private String normalizeRequiredValue(String value, String message) {
        String normalized = normalizeOptionalValue(value);
        if (normalized == null) {
            throw new ResponseStatusException(BAD_REQUEST, message);
        }
        return normalized;
    }

    private String normalizeOptionalValue(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private boolean equalsIgnoreCase(String left, String right) {
        return left != null && right != null && left.equalsIgnoreCase(right);
    }

    private void validateRobustPassword(String newPassword) {
        if (!newPassword.matches(ROBUST_PASSWORD_REGEX)) {
            throw new ResponseStatusException(
                BAD_REQUEST,
                "La nuova password deve contenere almeno 8 caratteri, una lettera maiuscola, una minuscola, un numero e un carattere speciale, senza spazi");
        }

        if (newPassword.toLowerCase().contains("password")) {
            throw new ResponseStatusException(BAD_REQUEST, "La nuova password non puo contenere parole banali come 'password'");
        }
    }

    private LoginResponse mapToLoginResponse(Map<String, Object> keycloakResponse) {
        LoginResponse response = new LoginResponse();
        response.setAccessToken(String.valueOf(keycloakResponse.getOrDefault("access_token", "")));
        response.setRefreshToken(String.valueOf(keycloakResponse.getOrDefault("refresh_token", "")));
        response.setTokenType(String.valueOf(keycloakResponse.getOrDefault("token_type", "Bearer")));
        response.setExpiresIn(Long.parseLong(String.valueOf(keycloakResponse.getOrDefault("expires_in", "0"))));
        response.setRefreshExpiresIn(Long.parseLong(String.valueOf(keycloakResponse.getOrDefault("refresh_expires_in", "0"))));
        return response;
    }
}
