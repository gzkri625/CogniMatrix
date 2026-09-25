import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { NotFound } from '../App';
import ShopLayout from '../components/ShopLayout';
import { money, qtyLabel, round2, uid } from '../format';
import { useCart, useStore } from '../store';
import type { Order } from '../types';
import { Totals } from './Storefront';

export default function Checkout() {
  const { slug = '' } = useParams();
  const { getShop, placeOrder } = useStore();
  const shop = getShop(slug);
  const cart = useCart(shop);
  const navigate = useNavigate();
  // placeOrder empties the cart; don't let the empty-cart redirect win the race.
  const placed = useRef(false);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    address: '',
    note: '',
    fulfillment: 'teslimat' as Order['fulfillment'],
    payment: 'kapıda nakit' as Order['payment'],
  });

  if (!shop) return <NotFound />;
  if (cart.count === 0 && !placed.current) return <Navigate to={`/${slug}`} replace />;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const deliveryFee = form.fulfillment === 'gel-al' ? 0 : cart.deliveryFee;
  const total = round2(cart.subtotal + deliveryFee);
  const belowMin = cart.subtotal < shop.minOrder;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (belowMin) return;
    const order: Order = {
      id: uid().toUpperCase().slice(0, 6),
      shopSlug: slug,
      createdAt: new Date().toISOString(),
      ...form,
      address: form.fulfillment === 'teslimat' ? form.address : '',
      lines: cart.items.map(({ product, qty }) => ({
        productId: product.id,
        name: product.name,
        unit: product.unit,
        price: product.price,
        qty,
      })),
      subtotal: cart.subtotal,
      deliveryFee,
      total,
      status: 'yeni',
    };
    placed.current = true;
    placeOrder(order);
    navigate(`/${slug}/siparis/${order.id}`, { replace: true });
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
            {(['kapıda nakit', 'kapıda kart', 'havale'] as const).map((p) => (
              <label key={p} className="radio">
                <input type="radio" name="payment" checked={form.payment === p} onChange={() => set('payment', p)} />
                {p === 'kapıda nakit' ? '💵 Kapıda nakit' : p === 'kapıda kart' ? '💳 Kapıda kredi kartı' : '🏦 Havale / EFT'}
              </label>
            ))}
          </div>
          {belowMin && <p className="warn">Minimum sipariş tutarı {money(shop.minOrder)}.</p>}
          <button className="btn btn-block" disabled={belowMin}>
            Siparişi ver · {money(total)}
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
