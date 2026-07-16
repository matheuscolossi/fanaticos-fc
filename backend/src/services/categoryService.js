const categoryModel = require('../models/categoryModel');
const { uploadCategoryImage } = require('./imageService');
const { createHttpError } = require('../utils/http');

async function validatePayload({ nome, categoria_pai_id }, currentId = null) {
  if (!nome || !nome.trim()) {
    throw createHttpError(400, 'Nome da categoria é obrigatório.', 'VALIDATION_ERROR');
  }

  const existing = await categoryModel.findByNome(nome.trim());
  if (existing && String(existing.id) !== String(currentId)) {
    throw createHttpError(409, 'Já existe uma categoria com esse nome.', 'CATEGORY_NAME_EXISTS');
  }

  if (categoria_pai_id && String(categoria_pai_id) === String(currentId)) {
    throw createHttpError(400, 'Uma categoria não pode ser pai dela mesma.', 'INVALID_PARENT');
  }
}

async function listCategories() {
  return categoryModel.list();
}

async function listPublicCategories() {
  return categoryModel.listPublic();
}

async function createCategory(data) {
  await validatePayload(data);
  const imagem = await uploadCategoryImage(data.imagem);
  const result = await categoryModel.create({ ...data, nome: data.nome.trim(), imagem });
  return { id: result.lastID, message: 'Categoria criada.' };
}

async function updateCategory(id, data) {
  const current = await categoryModel.findById(id);
  if (!current) throw createHttpError(404, 'Categoria não encontrada.', 'CATEGORY_NOT_FOUND');

  await validatePayload(data, id);
  const imagem = await uploadCategoryImage(data.imagem) ?? current.imagem;
  await categoryModel.update(id, { ...data, nome: data.nome.trim(), imagem });
  return { message: 'Categoria atualizada.' };
}

async function setCategoryStatus(id, status) {
  const current = await categoryModel.findById(id);
  if (!current) throw createHttpError(404, 'Categoria não encontrada.', 'CATEGORY_NOT_FOUND');
  await categoryModel.setStatus(id, status);
  return { message: 'Status atualizado.' };
}

async function deleteCategory(id, transferToId) {
  const current = await categoryModel.findById(id);
  if (!current) throw createHttpError(404, 'Categoria não encontrada.', 'CATEGORY_NOT_FOUND');

  const { c: subcategorias } = await categoryModel.countSubcategorias(id);
  if (Number(subcategorias) > 0) {
    throw createHttpError(
      409,
      'Esta categoria possui subcategorias vinculadas. Edite ou exclua-as antes de continuar.',
      'HAS_SUBCATEGORIES'
    );
  }

  const { c: produtosCount } = await categoryModel.countProdutos(id);
  if (Number(produtosCount) > 0) {
    if (!transferToId) {
      throw createHttpError(
        409,
        `Esta categoria possui ${produtosCount} produto(s) vinculado(s). Escolha uma categoria de destino para transferi-los antes de excluir.`,
        'HAS_PRODUCTS'
      );
    }
    if (String(transferToId) === String(id)) {
      throw createHttpError(400, 'A categoria de destino não pode ser a mesma que está sendo excluída.', 'VALIDATION_ERROR');
    }
    const destino = await categoryModel.findById(transferToId);
    if (!destino) throw createHttpError(404, 'Categoria de destino não encontrada.', 'CATEGORY_NOT_FOUND');

    await categoryModel.reassignProducts(id, transferToId);
  }

  await categoryModel.remove(id);
  return { message: 'Categoria excluída.' };
}

module.exports = {
  createCategory,
  deleteCategory,
  listCategories,
  listPublicCategories,
  setCategoryStatus,
  updateCategory,
};
