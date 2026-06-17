function maskRecipientName(name) {
  if (!name || typeof name !== 'string') {
    return '***';
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return '***';
  }

  const visible = trimmed.slice(0, 2);
  return `${visible}***`;
}

module.exports = { maskRecipientName };
