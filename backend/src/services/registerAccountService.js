const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../lib/prisma');
const { normalize: normalizePhone } = require('../lib/phoneNormalizer');
const { OPENING_BALANCE_CENTS, LEDGER_KINDS } = require('../lib/constants');
const { ok, fail } = require('./result');

const BCRYPT_COST = 12;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function registerAccount({ name, email, phone, password }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return fail({ status: 422, message: 'Telefone inválido' });
  }

  const passwordDigest = await bcrypt.hash(password, BCRYPT_COST);
  const paymentKey = uuidv4();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordDigest,
          paymentKey,
          balanceCents: OPENING_BALANCE_CENTS,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          userId: createdUser.id,
          kind: LEDGER_KINDS[0],
          amountCents: OPENING_BALANCE_CENTS,
          balanceAfterCents: OPENING_BALANCE_CENTS,
        },
      });

      return createdUser;
    });

    return ok(user);
  } catch (error) {
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target : [target].filter(Boolean);

      if (fields.some((field) => String(field).includes('email'))) {
        return fail({ status: 422, message: 'E-mail já cadastrado' });
      }

      if (fields.some((field) => String(field).includes('phone'))) {
        return fail({ status: 422, message: 'Telefone já cadastrado' });
      }

      return fail({ status: 422, message: 'Dados já cadastrados' });
    }

    throw error;
  }
}

module.exports = { registerAccount, normalizeEmail };
