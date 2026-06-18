import fs from 'node:fs';
import path from 'node:path';

import { APIRequestContext, APIResponse, request } from '@playwright/test';

import { ANA, API_BASE_URL, BRUNO, DEMO_PASSWORD } from './constants';

export type JsonBody = Record<string, unknown>;

export interface DashboardSnapshot {
  balanceCents: number;
  ledgerTopBalanceAfter: number | null;
  userEmail: string;
}

const AUTH_DIR = path.join(__dirname, '../.auth');

const EMAIL_TO_AUTH_FILE: Record<string, string> = {
  [ANA.email]: 'ana.json',
  [BRUNO.email]: 'bruno.json',
};

const sessionCache = new Map<string, APIRequestContext>();

export async function newApiContext(): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  });
}

export async function loginAs(
  ctx: APIRequestContext,
  email: string,
  password: string = DEMO_PASSWORD
): Promise<APIResponse> {
  return ctx.post('/auth/login', {
    data: { email, password },
  });
}

export async function getAuthenticatedContext(email: string): Promise<APIRequestContext> {
  const cached = sessionCache.get(email);
  if (cached) {
    return cached;
  }

  const authFileName = EMAIL_TO_AUTH_FILE[email];
  const authPath = authFileName ? path.join(AUTH_DIR, authFileName) : null;

  const ctx =
    authPath && fs.existsSync(authPath)
      ? await request.newContext({
          baseURL: API_BASE_URL,
          storageState: authPath,
          extraHTTPHeaders: { Accept: 'application/json' },
        })
      : await newApiContext();

  if (!authPath || !fs.existsSync(authPath)) {
    const response = await loginAs(ctx, email);
    if (!response.ok()) {
      const body = await response.text();
      await ctx.dispose();
      throw new Error(`Login falhou para ${email}: HTTP ${response.status()} — ${body}`);
    }
  } else {
    const probe = await ctx.get('/auth/me');
    if (!probe.ok()) {
      const response = await loginAs(ctx, email);
      if (!response.ok()) {
        const body = await response.text();
        await ctx.dispose();
        throw new Error(`Sessão expirada para ${email}: HTTP ${response.status()} — ${body}`);
      }
    }
  }

  sessionCache.set(email, ctx);
  return ctx;
}

export async function disposeSessionCache(): Promise<void> {
  await Promise.all([...sessionCache.values()].map((ctx) => ctx.dispose()));
  sessionCache.clear();
}

export async function apiRequest(
  ctx: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  options?: {
    data?: unknown;
    multipart?: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>;
    headers?: Record<string, string>;
  }
): Promise<APIResponse> {
  switch (method) {
    case 'GET':
      return ctx.get(path, { headers: options?.headers });
    case 'POST':
      if (options?.multipart) {
        return ctx.post(path, { multipart: options.multipart, headers: options?.headers });
      }
      return ctx.post(path, { data: options?.data, headers: options?.headers });
    case 'PUT':
      if (options?.multipart) {
        return ctx.put(path, { multipart: options.multipart, headers: options?.headers });
      }
      return ctx.put(path, { data: options?.data, headers: options?.headers });
    case 'DELETE':
      return ctx.delete(path, { headers: options?.headers });
    case 'PATCH':
      return ctx.patch(path, { data: options?.data, headers: options?.headers });
    default:
      throw new Error(`Método HTTP não suportado: ${method}`);
  }
}

export async function getBalance(ctx: APIRequestContext): Promise<number> {
  const snapshot = await getDashboardSnapshot(ctx);
  return snapshot.balanceCents;
}

export async function getDashboardSnapshot(ctx: APIRequestContext): Promise<DashboardSnapshot> {
  const response = await ctx.get('/dashboard');
  if (!response.ok()) {
    throw new Error(`GET /dashboard falhou: HTTP ${response.status()} — ${await response.text()}`);
  }

  const body = (await response.json()) as {
    user: { balance_cents: number; email: string };
    ledger_entries: Array<{ balance_after_cents: number }>;
  };

  return {
    balanceCents: body.user.balance_cents,
    ledgerTopBalanceAfter: body.ledger_entries[0]?.balance_after_cents ?? null,
    userEmail: body.user.email,
  };
}

export async function findAffordableProduct(
  buyerCtx: APIRequestContext,
  maxPriceCents: number
): Promise<{ id: number; price_cents: number; name: string } | null> {
  const response = await buyerCtx.get('/store/products?per_page=50');
  if (!response.ok()) {
    return null;
  }

  const body = (await response.json()) as {
    products: Array<{ id: number; price_cents: number; name: string }>;
  };

  const affordable = body.products
    .filter((product) => product.price_cents <= maxPriceCents)
    .sort((a, b) => a.price_cents - b.price_cents);

  return affordable[0] ?? null;
}

export async function findSellerProductId(
  sellerCtx: APIRequestContext,
  productName?: string
): Promise<number | null> {
  const response = await sellerCtx.get('/store/products/mine');
  if (!response.ok()) {
    return null;
  }

  const body = (await response.json()) as {
    products: Array<{ id: number; name: string }>;
  };

  if (productName) {
    const match = body.products.find((product) => product.name === productName);
    return match?.id ?? null;
  }

  return body.products[0]?.id ?? null;
}

export function randomUuid(): string {
  return crypto.randomUUID();
}
