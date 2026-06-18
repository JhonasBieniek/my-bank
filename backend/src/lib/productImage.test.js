const {
  detectImageType,
  hasDangerousFilename,
  isSafeFilename,
} = require('./productImage');

describe('productImage', () => {
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);

  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

  const webpHeader = Buffer.from('RIFFxxxxWEBP', 'ascii');

  it('detecta PNG, JPEG e WebP pelos magic bytes', () => {
    expect(detectImageType(pngHeader)).toBe('png');
    expect(detectImageType(jpegHeader)).toBe('jpeg');
    expect(detectImageType(webpHeader)).toBe('webp');
  });

  it('rejeita SVG disfarçado', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectImageType(svg)).toBeNull();
  });

  it('rejeita nomes com path traversal e extensão dupla', () => {
    expect(hasDangerousFilename('../evil.jpg')).toBe(true);
    expect(hasDangerousFilename('photo.php.jpg')).toBe(true);
    expect(hasDangerousFilename('photo.svg')).toBe(true);
    expect(hasDangerousFilename('photo.jpg')).toBe(false);
  });

  it('aceita apenas nomes UUID gerados pelo servidor', () => {
    expect(isSafeFilename('550e8400-e29b-41d4-a716-446655440000.jpg')).toBe(true);
    expect(isSafeFilename('../../../etc/passwd')).toBe(false);
    expect(isSafeFilename('photo.jpg')).toBe(false);
  });
});
