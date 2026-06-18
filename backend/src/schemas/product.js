const { z } = require('zod');



const { MAX_PRODUCT_NAME_LENGTH } = require('../lib/constants');
const { containsHtmlTags } = require('../lib/plainText');
const { env } = require('../config/env');

const { getMaxCashbackPercent } = require('../services/purchaseSplit');

const productNameMaxMessage = `Nome deve ter no máximo ${MAX_PRODUCT_NAME_LENGTH} caracteres`;
const noHtmlMessage = 'Não pode conter tags HTML';

const plainTextName = z
  .string()
  .trim()
  .min(1, 'Nome é obrigatório')
  .max(MAX_PRODUCT_NAME_LENGTH, productNameMaxMessage)
  .refine((value) => !containsHtmlTags(value), { message: noHtmlMessage });

const plainTextDescription = z
  .string()
  .trim()
  .max(1000, 'Descrição muito longa')
  .refine((value) => !containsHtmlTags(value), { message: noHtmlMessage });



const maxCashbackPercent = getMaxCashbackPercent();

const cashbackMaxMessage = `Cashback não pode passar de ${maxCashbackPercent}% (a loja retém ${env.storeFeePercent}% de taxa em cada venda)`;



const productCreateSchema = z.object({

  name: plainTextName,

  description: plainTextDescription.optional().transform((value) => (value === '' ? undefined : value)),

  price: z.string().trim().min(1, 'Preço é obrigatório'),

  cashback_percent: z.coerce

    .number({ invalid_type_error: 'Cashback inválido' })

    .int('Cashback deve ser inteiro')

    .min(0, 'Cashback não pode ser negativo')

    .max(maxCashbackPercent, cashbackMaxMessage)

    .optional()

    .default(0),

  active: z.boolean().optional().default(true),

});



const productUpdateSchema = z

  .object({

    name: plainTextName.optional(),

    description: plainTextDescription.optional().transform((value) => (value === '' ? null : value)),

    price: z.string().trim().min(1, 'Preço é obrigatório').optional(),

    cashback_percent: z.coerce

      .number({ invalid_type_error: 'Cashback inválido' })

      .int('Cashback deve ser inteiro')

      .min(0, 'Cashback não pode ser negativo')

      .max(maxCashbackPercent, cashbackMaxMessage)

      .optional(),

    active: z.boolean().optional(),

    remove_image: z.boolean().optional(),

  })

  .refine((data) => Object.keys(data).length > 0, {

    message: 'Informe ao menos um campo para atualizar',

  });



const purchaseSchema = z.object({

  idempotency_key: z.string().uuid('Chave de idempotência inválida').optional(),

});



module.exports = { productCreateSchema, productUpdateSchema, purchaseSchema };

