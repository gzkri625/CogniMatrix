import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NotFound } from '../App';
import ShopLayout from '../components/ShopLayout';
import { money, qtyLabel, uid } from '../format';
import { useStore } from '../store';
import type { OrderStatus, Product, Shop, Unit } from '../types';

const STATUSES: OrderStatus[] = ['yeni', 'hazırlanıyor', 'yolda', 'teslim edildi', 'iptal'];
const UNITS: Unit[] = ['adet', 'kg', 'demet', 'paket', 'litre'];
const authKey = (slug: string) => `esnaf-carsi:panel:${slug}`;

export default function Panel() {
  const { slug = '' } = useParams();
  const { getShop } = useStore();
  const shop = getShop(slug);
  const [authed, setAuthed] = useState(() => {
    try {
      return sessionStorage.getItem(authKey(slug)) === '1';
    } catch {
      return false;
    }
  });
  const [tab, setTab] = useState<'siparis' | 'urun' | 'dukkan'>('siparis');

  if (!shop) return <NotFound />;

  const logout = () => {
    try {
      sessionStorage.removeItem(authKey(slug));
    } catch {
      /* ignore */
    }
    setAuthed(false);
  };

  return (
    <ShopLayout
      shop={shop}
      right={
        <span className="row gap">
          <Link to={`/${slug}`} className="link">Siteyi gör ↗</Link>
          {authed && <button className="link" onClick={logout}>Çıkış</button>}
        </span>
      }
    >
      <main className="wrap">
        {!authed ? (
          <PinGate shop={shop} onOk={() => setAuthed(true)} />
        ) : (
          <>
            <h1>Esnaf Paneli</h1>
            <div className="tabs">
              <button className={tab === 'siparis' ? 'active' : ''} onClick={() => setTab('siparis')}>🧾 Siparişler</button>
              <button className={tab === 'urun' ? 'active' : ''} onClick={() => setTab('urun')}>📦 Ürünler</button>
              <button className={tab === 'dukkan' ? 'active' : ''} onClick={() => setTab('dukkan')}>⚙️ Dükkan</button>
            </div>
            {tab === 'siparis' && <Orders shop={shop} />}
            {tab === 'urun' && <Products shop={shop} />}
            {tab === 'dukkan' && <Settings shop={shop} />}
          </>
        )}
      </main>
    </ShopLayout>
  );
}

function PinGate({ shop, onOk }: { shop: Shop; onOk: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pin !== shop.pin) return setErr(true);
    try {
      sessionStorage.setItem(authKey(shop.slug), '1');
    } catch {
      /* ignore */
    }
    onOk();
  };
  return (
    <form className="card narrow center" onSubmit={submit}>
      <div className="big-emoji">🔐</div>
      <h2>Esnaf girişi</h2>
      <input
        className="pin"
        inputMode="numeric"
        maxLength={6}
        placeholder="PIN"
        value={pin}
        onChange={(e) => { setPin(e.target.value); setErr(false); }}
        autoFocus
      />
      {err && <p className="warn">PIN hatalı.</p>}
      <button className="btn btn-block">Giriş</button>
      <p className="small muted">Demo dükkanların PIN'i: 1234</p>
    </form>
  );
}

function Orders({ shop }: { shop: Shop }) {
  const { orders, setOrderStatus } = useStore();
  const mine = orders.filter((o) => o.shopSlug === shop.slug);
  const active = mine.filter((o) => o.status !== 'teslim edildi' && o.status !== 'iptal');
  const today = mine.filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString() && o.status !== 'iptal');

  return (
    <>
      <div className="stats">
        <div className="card"><span className="muted small">Bekleyen</span><b>{active.length}</b></div>
        <div className="card"><span className="muted small">Bugünkü sipariş</span><b>{today.length}</b></div>
        <div className="card"><span className="muted small">Bugünkü ciro</span><b>{money(today.reduce((s, o) => s + o.total, 0))}</b></div>
      </div>
      {mine.length === 0 && <p className="muted">Henüz sipariş yok. Sitenizi paylaşın: <code>#/{shop.slug}</code></p>}
      <div className="order-list">
        {mine.map((o) => (
          <div key={o.id} className={`card order status-${o.status.replace(' ', '-')}`}>
            <div className="row">
              <b>#{o.id} · {o.customerName}</b>
              <select value={o.status} onChange={(e) => setOrderStatus(o.id, e.target.value as OrderStatus)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="small muted">
              {new Date(o.createdAt).toLocaleString('tr-TR')} · <a href={`tel:${o.customerPhone}`}>{o.customerPhone}</a> ·{' '}
              {o.fulfillment === 'teslimat' ? `🛵 ${o.address}` : '🏃 Gel-al'} · {o.payment}
              {o.online && (
                <>
                  {' '}
                  <span className={`tag pay-${o.online.state === 'ödendi' ? 'ok' : o.online.state === 'başarısız' ? 'fail' : 'wait'}`}>
                    {o.online.state === 'ödendi'
                      ? `✓ Ödendi ${money(o.online.paidAmount ?? 0)}`
                      : o.online.state === 'başarısız' ? 'Ödeme başarısız' : 'Ödeme bekleniyor'}
                  </span>
                  {o.online.paymentId && <span className="small"> · iyzico no {o.online.paymentId}</span>}
                </>
              )}
            </div>
            <ul className="summary-list">
              {o.lines.map((l) => (
                <li key={l.productId}><span>{l.name} × {qtyLabel(l.qty, l.unit)}</span><span>{money(l.price * l.qty)}</span></li>
              ))}
            </ul>
            {o.note && <p className="small">📝 {o.note}</p>}
            <div className="row"><span className="muted small">Teslimat {money(o.deliveryFee)}</span><b>{money(o.total)}</b></div>
          </div>
        ))}
      </div>
    </>
  );
}

const emptyProduct = (): Product => ({
  id: uid(), name: '', description: '', price: 0, unit: 'adet', category: '', emoji: '📦', inStock: true,
});

function Products({ shop }: { shop: Shop }) {
  const { upsertProduct, deleteProduct } = useStore();
  const [editing, setEditing] = useState<Product | null>(null);
  const cats = [...new Set(shop.products.map((p) => p.category))];

  return (
    <>
      <div className="row">
        <span className="muted">{shop.products.length} ürün</span>
        <button className="btn btn-sm" onClick={() => setEditing(emptyProduct())}>+ Yeni ürün</button>
      </div>
      {editing && (
        <ProductForm
          product={editing}
          categories={cats}
          onCancel={() => setEditing(null)}
          onSave={(p) => { upsertProduct(shop.slug, p); setEditing(null); }}
        />
      )}
      <table className="table">
        <thead>
          <tr><th></th><th>Ürün</th><th>Kategori</th><th>Fiyat</th><th>Stok</th><th></th></tr>
        </thead>
        <tbody>
          {shop.products.map((p) => (
            <tr key={p.id}>
              <td>{p.emoji}</td>
              <td><b>{p.name}</b><div className="small muted">{p.description}</div></td>
              <td>{p.category}</td>
              <td>{money(p.price)} / {p.unit}</td>
              <td>
                <label className="switch">
                  <input type="checkbox" checked={p.inStock} onChange={(e) => upsertProduct(shop.slug, { ...p, inStock: e.target.checked })} />
                  {p.inStock ? 'Var' : 'Yok'}
                </label>
              </td>
              <td className="nowrap">
                <button className="link" onClick={() => setEditing(p)}>Düzenle</button>{' '}
                <button className="link danger" onClick={() => confirm(`"${p.name}" silinsin mi?`) && deleteProduct(shop.slug, p.id)}>Sil</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ProductForm({ product, categories, onSave, onCancel }: {
  product: Product; categories: string[]; onSave: (p: Product) => void; onCancel: () => void;
}) {
  const [p, setP] = useState(product);
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));
  return (
    <form className="card form-grid" onSubmit={(e) => { e.preventDefault(); onSave(p); }}>
      <label className="w-sm">Simge<input value={p.emoji} maxLength={4} onChange={(e) => set('emoji', e.target.value)} /></label>
      <label>Ürün adı<input required value={p.name} onChange={(e) => set('name', e.target.value)} /></label>
      <label>Açıklama<input value={p.description} onChange={(e) => set('description', e.target.value)} /></label>
      <label>
        Kategori
        <input required list="cats" value={p.category} onChange={(e) => set('category', e.target.value)} />
        <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <label>Fiyat (₺)<input required type="number" min="0" step="0.01" value={p.price || ''} onChange={(e) => set('price', Number(e.target.value))} /></label>
      <label>
        Birim
        <select value={p.unit} onChange={(e) => set('unit', e.target.value as Unit)}>
          {UNITS.map((u) => <option key={u}>{u}</option>)}
        </select>
      </label>
      <div className="row gap full">
        <button className="btn">Kaydet</button>
        <button type="button" className="link" onClick={onCancel}>Vazgeç</button>
      </div>
    </form>
  );
}

function Settings({ shop }: { shop: Shop }) {
  const { updateShop } = useStore();
  const [s, setS] = useState(shop);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Shop>(k: K, v: Shop[K]) => { setS((x) => ({ ...x, [k]: v })); setSaved(false); };
  const num = (k: 'deliveryFee' | 'freeDeliveryOver' | 'minOrder') => (
    <input type="number" min="0" value={s[k]} onChange={(e) => set(k, Number(e.target.value))} />
  );
  return (
    <form className="card form-grid" onSubmit={(e) => { e.preventDefault(); updateShop(shop.slug, s); setSaved(true); }}>
      <label>Dükkan adı<input required value={s.name} onChange={(e) => set('name', e.target.value)} /></label>
      <label>Slogan<input value={s.tagline} onChange={(e) => set('tagline', e.target.value)} /></label>
      <label className="w-sm">Simge<input value={s.emoji} maxLength={4} onChange={(e) => set('emoji', e.target.value)} /></label>
      <label className="w-sm">Renk<input type="color" value={s.color} onChange={(e) => set('color', e.target.value)} /></label>
      <label>WhatsApp / Telefon<input required value={s.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))} /></label>
      <label>Çalışma saatleri<input value={s.hours} onChange={(e) => set('hours', e.target.value)} /></label>
      <label>Adres<input value={s.address} onChange={(e) => set('address', e.target.value)} /></label>
      <label>Semt<input value={s.district} onChange={(e) => set('district', e.target.value)} /></label>
      <label>Teslimat ücreti (₺){num('deliveryFee')}</label>
      <label>Ücretsiz teslimat eşiği (₺, 0 = yok){num('freeDeliveryOver')}</label>
      <label>Minimum sipariş (₺){num('minOrder')}</label>
      <label>Panel PIN<input required minLength={4} maxLength={6} value={s.pin} onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))} /></label>
      <div className="row gap full">
        <button className="btn">Kaydet</button>
        {saved && <span className="ok">✓ Kaydedildi</span>}
      </div>
    </form>
  );
}
