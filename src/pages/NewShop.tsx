import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loading, PlatformShell } from '../App';
import AuthForm from '../components/AuthForm';
import { seedShops } from '../data/seed';
import { slugify } from '../format';
import { useStore } from '../store';
import type { ShopCategory } from '../types';

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
const RESERVED = new Set(['dukkan-ac', 'giris', 'api']);

export default function NewShop() {
  const { shops, createShop, user, authReady } = useStore();
  const navigate = useNavigate();
  const [f, setF] = useState({
    name: '', category: 'Fırın' as ShopCategory, owner: '', phone: '', district: '', address: '',
    city: 'İstanbul', hours: '08:00 – 20:00', starter: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const baseSlug = slugify(f.name);
  const taken = shops.some((s) => s.slug === baseSlug) || RESERVED.has(baseSlug);
  const template = seedShops.find((s) => s.category === f.category);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!baseSlug || taken || busy) return;
    setBusy(true);
    setError('');
    try {
      const shop = await createShop(
        {
          slug: baseSlug,
          name: f.name.trim(),
          category: f.category,
          tagline: `${f.district} semtinden kapınıza online sipariş`,
          ...PRESETS[f.category],
          owner: f.owner,
          phone: f.phone.replace(/\D/g, '').replace(/^0/, '90'),
          address: f.address,
          district: f.district,
          city: f.city,
          hours: f.hours,
          deliveryFee: 25,
          freeDeliveryOver: 300,
          minOrder: 100,
        },
        f.starter && template ? template.products.map(({ id: _id, ...p }) => p) : [],
      );
      navigate(`/${shop.slug}/panel`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (!authReady) return <Loading />;
  if (!user) {
    return (
      <PlatformShell>
        <main className="wrap narrow">
          <h1>Dükkanını aç</h1>
          <p className="muted">Önce siparişlerini yöneteceğin esnaf hesabını oluştur ya da giriş yap.</p>
          <AuthForm title="Esnaf hesabı" initialMode="kayit" />
        </main>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell>
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
          <label>İl<input required value={f.city} onChange={(e) => set('city', e.target.value)} /></label>
          <label>Çalışma saatleri<input value={f.hours} onChange={(e) => set('hours', e.target.value)} /></label>
          {template && (
            <label className="radio full">
              <input type="checkbox" checked={f.starter} onChange={(e) => set('starter', e.target.checked)} />
              Örnek {f.category.toLocaleLowerCase('tr-TR')} ürünleriyle başla ({template.products.length} ürün)
            </label>
          )}
          {error && <p className="warn full">{error}</p>}
          <button className="btn btn-block full" disabled={!baseSlug || taken || busy}>
            {busy ? 'Oluşturuluyor…' : 'Dükkanımı oluştur'}
          </button>
        </form>
      </main>
    </PlatformShell>
  );
}
