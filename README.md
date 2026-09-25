# 🏪 Esnaf Çarşı

Mahalle esnafı için çok dükkanlı e-ticaret platformu. Her esnaf (fırın, manav, kasap, balıkçı,
kırtasiye, çiçekçi…) dakikalar içinde kendi markalı online dükkanını açar; siparişler esnaf
paneline ve WhatsApp'a düşer.

## Özellikler

**Müşteri tarafı**
- Çarşı ana sayfası: dükkan arama, esnaf türüne göre filtreleme
- Her dükkana özel site (`#/<dukkan-adi>`): kendi rengi, simgesi, çalışma saatleri, teslimat bilgisi
- Ürün kategorileri, arama, stok durumu ("Tükendi")
- Kilo / litre için 0,5 hassasiyetinde, adet / demet / paket için tam sayı miktar
- Sepet, minimum sipariş tutarı, teslimat ücreti ve "X TL üzeri ücretsiz teslimat"
- Ödeme sayfası: adrese teslim veya gel-al; kapıda nakit, kapıda kart, havale
- Sipariş onayı + tek tıkla **WhatsApp ile esnafa gönder** (hazır sipariş mesajı)

**Esnaf tarafı** (`#/<dukkan-adi>/panel`, PIN ile giriş)
- Siparişler: bekleyen / bugünkü sipariş / bugünkü ciro, sipariş durumu güncelleme
  (yeni → hazırlanıyor → yolda → teslim edildi / iptal)
- Ürünler: ekle, düzenle, sil, stok aç/kapat
- Dükkan ayarları: ad, slogan, renk, WhatsApp, adres, saatler, teslimat ücreti, minimum sipariş, PIN
- **Dükkanını Aç** (`#/dukkan-ac`): yeni esnaf kaydı, isteğe bağlı hazır örnek ürünlerle başlama

## Çalıştırma

```bash
npm install
npm run dev       # geliştirme sunucusu
npm run build     # dist/ klasörüne statik çıktı
npm run preview   # build'i önizle
```

Çıktı tamamen statiktir (hash tabanlı yönlendirme, `base: './'`); GitHub Pages, Netlify vb.
herhangi bir statik barındırmaya doğrudan yüklenebilir.

Demo dükkanların panel PIN'i: **1234**. Ana sayfanın altındaki "Demo verilerini sıfırla" ile
başlangıç verilerine dönülür.

## Online ödeme (iyzico)

Ödeme sayfasında **"Online kredi / banka kartı (iyzico)"** seçeneği var. Müşteri iyzico'nun
güvenli ödeme sayfasına yönlenir (kart bilgisi bu siteye hiç gelmez), 3D Secure ve taksit
(1/2/3/6) iyzico tarafında yapılır. Dönüşte sonuç sunucu tarafında iyzico'ya sorularak
doğrulanır; tarayıcı "ödendi" kararını kendisi vermez.

iyzico'nun gizli anahtarı tarayıcıya konamayacağı için bu kısım `api/odeme/` altındaki
sunucusuz fonksiyonlarla çalışır:

| Uç nokta | Görevi |
|---|---|
| `GET  /api/odeme/durum` | Online ödeme açık mı / test modunda mı |
| `POST /api/odeme/baslat` | iyzico Checkout Form oluşturur, ödeme sayfası adresini döner |
| `POST /api/odeme/sonuc` | iyzico'nun geri dönüş adresi (callbackUrl), müşteriyi sipariş sayfasına yollar |
| `GET  /api/odeme/dogrula` | Token'ı iyzico'ya sorup gerçek ödeme sonucunu döner |

Anahtarlar tanımlı değilse (ör. GitHub Pages'te) kart seçeneği otomatik gizlenir; kapıda
ödeme ve havale çalışmaya devam eder.

## Yayına alma (Vercel — iyzico ile)

1. [vercel.com](https://vercel.com)'a GitHub ile girin → **Add New → Project** → bu repoyu seçin.
   Vite otomatik tanınır (build: `npm run build`, çıktı: `dist`), `api/` fonksiyonları da otomatik yayınlanır.
2. **Settings → Environment Variables**'a `.env.example` içindeki değişkenleri girin:
   - Önce test: [sandbox-merchant.iyzipay.com](https://sandbox-merchant.iyzipay.com)'dan ücretsiz sandbox
     hesabı açın, API anahtarlarını girin, `IYZICO_BASE_URL=https://sandbox-api.iyzipay.com`.
     Test kartı: `5528 7900 0000 0008`, SKT ileri bir tarih, CVC `123`.
   - Canlı: iyzico üye işyeri başvurusu onaylanınca canlı anahtarları girin ve
     `IYZICO_BASE_URL=https://api.iyzipay.com` yapın.
3. Değişkenleri girdikten sonra **Redeploy**.

Yerel geliştirme için fonksiyonlarla birlikte: `npx vercel dev` (sadece arayüz için `npm run dev` yeterli).

`.github/workflows/deploy.yml` ayrıca GitHub Pages'e yayın yapar; orada online ödeme olmaz.

## Mimari

React 19 + TypeScript + Vite, React Router (HashRouter).

```
src/
  types.ts          Shop, Product, Order modelleri
  data/seed.ts      6 örnek dükkan ve ürünleri
  store.tsx         Uygulama durumu (dükkanlar, sepetler, siparişler) + localStorage kalıcılığı
  whatsapp.ts       WhatsApp sipariş mesajı ve wa.me bağlantısı
  payment.ts        Arayüzün iyzico fonksiyonlarıyla konuşan kısmı
api/
  _lib/iyzico.ts    iyzico REST istemcisi (IYZWSv2 imzalama)
  odeme/*.ts        Sunucusuz ödeme fonksiyonları (Vercel)
  pages/            Home, Storefront, Checkout, OrderDone, Panel, NewShop
  components/       ShopLayout (dükkan kabuğu), QtyControl
```

## Önemli not: bu bir MVP / demo

Tüm veriler **tarayıcının localStorage'ında** tutulur; yani siparişler yalnızca aynı tarayıcıda
görünür ve panel PIN'i gerçek bir güvenlik sağlamaz. Canlıya almak için sıradaki adımlar:

1. `store.tsx` içindeki işlemleri bir API'ye (ör. Supabase / Firebase / kendi backend'iniz) taşımak
2. Esnaf girişi için gerçek kimlik doğrulama (SMS/OTP)
3. **Fiyatların sunucuda doğrulanması:** ürün kataloğu şu an tarayıcıda olduğu için `baslat` fonksiyonu
   tutarı istekten alıyor. Veritabanına geçildiğinde fiyatlar orada, sunucu tarafında hesaplanmalı.
   O zamana kadar ödenen tutarı iyzico panelinden ve esnaf panelindeki "Ödendi ₺…" etiketinden kontrol edin.
4. Ürün fotoğrafı yükleme (şu an emoji kullanılıyor)
5. Dükkan başına özel alan adı (`yildizfirini.com` → ilgili dükkan)
6. **iyzico Pazaryeri:** şu an tüm ödemeler platformun tek iyzico hesabına düşer ve esnafa
   ödemeyi siz yaparsınız. Paranın doğrudan esnafa bölünmesi için iyzico Pazaryeri sözleşmesi ve
   her esnafın alt üye işyeri (IBAN, TCKN/VKN) olarak kaydı gerekir.
