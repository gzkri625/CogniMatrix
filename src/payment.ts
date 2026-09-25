import { useEffect, useState } from 'react';
import { backend } from './backend';

// Talks to the serverless functions in /api/odeme (iyzico). Online payment
// needs the database (prices are read server-side), so it is off in demo mode
// and on static hosts without those functions (e.g. GitHub Pages).

export interface PaymentStatus { aktif: boolean; test: boolean }

const OFF: PaymentStatus = { aktif: false, test: false };
let cached: Promise<PaymentStatus> | null = null;

export function fetchPaymentStatus(): Promise<PaymentStatus> {
  if (backend.mode !== 'supabase') return Promise.resolve(OFF);
  cached ??= fetch('api/odeme/durum')
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : OFF))
    .catch(() => OFF);
  return cached;
}

export function usePaymentStatus() {
  const [s, setS] = useState<PaymentStatus | null>(null);
  useEffect(() => {
    fetchPaymentStatus().then(setS);
  }, []);
  return s;
}

/** Creates the iyzico checkout form for a stored order; resolves to the payment page URL. */
export async function startPayment(orderId: string): Promise<string> {
  const res = await fetch('api/odeme/baslat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.odemeSayfasi) throw new Error(data.hata || 'Ödeme başlatılamadı');
  return data.odemeSayfasi as string;
}

/** Asks the server to confirm a returned iyzico token; the server records the result on the order. */
export async function verifyPayment(token: string): Promise<{ odendi: boolean; hata?: string }> {
  const res = await fetch(`api/odeme/dogrula?token=${encodeURIComponent(token)}`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { odendi: false, hata: data.hata || 'Ödeme doğrulanamadı' };
  return data;
}
