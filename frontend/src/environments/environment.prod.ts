/**
 * Environment di produzione per il frontend QTMDashboard.
 */
export const environment = {
  production: true,
  // Base API relativa (proxy)
  apiBaseUrl: '/api',
  // Priorità: runtime env `NG_APP_API_BASE_URL` -> fallback relativo per produzione
  dashboardApiBaseUrl: (typeof window !== 'undefined' && (window as any).NG_APP_API_BASE_URL)
    ? (window as any).NG_APP_API_BASE_URL
    : '/api',
  ticketApiBaseUrl: '/api/ticket',
  tenantsApiBaseUrl: '/api/tenants'
};
