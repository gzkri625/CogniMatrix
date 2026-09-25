import { qtyStep, round2 } from '../format';
import type { OrderInput, OrderLine, Shop } from '../types';

/** Mirrors public.place_order() in the Supabase migration (used by demo mode). */
export function priceOrder(shop: Shop, input: OrderInput) {
  const fail = (msg: string): never => {
    throw new Error(msg);
  };
  if (!input.customerName.trim()) fail('Ad soyad gerekli');
  if (!/^[0-9]{10,15}$/.test(input.customerPhone.replace(/\D/g, ''))) fail('Geçerli bir telefon gerekli');
  if (input.fulfillment === 'teslimat' && !input.address.trim()) fail('Adres gerekli');
  if (input.payment === 'online kart' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    fail('Geçerli bir e-posta gerekli');
  }
  if (input.items.length === 0) fail('Sepet boş');

  const lines: OrderLine[] = input.items.map(({ productId, qty }) => {
    const p = shop.products.find((x) => x.id === productId) ?? fail('Ürün bulunamadı');
    if (!p.inStock) fail(`${p.name} tükendi`);
    if (qty <= 0 || qty > 1000 || Math.abs(qty / qtyStep(p.unit) - Math.round(qty / qtyStep(p.unit))) > 1e-9) {
      fail(`Geçersiz miktar: ${p.name}`);
    }
    return { productId: p.id, name: p.name, unit: p.unit, price: p.price, qty };
  });
  const subtotal = round2(lines.reduce((s, l) => s + round2(l.price * l.qty), 0));
  if (subtotal < shop.minOrder) fail(`Minimum sipariş tutarı ${shop.minOrder} TL`);
  const deliveryFee =
    input.fulfillment === 'gel-al' || (shop.freeDeliveryOver > 0 && subtotal >= shop.freeDeliveryOver)
      ? 0
      : shop.deliveryFee;
  return { lines, subtotal, deliveryFee, total: round2(subtotal + deliveryFee) };
}

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const orderCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join('');
