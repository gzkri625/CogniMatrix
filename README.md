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

## Mimari

React 19 + TypeScript + Vite, React Router (HashRouter).

```
src/
  types.ts          Shop, Product, Order modelleri
  data/seed.ts      6 örnek dükkan ve ürünleri
  store.tsx         Uygulama durumu (dükkanlar, sepetler, siparişler) + localStorage kalıcılığı
  whatsapp.ts       WhatsApp sipariş mesajı ve wa.me bağlantısı
  pages/            Home, Storefront, Checkout, OrderDone, Panel, NewShop
  components/       ShopLayout (dükkan kabuğu), QtyControl
```

## Önemli not: bu bir MVP / demo

Tüm veriler **tarayıcının localStorage'ında** tutulur; yani siparişler yalnızca aynı tarayıcıda
görünür ve panel PIN'i gerçek bir güvenlik sağlamaz. Canlıya almak için sıradaki adımlar:

1. `store.tsx` içindeki işlemleri bir API'ye (ör. Supabase / Firebase / kendi backend'iniz) taşımak
2. Esnaf girişi için gerçek kimlik doğrulama (SMS/OTP)
3. Online ödeme (iyzico, PayTR vb.)
4. Ürün fotoğrafı yükleme (şu an emoji kullanılıyor)
5. Dükkan başına özel alan adı (`yildizfirini.com` → ilgili dükkan)
