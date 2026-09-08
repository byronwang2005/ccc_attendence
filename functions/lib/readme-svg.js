import { readmeLogoAtlas, readmeTitle } from './readme-foreground.js';
import { renderEmbeddedFonts, renderQrCumulativeStatsSvg, renderQrStatsSvg } from './qr-stats.js';

// Pantone TCX digital references: Winter White 11-0507 / Snow White 11-0602.
// Keep the original 1200x220 hero and two 600x168 charts, with an 8px baseline gap.
const WIDTH = 1200;
const HEIGHT = 396;
const oscillate = (attribute, low, high, phase) => `<animate attributeName="${attribute}" values="${low};${high};${low}" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.37 0 0.63 1;0.37 0 0.63 1" begin="${phase}s" dur="8s" repeatCount="indefinite"/>`;

export const renderReadmeBackground = () => `<defs>
  <radialGradient id="readme-yellow">
    <stop offset="0" stop-color="#F5ECD2"/>
    <stop offset="0.6" stop-color="#F5ECD2" stop-opacity="0.85"/>
    <stop offset="1" stop-color="#F5ECD2" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="readme-white">
    <stop offset="0" stop-color="#F2F0EB"/>
    <stop offset="0.4" stop-color="#F2F0EB" stop-opacity="0.9"/>
    <stop offset="1" stop-color="#F2F0EB" stop-opacity="0"/>
  </radialGradient>
</defs>
<g id="readme-background">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#F2F0EB"/>
  <g opacity="0.35">
  ${[
    { x: 430, y: 110, rx: 280, ry: 190, color: 'yellow', phase: 0 },
    { x: 770, y: 286, rx: 280, ry: 190, color: 'yellow', phase: -2 },
    { x: 600, y: 180, rx: 210, ry: 170, color: 'white', phase: -5 }
  ].map(({ x, y, rx, ry, color, phase }) => `<ellipse cx="${x - 440}" cy="${y - 72}" rx="${rx * 0.85}" ry="${ry * 0.85}" fill="url(#readme-${color})">
    ${oscillate('cx', x - 440, x + 440, phase)}
    ${oscillate('cy', y - 72, y + 72, phase - 2)}
    ${oscillate('rx', rx * 0.85, rx * 1.15, phase - 1)}
    ${oscillate('ry', ry * 0.85, ry * 1.15, phase - 1)}
  </ellipse>`).join('\n')}
  </g>
</g>`;

export const renderReadmeSvg = ({ hourly, cumulative }) => {
  const logoFrames = Array.from({ length: 90 }, (_, index) => -116 * index);
  const logoOpacity = Array.from({ length: 90 }, (_, index) => 0.94 + 0.06 * Math.sin(index / 90 * Math.PI * 2 - Math.PI / 2));
  const logoTimes = Array.from({ length: 91 }, (_, index) => index / 90).join(';');
  const chartOptions = { background: false, embeddedFonts: false, fragment: true, y: 228 };
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="readme-title readme-desc">
  <title id="readme-title">CCC Attendance — 一个签到码，三步搞定</title>
  <desc id="readme-desc">二维码生成趋势与历史累计生成总量。背景为循环黄白柔光。</desc>
  <defs>${renderEmbeddedFonts()}</defs>
  ${renderReadmeBackground()}
  <image x="0" y="0" width="1200" height="220" href="${readmeTitle}"/>
  <svg x="272" y="61" width="116" height="99" viewBox="0 0 116 99" overflow="hidden" aria-hidden="true">
    <image x="0" y="0" width="10440" height="99" opacity="0.88" href="${readmeLogoAtlas}">
      <animate attributeName="x" values="${[...logoFrames, 0].join(';')}" keyTimes="${logoTimes}" calcMode="discrete" dur="4.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="${[...logoOpacity, logoOpacity[0]].join(';')}" keyTimes="${logoTimes}" calcMode="discrete" dur="4.5s" repeatCount="indefinite"/>
    </image>
  </svg>
  ${renderQrStatsSvg(hourly, chartOptions)}
  ${renderQrCumulativeStatsSvg(cumulative, { ...chartOptions, x: 600 })}
</svg>`;
};
