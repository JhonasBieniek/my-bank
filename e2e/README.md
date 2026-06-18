# E2E — Testes de segurança (Playwright)

Simula um **atacante malicioso** contra o stack real do My Bank.

## Pré-requisitos

1. Stack rodando:

```bash
docker compose up
```

2. Dependências e browser:

```bash
npm install
npm run test:e2e:install
```

## Executar

```bash
npm run test:e2e
npm run test:e2e:ui      # modo interativo
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `API_BASE_URL` | `http://localhost:3000` | Base da API |
| `FRONTEND_BASE_URL` | `http://localhost:4200` | Base do Angular (proxy → API) |

## Contas demo

- `ana@demo.mybank.local` / `Demo@2026!`
- `bruno@demo.mybank.local` / `Demo@2026!`

## CI

- **Push/PR:** o workflow `.github/workflows/ci.yml` roda apenas **Jest** no backend (job obrigatório).
- **E2E:** disparo **manual** via `.github/workflows/e2e.yml` (`workflow_dispatch`).
  - GitHub → **Actions** → **E2E (Playwright)** → **Run workflow** → escolha o branch → **Run workflow**.
  - O job sobe `docker compose` (MySQL + API + frontend), instala Chromium e executa `npm run test:e2e`.
