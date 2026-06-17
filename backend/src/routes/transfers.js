const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../lib/prisma');
const { parseAmountToCents } = require('../lib/parseAmount');
const { maskRecipientName } = require('../lib/maskRecipientName');
const { validate } = require('../middleware/validate');
const { transferSchema } = require('../schemas/transfer');
const { transfer } = require('../services/transferService');

const router = express.Router();

const UNPROCESSABLE_CODES = new Set(['insufficient_funds', 'payee_not_found']);

router.post('/', validate(transferSchema), async (req, res, next) => {
  try {
    const sender = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });

    if (!sender) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const { payee_identifier: payeeIdentifier, amount, idempotency_key: idempotencyKey } =
      req.validated;
    const resolvedIdempotencyKey = idempotencyKey ?? uuidv4();
    const amountCents = parseAmountToCents(amount);

    if (amountCents === null) {
      return res.status(422).json({ message: 'Valor inválido' });
    }

    const result = await transfer({
      sender,
      payeeIdentifier,
      amountCents,
      idempotencyKey: resolvedIdempotencyKey,
    });

    if (!result.ok) {
      const status = UNPROCESSABLE_CODES.has(result.error.code) ? 422 : 422;
      return res.status(status).json({ message: result.error.message });
    }

    const recipient = await prisma.user.findUnique({
      where: { id: result.value.recipientId },
    });

    res.status(201).json({
      transfer: {
        id: result.value.id,
        amount_cents: result.value.amountCents,
        recipient_name: maskRecipientName(recipient?.name),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
