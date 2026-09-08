import { afterEach, describe, expect, it, vi } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { onRequestGet } from '../api/readme.svg.js';
import { renderReadmeSvg } from './readme-svg.js';
import { renderQrCumulativeStatsSvg, renderQrStatsSvg } from './qr-stats.js';

const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml');
const empty = { rows: [], configured: true };
const freezeTime = () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-08T12:00:00Z'));
};

describe('combined README image', () => {
  afterEach(() => vi.useRealTimers());

  it('preserves chart foregrounds, fonts, and layout without nested backgrounds', () => {
    freezeTime();
    const hourly = { configured: true, rows: [{ bucket_hour: '2026-09-08T12:00:00.000Z', count: 7 }] };
    const cumulative = { configured: true, rows: [{ day: '2026-09-07', count: 4 }, { day: '2026-09-08', count: 7 }] };
    const svg = renderReadmeSvg({ hourly, cumulative });
    const doc = parse(svg);
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 1200 396');
    for (const [prefix, standalone, x] of [
      ['hourly', renderQrStatsSvg(hourly), '0'],
      ['total', renderQrCumulativeStatsSvg(cumulative), '600']
    ]) {
      const chart = doc.getElementById(`${prefix}-title`).parentElement;
      expect(chart.getAttribute('x')).toBe(x);
      expect(chart.getAttribute('y')).toBe('228');
      expect(chart.getAttribute('viewBox')).toBe('0 0 600 168');
      const selectForeground = node => [...node.querySelectorAll('text, circle, #hourly-bars rect, path[fill="none"], path[fill^="url"]')]
        .filter(element => !element.hasAttribute('stroke-width') || element.getAttribute('stroke-width') === '2.5')
        .map(element => element.outerHTML).sort();
      expect(selectForeground(chart)).toEqual(selectForeground(parse(standalone)));
    }
    expect(doc.querySelectorAll('style')).toHaveLength(1);
    expect(doc.querySelectorAll('[id$="Paper"], [id$="Silk"]')).toHaveLength(0);
    const ids = [...doc.querySelectorAll('[id]')].map(element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(svg).not.toMatch(/<script|<foreignObject|href="https?:/);
  });

  it('closes every background animation with matching values and zero endpoint velocity', () => {
    const doc = parse(renderReadmeSvg({ hourly: empty, cumulative: empty }));
    const animations = doc.querySelectorAll('#readme-background animate');
    expect(animations).toHaveLength(12);
    for (const animation of animations) {
      const values = animation.getAttribute('values').split(';');
      expect(values[0]).toBe(values.at(-1));
      expect(animation.getAttribute('dur')).toBe('8s');
      expect(animation.getAttribute('repeatCount')).toBe('indefinite');
      expect(animation.getAttribute('keySplines')).toBe('0.37 0 0.63 1;0.37 0 0.63 1');
    }
  });

  it('returns an image for an unconfigured database', async () => {
    const response = await onRequestGet({ env: {} });
    expect(response.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect((await response.text()).match(/统计数据库未配置/g)).toHaveLength(2);
  });

  it('transfers the complete lossless image below 1 MiB when gzip is accepted', async () => {
    const request = new Request('https://example.com/api/readme.svg', { headers: { 'Accept-Encoding': 'gzip, br' } });
    const response = await onRequestGet({ env: {}, request });
    expect(response.headers.get('Content-Encoding')).toBe('gzip');
    expect(response.headers.get('Vary')).toBe('Accept-Encoding');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.length).toBeLessThan(1024 * 1024);
    expect(parse(gunzipSync(bytes).toString()).querySelector('parsererror')).toBeNull();
  });

  it('respects an explicit gzip opt-out', async () => {
    const request = new Request('https://example.com/api/readme.svg', { headers: { 'Accept-Encoding': 'gzip;q=0, br' } });
    const response = await onRequestGet({ env: {}, request });
    expect(response.headers.get('Content-Encoding')).toBeNull();
    expect(await response.text()).toContain('<svg');
  });

  it.each(['hourly', 'cumulative', 'both'])('keeps healthy statistics when %s queries fail', async failure => {
    freezeTime();
    const env = { QR_STATS_DB: { prepare: sql => {
      const isHourly = sql.includes('WHERE bucket_hour');
      const query = {
        bind: () => query,
        all: async () => {
          if (failure === 'both' || failure === (isHourly ? 'hourly' : 'cumulative')) throw new Error('Database unavailable');
          return { results: isHourly
            ? [{ bucket_hour: '2026-09-08T12:00:00.000Z', count: 7 }]
            : [{ day: '2026-09-08', count: 11 }] };
        }
      };
      return query;
    } } };
    const response = await onRequestGet({ env });
    expect(response.status).toBe(200);
    const doc = parse(await response.text());
    for (const [prefix, failed] of [['hourly', failure !== 'cumulative'], ['total', failure !== 'hourly']]) {
      const panel = doc.getElementById(`${prefix}-title`).parentElement;
      expect(panel.textContent.includes('统计暂不可用')).toBe(failed);
      expect(panel.querySelectorAll('circle, #hourly-bars rect').length > 0).toBe(!failed);
    }
    if (failure === 'hourly') expect(doc.documentElement.textContent).toContain('累计 11 次');
    if (failure === 'cumulative') expect(doc.documentElement.textContent).toContain('总计 7');
  });
});
