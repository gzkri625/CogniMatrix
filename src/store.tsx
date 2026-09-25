import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { backend } from './backend';
import type { NewShop, ShopPatch } from './backend/types';
import { round2 } from './format';
import type { CartLine, Order, Product, Shop, User } from './types';

const CART_KEY = 'esnaf-carsi:carts';

function loadCarts(): Record<string, CartLine[]> {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? '{}');
  } catch {
    return {};
  }
}

interface Store {
  backend: typeof backend;
  shops: Shop[];
  shopsLoading: boolean;
  shopsError: string;
  getShop: (slug: string) => Shop | undefined;
  refreshShops: () => Promise<void>;

  user: User | null;
  authReady: boolean;

  createShop: (shop: NewShop, products: Omit<Product, 'id'>[]) => Promise<Shop>;
  updateShop: (slug: string, patch: ShopPatch) => Promise<void>;
  saveProduct: (slug: string, product: Product) => Promise<void>;
  deleteProduct: (slug: string, productId: string) => Promise<void>;

  carts: Record<string, CartLine[]>; // keyed by shop slug, always local
  setCartQty: (slug: string, productId: string, qty: number) => void;
  clearCart: (slug: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [shopsError, setShopsError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [carts, setCarts] = useState(loadCarts);

  const refreshShops = useCallback(async () => {
    try {
      setShops(await backend.listShops());
      setShopsError('');
    } catch (e) {
      setShopsError((e as Error).message);
    } finally {
      setShopsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshShops();
    backend.currentUser().then((u) => {
      setUser(u);
      setAuthReady(true);
    });
    return backend.onAuthChange((u) => {
      setUser(u);
      setAuthReady(true);
      if (backend.mode === 'demo') refreshShops(); // demo reset changes the catalog
    });
  }, [refreshShops]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(carts));
    } catch {
      /* ignore */
    }
  }, [carts]);

  const patchShop = (slug: string, fn: (s: Shop) => Shop) =>
    setShops((all) => all.map((s) => (s.slug === slug ? fn(s) : s)));

  const store = useMemo<Store>(
    () => ({
      backend,
      shops,
      shopsLoading,
      shopsError,
      getShop: (slug) => shops.find((s) => s.slug === slug),
      refreshShops,
      user,
      authReady,

      createShop: async (shop, products) => {
        const created = await backend.createShop(shop, products);
        setShops((all) => [...all, created]);
        return created;
      },
      updateShop: async (slug, patch) => {
        await backend.updateShop(slug, patch);
        patchShop(slug, (s) => ({ ...s, ...patch }));
      },
      saveProduct: async (slug, product) => {
        const saved = await backend.saveProduct(slug, product);
        patchShop(slug, (s) => ({
          ...s,
          products: s.products.some((p) => p.id === saved.id)
            ? s.products.map((p) => (p.id === saved.id ? saved : p))
            : [...s.products, saved],
        }));
      },
      deleteProduct: async (slug, productId) => {
        await backend.deleteProduct(slug, productId);
        patchShop(slug, (s) => ({ ...s, products: s.products.filter((p) => p.id !== productId) }));
      },

      carts,
      setCartQty: (slug, productId, qty) =>
        setCarts((c) => {
          const prev = c[slug] ?? [];
          const q = round2(qty);
          const lines = prev.some((l) => l.productId === productId)
            ? prev.map((l) => (l.productId === productId ? { ...l, qty: q } : l))
            : [...prev, { productId, qty: q }];
          return { ...c, [slug]: lines.filter((l) => l.qty > 0) };
        }),
      clearCart: (slug) => setCarts((c) => ({ ...c, [slug]: [] })),
    }),
    [shops, shopsLoading, shopsError, refreshShops, user, authReady, carts],
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

/** One order, for the customer's order page. */
export function useOrder(id: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!id) return;
    try {
      setOrder(await backend.getOrder(id));
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    reload();
    const timer = setInterval(reload, 20_000); // pick up status changes from the shop
    return () => clearInterval(timer);
  }, [reload]);
  return { order, loading, reload };
}

/** A shop's orders for its owner, kept live. onNew fires when a new order arrives. */
export function useShopOrders(slug: string, enabled: boolean, onNew?: (o: Order) => void) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let known: Set<string> | null = null;
    const load = async () => {
      try {
        const list = await backend.listOrders(slug);
        if (!alive) return;
        if (known) list.filter((o) => !known!.has(o.id)).forEach((o) => onNewRef.current?.(o));
        known = new Set(list.map((o) => o.id));
        setOrders(list);
        setError('');
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    load();
    const unsubscribe = backend.subscribeOrders(slug, load);
    // realtime can miss events (sleeping tab, flaky network): poll as a safety net
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, [slug, enabled]);

  const setStatus = async (id: string, status: Order['status']) => {
    await backend.setOrderStatus(id, status);
    setOrders((all) => all.map((o) => (o.id === id ? { ...o, status } : o)));
  };
  return { orders, error, setStatus };
}
