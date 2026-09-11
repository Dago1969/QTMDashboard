// FIXME Francesco: la login dovrebbe essere gestita dal redirect nativo Keycloak;
// in questo modo lo stesso backend e database funzionano sia con frontend locale sia in DEV.

// LOCALE: frontend e backend avviati sulla macchina locale.
// Per usare i backend locali, sostituire il blocco DEV attivo con questo blocco:
// {
//   '/api/tenants': {
//     target: 'http://localhost:8087',
//     secure: false,
//     changeOrigin: true,
//     logLevel: 'debug'
//   },
//   '/api': {
//     target: 'http://localhost:8086',
//     secure: false,
//     changeOrigin: true,
//     logLevel: 'debug'
//   }
// }

// COLLAUDO:
// {
//   '/api/tenants': {
//     target: 'https://tenants.qtmdev.quicare.com',
//     secure: false,
//     changeOrigin: true,
//     logLevel: 'debug'
//   },
//   '/api': {
//     target: 'https://dashboard.qtmdev.quicare.com',
//     secure: false,
//     changeOrigin: true,
//     logLevel: 'debug'
//   }
// }

// DEV: frontend locale collegato ai backend di sviluppo.
// La rotta specifica /api/tenants deve precedere /api e replica il routing Traefik del qtm-env.
module.exports = {
  '/api/ticket': {
    target: 'http://localhost:8084',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    proxyTimeout: 300000,
    timeout: 300000
  },
  '/api/tenants': {
    target: 'http://localhost:8087',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    proxyTimeout: 300000,
    timeout: 300000
  },
  '/api': {
    target: 'http://localhost:8086',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    proxyTimeout: 300000,
    timeout: 300000
  }
};