function formatZodErrors(error) {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
}

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      return res.status(422).json({
        message: errors[0] ?? 'Dados inválidos',
        errors,
      });
    }

    req.validated = result.data;
    next();
  };
}

module.exports = { validate, formatZodErrors };
