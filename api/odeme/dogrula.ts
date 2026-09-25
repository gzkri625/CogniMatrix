// POST /api/odeme/dogrula?token=… — asks iyzico (server to server) for the real
// result of a checkout form and records it on the order. The browser never
// decides "paid" itself, and a confirmed payment is never downgraded.
import { dbConfigured, getOrder, updateOrder } from '../_lib/db';
import { iyzicoPost, isConfigured, json } from '../_lib/iyzico';

export async function POST(req: Request) {
  if (!isConfigured() || !dbConfigured()) return json({ hata: 'Online ödeme yapılandırılmamış' }, 503);
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[A-Za-z0-9-]{10,100}$/.test(token)) return json({ hata: 'Geçersiz token' }, 400);

  const r = await iyzicoPost('/payment/iyzipos/checkoutform/auth/ecom/detail', { locale: 'tr', token });
  if (r.status !== 'success' || typeof r.basketId !== 'string') {
    return json({ odendi: false, hata: r.errorMessage || 'Ödeme doğrulanamadı' });
  }
  // basketId is our order id; iyzico signed off on it, so it identifies the order.
  const order = await getOrder(r.basketId);
  if (!order) return json({ odendi: false, hata: 'Sipariş bulunamadı' }, 404);
  if (order.online_state === 'ödendi') return json({ odendi: true });

  const paid = r.paymentStatus === 'SUCCESS';
  const amountOk = paid && Math.abs(Number(r.paidPrice) - Number(order.total)) < 0.01;
  const notPaidYet = '&online_state=neq.ödendi';
  if (paid && amountOk) {
    await updateOrder(order.id, {
      online_state: 'ödendi',
      payment_id: String(r.paymentId ?? ''),
      paid_amount: Number(r.paidPrice),
      card: r.lastFourDigits ? `**** ${r.lastFourDigits}` : null,
      payment_error: null,
    }, notPaidYet);
    return json({ odendi: true });
  }
  const error = paid ? `Ödenen tutar (${r.paidPrice}) sipariş tutarıyla eşleşmiyor` : String(r.errorMessage || 'Ödeme tamamlanmadı');
  await updateOrder(order.id, { online_state: 'başarısız', payment_error: error }, notPaidYet);
  return json({ odendi: false, hata: error });
}
