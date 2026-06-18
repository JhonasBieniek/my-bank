const multer = require('multer');
const { env } = require('../config/env');
const { formatZodErrors } = require('./validate');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: env.maxUploadBytes,
  },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido'));
    }

    return cb(null, true);
  },
});

function parseMultipartBody(body) {
  const parsed = { ...body };

  if (parsed.cashback_percent !== undefined && parsed.cashback_percent !== '') {
    parsed.cashback_percent = Number(parsed.cashback_percent);
  }

  if (parsed.active !== undefined && parsed.active !== '') {
    parsed.active = parsed.active === 'true' || parsed.active === true || parsed.active === '1';
  }

  if (parsed.remove_image !== undefined && parsed.remove_image !== '') {
    parsed.remove_image =
      parsed.remove_image === 'true' || parsed.remove_image === true || parsed.remove_image === '1';
  }

  return parsed;
}

function validateProductMultipart(schema) {
  return (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(422).json({ message: 'Imagem excede o tamanho máximo permitido' });
        }

        return res.status(422).json({ message: 'Upload de imagem inválido' });
      }

      if (err) {
        return res.status(422).json({ message: err.message ?? 'Upload de imagem inválido' });
      }

      const result = schema.safeParse(parseMultipartBody(req.body));

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        return res.status(422).json({
          message: errors[0] ?? 'Dados inválidos',
          errors,
        });
      }

      req.validated = result.data;
      return next();
    });
  };
}

module.exports = { validateProductMultipart, upload };
