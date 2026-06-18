# My Bank

**Idiomas:** [English](README.md) · [Português (BR)](README.pt-BR.md)

Banco digital de exemplo (**Node.js + Angular**): contas, transferências, loja entre usuários (taxa de 2% para tesouraria em cada compra). Regras de dinheiro no backend; o navegador só exibe dados do servidor.

> **Segurança e integridade** — [detalhes abaixo](#segurança-e-integridade)

## Como rodar

```bash
cp .env.example .env
docker compose up --build
```

UI [localhost:4200](http://localhost:4200) · API [localhost:3000](http://localhost:3000) — na primeira subida, migrations do Prisma e seed das contas demo.

**Requisitos:** Docker + Compose (recomendado). Node ≥ 18 só fora do Docker. **Correções:** porta em uso → `API_PORT`/`FRONTEND_PORT`/`MYSQL_PORT` no `.env`; banco desatualizado → `docker compose down -v` + rebuild; sem dados → logs do `my-bank-api`.

## Contas para testar

Senha: **`Demo@2026!`**

| Quem | E-mail | Telefone | Chave de pagamento |
|------|--------|----------|-------------------|
| Ana Demo | `ana@demo.mybank.local` | `+5511999990001` | `11111111-1111-1111-1111-111111111111` |
| Bruno Demo | `bruno@demo.mybank.local` | `+5511999990002` | `22222222-2222-2222-2222-222222222222` |

O seed inclui compras de exemplo, transferência e catálogo com cashback opcional (`backend/prisma/seed.js`). Tesouraria reflete a taxa de 2%.

## Stack

Monorepo (`backend` · `frontend` · `e2e`): **Express 5** + **Prisma** + **MySQL 8** + **Zod** + **Jest** | **Angular 17** | **Docker Compose**

Lógica financeira: `backend/src/services/` (`registerAccountService`, `transferService`, `purchaseService`, `purchaseSplit`). Features: auth, dashboard auditável, transferências, CRUD da loja com upload de imagem, desativação lógica de produtos.

## Segurança e integridade

**Limite de confiança** — Backend valida todas as regras monetárias; o front nunca define valor de compra nem split de taxas.

| Tópico | Mecanismo |
|--------|-----------|
| **Centavos e ledger** | Só centavos inteiros; cada operação gera `LedgerEntry` auditável (`opening_balance`, `transfer_*`, `purchase_*`, `purchase_fee`, `purchase_cashback`). Cadastro: crédito de R$ 300,00 |
| **Transferências** | Por e-mail, telefone ou `payment_key`; bloqueia auto-transferência e saldo insuficiente; locks SQL `FOR UPDATE` |
| **Compras** | Preço só do banco; `purchaseSplit` (2% tesouraria, cashback opcional ≤ 98%, líquido ao vendedor) em transação com lock |
| **Tesouraria** | Saldo público na loja; cresce só com taxas de compra |
| **Idempotência** | UUID `idempotency_key` do cliente em transferência e compra; replay = mesmo resultado; índice único no banco |
| **Concorrência** | Locks pessimistas + suítes Jest com carga paralela (transferências e compras) |
| **Auth** | bcrypt; cookie `httpOnly` + `SameSite=Lax` |
| **Endurecimento da API** | Rate limit (10/min login, 5/min cadastro/IP); Helmet; validação Zod; HTML rejeitado em campos de produto |
| **Uploads** | Magic bytes; re-encode com **sharp** (JPEG/PNG); sem SVG; nomes de arquivo seguros |
| **Privacidade** | Nomes de destinatário mascarados nas respostas da API |

## Testes

| Camada | Papel |
|--------|-------|
| **Jest (~62 testes)** | **Gate principal do CI** — lógica unitária, integração HTTP (auth, dashboard, loja, autorização), concorrência MySQL real (locks, idempotência, saldo ≥ 0, ledger). Sem suíte Jasmine no front |
| **Playwright E2E** | **Opcional** red-team no stack Docker — ataques de sessão, rate limits, abuso de upload, injeção, exploits financeiros. Disparo manual no GitHub (Actions → **E2E (Playwright)**) |

```bash
npm test -w backend                    # gate do CI (todo push/PR)
npm run test:watch -w backend
docker compose up --build              # para E2E
npm run test:e2e:install && npm run test:e2e
```

Priorize Jest antes de commits; rode E2E ao mudar middleware de segurança, uploads ou sessão.