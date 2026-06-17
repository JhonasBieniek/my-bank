module.exports = {
  OPENING_BALANCE_CENTS: 30_000,
  STORE_FEE_PERCENT: 2,
  LEDGER_KINDS: [
    'opening_balance',
    'transfer_debit',
    'transfer_credit',
    'purchase_debit',
    'purchase_credit',
    'purchase_fee',
    'purchase_cashback',
  ],
};