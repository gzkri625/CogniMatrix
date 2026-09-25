import { useState, type FormEvent } from 'react';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../data/seed';
import { useStore } from '../store';

/** E-mail + password sign-in / sign-up for shopkeepers. */
export default function AuthForm({ title = 'Esnaf girişi', initialMode = 'giris' }: { title?: string; initialMode?: 'giris' | 'kayit' }) {
  const { backend } = useStore();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'giris') {
        await backend.signIn(email, password);
      } else {
        const { needsConfirmation } = await backend.signUp(email, password);
        if (needsConfirmation) setInfo(`${email} adresine bir onay bağlantısı gönderdik. Bağlantıya tıkladıktan sonra giriş yapın.`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card narrow center auth" onSubmit={submit}>
      <div className="big-emoji">🔐</div>
      <h2>{title}</h2>
      <div className="seg">
        <button type="button" className={mode === 'giris' ? 'active' : ''} onClick={() => setMode('giris')}>Giriş yap</button>
        <button type="button" className={mode === 'kayit' ? 'active' : ''} onClick={() => setMode('kayit')}>Hesap oluştur</button>
      </div>
      <label>
        E-posta
        <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Şifre
        <input
          required
          type="password"
          minLength={6}
          autoComplete={mode === 'giris' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="warn">{error}</p>}
      {info && <p className="ok">{info}</p>}
      <button className="btn btn-block" disabled={busy}>
        {busy ? 'Bekleyin…' : mode === 'giris' ? 'Giriş yap' : 'Hesap oluştur'}
      </button>
      {backend.mode === 'demo' && (
        <p className="small muted">
          Demo modu · örnek dükkanların hesabı: <b>{DEMO_EMAIL}</b> / <b>{DEMO_PASSWORD}</b>
        </p>
      )}
    </form>
  );
}
