import { money, qtyLabel } from './format';
import type { Order, Shop } from './types';

export function orderMessage(order: Order, shop: Shop) {
  const lines = order.lines.map((l) => `• ${l.name} — ${qtyLabel(l.qty, l.unit)} = ${money(l.price * l.qty)}`);
  return [
    `Merhaba ${shop.name}, yeni sipariş 🛒`,
    `Sipariş no: #${order.id}`,
    '',
    ...lines,
    '',
    `Ara toplam: ${money(order.subtotal)}`,
    `Teslimat: ${order.deliveryFee === 0 ? 'Ücretsiz' : money(order.deliveryFee)}`,
    `TOPLAM: ${money(order.total)}`,
    '',
    `Ad: ${order.customerName}`,
    `Tel: ${order.customerPhone}`,
    order.fulfillment === 'teslimat' ? `Adres: ${order.address}` : 'Mağazadan gelip alacağım',
    `Ödeme: ${order.payment}`,
    order.note ? `Not: ${order.note}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

export const whatsappLink = (phone: string, text: string) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
