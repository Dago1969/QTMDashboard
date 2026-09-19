const fs = require('fs');
const path = require('path');

// minimal arg parsing: allow --api=... --ticket=...
const args = process.argv.slice(2);
const argMap = {};
args.forEach(a => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) argMap[m[1]] = m[2];
});

const apiBase = process.env.NG_APP_API_BASE_URL || argMap.api || 'https://dashboard.qtmdev.quicare.com/api';
const ticketBase = process.env.NG_APP_TICKET_API_BASE_URL || argMap.ticket || 'https://ticket.qtmdev.quicare.com/api/ticket';

const distEnvPath = path.resolve(__dirname, '..', 'dist', 'qtm-dashboard-frontend', 'browser', 'env.js');
const content = `// Generated env.js
(function (window) {
  window.NG_APP_API_BASE_URL = "${apiBase}";
  window.NG_APP_TICKET_API_BASE_URL = "${ticketBase}";
})(window);
`;

try {
  // ensure directory exists
  fs.mkdirSync(path.dirname(distEnvPath), { recursive: true });
  fs.writeFileSync(distEnvPath, content, 'utf8');
  console.log(`env.js written to ${distEnvPath}`);
} catch (e) {
  console.error('Failed to write env.js:', e);
  process.exit(1);
}
