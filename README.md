# My Bank

**Languages:** [English](README.md) · [Português (BR)](README.pt-BR.md)

Sample digital bank (**Node.js + Angular**): accounts, transfers, peer store (2% treasury fee on purchases). Money rules live in the backend; the browser only displays server data.

> **Security & integrity** — [details below](#security--integrity)

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

UI [localhost:4200](http://localhost:4200) · API [localhost:3000](http://localhost:3000) — first boot runs Prisma migrations and seeds demo accounts.

**Needs:** Docker + Compose (recommended). Node ≥ 18 only outside Docker. **Fixes:** port conflict → `API_PORT`/`FRONTEND_PORT`/`MYSQL_PORT` in `.env`; stale DB → `docker compose down -v` + rebuild; empty data → check `my-bank-api` logs.

## Demo accounts

Password: **`Demo@2026!`**

| Who | Email | Phone | Payment key |
|-----|-------|-------|-------------|
| Ana Demo | `ana@demo.mybank.local` | `+5511999990001` | `11111111-1111-1111-1111-111111111111` |
| Bruno Demo | `bruno@demo.mybank.local` | `+5511999990002` | `22222222-2222-2222-2222-222222222222` |

Seed includes sample purchases, a transfer, and catalog items with optional cashback (`backend/prisma/seed.js`). Store treasury reflects the 2% fee.

## Stack

Monorepo (`backend` · `frontend` · `e2e`): **Express 5** + **Prisma** + **MySQL 8** + **Zod** + **Jest** | **Angular 17** | **Docker Compose**

Money logic: `backend/src/services/` (`registerAccountService`, `transferService`, `purchaseService`, `purchaseSplit`). Features: auth, auditable dashboard, transfers, store CRUD with image upload, soft-deactivate products.

## Security & integrity

**Trust boundary** — Backend validates all money rules; frontend never sets purchase amounts or fee splits.

| Topic | Mechanism |
|-------|-----------|
| **Cents & ledger** | Whole cents only; every operation writes auditable `LedgerEntry` (`opening_balance`, `transfer_*`, `purchase_*`, `purchase_fee`, `purchase_cashback`). Sign-up: R$ 300.00 credit |
| **Transfers** | By email, phone, or `payment_key`; blocks self-transfer & insufficient balance; SQL `FOR UPDATE` locks |
| **Purchases** | Price from DB only; `purchaseSplit` (2% treasury, optional cashback ≤ 98%, net to seller) inside locked transaction |
| **Treasury** | Public store-page balance; grows only from purchase fees |
| **Idempotency** | Client UUID `idempotency_key` on transfer & purchase; replay = same result; unique DB index |
| **Concurrency** | Pessimistic locks + Jest parallel-load suites for transfers & purchases |
| **Auth** | bcrypt; session cookie `httpOnly` + `SameSite=Lax` |
| **API hardening** | Rate limit (10/min login, 5/min sign-up/IP); Helmet; Zod validation; HTML rejected on product fields |
| **Uploads** | Magic-byte check; **sharp** re-encode to JPEG/PNG; no SVG; safe filenames |
| **Privacy** | Masked recipient names in API responses |

## Testing

| Layer | Role |
|-------|------|
| **Jest (~62 tests)** | **Primary CI gate** — unit logic, HTTP integration (auth, dashboard, store, authz), real-MySQL concurrency (locks, idempotency, balance ≥ 0, ledger). No frontend Jasmine suite |
| **Playwright E2E** | **Optional** red-team on running Docker stack — session attacks, rate limits, upload abuse, injection, financial exploits. Manual GitHub trigger only (Actions → **E2E (Playwright)**) |

```bash
npm test -w backend                    # CI gate (every push/PR)
npm run test:watch -w backend
docker compose up --build            # for E2E
npm run test:e2e:install && npm run test:e2e
```

Prioritize Jest before commits; run E2E when changing security middleware, uploads, or sessions.