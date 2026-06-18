require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { PrismaClient } = require('@prisma/client');
const { registerAccount } = require('../src/services/registerAccountService');
const { transfer } = require('../src/services/transferService');
const { createProduct } = require('../src/services/productService');
const { purchase } = require('../src/services/purchaseService');

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@2026!';

const USERS = [
  {
    name: 'Ana Demo',
    email: 'ana@demo.mybank.local',
    phone: '+5511999990001',
    payment_key: '11111111-1111-1111-1111-111111111111',
  },
  {
    name: 'Bruno Demo',
    email: 'bruno@demo.mybank.local',
    phone: '+5511999990002',
    payment_key: '22222222-2222-2222-2222-222222222222',
  },
];

const SAMPLE_TRANSFER_IDEMPOTENCY_KEY = 'seed-sample-transfer-ana-bruno';
const SAMPLE_TRANSFER_AMOUNT_CENTS = 500;

const PRODUCT_CATALOG = [
  {
    sellerEmail: 'bruno@demo.mybank.local',
    name: 'Café especial demo',
    description: 'Grãos selecionados para demonstração da loja.',
    price: '19,90',
    cashbackPercent: 5,
  },
  {
    sellerEmail: 'bruno@demo.mybank.local',
    name: 'Brownie artesanal',
    description: 'Brownie de chocolate com nozes.',
    price: '12,50',
    cashbackPercent: 3,
  },
  {
    sellerEmail: 'bruno@demo.mybank.local',
    name: 'Livro de finanças',
    description: 'Guia introdutório de educação financeira.',
    price: '45,00',
    cashbackPercent: 0,
  },
  {
    sellerEmail: 'bruno@demo.mybank.local',
    name: 'Camiseta MyBank',
    description: 'Camiseta algodão com logo da demo.',
    price: '35,00',
    cashbackPercent: 10,
  },
  {
    sellerEmail: 'ana@demo.mybank.local',
    name: 'Caderno premium',
    description: 'Caderno pautado com capa dura.',
    price: '24,90',
    cashbackPercent: 5,
  },
  {
    sellerEmail: 'ana@demo.mybank.local',
    name: 'Fone básico',
    description: 'Fone intra-auricular para o dia a dia.',
    price: '89,90',
    cashbackPercent: 2,
  },
  {
    sellerEmail: 'ana@demo.mybank.local',
    name: 'Caneca personalizada',
    description: 'Caneca cerâmica 350 ml.',
    price: '29,90',
    cashbackPercent: 0,
  },
  {
    sellerEmail: 'ana@demo.mybank.local',
    name: 'Planner anual',
    description: 'Organizador anual com metas mensais.',
    price: '39,90',
    cashbackPercent: 5,
  },
];

const SAMPLE_PURCHASES = [
  {
    idempotencyKey: 'seed-purchase-ana-from-bruno',
    buyerEmail: 'ana@demo.mybank.local',
    sellerEmail: 'bruno@demo.mybank.local',
    productName: 'Café especial demo',
  },
  {
    idempotencyKey: 'seed-purchase-bruno-from-ana',
    buyerEmail: 'bruno@demo.mybank.local',
    sellerEmail: 'ana@demo.mybank.local',
    productName: 'Caderno premium',
  },
];

async function createUsers() {
  const users = [];

  for (const userAttrs of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: userAttrs.email } });
    if (existing) {
      users.push(existing);
      continue;
    }

    const result = await registerAccount({
      name: userAttrs.name,
      email: userAttrs.email,
      phone: userAttrs.phone,
      password: DEMO_PASSWORD,
    });

    if (!result.ok) {
      throw new Error(result.error.message || 'Falha ao criar usuário demo');
    }

    const user = await prisma.user.update({
      where: { id: result.value.id },
      data: { paymentKey: userAttrs.payment_key },
    });

    users.push(user);
  }

  return users;
}

async function sampleTransfer(users) {
  const ana = users.find((user) => user.email === 'ana@demo.mybank.local');
  const bruno = users.find((user) => user.email === 'bruno@demo.mybank.local');

  if (!ana || !bruno) {
    return;
  }

  const existing = await prisma.transfer.findUnique({
    where: { idempotencyKey: SAMPLE_TRANSFER_IDEMPOTENCY_KEY },
  });

  if (existing) {
    return;
  }

  const result = await transfer({
    sender: ana,
    payeeIdentifier: bruno.paymentKey,
    amountCents: SAMPLE_TRANSFER_AMOUNT_CENTS,
    idempotencyKey: SAMPLE_TRANSFER_IDEMPOTENCY_KEY,
  });

  if (!result.ok) {
    throw new Error(result.error.message || 'Falha na transferência demo');
  }
}

async function sampleProducts(users) {
  for (const item of PRODUCT_CATALOG) {
    const seller = users.find((user) => user.email === item.sellerEmail);
    if (!seller) {
      continue;
    }

    const existing = await prisma.product.findFirst({
      where: { sellerId: seller.id, name: item.name },
    });

    if (existing) {
      continue;
    }

    const result = await createProduct(seller.id, {
      name: item.name,
      description: item.description,
      price: item.price,
      cashbackPercent: item.cashbackPercent,
      active: true,
    });

    if (!result.ok) {
      throw new Error(result.error.message || `Falha ao criar produto ${item.name}`);
    }
  }
}

async function samplePurchases(users) {
  for (const spec of SAMPLE_PURCHASES) {
    const existing = await prisma.purchase.findUnique({
      where: { idempotencyKey: spec.idempotencyKey },
    });

    if (existing) {
      continue;
    }

    const buyer = users.find((user) => user.email === spec.buyerEmail);
    const seller = users.find((user) => user.email === spec.sellerEmail);

    if (!buyer || !seller) {
      continue;
    }

    const product = await prisma.product.findFirst({
      where: { sellerId: seller.id, name: spec.productName },
    });

    if (!product) {
      throw new Error(`Produto demo não encontrado: ${spec.productName}`);
    }

    const result = await purchase({
      buyer,
      productId: product.id,
      idempotencyKey: spec.idempotencyKey,
    });

    if (!result.ok) {
      throw new Error(result.error.message || `Falha na compra demo ${spec.idempotencyKey}`);
    }
  }
}

async function main() {
  await prisma.storeTreasury.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, balanceCents: 0 },
  });

  const users = await createUsers();
  await sampleTransfer(users);
  await sampleProducts(users);
  await samplePurchases(users);

  console.log(
    `Demo seed: ${users.length} usuários, 1 transferência, ${PRODUCT_CATALOG.length} produtos, ${SAMPLE_PURCHASES.length} compras.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
