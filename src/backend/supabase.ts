import { createClient, type PostgrestError, type User as SbUser } from '@supabase/supabase-js';
import type { Order, OrderLine, Product, Shop, ShopCategory, Unit, User } from '../types';
import type { Backend, ShopPatch } from './types';

type Row = Record<string, unknown>;

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb = createClient(url, anonKey);

  const check = <T>({ data, error }: { data: T; error: PostgrestError | null }): T => {
    if (error) throw new Error(friendly(error));
    return data;
  };

  const toUser = (u: SbUser | null | undefined): User | null => (u ? { id: u.id, email: u.email ?? '' } : null);

  return {
    mode: 'supabase',

    async listShops() {
      const rows = check(await sb.from('shops').select('*, products(*)').order('created_at'));
      return (rows as Row[]).map(shopFromRow);
    },
    async createShop(shop, products) {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) throw new Error('Önce giriş yapın');
      check(await sb.from('shops').insert({ ...shopToRow(shop), slug: shop.slug, owner_id: auth.user.id }));
      if (products.length) {
        check(await sb.from('products').insert(products.map((p) => ({ ...productToRow(p), shop_slug: shop.slug }))));
      }
      const row = check(await sb.from('shops').select('*, products(*)').eq('slug', shop.slug).single());
      return shopFromRow(row as Row);
    },
    async updateShop(slug, patch) {
      const rows = check(await sb.from('shops').update(shopToRow(patch)).eq('slug', slug).select('slug'));
      if (!rows?.length) throw new Error('Bu dükkanı yönetme yetkiniz yok');
    },
    async saveProduct(slug, product) {
      const row = productToRow(product);
      const res = product.id
        ? await sb.from('products').update(row).eq('id', product.id).eq('shop_slug', slug).select().single()
        : await sb.from('products').insert({ ...row, shop_slug: slug }).select().single();
      return productFromRow(check(res) as Row);
    },
    async deleteProduct(slug, productId) {
      check(await sb.from('products').delete().eq('id', productId).eq('shop_slug', slug));
    },

    async placeOrder(input) {
      const row = check(
        await sb.rpc('place_order', {
          p_shop: input.shopSlug,
          p_customer: {
            name: input.customerName,
            phone: input.customerPhone,
            email: input.email,
            address: input.address,
            note: input.note,
            fulfillment: input.fulfillment,
            payment: input.payment,
          },
          p_items: input.items.map((i) => ({ product_id: i.productId, qty: i.qty })),
        }),
      );
      return orderFromRow(row as Row);
    },
    async getOrder(id) {
      const row = check(await sb.rpc('get_order', { p_id: id })) as Row | null;
      return row && row.id ? orderFromRow(row) : null;
    },
    async switchToCash(id) {
      check(await sb.rpc('switch_to_cash', { p_id: id }));
    },
    async listOrders(slug) {
      const rows = check(
        await sb.from('orders').select('*').eq('shop_slug', slug).order('created_at', { ascending: false }).limit(200),
      );
      return (rows as Row[]).map(orderFromRow);
    },
    async setOrderStatus(id, status) {
      const rows = check(await sb.from('orders').update({ status }).eq('id', id).select('id'));
      if (!rows?.length) throw new Error('Sipariş güncellenemedi');
    },
    subscribeOrders(slug, onChange) {
      let channel: ReturnType<typeof sb.channel> | null = null;
      let closed = false;
      (async () => {
        // Make sure realtime carries the owner's JWT before joining; otherwise
        // RLS hides the shop's orders from this channel.
        const { data } = await sb.auth.getSession();
        await sb.realtime.setAuth(data.session?.access_token ?? null);
        if (closed) return;
        channel = sb
          .channel(`orders:${slug}:${Math.random().toString(36).slice(2)}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_slug=eq.${slug}` }, onChange)
          // catch anything that arrived while connecting
          .subscribe((status) => status === 'SUBSCRIBED' && onChange());
      })();
      return () => {
        closed = true;
        if (channel) sb.removeChannel(channel);
      };
    },

    async currentUser() {
      const { data } = await sb.auth.getSession();
      return toUser(data.session?.user);
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(toUser(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-posta veya şifre hatalı' : error.message);
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.href.split('#')[0] + '#/giris' },
      });
      if (error) throw new Error(error.message.includes('already registered') ? 'Bu e-posta zaten kayıtlı' : error.message);
      return { needsConfirmation: !data.session };
    },
    async signOut() {
      await sb.auth.signOut();
    },
  };
}

function friendly(e: PostgrestError) {
  if (e.code === '23505') return 'Bu dükkan adresi alınmış';
  if (e.code === '42501') return 'Bu işlem için yetkiniz yok';
  if (e.code === '23514') return 'Girilen bilgilerden biri geçersiz';
  return e.message;
}

const num = (v: unknown) => Number(v ?? 0);

function productFromRow(r: Row): Product {
  return {
    id: String(r.id),
    name: String(r.name),
    description: String(r.description ?? ''),
    price: num(r.price),
    unit: r.unit as Unit,
    category: String(r.category ?? ''),
    emoji: String(r.emoji ?? '📦'),
    inStock: Boolean(r.in_stock),
  };
}

const productToRow = (p: Omit<Product, 'id'>) => ({
  name: p.name,
  description: p.description,
  price: p.price,
  unit: p.unit,
  category: p.category,
  emoji: p.emoji,
  in_stock: p.inStock,
});

function shopFromRow(r: Row): Shop {
  const products = ((r.products as Row[]) ?? [])
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map(productFromRow);
  return {
    slug: String(r.slug),
    ownerId: String(r.owner_id),
    name: String(r.name),
    category: r.category as ShopCategory,
    tagline: String(r.tagline ?? ''),
    emoji: String(r.emoji),
    color: String(r.color),
    owner: String(r.owner_name ?? ''),
    phone: String(r.phone),
    address: String(r.address ?? ''),
    district: String(r.district ?? ''),
    city: String(r.city ?? 'İstanbul'),
    hours: String(r.hours ?? ''),
    deliveryFee: num(r.delivery_fee),
    freeDeliveryOver: num(r.free_delivery_over),
    minOrder: num(r.min_order),
    products,
  };
}

function shopToRow(s: ShopPatch) {
  const map: Record<string, string> = {
    name: 'name', category: 'category', tagline: 'tagline', emoji: 'emoji', color: 'color', owner: 'owner_name',
    phone: 'phone', address: 'address', district: 'district', city: 'city', hours: 'hours',
    deliveryFee: 'delivery_fee', freeDeliveryOver: 'free_delivery_over', minOrder: 'min_order',
  };
  const out: Row = {};
  for (const [k, v] of Object.entries(s)) if (map[k] && v !== undefined) out[map[k]] = v;
  return out;
}

function orderFromRow(r: Row): Order {
  return {
    id: String(r.id),
    code: String(r.code),
    shopSlug: String(r.shop_slug),
    createdAt: String(r.created_at),
    customerName: String(r.customer_name),
    customerPhone: String(r.customer_phone),
    email: r.email ? String(r.email) : undefined,
    address: String(r.address ?? ''),
    note: String(r.note ?? ''),
    fulfillment: r.fulfillment as Order['fulfillment'],
    payment: r.payment as Order['payment'],
    lines: ((r.lines as Row[]) ?? []).map(
      (l): OrderLine => ({ productId: String(l.productId), name: String(l.name), unit: l.unit as Unit, price: num(l.price), qty: num(l.qty) }),
    ),
    subtotal: num(r.subtotal),
    deliveryFee: num(r.delivery_fee),
    total: num(r.total),
    status: r.status as Order['status'],
    online: r.online_state
      ? {
          state: r.online_state as NonNullable<Order['online']>['state'],
          paymentId: r.payment_id ? String(r.payment_id) : undefined,
          paidAmount: r.paid_amount == null ? undefined : num(r.paid_amount),
          card: r.card ? String(r.card) : undefined,
          error: r.payment_error ? String(r.payment_error) : undefined,
        }
      : undefined,
  };
}
