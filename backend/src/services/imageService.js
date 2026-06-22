const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

const hasCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

let cloudinary = null;

if (hasCloudinaryConfig) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function uploadImage(image, folder) {
  if (typeof image !== 'string') return null;
  if (image.startsWith('http')) return image;

  if (!image.startsWith('data:image/')) return null;
  if (!cloudinary) return image;

  const result = await cloudinary.uploader.upload(image, {
    folder,
    resource_type: 'image',
  });

  return result.secure_url;
}

function uploadProductImage(image) {
  return uploadImage(image, 'fanaticos-fc/produtos');
}

function uploadCategoryImage(image) {
  return uploadImage(image, 'fanaticos-fc/categorias');
}

async function normalizeProductImages(images = []) {
  const normalized = [];

  for (const image of images.slice(0, 4)) {
    const url = await uploadProductImage(image);
    if (url) normalized.push(url);
  }

  return normalized;
}

module.exports = {
  hasCloudinaryConfig,
  normalizeProductImages,
  uploadCategoryImage,
};
