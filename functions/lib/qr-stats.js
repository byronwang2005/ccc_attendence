import { qrStatsFontMedium, qrStatsFontRegular } from './qr-stats-fonts.js';

const STATS_BINDING_NAME = 'QR_STATS_DB';
const STATS_TABLE_NAME = 'qr_generation_events';

const pad = value => String(value).padStart(2, '0');

export const getHourBucket = (date = new Date()) => {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket.toISOString();
};

const getStatsDb = env => env?.[STATS_BINDING_NAME];

export const recordQrGeneration = async ({ env, scheduleId, timestamp }) => {
  const db = getStatsDb(env);
  if (!db) {
    return false;
  }

  const createdAt = new Date().toISOString();
  const bucketHour = getHourBucket(new Date(createdAt));

  await db
    .prepare(`
      INSERT INTO ${STATS_TABLE_NAME} (created_at, bucket_hour, schedule_id, requested_timestamp)
      VALUES (?, ?, ?, ?)
    `)
    .bind(createdAt, bucketHour, scheduleId, timestamp)
    .run();

  return true;
};

export const getHourlyQrStats = async ({ env, hours = 24 }) => {
  const db = getStatsDb(env);
  if (!db) {
    return { configured: false, rows: [] };
  }

  const safeHours = Math.min(Math.max(Number(hours) || 24, 1), 168);
  const start = new Date();
  start.setUTCHours(start.getUTCHours() - safeHours + 1, 0, 0, 0);

  const { results } = await db
    .prepare(`
      SELECT bucket_hour, COUNT(*) AS count
      FROM ${STATS_TABLE_NAME}
      WHERE bucket_hour >= ?
      GROUP BY bucket_hour
      ORDER BY bucket_hour ASC
    `)
    .bind(start.toISOString())
    .all();

  return {
    configured: true,
    rows: Array.isArray(results) ? results : []
  };
};

export const getCumulativeQrStats = async ({ env }) => {
  const db = getStatsDb(env);
  if (!db) {
    return { configured: false, rows: [] };
  }

  const { results } = await db
    .prepare(`
      SELECT substr(datetime(bucket_hour, '+8 hours'), 1, 10) AS day, COUNT(*) AS count
      FROM ${STATS_TABLE_NAME}
      GROUP BY day
      ORDER BY day ASC
    `)
    .all();

  return {
    configured: true,
    rows: Array.isArray(results) ? results : []
  };
};

const escapeXml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const formatShanghaiHour = isoValue => {
  const date = new Date(new Date(isoValue).getTime() + 8 * 60 * 60 * 1000);
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hour = pad(date.getUTCHours());
  return `${month}-${day} ${hour}:00`;
};

const buildHourlySeries = (rows, hours) => {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  const countsByHour = new Map(rows.map(row => [row.bucket_hour, Number(row.count) || 0]));

  return Array.from({ length: hours }, (_, index) => {
    const pointDate = new Date(now);
    pointDate.setUTCHours(now.getUTCHours() - hours + 1 + index);
    const bucketHour = pointDate.toISOString();

    return {
      bucketHour,
      count: countsByHour.get(bucketHour) || 0,
      label: formatShanghaiHour(bucketHour)
    };
  });
};

const chartFontFamily = "'TsangerJinKai02'";
const chartColors = Object.freeze({
  brand: '#1B365D',
  brandFill: '#D0DCE9',
  cloudWhite: '#F2F0EB',
  ivory: '#faf9f5',
  nearBlack: '#141413',
  stone: '#6b6a64'
});
// Pantone TCX screen references: 11-0617 Transparent Yellow / 11-0602 Snow White.
// Match the hero's normalized silk highlights without changing foreground artwork.
const silkPath = offset => Array.from({ length: 211 }, (_, index) => {
  const x = -240 + index * 8;
  const y = 92 + offset + 66 * Math.sin(x / 1200 * Math.PI * 2 * 0.85);
  return `${index === 0 ? 'M' : 'L'} ${x} ${y.toFixed(2)}`;
}).join(' ');
export const renderEmbeddedFonts = () => `<style>
    @font-face { font-family: 'TsangerJinKai02'; src: url(data:font/woff2;base64,${qrStatsFontRegular}) format('woff2'); font-style: normal; font-weight: 400; }
    @font-face { font-family: 'TsangerJinKai02'; src: url(data:font/woff2;base64,${qrStatsFontMedium}) format('woff2'); font-style: normal; font-weight: 500; }
    text { font-synthesis: none; }
  </style>`;
export const renderQrStatsSvg = ({ rows, configured, hours = 24, unavailable = false }, { background = true, embeddedFonts = true, fragment = false, x = 0, y = 0 } = {}) => {
  const width = 600;
  const height = 168;
  const padding = { top: 66, right: 24, bottom: 28, left: 24 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const series = buildHourlySeries(rows, hours);
  const maxCount = Math.max(1, ...series.map(point => point.count));
  const xStep = plotWidth / series.length;
  const barWidth = Math.min(18, xStep * 0.65);
  const yScale = value => padding.top + plotHeight - (value / maxCount) * plotHeight;
  const points = series.map((point, index) => ({
    ...point,
    x: padding.left + (index + 0.5) * xStep - barWidth / 2,
    y: yScale(point.count)
  }));
  const total = series.reduce((sum, point) => sum + point.count, 0);
  const peak = Math.max(...series.map(point => point.count));
  const latest = series.at(-1)?.count ?? 0;
  const statusText = unavailable ? '统计暂不可用' : configured
    ? `最近${hours}小时，UTC+8。总计${total}，峰值${peak}，最新${latest}`
    : 'D1 绑定 QR_STATS_DB 尚未配置。';
  const summaryText = unavailable ? '统计暂不可用' : configured
    ? `总计 ${total} · 峰值 ${peak} · 最新 ${latest}`
    : '统计数据库未配置';
  const xTicks = [0, series.length - 1]
    .filter((value, index, values) => values.indexOf(value) === index);

  return `${fragment ? '' : '<?xml version="1.0" encoding="UTF-8"?>'}
<svg xmlns="http://www.w3.org/2000/svg" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="hourly-title hourly-desc">
  <title id="hourly-title">CCC Attendance 二维码生成趋势</title>
  <desc id="hourly-desc">${escapeXml(statusText)}</desc>
  <defs>
    ${embeddedFonts ? renderEmbeddedFonts() : ''}
    ${background ? `<linearGradient id="hourlyPaper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F4EAC2"/>
      <stop offset="0.52" stop-color="${chartColors.cloudWhite}"/>
      <stop offset="1" stop-color="#F4EAC2"/>
    </linearGradient>
    <filter id="hourlySilk" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="18"/></filter>` : ''}
    <linearGradient id="hourlyFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${chartColors.brandFill}"/>
      <stop offset="1" stop-color="${chartColors.cloudWhite}"/>
    </linearGradient>
  </defs>
  ${background ? `<rect width="${width}" height="${height}" fill="url(#hourlyPaper)"/>
  <g transform="scale(${width / 1200} ${height / 220})"><g filter="url(#hourlySilk)">
    <animateTransform attributeName="transform" type="translate" values="0 0;90 12;0 0;-90 -12;0 0" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" keySplines="0.37 0 0.63 1;0.37 0 0.63 1;0.37 0 0.63 1;0.37 0 0.63 1" dur="4.5s" repeatCount="indefinite"/>
    <path d="${silkPath(0)}" fill="none" stroke="${chartColors.cloudWhite}" stroke-width="52" opacity="0.961"/>
    <path d="${silkPath(132)}" fill="none" stroke="${chartColors.cloudWhite}" stroke-width="20" opacity="0.588"/>
  </g></g>` : ''}
  <text x="${padding.left}" y="25" fill="${chartColors.nearBlack}" font-family="${chartFontFamily}" font-size="17" font-weight="500">二维码生成趋势</text>
  <text x="${padding.left}" y="46" fill="${chartColors.stone}" font-family="${chartFontFamily}" font-size="11">${escapeXml(`最近 ${hours} 小时 · UTC+8`)}</text>
  <text x="${width - padding.right}" y="31" text-anchor="end" fill="${chartColors.brand}" font-family="${chartFontFamily}" font-size="13" font-weight="500">${escapeXml(summaryText)}</text>
  ${unavailable ? '' : `<g fill="${chartColors.stone}" font-family="${chartFontFamily}" font-size="10">
    ${xTicks.map(index => `<text x="${index === 0 ? padding.left : width - padding.right}" y="${height - 9}" text-anchor="${index === 0 ? 'start' : 'end'}">${escapeXml(points[index].label)}</text>`).join('\n    ')}
  </g>
  <g id="hourly-bars" fill="url(#hourlyFill)">
    ${points.map(point => `<rect x="${point.x.toFixed(2)}" y="${point.y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${(padding.top + plotHeight - point.y).toFixed(2)}"><title>${escapeXml(`${point.label}：${point.count} 次`)}</title></rect>`).join('\n    ')}
  </g>
  <g fill="none" stroke="${chartColors.brand}" stroke-width="1.5">
    ${points.filter(point => point.count > 0).map(point => `<path d="M ${point.x.toFixed(2)} ${point.y.toFixed(2)} h ${barWidth.toFixed(2)}"/>`).join('\n    ')}
  </g>`}
</svg>`;
};

const formatDayLabel = day => {
  const date = new Date(`${day}T00:00:00.000Z`);
  const shanghaiDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${pad(shanghaiDate.getUTCMonth() + 1)}-${pad(shanghaiDate.getUTCDate())}`;
};

const buildCumulativeSeries = rows => {
  if (!rows.length) {
    const today = new Date().toISOString().slice(0, 10);
    return [{ day: today, count: 0, label: formatDayLabel(today) }];
  }

  const countsByDay = new Map(rows.map(row => [row.day, Number(row.count) || 0]));
  const start = new Date(`${rows[0].day}T00:00:00.000Z`);
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  let runningTotal = 0;
  const series = [];

  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const day = date.toISOString().slice(0, 10);
    runningTotal += countsByDay.get(day) || 0;
    series.push({
      day,
      count: runningTotal,
      label: formatDayLabel(day)
    });
  }

  return series;
};

export const renderQrCumulativeStatsSvg = ({ rows, configured, unavailable = false }, { background = true, embeddedFonts = true, fragment = false, x = 0, y = 0 } = {}) => {
  const width = 600;
  const height = 168;
  const padding = { top: 66, right: 24, bottom: 28, left: 24 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const series = buildCumulativeSeries(rows);
  const maxCount = Math.max(1, ...series.map(point => point.count));
  const xStep = series.length > 1 ? plotWidth / (series.length - 1) : plotWidth;
  const yScale = value => padding.top + plotHeight - (value / maxCount) * plotHeight;
  const points = series.map((point, index) => ({
    ...point,
    x: padding.left + index * xStep,
    y: yScale(point.count)
  }));
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const areaPath = `${path} L ${points.at(-1).x.toFixed(2)} ${padding.top + plotHeight} L ${padding.left} ${padding.top + plotHeight} Z`;
  const total = series.at(-1)?.count ?? 0;
  const statusText = unavailable ? '统计暂不可用' : configured
    ? `历史累计总量：${total}`
    : 'D1 绑定 QR_STATS_DB 尚未配置。';
  const summaryText = unavailable ? '统计暂不可用' : configured ? `累计 ${total} 次` : '统计数据库未配置';
  const xTickIndexes = [0, series.length - 1]
    .filter((value, index, values) => values.indexOf(value) === index);
  const markerPoints = points.length === 1 ? points : [points[0], points.at(-1)];

  return `${fragment ? '' : '<?xml version="1.0" encoding="UTF-8"?>'}
<svg xmlns="http://www.w3.org/2000/svg" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="total-title total-desc">
  <title id="total-title">CCC Attendance 历史累计生成总量</title>
  <desc id="total-desc">${escapeXml(statusText)}</desc>
  <defs>
    ${embeddedFonts ? renderEmbeddedFonts() : ''}
    ${background ? `<linearGradient id="totalPaper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F4EAC2"/>
      <stop offset="0.52" stop-color="${chartColors.cloudWhite}"/>
      <stop offset="1" stop-color="#F4EAC2"/>
    </linearGradient>
    <filter id="totalSilk" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="18"/></filter>` : ''}
    <linearGradient id="totalFill" x1="0" y1="${padding.top}" x2="0" y2="${padding.top + plotHeight}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${chartColors.brandFill}"/>
      <stop offset="1" stop-color="${chartColors.cloudWhite}"/>
    </linearGradient>
  </defs>
  ${background ? `<rect width="${width}" height="${height}" fill="url(#totalPaper)"/>
  <g transform="scale(${width / 1200} ${height / 220})"><g filter="url(#totalSilk)">
    <animateTransform attributeName="transform" type="translate" values="0 0;90 12;0 0;-90 -12;0 0" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" keySplines="0.37 0 0.63 1;0.37 0 0.63 1;0.37 0 0.63 1;0.37 0 0.63 1" dur="4.5s" repeatCount="indefinite"/>
    <path d="${silkPath(0)}" fill="none" stroke="${chartColors.cloudWhite}" stroke-width="52" opacity="0.961"/>
    <path d="${silkPath(132)}" fill="none" stroke="${chartColors.cloudWhite}" stroke-width="20" opacity="0.588"/>
  </g></g>` : ''}
  <text x="${padding.left}" y="25" fill="${chartColors.nearBlack}" font-family="${chartFontFamily}" font-size="17" font-weight="500">历史累计生成总量</text>
  <text x="${padding.left}" y="46" fill="${chartColors.stone}" font-family="${chartFontFamily}" font-size="11">自 2026-04-28 起</text>
  <text x="${width - padding.right}" y="31" text-anchor="end" fill="${chartColors.brand}" font-family="${chartFontFamily}" font-size="13" font-weight="500">${escapeXml(summaryText)}</text>
  ${unavailable ? '' : `<g fill="${chartColors.stone}" font-family="${chartFontFamily}" font-size="10">
    ${xTickIndexes.map(index => `<text x="${points[index].x.toFixed(2)}" y="${height - 9}" text-anchor="${index === 0 ? 'start' : 'end'}">${escapeXml(points[index].label)}</text>`).join('\n    ')}
  </g>
  <path d="${areaPath}" fill="url(#totalFill)"/>
  <path d="${path}" fill="none" stroke="${chartColors.brand}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <g fill="${chartColors.ivory}" stroke="${chartColors.brand}" stroke-width="2">
    ${markerPoints.map(point => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3"><title>${escapeXml(`${point.label}：${point.count} 次`)}</title></circle>`).join('\n    ')}
  </g>`}
</svg>`;
};
