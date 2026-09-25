# 🏪 Esnaf Çarşı

Mahalle esnafı için çok dükkanlı e-ticaret platformu. Her esnaf (fırın, manav, kasap, balıkçı,
kırtasiye, çiçekçi…) dakikalar içinde kendi markalı online dükkanını açar; siparişler esnaf
paneline anında (canlı) düşer, müşteri isterse iyzico ile kartla öder.

Veriler **Supabase**'de (PostgreSQL) tutulur. Supabase ayarlanmamışsa site otomatik olarak
**demo modunda** çalışır (veriler yalnızca o tarayıcıda) — GitHub Pages önizlemesi böyle çalışır.

## Özellikler

**Müşteri tarafı**
- Çarşı ana sayfası: dükkan arama, esnaf türüne göre filtreleme
- Her dükkana özel site (`#/<dukkan-adi>`): kendi rengi, simgesi, çalışma saatleri, teslimat bilgisi
- Ürün kategorileri, arama, stok durumu ("Tükendi")
- Kilo / litre için 0,5 hassasiyetinde, adet / demet / paket için tam sayı miktar
- Sepet, minimum sipariş tutarı, teslimat ücreti ve "X TL üzeri ücretsiz teslimat"
- Ödeme sayfası: adrese teslim veya gel-al; kapıda nakit, kapıda kart, havale
- Sipariş onayı + tek tıkla **WhatsApp ile esnafa gönder** (hazır sipariş mesajı)

**Esnaf tarafı** (`#/<dukkan-adi>/panel`, e-posta + şifre ile giriş)
- Siparişler **canlı** gelir (sayfa yenilemeden, sesli uyarı ve sekme başlığında 🔔)
- Bekleyen / bugünkü sipariş / bugünkü ciro, sipariş durumu güncelleme
  (yeni → hazırlanıyor → yolda → teslim edildi / iptal)
- Ürünler: ekle, düzenle, sil, stok aç/kapat
- Dükkan ayarları: ad, slogan, renk, WhatsApp, adres, il, saatler, teslimat ücreti, minimum sipariş
- **Dükkanını Aç** (`#/dukkan-ac`): esnaf hesabı + dükkan oluşturma, isteğe bağlı hazır örnek ürünlerle
- Müşteri, sipariş sayfasının bağlantısıyla durumu (hazırlanıyor, yolda…) takip eder

## Çalıştırma

```bash
npm install
npm run dev       # geliştirme sunucusu
npm run build     # dist/ klasörüne statik çıktı
npm run preview   # build'i önizle
```

Çıktı tamamen statiktir (hash tabanlı yönlendirme, `base: './'`); GitHub Pages, Netlify vb.
herhangi bir statik barındırmaya doğrudan yüklenebilir.

Demo modunda örnek dükkanların hesabı: **demo@esnafcarsi.com / demo1234**. Ana sayfanın altındaki
"Demo verilerini sıfırla" ile başlangıç verilerine dönülür.

## Veritabanı (Supabase)

Şema: `supabase/migrations/20260925000000_esnaf_carsi.sql`

| Tablo / fonksiyon | Kim ne yapabilir |
|---|---|
| `shops`, `products` | Herkes okur; yalnızca dükkan sahibi yazar (slug ve sahip sonradan değişmez) |
| `orders` | Doğrudan kimse ekleyemez. Sahip kendi dükkanının siparişlerini okur, yalnızca `status` alanını değiştirir |
| `place_order()` | Müşteri siparişi bununla verir. **Fiyatlar, stok, miktar adımı, minimum sipariş ve teslimat ücreti veritabanında hesaplanır**; tarayıcının gönderdiği fiyat dikkate alınmaz |
| `get_order(id)` | Müşteri kendi siparişini rastgele sipariş kimliğiyle (bağlantıdaki uuid) görür |
| `switch_to_cash(id)` | Online ödemesi tamamlanmayan müşteri kapıda ödemeye geçer |
| Ödeme alanları | Yalnızca sunucu (service role) yazar, iyzico onayından sonra |

Kurulum:

1. [supabase.com](https://supabase.com)'da ücretsiz proje açın (bölge: Frankfurt, `eu-central-1`, Türkiye'ye en yakını).
2. **SQL Editor**'e migration dosyasının içeriğini yapıştırıp çalıştırın
   (ya da `npx supabase link --project-ref <ref> && npx supabase db push`).
3. **Authentication → URL Configuration**: *Site URL*'e sitenizin adresini (ör. `https://esnafcarsi.vercel.app`) yazın.
   E-posta onayı açıksa (varsayılan) esnaf kayıttan sonra gelen bağlantıya tıklar.
4. **Project Settings → API**'den adres ve anahtarları alıp Vercel'e girin (aşağıda).

Yerelde tam ortam (Docker gerekir): `npx supabase start` → çıktıdaki adres/anahtarları `.env.local`'a yazın.



Ödeme sayfasında **"Online kredi / banka kartı (iyzico)"** seçeneği var. Müşteri iyzico'nun
güvenli ödeme sayfasına yönlenir (kart bilgisi bu siteye hiç gelmez), 3D Secure ve taksit
(1/2/3/6) iyzico tarafında yapılır. Dönüşte sonuç sunucu tarafında iyzico'ya sorularak
doğrulanır; tarayıcı "ödendi" kararını kendisi vermez.

iyzico'nun gizli anahtarı tarayıcıya konamayacağı için bu kısım sunucusuz fonksiyonlarla çalışır.
Kod `server/odeme.ts`'te; `functions/api/odeme/` (Cloudflare Pages) ve `api/odeme/` (Vercel) bunu
çağıran ince giriş dosyalarıdır, yani iki platformda da aynı adreslerle çalışır:

| Uç nokta | Görevi |
|---|---|
| `GET  /api/odeme/durum` | Online ödeme açık mı / test modunda mı |
| `POST /api/odeme/baslat` | iyzico Checkout Form oluşturur, ödeme sayfası adresini döner |
| `POST /api/odeme/sonuc` | iyzico'nun geri dönüş adresi (callbackUrl), müşteriyi sipariş sayfasına yollar |
| `GET  /api/odeme/dogrula` | Token'ı iyzico'ya sorup gerçek ödeme sonucunu döner |

Tutar, veritabanındaki siparişten okunur (tarayıcıdan alınmaz) ve iyzico'nun bildirdiği ödenen tutar
sipariş tutarıyla karşılaştırılır; ödeme sonucu siparişe sunucu tarafında yazılır. iyzico veya Supabase
sunucu anahtarları tanımlı değilse kart seçeneği otomatik gizlenir; kapıda ödeme ve havale çalışır.

## Yayına alma — önerilen: Cloudflare Pages (ücretsiz, ticari kullanım serbest)

Ücretsiz kurulum: **Cloudflare Pages** (site + ödeme fonksiyonları) + **Supabase Free** (veritabanı) + iyzico
(aylık ücret yok, satış başına komisyon).

1. Önce yukarıdaki **Veritabanı (Supabase)** adımlarını yapın ve Legacy API Keys'ten `anon` ve `service_role`
   anahtarlarını alın.
2. [dash.cloudflare.com](https://dash.cloudflare.com)'da ücretsiz hesap açın.
3. **Workers & Pages → Create → Pages → Connect to Git** → GitHub'ı bağlayın → bu repoyu seçin.
4. Build ayarları:
   - Framework preset: **None** (veya Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Production branch: `main`
5. **Environment variables** (aynı ekranda, *Save and Deploy*'dan önce) — `.env.example`'daki hepsi:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL`. Gizli olanları (*service_role*, iyzico anahtarları)
   **Encrypt** seçeneğiyle girin.
6. **Save and Deploy**. Birkaç dakika sonra site `https://<proje>.pages.dev` adresinde yayında olur.
   `functions/` klasöründeki ödeme fonksiyonları otomatik yayınlanır.
7. Supabase → **Authentication → URL Configuration**: *Site URL* = `https://<proje>.pages.dev`,
   *Redirect URLs*'e `https://<proje>.pages.dev/**` ekleyin.
8. Kontrol: `https://<proje>.pages.dev/api/odeme/durum` → `{"aktif":true,"test":true}`.
   iyzico test kartı: `5528 7900 0000 0008`, SKT ileri bir tarih, CVC `123`.

Değişken değiştirdikten sonra **Deployments → (son yayın) → ⋯ → Retry deployment** ile yeniden yayınlayın
(`VITE_` ile başlayanlar derleme sırasında siteye gömülür). Kendi alan adınız için: projede **Custom domains**.

Yerelde fonksiyonlarla birlikte denemek için: `npm run build && npx wrangler pages dev dist`
(sunucu değişkenleri repo kökünde `.dev.vars` dosyasına, `.env.example` biçiminde).

### Alternatif: Vercel

Aynı kod Vercel'de de çalışır (`api/` klasörü). Vercel'in ücretsiz Hobby planı yalnızca ticari olmayan
kullanım içindir; satış yapan bir site için Pro plan gerekir. Kurulum: Vercel'e GitHub ile girin →
**Add New → Project** → repoyu seçin → yukarıdaki değişkenleri girin → **Deploy**, sonra Supabase'te Site URL'i güncelleyin.

### GitHub Pages

`.github/workflows/deploy.yml` siteyi GitHub Pages'e **demo modunda** yayınlar (veritabanı ve online ödeme yok).
GitHub Pages kullanım şartları e-ticaret sitesi barındırmaya izin vermediği için yalnızca tanıtım/önizleme içindir.

## Mimari

React 19 + TypeScript + Vite, React Router (HashRouter).

```
src/
  types.ts          Shop, Product, Order modelleri
  data/seed.ts      Demo modunun 6 örnek dükkanı
  backend/          Veri katmanı: supabase.ts (gerçek), demo.ts (localStorage), pricing.ts
  store.tsx         Uygulama durumu, oturum, sepet; useOrder / useShopOrders (canlı) kancaları
  whatsapp.ts       WhatsApp sipariş mesajı ve wa.me bağlantısı
  payment.ts        Arayüzün iyzico fonksiyonlarıyla konuşan kısmı
api/
  odeme/*.ts        Vercel giriş dosyaları
functions/api/odeme/ Cloudflare Pages Functions giriş dosyaları
server/
  odeme.ts          Ödeme uç noktaları (platformdan bağımsız)
  iyzico.ts         iyzico REST istemcisi (IYZWSv2 imzalama, Web Crypto)
  db.ts             Sunucu tarafı Supabase erişimi (service role)
  pages/            Home, Storefront, Checkout, OrderDone, Panel, NewShop
  components/       ShopLayout (dükkan kabuğu), QtyControl, AuthForm
supabase/
  migrations/       Veritabanı şeması, RLS kuralları, place_order vb.
```

## Bilinen eksikler / sıradaki adımlar

1. **iyzico Pazaryeri:** tüm ödemeler platformun tek iyzico hesabına düşer, esnafa ödemeyi siz yaparsınız.
   Paranın doğrudan esnafa bölünmesi için iyzico Pazaryeri sözleşmesi ve her esnafın alt üye işyeri
   (IBAN, TCKN/VKN) kaydı gerekir.
2. **Sahte sipariş koruması:** `place_order` herkese açık; hız sınırı / CAPTCHA (ör. Cloudflare Turnstile) eklenmeli.
3. **SMS ile giriş / bildirim:** esnaf girişi e-posta + şifre. SMS OTP için Supabase'e bir SMS sağlayıcısı
   (Twilio, Netgsm vb.) bağlanabilir; yeni siparişte esnafa SMS/WhatsApp bildirimi de gönderilebilir.
4. Ürün fotoğrafı yükleme (Supabase Storage; şu an emoji kullanılıyor).
5. Dükkan başına özel alan adı (`yildizfirini.com` → ilgili dükkan).
6. KVKK aydınlatma metni ve mesafeli satış sözleşmesi sayfaları (canlıya almadan önce hukuken gerekli).
