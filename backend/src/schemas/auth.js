const { z } = require('zod');

const registerSchema = z.object({
  user: z
    .object({
      name: z.string().trim().min(1, 'Nome é obrigatório'),
      email: z.string().trim().email('E-mail inválido'),
      phone: z.string().trim().min(1, 'Telefone é obrigatório'),
      password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
      password_confirmation: z.string().min(1, 'Confirmação de senha é obrigatória'),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: 'As senhas não conferem',
      path: ['password_confirmation'],
    }),
});

const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

module.exports = { registerSchema, loginSchema };
