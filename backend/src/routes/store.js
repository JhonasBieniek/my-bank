const fs = require('fs/promises');

const path = require('path');

const express = require('express');

const { v4: uuidv4 } = require('uuid');

const { prisma } = require('../lib/prisma');

const { sanitizeProduct } = require('../lib/sanitizeProduct');

const {

  getContentType,

  isSafeFilename,

  processAndSaveImage,

  deleteProductImage,

} = require('../lib/productImage');

const { env } = require('../config/env');

const { requireAuth } = require('../middleware/auth');

const { validate } = require('../middleware/validate');

const { validateProductMultipart } = require('../middleware/productMultipart');

const {

  productCreateSchema,

  productUpdateSchema,

  purchaseSchema,

} = require('../schemas/product');

const {

  listActiveProducts,

  listSellerProducts,

  createProduct,

  updateProduct,

  deleteProduct,

} = require('../services/productService');

const { purchase } = require('../services/purchaseService');



const router = express.Router();



const UNPROCESSABLE_CODES = new Set([

  'insufficient_funds',

  'product_not_found',

  'product_has_purchases',

]);



const FORBIDDEN_CODES = new Set(['forbidden']);



async function loadAuthenticatedUser(req, res) {

  const user = await prisma.user.findUnique({

    where: { id: req.session.userId },

  });



  if (!user) {

    req.session.destroy(() => {});

    res.status(401).json({ message: 'Não autenticado' });

    return null;

  }



  return user;

}



async function loadOptionalUser(req, res) {

  if (!req.session.userId) {

    return null;

  }



  const user = await prisma.user.findUnique({

    where: { id: req.session.userId },

  });



  if (!user) {

    req.session.destroy(() => {});

    res.status(401).json({ message: 'Não autenticado' });

    return undefined;

  }



  return user;

}



function parsePositiveInt(value, fallback) {

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {

    return fallback;

  }



  return parsed;

}



function mapServiceError(res, result) {

  if (FORBIDDEN_CODES.has(result.error.code)) {

    return res.status(403).json({ message: result.error.message });

  }



  if (UNPROCESSABLE_CODES.has(result.error.code) || !result.error.code) {

    return res.status(422).json({ message: result.error.message });

  }



  return res.status(422).json({ message: result.error.message });

}



router.get('/products/images/:filename', requireAuth, async (req, res, next) => {

  try {

    const user = await loadAuthenticatedUser(req, res);

    if (!user) {

      return;

    }



    const { filename } = req.params;

    if (!isSafeFilename(filename)) {

      return res.status(404).json({ message: 'Imagem não encontrada' });

    }



    const filePath = path.join(env.uploadDir, filename);

    const contentType = getContentType(filename);



    if (!contentType) {

      return res.status(404).json({ message: 'Imagem não encontrada' });

    }



    try {

      await fs.access(filePath);

    } catch {

      return res.status(404).json({ message: 'Imagem não encontrada' });

    }



    res.setHeader('Content-Type', contentType);

    res.setHeader('Content-Disposition', 'inline');

    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.setHeader('Cache-Control', 'private, max-age=3600');

    res.sendFile(path.resolve(filePath));

  } catch (error) {

    next(error);

  }

});



router.get('/products', async (req, res, next) => {

  try {

    const user = await loadOptionalUser(req, res);

    if (user === undefined) {

      return;

    }



    const page = parsePositiveInt(req.query.page, 1);

    const perPage = parsePositiveInt(req.query.per_page, 16);



    const result = await listActiveProducts({

      excludeSellerId: user?.id,

      page,

      perPage,

    });



    const treasury = await prisma.storeTreasury.findUnique({ where: { id: 1 } });



    res.json({

      products: result.value.products.map((product) =>

        sanitizeProduct(product, { includeSeller: true })

      ),

      pagination: result.value.pagination,

      treasury_balance_cents: treasury?.balanceCents ?? 0,

    });

  } catch (error) {

    next(error);

  }

});



router.get('/products/mine', requireAuth, async (req, res, next) => {

  try {

    const user = await loadAuthenticatedUser(req, res);

    if (!user) {

      return;

    }



    const result = await listSellerProducts(user.id);

    res.json({

      products: result.value.map((product) => sanitizeProduct(product, { includeActive: true })),

    });

  } catch (error) {

    next(error);

  }

});



router.post('/products', requireAuth, validateProductMultipart(productCreateSchema), async (req, res, next) => {

  let savedFilename;



  try {

    const user = await loadAuthenticatedUser(req, res);

    if (!user) {

      return;

    }



    if (req.file) {

      savedFilename = await processAndSaveImage(req.file.buffer, req.file.originalname);

    }



    const {

      name,

      description,

      price,

      cashback_percent: cashbackPercent,

      active,

    } = req.validated;



    const result = await createProduct(user.id, {

      name,

      description,

      price,

      imageFilename: savedFilename,

      cashbackPercent,

      active,

    });



    if (!result.ok) {

      if (savedFilename) {

        await deleteProductImage(savedFilename);

      }

      return mapServiceError(res, result);

    }



    res.status(201).json({

      product: sanitizeProduct(result.value, { includeActive: true }),

    });

  } catch (error) {

    if (savedFilename) {

      await deleteProductImage(savedFilename).catch(() => {});

    }

    next(error);

  }

});



router.put('/products/:id', requireAuth, validateProductMultipart(productUpdateSchema), async (req, res, next) => {

  let savedFilename;



  try {

    const user = await loadAuthenticatedUser(req, res);

    if (!user) {

      return;

    }



    const productId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(productId) || productId <= 0) {

      return res.status(422).json({ message: 'Produto inválido' });

    }



    if (req.file) {

      savedFilename = await processAndSaveImage(req.file.buffer, req.file.originalname);

    }



    const {

      name,

      description,

      price,

      cashback_percent: cashbackPercent,

      active,

      remove_image: removeImage,

    } = req.validated;



    const result = await updateProduct(user.id, productId, {

      name,

      description,

      price,

      imageFilename: savedFilename,

      removeImage: removeImage && !savedFilename,

      cashbackPercent,

      active,

    });



    if (!result.ok) {

      if (savedFilename) {

        await deleteProductImage(savedFilename);

      }

      return mapServiceError(res, result);

    }



    res.json({

      product: sanitizeProduct(result.value, { includeActive: true }),

    });

  } catch (error) {

    if (savedFilename) {

      await deleteProductImage(savedFilename).catch(() => {});

    }

    next(error);

  }

});



router.delete('/products/:id', requireAuth, async (req, res, next) => {

  try {

    const user = await loadAuthenticatedUser(req, res);

    if (!user) {

      return;

    }



    const productId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(productId) || productId <= 0) {

      return res.status(422).json({ message: 'Produto inválido' });

    }



    const result = await deleteProduct(user.id, productId);

    if (!result.ok) {

      return mapServiceError(res, result);

    }



    res.status(204).send();

  } catch (error) {

    next(error);

  }

});



router.post('/products/:id/purchase', requireAuth, validate(purchaseSchema), async (req, res, next) => {

  try {

    const user = await loadAuthenticatedUser(req, res);

    if (!user) {

      return;

    }



    const productId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(productId) || productId <= 0) {

      return res.status(422).json({ message: 'Produto inválido' });

    }



    const { idempotency_key: idempotencyKey } = req.validated;

    const resolvedIdempotencyKey = idempotencyKey ?? uuidv4();



    const result = await purchase({

      buyer: user,

      productId,

      idempotencyKey: resolvedIdempotencyKey,

    });



    if (!result.ok) {

      return mapServiceError(res, result);

    }



    const product = await prisma.product.findUnique({ where: { id: productId } });



    res.status(201).json({

      purchase: {

        id: result.value.id,

        amount_cents: result.value.grossCents,

        fee_cents: result.value.feeCents,

        cashback_cents: result.value.cashbackCents,

        seller_net_cents: result.value.sellerNetCents,

        product_name: product?.name ?? null,

      },

    });

  } catch (error) {

    next(error);

  }

});



module.exports = router;

