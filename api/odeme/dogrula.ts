// GET /api/odeme/dogrula?token=… — asks iyzico (server to server) for the
// real result of a checkout form. The browser never decides "paid" itself.
import { iyzicoPost, isConfigured, json } from '../_lib/iyzico';

export async function GET(req: Request) {
  if (!isConfigured()) return json({ hata: 'Online ödeme yapılandırılmamış' }, 503);
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[A-Za-z0-9-]{10,100}$/.test(token)) return json({ hata: 'Geçersiz token' }, 400);

  const r = await iyzicoPost('/payment/iyzipos/checkoutform/auth/ecom/detail', { locale: 'tr', token });
  if (r.status !== 'success') {
    return json({ odendi: false, hata: r.errorMessage || 'Ödeme doğrulanamadı' });
  }
  return json({
    odendi: r.paymentStatus === 'SUCCESS',
    siparisNo: r.basketId,
    odemeNo: r.paymentId,
    tutar: Number(r.paidPrice),
    taksit: r.installment,
    kart: r.lastFourDigits ? `**** ${r.lastFourDigits}` : undefined,
    hata: r.paymentStatus === 'SUCCESS' ? undefined : (r.errorMessage as string) || 'Ödeme tamamlanmadı',
  });
}
