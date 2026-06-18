const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const sharp = require('sharp');
const { env } = require('../config/env');

const SAFE_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }

  return null;
}

function hasDangerousFilename(originalname) {
  if (!originalname || typeof originalname !== 'string') {
    return true;
  }

  const base = path.basename(originalname);
  if (base !== originalname || originalname.includes('..') || originalname.includes('/') || originalname.includes('\\')) {
    return true;
  }

  const parts = base.split('.');
  if (parts.length > 2) {
    return true;
  }

  const ext = path.extname(base).toLowerCase();
  if (ext && !['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    return true;
  }

  return false;
}

function isSafeFilename(filename) {
  return SAFE_FILENAME_PATTERN.test(filename);
}

function getImageUrl(filename) {
  if (!filename) {
    return null;
  }

  return `/store/products/images/${filename}`;
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return CONTENT_TYPES[ext] ?? null;
}

async function processAndSaveImage(buffer, originalname) {
  if (hasDangerousFilename(originalname)) {
    const error = new Error('Nome de arquivo inválido');
    error.status = 422;
    throw error;
  }

  const type = detectImageType(buffer);
  if (!type) {
    const error = new Error('Formato de imagem não permitido. Use JPEG, PNG ou WebP.');
    error.status = 422;
    throw error;
  }

  const ext = type === 'jpeg' ? '.jpg' : `.${type}`;
  const filename = `${randomUUID()}${ext}`;

  let output;
  if (type === 'jpeg') {
    output = await sharp(buffer).rotate().jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  } else if (type === 'png') {
    output = await sharp(buffer).rotate().png().toBuffer();
  } else {
    output = await sharp(buffer).rotate().webp({ quality: 85 }).toBuffer();
  }

  await fs.mkdir(env.uploadDir, { recursive: true });
  await fs.writeFile(path.join(env.uploadDir, filename), output);

  return filename;
}

async function deleteProductImage(filename) {
  if (!filename || !isSafeFilename(filename)) {
    return;
  }

  try {
    await fs.unlink(path.join(env.uploadDir, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = {
  detectImageType,
  hasDangerousFilename,
  isSafeFilename,
  getImageUrl,
  getContentType,
  processAndSaveImage,
  deleteProductImage,
};
