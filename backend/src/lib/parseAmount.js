function parseAmountToCents(value) {
  if (value == null || typeof value !== 'string') {
    return null;
  }

  let str = value.trim().replace(/[R$\s]/gi, '');
  if (!str || !/\d/.test(str)) {
    return null;
  }

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  let normalized;
  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      normalized = str.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = str.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = str.replace(/,/g, '');
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100);
}

module.exports = { parseAmountToCents };
