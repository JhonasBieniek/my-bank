import fs from 'node:fs';
import path from 'node:path';

import { request } from '@playwright/test';

import { ANA, API_BASE_URL, BRUNO, DEMO_PASSWORD, FRONTEND_BASE_URL } from './helpers/constants';

const AUTH_DIR = path.join(__dirname, '.auth');

async function ensureAuthState(email: string, fileName: string): Promise<void> {
  const filePath = path.join(AUTH_DIR, fileName);

  if (fs.existsSync(filePath)) {
    const existing = await request.newContext({
      baseURL: API_BASE_URL,
      storageState: filePath,
    });
    const probe = await existing.get('/auth/me');
    await existing.dispose();

    if (probe.ok()) {
      return;
    }
  }

  const ctx = await request.newContext({ baseURL: API_BASE_URL });
  const response = await ctx.post('/auth/login', {
    data: { email, password: DEMO_PASSWORD },
  });

  if (!response.ok()) {
    const body = await response.text();
    await ctx.dispose();
    throw new Error(
      `Falha ao autenticar ${email} no global-setup: HTTP ${response.status()} — ${body}\n` +
        'Se HTTP 429, aguarde 60s após teste de rate limit ou reinicie a API: docker restart my-bank-api'
    );
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await ctx.storageState({ path: filePath });
  await ctx.dispose();
}

async function globalSetup(): Promise<void> {
  const ctx = await request.newContext();

  try {
    const health = await ctx.get(`${API_BASE_URL}/health`, { timeout: 10_000 });
    if (!health.ok()) {
      throw new Error(
        `API indisponível em ${API_BASE_URL} (HTTP ${health.status()}).\n` +
          'Suba o stack com: docker compose up\n' +
          'Ou defina API_BASE_URL se a API estiver em outra porta.'
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('API indisponível')) {
      throw error;
    }
    throw new Error(
      `Não foi possível conectar à API em ${API_BASE_URL}.\n` +
        'Suba o stack com: docker compose up\n' +
        `Detalhe: ${message}`
    );
  }

  try {
    const frontend = await ctx.get(FRONTEND_BASE_URL, { timeout: 8_000 });
    if (!frontend.ok()) {
      process.env.E2E_FRONTEND_UNAVAILABLE = '1';
      console.warn(
        `[e2e] Frontend retornou HTTP ${frontend.status()} em ${FRONTEND_BASE_URL} — testes de browser serão ignorados.`
      );
    }
  } catch {
    process.env.E2E_FRONTEND_UNAVAILABLE = '1';
    console.warn(
      `[e2e] Frontend indisponível em ${FRONTEND_BASE_URL} — testes de browser serão ignorados.`
    );
  }

  await ctx.dispose();

  await ensureAuthState(ANA.email, 'ana.json');
  await ensureAuthState(BRUNO.email, 'bruno.json');
}

export default globalSetup;
