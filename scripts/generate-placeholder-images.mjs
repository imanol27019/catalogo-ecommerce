// Genera imágenes placeholder (SVG, sin dependencia de red) para cada producto de
// src/data/products.json. Uso: node scripts/generate-placeholder-images.mjs
// Reemplazar estos archivos por fotos reales en public/images/products/ cuando estén disponibles
// (el campo `images` de cada producto solo necesita apuntar al archivo correspondiente).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_PATH = path.join(__dirname, '..', 'src', 'data', 'products.json');
const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'products');

const THEMES = {
  remeras: { bg: '#B5573A', accent: '#EAD3C8' },
  buzos: { bg: '#3B4A5A', accent: '#B9C6D1' },
  pantalones: { bg: '#6B6E3F', accent: '#DEDBB4' },
  camperas: { bg: '#5B2A3B', accent: '#E0BBC7' },
};
const FALLBACK_THEME = { bg: '#57534e', accent: '#e7e5e4' };

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

function silhouette(category, accent) {
  switch (category) {
    case 'remeras':
      return `<polygon points="160,150 175,133 140,108 112,148 142,168 142,378 258,378 258,168 288,148 260,108 225,133 240,150 200,163" fill="${accent}" fill-opacity="0.85"/>`;
    case 'buzos':
      return `
        <path d="M170,140 Q200,90 230,140 Z" fill="${accent}" fill-opacity="0.85"/>
        <polygon points="155,160 170,138 130,112 105,155 138,175 138,380 262,380 262,175 295,155 270,112 230,138 245,160 200,172" fill="${accent}" fill-opacity="0.85"/>
        <rect x="170" y="260" width="60" height="40" rx="4" fill="${accent}" fill-opacity="0.4"/>`;
    case 'pantalones':
      return `
        <rect x="148" y="118" width="104" height="30" rx="10" fill="${accent}" fill-opacity="0.85"/>
        <rect x="150" y="145" width="42" height="235" rx="8" fill="${accent}" fill-opacity="0.85"/>
        <rect x="208" y="145" width="42" height="235" rx="8" fill="${accent}" fill-opacity="0.85"/>`;
    case 'camperas':
      return `
        <polygon points="155,160 170,138 130,112 105,155 138,175 138,380 262,380 262,175 295,155 270,112 230,138 245,160 200,172" fill="${accent}" fill-opacity="0.85"/>
        <polyline points="170,138 185,155" stroke="${accent}" stroke-width="3" fill="none"/>
        <polyline points="230,138 215,155" stroke="${accent}" stroke-width="3" fill="none"/>
        <line x1="200" y1="165" x2="200" y2="378" stroke="${accent}" stroke-width="2" stroke-dasharray="4,4" fill="none"/>`;
    default:
      return `<circle cx="200" cy="250" r="90" fill="${accent}" fill-opacity="0.85"/>`;
  }
}

function buildSvg({ name, category }) {
  const theme = THEMES[category] ?? FALLBACK_THEME;
  const label = escapeXml(category.toUpperCase());
  const title = escapeXml(name);

  return `<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
  <rect width="400" height="500" fill="${theme.bg}"/>
  <rect x="20" y="20" width="${label.length * 8 + 24}" height="28" rx="14" fill="#00000033"/>
  <text x="32" y="39" font-family="system-ui, sans-serif" font-size="13" font-weight="600" letter-spacing="1" fill="#ffffff">${label}</text>
  ${silhouette(category, theme.accent)}
  <rect x="0" y="420" width="400" height="80" fill="#00000055"/>
  <text x="200" y="465" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="600" fill="#ffffff">${title}</text>
</svg>`;
}

const catalog = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf-8'));
mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const product of catalog.products) {
  const svg = buildSvg(product);
  const fileName = path.basename(product.images[0]);
  writeFileSync(path.join(OUT_DIR, fileName), svg, 'utf-8');
  count++;
}

console.log(`Generadas ${count} imágenes placeholder en ${OUT_DIR}`);
