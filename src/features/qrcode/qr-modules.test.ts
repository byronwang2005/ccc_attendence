import { describe, expect, it } from 'vitest';
import qr from 'qr-image';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { extractQrModules } from './qr-modules';
import { qrModuleColors, TREE_PALETTE } from './magic-tree-config';
import { onRequestPost } from '../../../functions/api/generate.js';

const makeImage = (value: string) => {
  const buffer = qr.imageSync(value, { type: 'png', margin: 2, size: 10 });
  if (typeof buffer === 'string') throw new Error('Expected PNG buffer');
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
};

describe('QR PNG module contract', () => {
  it.each(['https://example.com/', 'https://ccc.nottingham.edu.cn/attendance?courseId=1234&timestamp=1788597000000', 'x'.repeat(500)])('preserves encoded content: %s', value => {
    const image = makeImage(value);
    const modules = extractQrModules(image);
    const scale = 6, width = (modules.length + 8) * scale;
    const pixels = new Uint8ClampedArray(width * width * 4);
    // Independently decode the final dark brown / warm white palette and quiet zone.
    for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
      const dark = modules[Math.floor(y / scale) - 4]?.[Math.floor(x / scale) - 4];
      pixels.set(dark ? [56, 39, 25, 255] : [246, 241, 231, 255], (y * width + x) * 4);
    }
    expect(jsQR(image.data, image.width, image.height)?.data).toBe(value);
    expect(jsQR(pixels, width, width)?.data).toBe(value);
  });
  it('rejects malformed dimensions, borders, nonuniform pixels and invalid finders', () => {
    const image = makeImage('test');
    expect(() => extractQrModules({ ...image, height: 1 })).toThrow();
    for (const [x, y] of [[0, 0], [25, 25]]) {
      const corrupt = { ...image, data: image.data.slice() };
      const offset = (y * image.width + x) * 4;
      const opposite = corrupt.data[offset] ? 0 : 255;
      corrupt.data.set([opposite, opposite, opposite, 255], offset);
      expect(() => extractQrModules(corrupt)).toThrow();
    }
    const blank = { ...image, data: new Uint8ClampedArray(image.data.length).fill(255) };
    expect(() => extractQrModules(blank)).toThrow('finder');
  });
});


describe('lower-version attendance PNG', () => {
  it.each(['schedule-456', '12345678-1234-1234-1234-123456789abc'])('preserves the full direct link and decodes the autumn palette: %s', async scheduleId => {
    const timestamp = '1777777777777';
    const expected = `https://ccc.nottingham.edu.cn/study/attendance?scheduleId=${scheduleId}&time=${timestamp}`;
    const response = await onRequestPost({ request: new Request('https://example.test/api/generate', {
      method: 'POST', body: JSON.stringify({ url: `https://ccc.nottingham.edu.cn/study/course?id=${scheduleId}`, timestamp })
    }), env: {} });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
    const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
    const image = { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
    const modules = extractQrModules(image);
    expect(modules.length).toBe(extractQrModules(makeImage(expected)).length - 4);
    expect(jsQR(image.data, image.width, image.height)?.data).toBe(expected);
    const colors = qrModuleColors(modules.length);
    // Validate the colored view at normal display scales. Enlarged light modules
    // can exceed the decoder's adaptive-threshold limits.
    for (const scale of [4, 7]) {
      const width = (modules.length + 8) * scale;
      const data = new Uint8ClampedArray(width * width * 4);
      for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
        const mx = Math.floor(x / scale) - 4, my = Math.floor(y / scale) - 4;
        const color = modules[my]?.[mx] ? colors[my][mx] : TREE_PALETTE.background;
        data.set([1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16)).concat(255), (y * width + x) * 4);
      }
      expect(jsQR(data, width, width)?.data).toBe(expected);
    }
  });
});
