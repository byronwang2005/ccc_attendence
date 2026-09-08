import { RESPONSE_HEADERS } from '../lib/api-constants.js';
import { getCumulativeQrStats, getHourlyQrStats } from '../lib/qr-stats.js';
import { renderReadmeSvg } from '../lib/readme-svg.js';

export async function onRequestGet({ env, request }) {
  const results = await Promise.allSettled([
    getHourlyQrStats({ env, hours: 24 }),
    getCumulativeQrStats({ env })
  ]);
  const [hourly, cumulative] = results.map(result => result.status === 'fulfilled'
    ? result.value
    : { configured: true, rows: [], unavailable: true });

  // A partial failure still returns a usable image with the other panel intact.
  const svg = renderReadmeSvg({ hourly, cumulative });
  const headers = { ...RESPONSE_HEADERS.svg, Vary: 'Accept-Encoding' };
  const acceptsGzip = request?.headers.get('Accept-Encoding')?.split(',').some(encoding => {
    const [name, ...parameters] = encoding.trim().split(';');
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
    return name.toLowerCase() === 'gzip' && (!quality || Number(quality.trim().slice(2)) > 0);
  });
  if (acceptsGzip) {
    // Keep the original lossless logo frames; budget the complete image's wire size.
    const compressed = new Response(svg).body.pipeThrough(new CompressionStream('gzip'));
    return new Response(compressed, {
      headers: { ...headers, 'Content-Encoding': 'gzip' },
      encodeBody: 'manual'
    });
  }
  return new Response(svg, { headers });
}
