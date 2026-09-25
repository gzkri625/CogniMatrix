import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { seedShops } from '../data/seed';
import { slugify, uid } from '../format';
import { useStore } from '../store';
import type { Shop, ShopCategory } from '../types';

const PRESETS: Record<ShopCategory, { emoji: string; color: string }> = {
  Fırın: { emoji: '🥖', color: '#c2410c' },
  Manav: { emoji: '🍅', color: '#15803d' },
  Kasap: { emoji: '🥩', color: '#b91c1c' },
  Balıkçı: { emoji: '🐟', color: '#0369a1' },
  Kırtasiye: { emoji: '✏️', color: '#7c3aed' },
  Çiçekçi: { emoji: '💐', color: '#be185d' },
  Şarküteri: { emoji: '🧀', color: '#a16207' },
  Diğer: { emoji: '🏪', color: '#334155' },
};
const RESERVED = new Set(['dukkan-ac']);

export default function NewShop() {
  const { shops, addShop } = useStore();
  const navigate = useNavigate();
  const [f, setF] = useState({
    name: '', category: 'Fırın' as ShopCategory, owner: '', phone: '', district: '', address: '',
    hours: '08:00 – 20:00', pin: '', starter: true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const baseSlug = slugify(f.name);
  const taken = shops.some((s) => s.slug === baseSlug) || RESERVED.has(baseSlug);
  const template = seedShops.find((s) => s.category === f.category);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!baseSlug || taken) return;
    const phone = f.phone.replace(/\D/g, '').replace(/^0/, '90');
    const shop: Shop = {
      slug: baseSlug,
      name: f.name.trim(),
      category: f.category,
      tagline: `${f.district} semtinden kapınıza online sipariş`,
      ...PRESETS[f.category],
      owner: f.owner,
      phone,
      address: f.address,
      district: f.district,
      hours: f.hours,
      deliveryFee: 25,
      freeDeliveryOver: 300,
      minOrder: 100,
      pin: f.pin,
      products: f.starter && template ? template.products.map((p) => ({ ...p, id: uid() })) : [],
    };
    addShop(shop);
    try {
      sessionStorage.setItem(`esnaf-carsi:panel:${shop.slug}`, '1');
    } catch {
      /* ignore */
    }
    navigate(`/${shop.slug}/panel`);
  };

  return (
    <>
      <header className="platform-bar">
        <div className="wrap row">
          <Link to="/" className="logo">🏪 Esnaf Çarşı</Link>
        </div>
      </header>
      <main className="wrap narrow">
        <h1>Dükkanını aç</h1>
        <p className="muted">Birkaç bilgiyle online dükkanın hazır. Sonra panelden ürün ve fiyatları düzenleyebilirsin.</p>
        <form className="card form-grid" onSubmit={submit}>
          <label className="full">
            Dükkan adı
            <input required value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Örn. Güven Şarküteri" />
            {baseSlug && (
              <span className={`small ${taken ? 'warn' : 'muted'}`}>
                {taken ? 'Bu isim alınmış, farklı bir isim deneyin.' : `Site adresin: #/${baseSlug}`}
              </span>
            )}
          </label>
          <label>
            Esnaf türü
            <select value={f.category} onChange={(e) => set('category', e.target.value as ShopCategory)}>
              {Object.keys(PRESETS).map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Ad Soyad<input required value={f.owner} onChange={(e) => set('owner', e.target.value)} /></label>
          <label>WhatsApp numarası<input required type="tel" placeholder="05xx xxx xx xx" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
          <label>Semt<input required value={f.district} onChange={(e) => set('district', e.target.value)} /></label>
          <label className="full">Adres<input required value={f.address} onChange={(e) => set('address', e.target.value)} /></label>
          <label>Çalışma saatleri<input value={f.hours} onChange={(e) => set('hours', e.target.value)} /></label>
          <label>
            Panel PIN'i (4–6 rakam)
            <input required inputMode="numeric" pattern="\d{4,6}" value={f.pin} onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))} />
          </label>
          {template && (
            <label className="radio full">
              <input type="checkbox" checked={f.starter} onChange={(e) => set('starter', e.target.checked)} />
              Örnek {f.category.toLocaleLowerCase('tr-TR')} ürünleriyle başla ({template.products.length} ürün)
            </label>
          )}
          <button className="btn btn-block full" disabled={!baseSlug || taken}>Dükkanımı oluştur</button>
        </form>
      </main>
    </>
  );
}
