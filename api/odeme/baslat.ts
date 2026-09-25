// POST /api/odeme/baslat {orderId} — starts an iyzico Checkout Form for a
// stored order and returns the hosted payment page URL. Amounts come from the
// order row, which place_order() priced from the products table.
import { dbConfigured, getOrder } from '../_lib/db';
import { fmtPrice, iyzicoPost, isConfigured, json } from '../_lib/iyzico';

export async function POST(req: Request) {
  if (!isConfigured() || !dbConfigured()) return json({ hata: 'Online ödeme yapılandırılmamış' }, 503);

  let orderId = '';
  try {
    orderId = String(((await req.json()) as { orderId?: unknown }).orderId ?? '');
  } catch {
    return json({ hata: 'Geçersiz istek' }, 400);
  }
  const order = await getOrder(orderId);
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

  const origin = process.env.PUBLIC_URL?.replace(/\/$/, '') || new URL(req.url).origin;
  const nameParts = order.customer_name.trim().split(/\s+/);
  const surname = nameParts.length > 1 ? nameParts.pop()! : nameParts[0];
  const address = order.fulfillment === 'teslimat' ? order.address : `${shop.address}, ${shop.district} (gel-al)`;
  const digits = order.customer_phone.replace(/\D/g, '').replace(/^0/, '90');
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '85.34.78.112';
  const addr = { contactName: order.customer_name, city: shop.city || 'İstanbul', country: 'Turkey', address };

  const result = await iyzicoPost('/payment/iyzipos/checkoutform/initialize/auth/ecom', {
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
