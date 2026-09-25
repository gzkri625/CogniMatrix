// Server-side Supabase access with the service role key (bypasses RLS).
// Only used by the payment functions; never expose this key to the browser.

const url = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const dbConfigured = () => Boolean(url() && key());

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${url()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key(),
      Authorization: `Bearer ${key()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

export interface OrderRow {
  id: string;
  code: string;
  shop_slug: string;
  customer_name: string;
  customer_phone: string;
  email: string | null;
  address: string;
  fulfillment: 'teslimat' | 'gel-al';
  payment: string;
  lines: { productId: string; name: string; price: number; qty: number }[];
  delivery_fee: number;
  total: number;
  online_state: 'bekliyor' | 'ödendi' | 'başarısız' | null;
  shops: { slug: string; name: string; address: string; district: string; city: string };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrder(id: string): Promise<OrderRow | null> {
  if (!UUID.test(id)) return null;
  const rows = (await rest(`orders?id=eq.${id}&select=*,shops(slug,name,address,district,city)`)) as OrderRow[];
  return rows[0] ?? null;
}

export async function updateOrder(id: string, patch: Record<string, unknown>, onlyIf = '') {
  return (await rest(`orders?id=eq.${id}${onlyIf}`, { method: 'PATCH', body: JSON.stringify(patch) })) as OrderRow[];
}
