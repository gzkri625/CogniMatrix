// POST /api/odeme/sonuc — iyzico's callbackUrl. iyzico posts the form token
// here after the customer finishes (or abandons) payment; we send the
// customer back to the order page, which verifies the token via /dogrula.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const shop = url.searchParams.get('shop') ?? '';
  const order = url.searchParams.get('order') ?? '';
  let token = '';
  try {
    token = String((await req.formData()).get('token') ?? '');
  } catch {
    /* no body */
  }
  const safe = (s: string) => encodeURIComponent(s.replace(/[^A-Za-z0-9-]/g, ''));
  const target = `/#/${safe(shop)}/siparis/${safe(order)}?token=${encodeURIComponent(token)}`;
  return new Response(null, { status: 303, headers: { Location: target } });
}
