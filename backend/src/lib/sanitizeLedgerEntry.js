function sanitizeLedgerEntry(entry) {
  return {
    id: entry.id,
    kind: entry.kind,
    amount_cents: entry.amountCents,
    balance_after_cents: entry.balanceAfterCents,
    created_at: entry.createdAt.toISOString(),
  };
}

module.exports = { sanitizeLedgerEntry };
