import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_USER_ID, seedShops } from '../data/seed';
import { uid } from '../format';
import type { Order, Shop, User } from '../types';
import { orderCode, priceOrder } from './pricing';
import type { Backend } from './types';

// Single-browser demo backend on localStorage. Used when Supabase is not
// configured (e.g. the GitHub Pages preview).
const KEY = 'esnaf-carsi:demo:v2';

interface DemoUser extends User { password: string }
interface DB {
  shops: Shop[];
  orders: Order[];
  users: DemoUser[];
  session: string | null;
}

const fresh = (): DB => ({
  shops: seedShops,
  orders: [],
  users: [{ id: DEMO_USER_ID, email: DEMO_EMAIL, password: DEMO_PASSWORD }],
  session: null,
});

function read(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch {
    /* unavailable or corrupt */
  }
  return fresh();
}

let db = read();
const authListeners = new Set<(u: User | null) => void>();
const orderListeners = new Set<() => void>();

function write(next: DB) {
  db = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* quota / private mode */
  }
}

// other tabs (e.g. panel open next to the storefront)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    db = read();
    orderListeners.forEach((f) => f());
    authListeners.forEach((f) => f(me()));
  });
}

const me = (): User | null => {
  const u = db.users.find((x) => x.id === db.session);
  return u ? { id: u.id, email: u.email } : null;
};
const requireOwner = (slug: string) => {
  const shop = db.shops.find((s) => s.slug === slug);
  if (!shop || shop.ownerId !== db.session) throw new Error('Bu dükkanı yönetme yetkiniz yok');
  return shop;
};
const mapShop = (slug: string, fn: (s: Shop) => Shop) =>
  write({ ...db, shops: db.shops.map((s) => (s.slug === slug ? fn(s) : s)) });
const mapOrder = (id: string, fn: (o: Order) => Order) => {
  write({ ...db, orders: db.orders.map((o) => (o.id === id ? fn(o) : o)) });
  orderListeners.forEach((f) => f());
};
const setSession = (id: string | null) => {
  write({ ...db, session: id });
  authListeners.forEach((f) => f(me()));
};

export const demoBackend: Backend = {
  mode: 'demo',

  async listShops() {
    return db.shops;
  },
  async createShop(shop, products) {
    const user = me();
    if (!user) throw new Error('Önce giriş yapın');
    if (db.shops.some((s) => s.slug === shop.slug)) throw new Error('Bu dükkan adresi alınmış');
    const created: Shop = { ...shop, ownerId: user.id, products: products.map((p) => ({ ...p, id: uid() })) };
    write({ ...db, shops: [...db.shops, created] });
    return created;
  },
  async updateShop(slug, patch) {
    requireOwner(slug);
    mapShop(slug, (s) => ({ ...s, ...patch }));
  },
  async saveProduct(slug, product) {
    requireOwner(slug);
    const saved = product.id ? product : { ...product, id: uid() };
    mapShop(slug, (s) => ({
      ...s,
      products: s.products.some((p) => p.id === saved.id)
        ? s.products.map((p) => (p.id === saved.id ? saved : p))
        : [...s.products, saved],
    }));
    return saved;
  },
  async deleteProduct(slug, productId) {
    requireOwner(slug);
    mapShop(slug, (s) => ({ ...s, products: s.products.filter((p) => p.id !== productId) }));
  },

  async placeOrder(input) {
    const shop = db.shops.find((s) => s.slug === input.shopSlug);
    if (!shop) throw new Error('Dükkan bulunamadı');
    const priced = priceOrder(shop, input);
    const order: Order = {
      id: crypto.randomUUID(),
      code: orderCode(),
      shopSlug: shop.slug,
      createdAt: new Date().toISOString(),
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      email: input.email.trim() || undefined,
      address: input.fulfillment === 'teslimat' ? input.address.trim() : '',
      note: input.note.trim(),
      fulfillment: input.fulfillment,
      payment: input.payment,
      ...priced,
      status: 'yeni',
      ...(input.payment === 'online kart' && { online: { state: 'bekliyor' as const } }),
    };
    write({ ...db, orders: [order, ...db.orders] });
    orderListeners.forEach((f) => f());
    return order;
  },
  async getOrder(id) {
    return db.orders.find((o) => o.id === id) ?? null;
  },
  async switchToCash(id) {
    mapOrder(id, (o) =>
      o.payment === 'online kart' && o.online?.state !== 'ödendi' ? { ...o, payment: 'kapıda nakit', online: undefined } : o,
    );
  },
  async listOrders(slug) {
    requireOwner(slug);
    return db.orders.filter((o) => o.shopSlug === slug);
  },
  async setOrderStatus(id, status) {
    const order = db.orders.find((o) => o.id === id);
    if (order) requireOwner(order.shopSlug);
    mapOrder(id, (o) => ({ ...o, status }));
  },
  subscribeOrders(_slug, onChange) {
    orderListeners.add(onChange);
    return () => orderListeners.delete(onChange);
  },

  async currentUser() {
    return me();
  },
  onAuthChange(cb) {
    authListeners.add(cb);
    return () => authListeners.delete(cb);
  },
  async signIn(email, password) {
    const u = db.users.find((x) => x.email === email.trim().toLowerCase() && x.password === password);
    if (!u) throw new Error('E-posta veya şifre hatalı');
    setSession(u.id);
  },
  async signUp(email, password) {
    const e = email.trim().toLowerCase();
    if (db.users.some((x) => x.email === e)) throw new Error('Bu e-posta zaten kayıtlı');
    if (password.length < 6) throw new Error('Şifre en az 6 karakter olmalı');
    const id = uid();
    write({ ...db, users: [...db.users, { id, email: e, password }] });
    setSession(id);
    return { needsConfirmation: false };
  },
  async signOut() {
    setSession(null);
  },

  resetDemo() {
    write(fresh());
    authListeners.forEach((f) => f(null));
    orderListeners.forEach((f) => f());
  },
};
