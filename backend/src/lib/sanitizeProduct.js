const { maskRecipientName } = require('./maskRecipientName');
const { getImageUrl } = require('./productImage');

function sanitizeProduct(product, { includeSeller = false, includeActive = false } = {}) {
  const sanitized = {
    id: product.id,
    name: product.name,
    description: product.description ?? null,
    price_cents: product.priceCents,
    image_url: getImageUrl(product.imageUrl),
    cashback_percent: product.cashbackPercent,
  };

  if (includeActive) {
    sanitized.active = product.active;
  }

  if (includeSeller && product.seller) {
    sanitized.seller_name = maskRecipientName(product.seller.name);
  }

  return sanitized;
}

module.exports = { sanitizeProduct };
