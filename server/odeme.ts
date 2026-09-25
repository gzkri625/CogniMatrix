// Payment endpoints, platform-neutral. Wired up in api/odeme/* (Vercel) and
// functions/api/odeme/* (Cloudflare Pages).
import { dbConfigured, getOrder, updateOrder } from './db';
import type { Env } from './env';
import { fmtPrice, iyzicoPost, isConfigured, isSandbox, json } from './iyzico';

// GET /api/odeme/durum — lets the storefront know whether online card
// payment is available (iyzico + database configured) and whether it is in test mode.
export function durum(env: Env) {
  return json({ aktif: isConfigured(env) && dbConfigured(env), test: isSandbox(env) });
}

// POST /api/odeme/baslat {orderId} — starts an iyzico Checkout Form for a
// stored order and returns the hosted payment page URL. Amounts come from the
// order row, which place_order() priced from the products table.

export async function baslat(req: Request, env: Env) {
  if (!isConfigured(env) || !dbConfigured(env)) return json({ hata: 'Online ödeme yapılandırılmamış' }, 503);

  let orderId = '';
  try {
    orderId = String(((await req.json()) as { orderId?: unknown }).orderId ?? '');
  } catch {
    return json({ hata: 'Geçersiz istek' }, 400);
  }
  const order = await getOrder(env, orderId);
  if (!order) return json({ hata: 'Sipariş bulunamadı' }, 404);
  if (order.payment !== 'online kart') return json({ hata: 'Bu sipariş kapıda ödemeli' }, 409);
  if (order.online_state === 'ödendi') return json({ hata: 'Bu sipariş zaten ödendi' }, 409);

  const shop = order.shops;
  const basketItems = order.lines.map((l, i) => ({
    id: String(l.productId || `urun-${i + 1}`).slice(0, 50),
    name: l.name.slice(0, 100),
    category1: shop.name.slice(0, 50),
    itemType: 'PHYSICAL',
    price: fmtPrice(Math.round(l.price * l.qty * 100) / 100),
  }));
  if (Number(order.delivery_fee) > 0) {
    basketItems.push({ id: 'teslimat', name: 'Teslimat ücreti', category1: 'Teslimat', itemType: 'VIRTUAL', price: fmtPrice(Number(order.delivery_fee)) });
  }
  const total = Number(order.total);

  const origin = env.PUBLIC_URL?.replace(/\/$/, '') || new URL(req.url).origin;
  const nameParts = order.customer_name.trim().split(/\s+/);
  const surname = nameParts.length > 1 ? nameParts.pop()! : nameParts[0];
  const address = order.fulfillment === 'teslimat' ? order.address : `${shop.address}, ${shop.district} (gel-al)`;
  const digits = order.customer_phone.replace(/\D/g, '').replace(/^0/, '90');
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '85.34.78.112';
  const addr = { contactName: order.customer_name, city: shop.city || 'İstanbul', country: 'Turkey', address };

  const result = await iyzicoPost(env, '/payment/iyzipos/checkoutform/initialize/auth/ecom', {
    locale: 'tr',
    conversationId: order.code,
    price: fmtPrice(total),
    paidPrice: fmtPrice(total),
    currency: 'TRY',
    basketId: order.id,
    paymentGroup: 'PRODUCT',
    callbackUrl: `${origin}/api/odeme/sonuc?order=${order.id}`,
    enabledInstallments: [1, 2, 3, 6],
    buyer: {
      id: digits || order.id,
      name: nameParts.join(' '),
      surname,
      gsmNumber: digits ? `+${digits}` : undefined,
      email: order.email ?? '',
      // iyzico requires an identity number; TCKN is not collected, so use the
      // placeholder iyzico accepts for this case.
      identityNumber: '11111111111',
      registrationAddress: address,
      city: addr.city,
      country: 'Turkey',
      ip,
    },
    shippingAddress: addr,
    billingAddress: addr,
    basketItems,
  });

  if (result.status !== 'success') {
    return json({ hata: result.errorMessage || 'Ödeme başlatılamadı', kod: result.errorCode }, 502);
  }
  return json({ token: result.token, odemeSayfasi: result.paymentPageUrl, tutar: total });
}

// POST /api/odeme/sonuc?order=… — iyzico's callbackUrl. iyzico posts the form
// token here after the customer finishes (or abandons) payment; we send the
// customer back to the order page, which asks /dogrula to confirm the token.

export async function sonuc(req: Request, env: Env) {
  const orderId = new URL(req.url).searchParams.get('order') ?? '';
  let token = '';
  try {
    token = String((await req.formData()).get('token') ?? '');
  } catch {
    /* no body */
  }
  const order = dbConfigured(env) ? await getOrder(env, orderId).catch(() => null) : null;
  const target = order
    ? `/#/${order.shop_slug}/siparis/${order.id}?token=${encodeURIComponent(token)}`
    : '/';
  return new Response(null, { status: 303, headers: { Location: target } });
}

// POST /api/odeme/dogrula?token=… — asks iyzico (server to server) for the real
// result of a checkout form and records it on the order. The browser never
// decides "paid" itself, and a confirmed payment is never downgraded.

export async function dogrula(req: Request, env: Env) {
  if (!isConfigured(env) || !dbConfigured(env)) return json({ hata: 'Online ödeme yapılandırılmamış' }, 503);
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[A-Za-z0-9-]{10,100}$/.test(token)) return json({ hata: 'Geçersiz token' }, 400);

  const r = await iyzicoPost(env, '/payment/iyzipos/checkoutform/auth/ecom/detail', { locale: 'tr', token });
  if (r.status !== 'success' || typeof r.basketId !== 'string') {
    return json({ odendi: false, hata: r.errorMessage || 'Ödeme doğrulanamadı' });
  }
  // basketId is our order id; iyzico signed off on it, so it identifies the order.
  const order = await getOrder(env, r.basketId);
  if (!order) return json({ odendi: false, hata: 'Sipariş bulunamadı' }, 404);
  if (order.online_state === 'ödendi') return json({ odendi: true });

  const paid = r.paymentStatus === 'SUCCESS';
  const amountOk = paid && Math.abs(Number(r.paidPrice) - Number(order.total)) < 0.01;
  const notPaidYet = '&online_state=neq.ödendi';
  if (paid && amountOk) {
    await updateOrder(env, order.id, {
      online_state: 'ödendi',
      payment_id: String(r.paymentId ?? ''),
      paid_amount: Number(r.paidPrice),
      card: r.lastFourDigits ? `**** ${r.lastFourDigits}` : null,
      payment_error: null,
    }, notPaidYet);
    return json({ odendi: true });
  }
  const error = paid ? `Ödenen tutar (${r.paidPrice}) sipariş tutarıyla eşleşmiyor` : String(r.errorMessage || 'Ödeme tamamlanmadı');
  await updateOrder(env, order.id, { online_state: 'başarısız', payment_error: error }, notPaidYet);
  return json({ odendi: false, hata: error });
}
