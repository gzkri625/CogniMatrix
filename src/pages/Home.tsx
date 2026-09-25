import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { money } from '../format';

export default function Home() {
  const { shops, resetDemo } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Hepsi');

  const cats = useMemo(() => ['Hepsi', ...new Set(shops.map((s) => s.category))], [shops]);
  const list = shops.filter((s) => {
    const text = `${s.name} ${s.tagline} ${s.district} ${s.category}`.toLocaleLowerCase('tr-TR');
    return (cat === 'Hepsi' || s.category === cat) && text.includes(q.toLocaleLowerCase('tr-TR'));
  });

  return (
    <>
      <header className="platform-bar">
        <div className="wrap row">
          <Link to="/" className="logo">🏪 Esnaf Çarşı</Link>
          <Link to="/dukkan-ac" className="btn btn-sm">Dükkanını Aç</Link>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <h1>Mahallenin esnafı artık internette</h1>
          <p>
            Fırından manava, kasaptan çiçekçiye — her esnafa dakikalar içinde kendi online dükkanı.
            Komisyon yok, sipariş doğrudan esnafa ve WhatsApp'a düşer.
          </p>
          <input
            className="search"
            placeholder="Dükkan, ürün türü veya semt ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </section>

      <main className="wrap">
        <div className="chips">
          {cats.map((c) => (
            <button key={c} className={`chip ${c === cat ? 'active' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="shop-grid">
          {list.map((s) => (
            <Link key={s.slug} to={`/${s.slug}`} className="shop-card" style={{ '--brand': s.color } as React.CSSProperties}>
              <div className="shop-card-top">
                <span className="shop-emoji">{s.emoji}</span>
              </div>
              <div className="shop-card-body">
                <div className="muted small">{s.category} · {s.district}</div>
                <h3>{s.name}</h3>
                <p>{s.tagline}</p>
                <div className="small muted">
                  🕒 {s.hours} · Min. {money(s.minOrder)} ·{' '}
                  {s.deliveryFee === 0 ? 'Ücretsiz teslimat' : `Teslimat ${money(s.deliveryFee)}`}
                </div>
              </div>
            </Link>
          ))}
          {list.length === 0 && <p className="muted">Aramanıza uygun dükkan bulunamadı.</p>}
        </div>

        <section className="features">
          <h2>Esnaf için neden Esnaf Çarşı?</h2>
          <div className="feature-grid">
            <div><b>⚡ 5 dakikada kurulum</b><p>Dükkan adını, telefonunu ve ürünlerini gir; siten hazır.</p></div>
            <div><b>📱 WhatsApp siparişi</b><p>Gelen her sipariş hazır mesaj olarak WhatsApp'ına iletilir.</p></div>
            <div><b>🧾 Sipariş paneli</b><p>Siparişleri takip et, durumunu güncelle, ürün ve fiyatları değiştir.</p></div>
            <div><b>⚖️ Kilo, demet, adet</b><p>Manav ve kasap için yarım kilo hassasiyetinde satış.</p></div>
          </div>
          <Link to="/dukkan-ac" className="btn">Hemen dükkanını aç →</Link>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap row">
          <span>© {new Date().getFullYear()} Esnaf Çarşı</span>
          <button
            className="link"
            onClick={() => confirm('Tüm demo verileri sıfırlansın mı?') && resetDemo()}
          >
            Demo verilerini sıfırla
          </button>
        </div>
      </footer>
    </>
  );
}
