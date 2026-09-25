import type { Unit } from './types';

const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

export const money = (n: number) => tl.format(n);

export const qtyStep = (unit: Unit) => (unit === 'kg' || unit === 'litre' ? 0.5 : 1);

export const qtyLabel = (qty: number, unit: Unit) =>
  `${qty.toLocaleString('tr-TR')} ${unit}`;

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const slugify = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const round2 = (n: number) => Math.round(n * 100) / 100;
