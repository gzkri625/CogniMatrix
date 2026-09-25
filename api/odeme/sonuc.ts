// POST /api/odeme/sonuc?order=… — iyzico's callbackUrl. iyzico posts the form
// token here after the customer finishes (or abandons) payment; we send the
// customer back to the order page, which asks /dogrula to confirm the token.
import { dbConfigured, getOrder } from '../_lib/db';

export async function POST(req: Request) {
  const orderId = new URL(req.url).searchParams.get('order') ?? '';
  let token = '';
  try {
    token = String((await req.formData()).get('token') ?? '');
  } catch {
    /* no body */
  }
  const order = dbConfigured() ? await getOrder(orderId).catch(() => null) : null;
  const target = order
    ? `/#/${order.shop_slug}/siparis/${order.id}?token=${encodeURIComponent(token)}`
    : '/';
  return new Response(null, { status: 303, headers: { Location: target } });
}
