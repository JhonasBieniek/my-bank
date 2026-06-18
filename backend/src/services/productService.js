const { prisma } = require('../lib/prisma');

const { parseAmountToCents } = require('../lib/parseAmount');

const { deleteProductImage } = require('../lib/productImage');

const { ok, fail } = require('./result');



const DEFAULT_PER_PAGE = 16;

const MAX_PER_PAGE = 16;



function normalizePagination({ page, perPage }) {

  const safePage = Number.isInteger(page) && page > 0 ? page : 1;

  const requestedPerPage = Number.isInteger(perPage) && perPage > 0 ? perPage : DEFAULT_PER_PAGE;

  const safePerPage = Math.min(MAX_PER_PAGE, requestedPerPage);



  return { page: safePage, perPage: safePerPage };

}



async function listActiveProducts({ excludeSellerId, page = 1, perPage = DEFAULT_PER_PAGE } = {}) {

  const pagination = normalizePagination({ page, perPage });

  const where = { active: true };



  if (excludeSellerId) {

    where.sellerId = { not: excludeSellerId };

  }



  const [products, total] = await Promise.all([

    prisma.product.findMany({

      where,

      include: { seller: { select: { name: true } } },

      orderBy: { createdAt: 'desc' },

      skip: (pagination.page - 1) * pagination.perPage,

      take: pagination.perPage,

    }),

    prisma.product.count({ where }),

  ]);



  const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.perPage);



  return ok({

    products,

    pagination: {

      page: pagination.page,

      per_page: pagination.perPage,

      total,

      total_pages: totalPages,

    },

  });

}



async function listSellerProducts(sellerId) {

  const products = await prisma.product.findMany({

    where: { sellerId },

    orderBy: { createdAt: 'desc' },

  });



  return ok(products);

}



async function createProduct(sellerId, { name, description, price, imageFilename, cashbackPercent, active }) {

  const priceCents = parseAmountToCents(price);

  if (priceCents === null || priceCents <= 0) {

    return fail({ message: 'Preço inválido' });

  }



  const product = await prisma.product.create({

    data: {

      sellerId,

      name,

      description: description ?? null,

      priceCents,

      imageUrl: imageFilename ?? null,

      cashbackPercent: cashbackPercent ?? 0,

      active: active ?? true,

    },

  });



  return ok(product);

}



async function updateProduct(sellerId, productId, fields) {

  const existing = await prisma.product.findUnique({ where: { id: productId } });

  if (!existing) {

    return fail({ message: 'Produto não encontrado', code: 'product_not_found' });

  }



  if (existing.sellerId !== sellerId) {

    return fail({ message: 'Você não pode editar este produto', code: 'forbidden' });

  }



  const data = {};



  if (fields.name !== undefined) {

    data.name = fields.name;

  }



  if (fields.description !== undefined) {

    data.description = fields.description;

  }



  if (fields.price !== undefined) {

    const priceCents = parseAmountToCents(fields.price);

    if (priceCents === null || priceCents <= 0) {

      return fail({ message: 'Preço inválido' });

    }

    data.priceCents = priceCents;

  }



  if (fields.imageFilename !== undefined) {

    if (existing.imageUrl && existing.imageUrl !== fields.imageFilename) {

      await deleteProductImage(existing.imageUrl);

    }

    data.imageUrl = fields.imageFilename;

  } else if (fields.removeImage) {

    if (existing.imageUrl) {

      await deleteProductImage(existing.imageUrl);

    }

    data.imageUrl = null;

  }



  if (fields.cashbackPercent !== undefined) {

    data.cashbackPercent = fields.cashbackPercent;

  }



  if (fields.active !== undefined) {

    data.active = fields.active;

  }



  const product = await prisma.product.update({

    where: { id: productId },

    data,

  });



  return ok(product);

}



async function deleteProduct(sellerId, productId) {

  const existing = await prisma.product.findUnique({

    where: { id: productId },

    include: { _count: { select: { purchases: true } } },

  });



  if (!existing) {

    return fail({ message: 'Produto não encontrado', code: 'product_not_found' });

  }



  if (existing.sellerId !== sellerId) {

    return fail({ message: 'Você não pode remover este produto', code: 'forbidden' });

  }



  if (existing._count.purchases > 0) {

    return fail({

      message: 'Produto com compras não pode ser removido; desative-o em vez disso',

      code: 'product_has_purchases',

    });

  }



  if (existing.imageUrl) {

    await deleteProductImage(existing.imageUrl);

  }



  await prisma.product.delete({ where: { id: productId } });

  return ok({ id: productId });

}



module.exports = {

  listActiveProducts,

  listSellerProducts,

  createProduct,

  updateProduct,

  deleteProduct,

};

