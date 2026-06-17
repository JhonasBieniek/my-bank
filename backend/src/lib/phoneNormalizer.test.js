const { normalize } = require('./phoneNormalizer');

describe('phoneNormalizer', () => {
  it('retorna string vazia para entrada sem dígitos', () => {
    expect(normalize('')).toBe('');
    expect(normalize('abc')).toBe('');
  });

  it('prefixa +55 em números brasileiros com 10 ou 11 dígitos', () => {
    expect(normalize('11999990000')).toBe('+5511999990000');
    expect(normalize('(11) 99999-0000')).toBe('+5511999990000');
  });

  it('mantém código do país quando já começa com 55 e tem 12+ dígitos', () => {
    expect(normalize('5511999990000')).toBe('+5511999990000');
  });

  it('prefixa + sem forçar +55 quando não é padrão BR (10–11 dígitos)', () => {
    expect(normalize('912345678')).toBe('+912345678');
  });
});
