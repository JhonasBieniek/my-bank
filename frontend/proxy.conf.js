// Rotas da SPA (/dashboard, /transfers) colidem com paths da API.
// Navegação do browser (Accept: text/html) deve servir index.html;
// chamadas XHR/fetch continuam indo para o backend.
const PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:3000';

function bypassSpaNavigation(req) {
  const accept = req.headers.accept || '';
  if (req.method === 'GET' && accept.includes('text/html')) {
    return '/index.html';
  }
}

module.exports = {
  '/auth': { target: PROXY_TARGET, secure: false, changeOrigin: true, bypass: bypassSpaNavigation },
  '/dashboard': { target: PROXY_TARGET, secure: false, changeOrigin: true, bypass: bypassSpaNavigation },
  '/transfers': { target: PROXY_TARGET, secure: false, changeOrigin: true, bypass: bypassSpaNavigation },
  '/store': { target: PROXY_TARGET, secure: false, changeOrigin: true, bypass: bypassSpaNavigation },
  '/health': { target: PROXY_TARGET, secure: false, changeOrigin: true },
};
