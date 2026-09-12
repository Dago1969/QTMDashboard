/**
 * Configurazione ambiente frontend per endpoint backend locali.
 */
export const environment = {
  production: false,
  // FIXME Francesco: mantenere apiBaseUrl relativo; il proxy nginx deve esporre le API sotto il base path dell'app.
  // Base API relativa (proxy) -- fallback per le chiamate verso il backend corrente
  apiBaseUrl: '/api',
  // URL completo verso il backend QTMDashboard (usalo se vuoi forzare QTMDB come destinazione)
  // Priorità: runtime env `NG_APP_API_BASE_URL` (es. espresso da nginx/proxy) -> valore statico di fallback
  dashboardApiBaseUrl: (typeof window !== 'undefined' && (window as any).NG_APP_API_BASE_URL)
    ? (window as any).NG_APP_API_BASE_URL
    : 'http://localhost:8086/api',
  // FIXME Francesco: instradare QTMTicket con una base dedicata per non inviare /api/ticket al backend dashboard locale.
  ticketApiBaseUrl: '/api/ticket',
  // FIXME Francesco: rotta relativa condivisa tra proxy locale e routing Traefik del qtm-env.
  tenantsApiBaseUrl: '/api/tenants'
};
