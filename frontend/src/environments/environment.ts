/**
 * Configurazione ambiente frontend per endpoint backend locali.
 */
export const environment = {
  production: false,
  // FIXME Francesco: mantenere apiBaseUrl relativo; il proxy nginx deve esporre le API sotto il base path dell'app.
  apiBaseUrl: '/api',
  // FIXME Francesco: instradare QTMTicket con una base dedicata per non inviare /api/ticket al backend dashboard locale.
  ticketApiBaseUrl: '/api/ticket',
  // FIXME Francesco: rotta relativa condivisa tra proxy locale e routing Traefik del qtm-env.
  tenantsApiBaseUrl: '/api/tenants'
};
