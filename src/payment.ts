import { useEffect, useState } from 'react';
import type { Order, Shop } from './types';

// Talks to the serverless functions in /api/odeme (iyzico). On static hosts
// without those functions (e.g. GitHub Pages) online payment stays hidden.

export interface PaymentStatus { aktif: boolean; test: boolean }

let cached: Promise<PaymentStatus> | null = null;
export function fetchPaymentStatus(): Promise<PaymentStatus> {
  cached ??= fetch('api/odeme/durum')
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : { aktif: false, test: false }))
    .catch(() => ({ aktif: false, test: false }));
  return cached;
}

export function usePaymentStatus() {
  const [s, setS] = useState<PaymentStatus | null>(null);
  useEffect(() => {
    fetchPaymentStatus().then(setS);
  }, []);
  return s;
}

/** Creates the iyzico checkout form; resolves to the hosted payment page URL. */
export async function startPayment(order: Order, shop: Shop): Promise<string> {
  const res = await fetch('api/odeme/baslat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shop: { slug: shop.slug, name: shop.name, address: shop.address, district: shop.district, city: shop.city },
      order: {
        id: order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        email: order.email,
        address: order.address,
        fulfillment: order.fulfillment,
        deliveryFee: order.deliveryFee,
        lines: order.lines.map(({ productId, name, price, qty }) => ({ productId, name, price, qty })),
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.odemeSayfasi) throw new Error(data.hata || 'Ödeme başlatılamadı');
  return data.odemeSayfasi as string;
}

export interface VerifyResult {
  odendi: boolean;
  siparisNo?: string;
  odemeNo?: string;
  tutar?: number;
  kart?: string;
  hata?: string;
}

export async function verifyPayment(token: string): Promise<VerifyResult> {
  const res = await fetch(`api/odeme/dogrula?token=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { odendi: false, hata: data.hata || 'Ödeme doğrulanamadı' };
  return data as VerifyResult;
}
