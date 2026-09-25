import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Link from '../components/AppLink';
import { Loading, NotFound } from '../App';
import ShopLayout from '../components/ShopLayout';
import { money, qtyLabel, round2 } from '../format';
import { useCart, useStore } from '../store';
import { startPayment, usePaymentStatus } from '../payment';
import type { Order } from '../types';
import { Totals } from './Storefront';

export default function Checkout() {
  const { slug = '' } = useParams();
  const { getShop, shopsLoading, backend, carts, clearCart } = useStore();
  const shop = getShop(slug);
  const cart = useCart(shop);
  const navigate = useNavigate();
  // placeOrder empties the cart; don't let the empty-cart redirect win the race.
  const placed = useRef(false);
  const online = usePaymentStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    email: '',
    address: '',
    note: '',
    fulfillment: 'teslimat' as Order['fulfillment'],
    payment: 'kapıda nakit' as Order['payment'],
  });

  if (!shop) return shopsLoading ? <Loading /> : <NotFound />;
  if (cart.count === 0 && !placed.current) return <Navigate to={`/${slug}`} replace />;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const deliveryFee = form.fulfillment === 'gel-al' ? 0 : cart.deliveryFee;
  const total = round2(cart.subtotal + deliveryFee);
  const belowMin = cart.subtotal < shop.minOrder;

  const payOnline = form.payment === 'online kart';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (belowMin || busy) return;
    setBusy(true);
    setError('');
    let order: Order;
    try {
      // The backend re-prices everything from its own catalog.
      order = await backend.placeOrder({ shopSlug: slug, ...form, items: carts[slug] ?? [] });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      return;
    }
    placed.current = true;
    clearCart(slug);
    const orderUrl = `/${slug}/siparis/${order.id}`;
    if (payOnline) {
      try {
        window.location.href = await startPayment(order.id);
        return;
      } catch {
        // order exists; its page offers "try again" / "pay at the door"
      }
    }
    navigate(orderUrl, { replace: true });
  };

  return (
    <ShopLayout shop={shop} right={<Link to={`/${slug}`} className="link">← Alışverişe dön</Link>}>
      <main className="wrap checkout">
        <form className="card" onSubmit={submit}>
          <h2>Teslimat bilgileri</h2>
          <div className="seg">
            {(['teslimat', 'gel-al'] as const).map((f) => (
              <button type="button" key={f} className={form.fulfillment === f ? 'active' : ''} onClick={() => set('fulfillment', f)}>
                {f === 'teslimat' ? '🛵 Adrese teslim' : '🏃 Gel-al'}
              </button>
            ))}
          </div>
          <label>
            Ad Soyad
            <input required value={form.customerName} onChange={(e) => set('customerName', e.target.value)} />
          </label>
          <label>
            Telefon
            <input
              required
              type="tel"
              pattern="[0-9 +\(\)\-]{10,}"
              placeholder="05xx xxx xx xx"
              value={form.customerPhone}
              onChange={(e) => set('customerPhone', e.target.value)}
            />
          </label>
          {payOnline && (
            <label>
              E-posta (ödeme makbuzu için)
              <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </label>
          )}
          {form.fulfillment === 'teslimat' ? (
            <label>
              Adres
              <textarea required rows={3} value={form.address} onChange={(e) => set('address', e.target.value)} />
            </label>
          ) : (
            <p className="muted small">📍 Siparişinizi {shop.address}, {shop.district} adresinden alabilirsiniz.</p>
          )}
          <label>
            Sipariş notu (isteğe bağlı)
            <input
              placeholder="Örn. zile basmayın, kıymayı iki kez çekin…"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </label>
          <h3>Ödeme</h3>
          <div className="radio-list">
            {(online?.aktif ? PAYMENTS : PAYMENTS.slice(1)).map((p) => (
              <label key={p} className="radio">
                <input type="radio" name="payment" checked={form.payment === p} onChange={() => set('payment', p)} />
                {PAYMENT_LABELS[p]}
                {p === 'online kart' && online?.test && <span className="tag">test modu</span>}
              </label>
            ))}
          </div>
          {payOnline && <p className="small muted">🔒 Kart bilgileriniz iyzico güvenli ödeme sayfasında girilir; bu siteye kaydedilmez.</p>}
          {error && <p className="warn">⚠️ {error}</p>}
          {belowMin && <p className="warn">Minimum sipariş tutarı {money(shop.minOrder)}.</p>}
          <button className="btn btn-block" disabled={belowMin || busy}>
            {busy ? 'Ödeme sayfası açılıyor…' : payOnline ? `Kartla öde · ${money(total)}` : `Siparişi ver · ${money(total)}`}
          </button>
        </form>

        <aside className="card">
          <h2>Sipariş özeti</h2>
          <ul className="summary-list">
            {cart.items.map(({ product, qty, lineTotal }) => (
              <li key={product.id}>
                <span>{product.emoji} {product.name} <span className="muted small">× {qtyLabel(qty, product.unit)}</span></span>
                <span>{money(lineTotal)}</span>
              </li>
            ))}
          </ul>
          <Totals subtotal={cart.subtotal} deliveryFee={deliveryFee} total={total} />
        </aside>
      </main>
    </ShopLayout>
  );
}

const PAYMENTS = ['online kart', 'kapıda nakit', 'kapıda kart', 'havale'] as const;
export const PAYMENT_LABELS: Record<Order['payment'], string> = {
  'online kart': '💳 Online kredi / banka kartı (iyzico)',
  'kapıda nakit': '💵 Kapıda nakit',
  'kapıda kart': '💳 Kapıda kredi kartı',
  havale: '🏦 Havale / EFT',
};
