// Documentação mínima (OpenAPI 3.0) das rotas exigidas pelo trabalho.
// Servida via Swagger UI em GET /docs (ver server.js).
module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'Fanáticos FC API',
    version: '1.0.0',
    description: 'Rotas REST exigidas pelo trabalho de Programação Web (URI).',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      basicAuth: { type: 'http', scheme: 'basic' },
    },
    schemas: {
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 244 },
          nome: { type: 'string', example: 'Venezia Third 25-26 Torcedor' },
          preco: { type: 'string', example: '179.99' },
          descricao: { type: 'string', example: 'Camisa oficial torcedor.' },
          cores: { type: 'array', items: { type: 'string' }, example: ['Verde', 'Preto'] },
          tamanhos: { type: 'array', items: { type: 'string' }, example: ['P', 'M', 'G'] },
          peso: { type: 'string', example: '0.300' },
          categoria_id: { type: 'integer', nullable: true, example: 2 },
        },
      },
      CartItemInput: {
        type: 'object',
        required: ['productId', 'qty'],
        properties: {
          productId: { type: 'integer', example: 244 },
          qty: { type: 'integer', example: 2 },
        },
      },
      CartSummary: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'integer', example: 244 },
                name: { type: 'string', example: 'Venezia Third 25-26 Torcedor' },
                price: { type: 'number', example: 179.99 },
                qty: { type: 'integer', example: 2 },
                image: { type: 'string', nullable: true, example: 'https://.../foto.webp' },
              },
            },
          },
          subtotal: { type: 'number', example: 359.98 },
          freight: { type: 'number', example: 0 },
          discount: { type: 'number', example: 36 },
          total: { type: 'number', example: 323.98 },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Produto não encontrado.' },
          code: { type: 'string', example: 'PRODUCT_NOT_FOUND' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Validação de funcionamento do serviço',
        responses: {
          200: {
            description: 'Serviço operante',
            content: { 'application/json': { example: { status: 'ok', db: true, timestamp: '2026-06-22T21:58:44.154Z' } } },
          },
        },
      },
    },
    '/products': {
      post: {
        summary: 'Cadastra um novo produto',
        security: [{ basicAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                nome: 'Camisa Flamengo Home 25/26',
                preco: 299.9,
                cores: ['Vermelho', 'Preto'],
                tamanhos: ['P', 'M', 'G'],
                peso: 0.3,
                descricao: 'Camisa oficial titular.',
                categoria_id: 1,
              },
            },
          },
        },
        responses: {
          201: { description: 'Produto criado', content: { 'application/json': { example: { message: 'Produto criado.', id: 246 } } } },
          401: { description: 'Credenciais Basic Auth ausentes/inválidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: { description: 'Erro interno', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/product/{id}': {
      get: {
        summary: 'Detalhe do produto',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Produto encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } },
          404: { description: 'Produto não encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      delete: {
        summary: 'Remove um produto específico',
        security: [{ basicAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Produto excluído', content: { 'application/json': { example: { message: 'Produto excluído.' } } } },
          401: { description: 'Credenciais Basic Auth ausentes/inválidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Produto não encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/search': {
      get: {
        summary: 'Lista produtos com busca e filtros paginados',
        parameters: [
          { name: 'query', in: 'query', schema: { type: 'string' }, description: 'Termo de pesquisa (nome/atributos)' },
          { name: 'cat', in: 'query', schema: { type: 'string' }, description: 'Categoria (id ou nome)' },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, default: 24 } },
        ],
        responses: {
          200: {
            description: 'Lista paginada de produtos',
            content: {
              'application/json': {
                example: { produtos: [{ id: 244, nome: 'Venezia Third 25-26 Torcedor', preco: '179.99' }], total: 231, page: 1, totalPages: 116 },
              },
            },
          },
          400: { description: 'Parâmetros de paginação inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/cart': {
      post: {
        summary: 'Calcula o resumo do carrinho (subtotal, frete, desconto e total)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: { items: [{ productId: 244, qty: 1 }, { productId: 243, qty: 1 }], cupomCode: 'URI10' },
            },
          },
        },
        responses: {
          200: { description: 'Resumo calculado', content: { 'application/json': { schema: { $ref: '#/components/schemas/CartSummary' } } } },
          400: { description: 'Itens inválidos ou ausentes', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Algum productId não existe', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
  },
};
