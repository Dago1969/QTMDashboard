// Development/runtime fallback for environment injection.
(function (window) {
  window.NG_APP_API_BASE_URL = window.NG_APP_API_BASE_URL || '/api';
  window.NG_APP_TICKET_API_BASE_URL = window.NG_APP_TICKET_API_BASE_URL || '/api/ticket';
})(window);