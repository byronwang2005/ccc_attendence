import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderQrCumulativeStatsSvg, renderQrStatsSvg } from './qr-stats.js';

describe('QR statistics SVG design', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the hourly chart with embedded project fonts and no logo', () => {
    const svg = renderQrStatsSvg({ configured: true, rows: [], hours: 24 });

    expect(svg).toContain("font-family: 'TsangerJinKai02'");
    expect(svg).toContain('data:font/woff2;base64,');
    expect(svg).toContain('url(#hourlyPaper)');
    expect(svg).toContain('width="600" height="168"');
    expect(svg).not.toMatch(/<line(?:\s|>)/);
    expect(svg).not.toContain('<circle');
    expect(svg).toContain('id="hourly-bars"');
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('xlink');
  });

  it('renders the cumulative chart with the same paper design', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'));

    const svg = renderQrCumulativeStatsSvg({
      configured: true,
      rows: [{ day: '2026-08-19', count: 3 }]
    });

    expect(svg).toContain("font-family: 'TsangerJinKai02'");
    expect(svg).toContain('data:font/woff2;base64,');
    expect(svg).toContain('url(#totalPaper)');
    expect(svg).toContain('width="600" height="168"');
    expect(svg).not.toMatch(/<line(?:\s|>)/);
    expect(svg.match(/<circle/g)).toHaveLength(1);
    expect(svg).not.toContain('<image');
    expect(svg).not.toContain('xlink');
  });

  it.each([1, 24, 168])('renders %i hourly bars with accurate heights and no overlap', hours => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'));
    const svg = renderQrStatsSvg({ configured: true, hours, rows: [
      { bucket_hour: '2026-09-08T11:00:00.000Z', count: 5 },
      { bucket_hour: '2026-09-08T12:00:00.000Z', count: 10 }
    ] });
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const bars = [...doc.querySelectorAll('#hourly-bars rect')];
    expect(bars).toHaveLength(hours);
    expect(Number(bars.at(-1).getAttribute('height'))).toBe(74);
    if (hours > 1) expect(Number(bars.at(-2).getAttribute('height'))).toBe(37);
    for (let index = 0; index < bars.length; index++) {
      const x = Number(bars[index].getAttribute('x'));
      const width = Number(bars[index].getAttribute('width'));
      expect(x).toBeGreaterThanOrEqual(24);
      expect(x + width).toBeLessThanOrEqual(576);
      if (index > 0) expect(x).toBeGreaterThan(Number(bars[index - 1].getAttribute('x')) + width);
      if (index < hours - 2) expect(Number(bars[index].getAttribute('height'))).toBe(0);
    }
    expect(doc.querySelector('#hourly-bars').getAttribute('fill')).toBe('url(#hourlyFill)');
    expect([...doc.querySelectorAll('#hourlyFill stop')].map(stop => stop.getAttribute('stop-color'))).toEqual(['#D0DCE9', '#F2F0EB']);
  });

  it('renders endpoint markers for a multi-day cumulative chart', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T12:00:00.000Z'));

    const svg = renderQrCumulativeStatsSvg({
      configured: true,
      rows: [{ day: '2026-08-19', count: 3 }]
    });

    expect(svg.match(/<circle/g)).toHaveLength(2);
    expect(svg).toContain('<title>08-19：3 次</title>');
    expect(svg).toContain('<title>08-23：3 次</title>');
  });
});
