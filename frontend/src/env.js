// Development fallback for runtime env injection
(function (window) {
  // Only set defaults if not already provided by runtime
  window.NG_APP_API_BASE_URL = window.NG_APP_API_BASE_URL || '/api';
  window.NG_APP_TICKET_API_BASE_URL = window.NG_APP_TICKET_API_BASE_URL || '/api/ticket';
})(window);
