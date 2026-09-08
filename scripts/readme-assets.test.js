import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readChunks = buffer => {
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    chunks.push({ type, data: buffer.subarray(dataStart, dataStart + size) });
    offset = dataStart + size + (size % 2);
  }
  return chunks;
};

describe('README visual assets', () => {
  it('keeps the animated hero compact and looping', () => {
    const buffer = readFileSync('public/assets/images/readme-hero.webp');
    const chunks = readChunks(buffer);
    const canvas = chunks.find(chunk => chunk.type === 'VP8X')?.data;
    const animationFrames = chunks.filter(chunk => chunk.type === 'ANMF');

    expect(canvas).toBeDefined();
    expect(canvas?.readUIntLE(4, 3) + 1).toBe(1200);
    expect(canvas?.readUIntLE(7, 3) + 1).toBe(220);
    expect(animationFrames).toHaveLength(90);
    expect(animationFrames.reduce((total, frame) => total + frame.data.readUIntLE(12, 3), 0)).toBe(4500);
    // Full frames retain the subtle moving background; keep the asset under 1 MiB.
    expect(buffer.byteLength).toBeLessThanOrEqual(1024 * 1024);
  });

  it('uses one responsive image and the project badge palette', () => {
    const readme = readFileSync('README.md', 'utf8');

    expect(readme).toContain('https://ccc.byron.wang/api/readme.svg');
    expect(readme.match(/width="100%"/g)).toHaveLength(1);
    expect(readme).not.toMatch(/api\/stats(?:-total)?\.svg|readme-hero\.webp/);
    expect(readme.match(/labelColor=504E49&color=1B365D/g)).toHaveLength(2);
    expect(readme).toContain('img.shields.io/badge/license-MIT-1B365D?style=flat-square&labelColor=504E49');
  });
});
