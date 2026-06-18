const { env } = require('../config/env');
const { InvalidOperationError } = require('./baseService');

function getStoreFeePercent() {
  return env.storeFeePercent;
}

function getMaxCashbackPercent() {
  return 100 - getStoreFeePercent();
}

function calculatePurchaseSplit({ priceCents, cashbackPercent }) {
  const grossCents = priceCents;
  const feeCents = Math.floor((grossCents * getStoreFeePercent()) / 100);
  const cashbackCents =
    cashbackPercent > 0 ? Math.floor((grossCents * cashbackPercent) / 100) : 0;
  const sellerNetCents = grossCents - feeCents - cashbackCents;

  if (sellerNetCents < 0) {
    throw new InvalidOperationError('Valores da compra inválidos');
  }

  return {
    grossCents,
    feeCents,
    cashbackCents,
    sellerNetCents,
  };
}

module.exports = {
  getStoreFeePercent,
  getMaxCashbackPercent,
  calculatePurchaseSplit,
};
