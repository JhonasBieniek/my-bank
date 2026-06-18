const { env } = require('../config/env');

module.exports = {
  MAX_USER_NAME_LENGTH: 120,
  MAX_PRODUCT_NAME_LENGTH: 50,
  OPENING_BALANCE_CENTS: 30_000,
  get STORE_FEE_PERCENT() {
    return env.storeFeePercent;
  },
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