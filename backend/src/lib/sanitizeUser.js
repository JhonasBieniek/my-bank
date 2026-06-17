function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    balance_cents: user.balanceCents,
    payment_key: user.paymentKey,
  };
}

module.exports = { sanitizeUser };
