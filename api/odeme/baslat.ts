// POST /api/odeme/baslat — starts an iyzico Checkout Form for an order and
// returns the hosted payment page URL to redirect the customer to.
import { fmtPrice, iyzicoPost, isConfigured, json } from '../_lib/iyzico';

interface Line { productId: string; name: string; price: number; qty: number }
interface StartRequest {
  shop: { slug: string; name: string; address: string; district: string; city?: string };
  order: {
    id: string;
    customerName: string;
    customerPhone: string;
    email: string;
    address: string;
    fulfillment: 'teslimat' | 'gel-al';
    deliveryFee: number;
    lines: Line[];
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const str = (s: unknown, max = 200) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

function validate(body: StartRequest): string | null {
  const { shop, order } = body ?? {};
  if (!shop?.slug || !order?.id) return 'Eksik sipariş bilgisi';
  if (!/^[a-z0-9-]{1,60}$/.test(shop.slug) || !/^[A-Z0-9]{1,20}$/.test(order.id)) return 'Geçersiz sipariş numarası';
  if (!str(order.customerName) || !str(order.customerPhone)) return 'Ad ve telefon gerekli';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(order.email))) return 'Geçerli bir e-posta gerekli';
  if (!Array.isArray(order.lines) || order.lines.length === 0 || order.lines.length > 100) return 'Sepet boş';
  for (const l of order.lines) {
    if (!str(l.name) || !isNum(l.price) || !isNum(l.qty) || l.price <= 0 || l.qty <= 0 || l.qty > 1000) {
      return 'Geçersiz ürün satırı';
    }
  }
  if (!isNum(order.deliveryFee) || order.deliveryFee < 0) return 'Geçersiz teslimat ücreti';
  return null;
}

export async function POST(req: Request) {
  if (!isConfigured()) return json({ hata: 'Online ödeme yapılandırılmamış' }, 503);

  let body: StartRequest;
  try {
    body = (await req.json()) as StartRequest;
  } catch {
    return json({ hata: 'Geçersiz istek' }, 400);
  }
  const err = validate(body);
  if (err) return json({ hata: err }, 400);

  const { shop, order } = body;
  // NOTE: prices come from the browser because the catalog lives in
  // localStorage in this MVP. Once shops/products move to a database, look
  // prices up server-side here instead of trusting the request.
  const basketItems = order.lines.map((l, i) => ({
    id: str(l.productId, 50) || `urun-${i + 1}`,
    name: str(l.name, 100),
    category1: shop.name.slice(0, 50),
    itemType: 'PHYSICAL',
    price: fmtPrice(r2(l.price * l.qty)),
  }));
  if (order.deliveryFee > 0) {
    basketItems.push({ id: 'teslimat', name: 'Teslimat ücreti', category1: 'Teslimat', itemType: 'VIRTUAL', price: fmtPrice(order.deliveryFee) });
  }
  const total = r2(basketItems.reduce((s, b) => s + Number(b.price), 0));

  const origin = process.env.PUBLIC_URL?.replace(/\/$/, '') || new URL(req.url).origin;
  const city = str(shop.city, 50) || 'İstanbul';
  const nameParts = str(order.customerName, 100).split(/\s+/);
  const surname = nameParts.length > 1 ? nameParts.pop()! : nameParts[0];
  const address = order.fulfillment === 'teslimat' ? str(order.address, 500) : `${shop.address}, ${shop.district} (gel-al)`;
  const digits = str(order.customerPhone, 30).replace(/\D/g, '').replace(/^0/, '90');
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '85.34.78.112';
  const addr = { contactName: str(order.customerName, 100), city, country: 'Turkey', address };

  const result = await iyzicoPost('/payment/iyzipos/checkoutform/initialize/auth/ecom', {
    locale: 'tr',
    conversationId: `${shop.slug}:${order.id}`,
    price: fmtPrice(total),
    paidPrice: fmtPrice(total),
    currency: 'TRY',
    basketId: order.id,
    paymentGroup: 'PRODUCT',
    callbackUrl: `${origin}/api/odeme/sonuc?shop=${encodeURIComponent(shop.slug)}&order=${encodeURIComponent(order.id)}`,
    enabledInstallments: [1, 2, 3, 6],
    buyer: {
      id: digits || order.id,
      name: nameParts.join(' '),
      surname,
      gsmNumber: digits ? `+${digits}` : undefined,
      email: str(order.email, 100),
      // iyzico requires an identity number; TCKN is not collected, so use the
      // placeholder iyzico accepts for this case.
      identityNumber: '11111111111',
      registrationAddress: address,
      city,
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
