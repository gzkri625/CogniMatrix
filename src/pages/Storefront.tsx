import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loading, NotFound } from '../App';
import QtyControl from '../components/QtyControl';
import ShopLayout from '../components/ShopLayout';
import { money, qtyStep } from '../format';
import { useCart, useStore } from '../store';

export default function Storefront() {
  const { slug = '' } = useParams();
  const { getShop, shopsLoading, carts, setCartQty } = useStore();
  const shop = getShop(slug);
  const cart = useCart(shop);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Tümü');
  const [cartOpen, setCartOpen] = useState(false);

  const cats = useMemo(() => ['Tümü', ...new Set(shop?.products.map((p) => p.category))], [shop]);
  if (!shop) return shopsLoading ? <Loading /> : <NotFound />;

  const qtyOf = (id: string) => carts[slug]?.find((l) => l.productId === id)?.qty ?? 0;
  const products = shop.products.filter(
    (p) =>
      (cat === 'Tümü' || p.category === cat) &&
      `${p.name} ${p.description}`.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR')),
  );
  const belowMin = cart.subtotal < shop.minOrder;

  return (
    <ShopLayout
      shop={shop}
      right={
        <button className="btn btn-sm cart-btn" onClick={() => setCartOpen(true)}>
          🛒 Sepet {cart.count > 0 && <span className="badge">{cart.count}</span>}
        </button>
      }
    >
      <section className="shop-hero">
        <div className="wrap">
          <h1>{shop.emoji} {shop.name}</h1>
          <p>{shop.tagline}</p>
          <div className="info-pills">
            <span>🕒 {shop.hours}</span>
            <span>📍 {shop.district}</span>
            <span>🧺 Min. sipariş {money(shop.minOrder)}</span>
            <span>
              🛵 {shop.deliveryFee === 0 ? 'Ücretsiz teslimat' : `Teslimat ${money(shop.deliveryFee)}`}
              {shop.freeDeliveryOver > 0 && shop.deliveryFee > 0 && ` (${money(shop.freeDeliveryOver)} üzeri ücretsiz)`}
            </span>
          </div>
        </div>
      </section>

      <main className="wrap">
        <div className="toolbar">
          <div className="chips">
            {cats.map((c) => (
              <button key={c} className={`chip ${c === cat ? 'active' : ''}`} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          <input className="search search-sm" placeholder="Ürün ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="product-grid">
          {products.map((p) => {
            const qty = qtyOf(p.id);
            return (
              <div key={p.id} className={`product ${p.inStock ? '' : 'out'}`}>
                <div className="product-emoji">{p.emoji}</div>
                <div className="product-body">
                  <b>{p.name}</b>
                  <span className="muted small">{p.description}</span>
                  <div className="price">
                    {money(p.price)} <span className="muted small">/ {p.unit}</span>
                  </div>
                </div>
                {!p.inStock ? (
                  <span className="tag">Tükendi</span>
                ) : qty > 0 ? (
                  <QtyControl qty={qty} unit={p.unit} onChange={(n) => setCartQty(slug, p.id, n)} />
                ) : (
                  <button className="btn btn-sm" onClick={() => setCartQty(slug, p.id, qtyStep(p.unit))}>
                    Sepete ekle
                  </button>
                )}
              </div>
            );
          })}
          {products.length === 0 && <p className="muted">Ürün bulunamadı.</p>}
        </div>
      </main>

      {cart.count > 0 && !cartOpen && (
        <button className="floating-cart" onClick={() => setCartOpen(true)}>
          🛒 {cart.count} ürün · {money(cart.total)}
        </button>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="row">
              <h2>Sepetim</h2>
              <button className="link" onClick={() => setCartOpen(false)}>Kapat ✕</button>
            </div>
            {cart.count === 0 ? (
              <p className="muted">Sepetiniz boş.</p>
            ) : (
              <>
                <ul className="cart-list">
                  {cart.items.map(({ product, qty, lineTotal }) => (
                    <li key={product.id}>
                      <span className="cart-emoji">{product.emoji}</span>
                      <div className="grow">
                        <b>{product.name}</b>
                        <div className="small muted">{money(product.price)} / {product.unit}</div>
                        <QtyControl qty={qty} unit={product.unit} onChange={(n) => setCartQty(slug, product.id, n)} />
                      </div>
                      <b>{money(lineTotal)}</b>
                    </li>
                  ))}
                </ul>
                <Totals subtotal={cart.subtotal} deliveryFee={cart.deliveryFee} total={cart.total} />
                {belowMin && (
                  <p className="warn">Minimum sipariş tutarı {money(shop.minOrder)}. {money(shop.minOrder - cart.subtotal)} daha ekleyin.</p>
                )}
                <Link
                  to={`/${slug}/odeme`}
                  className={`btn btn-block ${belowMin ? 'disabled' : ''}`}
                  onClick={(e) => belowMin && e.preventDefault()}
                  aria-disabled={belowMin}
                >
                  Siparişi tamamla
                </Link>
              </>
            )}
          </aside>
        </div>
      )}
    </ShopLayout>
  );
}

export function Totals({ subtotal, deliveryFee, total }: { subtotal: number; deliveryFee: number; total: number }) {
  return (
    <dl className="totals">
      <dt>Ara toplam</dt><dd>{money(subtotal)}</dd>
      <dt>Teslimat</dt><dd>{deliveryFee === 0 ? 'Ücretsiz' : money(deliveryFee)}</dd>
      <dt className="total">Toplam</dt><dd className="total">{money(total)}</dd>
    </dl>
  );
}
