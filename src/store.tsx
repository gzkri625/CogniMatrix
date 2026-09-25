import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { seedShops } from './data/seed';
import { round2 } from './format';
import type { CartLine, Order, OrderStatus, Product, Shop } from './types';

// All data lives in the browser (localStorage). This is a demo/MVP;
// a real deployment would swap these for API calls.
const KEY = 'esnaf-carsi:v1';

interface Persisted {
  shops: Shop[];
  orders: Order[];
  carts: Record<string, CartLine[]>; // keyed by shop slug
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch {
    /* storage unavailable or corrupt: fall back to seed */
  }
  return { shops: seedShops, orders: [], carts: {} };
}

interface Store extends Persisted {
  getShop: (slug: string) => Shop | undefined;
  addShop: (shop: Shop) => void;
  updateShop: (slug: string, patch: Partial<Shop>) => void;
  upsertProduct: (slug: string, product: Product) => void;
  deleteProduct: (slug: string, productId: string) => void;
  setCartQty: (slug: string, productId: string, qty: number) => void;
  clearCart: (slug: string) => void;
  placeOrder: (order: Order) => void;
  setOrderStatus: (orderId: string, status: OrderStatus) => void;
  resetDemo: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore quota / private mode */
    }
  }, [data]);

  const mapShop = useCallback(
    (slug: string, fn: (s: Shop) => Shop) =>
      setData((d) => ({ ...d, shops: d.shops.map((s) => (s.slug === slug ? fn(s) : s)) })),
    [],
  );

  const store = useMemo<Store>(
    () => ({
      ...data,
      getShop: (slug) => data.shops.find((s) => s.slug === slug),
      addShop: (shop) => setData((d) => ({ ...d, shops: [...d.shops, shop] })),
      updateShop: (slug, patch) => mapShop(slug, (s) => ({ ...s, ...patch })),
      upsertProduct: (slug, product) =>
        mapShop(slug, (s) => {
          const exists = s.products.some((p) => p.id === product.id);
          return {
            ...s,
            products: exists
              ? s.products.map((p) => (p.id === product.id ? product : p))
              : [...s.products, product],
          };
        }),
      deleteProduct: (slug, productId) =>
        mapShop(slug, (s) => ({ ...s, products: s.products.filter((p) => p.id !== productId) })),
      setCartQty: (slug, productId, qty) =>
        setData((d) => {
          const prev = d.carts[slug] ?? [];
          const q = round2(qty);
          const lines = prev.some((l) => l.productId === productId)
            ? prev.map((l) => (l.productId === productId ? { ...l, qty: q } : l))
            : [...prev, { productId, qty: q }];
          return { ...d, carts: { ...d.carts, [slug]: lines.filter((l) => l.qty > 0) } };
        }),
      clearCart: (slug) => setData((d) => ({ ...d, carts: { ...d.carts, [slug]: [] } })),
      placeOrder: (order) =>
        setData((d) => ({
          ...d,
          orders: [order, ...d.orders],
          carts: { ...d.carts, [order.shopSlug]: [] },
        })),
      setOrderStatus: (orderId, status) =>
        setData((d) => ({
          ...d,
          orders: d.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
        })),
      resetDemo: () => setData({ shops: seedShops, orders: [], carts: {} }),
    }),
    [data, mapShop],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

/** Cart lines joined with their products, plus totals, for one shop. */
export function useCart(shop: Shop | undefined) {
  const { carts } = useStore();
  return useMemo(() => {
    if (!shop) return { items: [], count: 0, subtotal: 0, deliveryFee: 0, total: 0 };
    const items = (carts[shop.slug] ?? []).flatMap((l) => {
      const product = shop.products.find((p) => p.id === l.productId);
      return product && product.inStock ? [{ product, qty: l.qty, lineTotal: round2(product.price * l.qty) }] : [];
    });
    const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
    const free = shop.freeDeliveryOver > 0 && subtotal >= shop.freeDeliveryOver;
    const deliveryFee = items.length === 0 || free ? 0 : shop.deliveryFee;
    return { items, count: items.length, subtotal, deliveryFee, total: round2(subtotal + deliveryFee) };
  }, [carts, shop]);
}
