const { errorHandler } = require('./errorHandler');

describe('errorHandler', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
  });

  function createResponse() {
    const res = {
      headersSent: false,
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    return res;
  }

  it('oculta detalhes de erro 500 em produção', () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const { errorHandler: productionHandler } = require('./errorHandler');

    const res = createResponse();
    const err = new Error('detalhe interno sensível');
    err.status = 500;

    productionHandler(err, {}, res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: 'Erro interno do servidor' });
  });

  it('preserva mensagem de erro 4xx em produção', () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const { errorHandler: productionHandler } = require('./errorHandler');

    const res = createResponse();
    const err = new Error('Valor inválido');
    err.status = 422;

    productionHandler(err, {}, res, () => {});

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ message: 'Valor inválido' });
  });
});
