const { z } = require('zod');

const transferSchema = z.object({
  payee_identifier: z.string().trim().min(1, 'Destinatário é obrigatório'),
  amount: z.string().trim().min(1, 'Valor é obrigatório'),
  idempotency_key: z.string().uuid('Chave de idempotência inválida').optional(),
});

module.exports = { transferSchema };
