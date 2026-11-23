# SİLİVRİ SERHENDİ – Birim & Cari Takip Sistemi

Django REST API (SQLite / ORM) + React (Vite + Tailwind CSS) tabanlı, **OWASP Top 10 (1–10)** güvenlik adımlarıyla donatılmış ve tek sunucudan yayınlamaya (deployment) hazır Birim & Cari Takip Sistemi.

```
Serhendi/
├── backend/                  Django projesi (API + SPA sunucusu)
│   ├── config/               Ayarlar (.env destekli) & URL'ler (SPA fallback dahil)
│   └── cari/                 Modeller, OWASP Top 10 güvenlik motoru, API & testler
├── frontend/                 React 19 + Vite 6 + Tailwind 4 arayüzü (PWA destekli)
│   ├── public/               Manifest, ikon ve PWA Service Worker (sw.js)
│   └── src/
│       ├── App.jsx           Ana uygulama (sekme, KPI, oturum, SHA-256 imzalı CSV)
│       ├── api.js            Django API istemcisi (Süreli Token + 2FA auth)
│       └── components/       Cariler, Hareketler, Ekstre, Kullanıcılar, Güvenlik & Denetim
├── .env.example              Yayınlama (Production) ortam değişkenleri şablonu
├── Procfile                  Linux/PaaS (Gunicorn) yayınlama tanımı
└── baslat.ps1                Tek komutla derleme, migrasyon ve sunucu başlatıcı
```

## 1) Tek Komutla Yayınlama / Çalıştırma (Önerilen)

React arayüzünü derleyip (`frontend/dist`), veritabanı migrasyonlarını uygulayarak hem arayüzü hem de API'yi tek bir adresten (`http://127.0.0.1:8000`) yayınlamak için:

```powershell
.\baslat.ps1
```

veya adım adım:

```powershell
npm.cmd --prefix frontend run build
.\.venv\Scripts\python.exe backend\manage.py migrate
.\.venv\Scripts\python.exe backend\manage.py seed_defaults
.\.venv\Scripts\python.exe backend\manage.py collectstatic --noinput
.\.venv\Scripts\python.exe backend\manage.py runserver 0.0.0.0:8000 --insecure
```

- **Uygulama & Arayüz:** http://127.0.0.1:8000/
- **REST API:** http://127.0.0.1:8000/api/
- **Sağlık Kontrolü (Health Check):** http://127.0.0.1:8000/api/health/
- **Django Yönetim Paneli:** http://127.0.0.1:8000/admin/

## 2) Geliştirme Modu (Ayrı Vite + Django)

Geliştirme sırasında canlı yenileme (HMR) kullanmak isterseniz:

```powershell
# Terminal 1 (Backend - Port 8000)
.\.venv\Scripts\python.exe backend\manage.py runserver

# Terminal 2 (Frontend - Port 5173)
cd frontend
npm.cmd run dev
```

## Rol Hiyerarşisi ve Güvenli Deneme Hesapları

Sistemde **4 kademeli sıkı bir Rol Hiyerarşisi** uygulanmaktadır:
1. **Seviye 4 – Baş Yönetici (`super_admin` / `admin`):** Tüm sistemi, carileri, hareketleri ve **Yönetici (`admin`)** hesapları dahil tüm kullanıcıları kontrol eder. Yalnızca Baş Yönetici başka bir hesaba **Yönetici** rolü atayabilir veya bir Yöneticiyi düzenleyip silebilir.
2. **Seviye 3 – Yönetici (`admin` / `yonetici`):** Carileri ve hareketleri yönetir; **Genel Gözlemci** ve **Birim Gözlemcisi** hesapları oluşturabilir, şifrelerini yenileyebilir ve onlara gözlemci rolleri/birimleri atayabilir. Baş Yöneticiyi veya başka bir Yöneticiyi kontrol edemez.
3. **Seviye 2 – Genel Gözlemci (`viewer_all`):** Tüm cari ve hareketleri salt okunur inceler (telefon numaraları maskelidir).
4. **Seviye 1 – Birim Gözlemcisi (`viewer_unit`):** Yalnızca kendisine atanan tek bir cari/birimin verilerini salt okunur görüntüler.

| Kullanıcı Adı | Güvenli Şifre | Hiyerarşi Seviyesi & Rol | Kapsam / Birim |
|---|---|---|---|
| `admin` | `Serhendi!Admin26` | **Seviye 4 • Baş Yönetici (Admin)** | Tam Sistem & Yönetici Kontrolü |
| `yonetici` | `Serhendi!Ynt26` | **Seviye 3 • Yönetici** | Cari & Gözlemci Rol Atama Yetkisi |
| `genel` | `Serhendi!Gnl26` | **Seviye 2 • Genel Gözlemci** | Tüm Birimler (Salt Okunur) |
| `merkez` | `Serhendi!Mrk01` | **Seviye 1 • Birim Gözlemcisi** | `BRM-01` – Merkez Dergah |
| `yenimahalle` | `Serhendi!Ynm02` | **Seviye 1 • Birim Gözlemcisi** | `BRM-02` – Yenimahalle Dergah |
| `kiptas2` | `Serhendi!Kpt03` | **Seviye 1 • Birim Gözlemcisi** | `BRM-03` – Kiptaş 2 Dergah |
| `mimarsinan` | `Serhendi!Mmr04` | **Seviye 1 • Birim Gözlemcisi** | `BRM-04` – Mimar Sinan Dergah |
| `maviyelken` | `Serhendi!Mvy05` | **Seviye 1 • Birim Gözlemcisi** | `BRM-05` – Mavi yelken Dergah |
| `gumusyaka` | `Serhendi!Gms06` | **Seviye 1 • Birim Gözlemcisi** | `BRM-06` – Gümüşyaka Dergah |
| `danamandira` | `Serhendi!Dnm07` | **Seviye 1 • Birim Gözlemcisi** | `BRM-07` – Danamandıra Dergah |
| `ilheyeti` | `Serhendi!Ilh08` | **Seviye 1 • Birim Gözlemcisi** | `BRM-08` – Silivri il heyeti |

> **Güvenlik Notu:** Canlıya almadan önce `.env.example` dosyasını `.env` olarak kopyalayıp `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS` değerlerini ayarlayın ve varsayılan şifreleri **Güvenlik & Denetim** veya **Kullanıcı & Şifre Yönetimi** sekmesinden güçlü şifrelerle güncelleyin.

## OWASP Top 10 (1–10) Güvenlik Özellikleri

1. **Kırık Erişim Kontrolü (Broken Access Control):** Sunucu tarafı rol ve birim izolasyonu (`has_object_permission`). Yetkisiz birim sorgularında (`IDOR`) erişim engellenir ve `CRITICAL` alarm üretilir.
2. **Kriptografik Hatalar (Cryptographic Failures):** Şifreler `PBKDF2-SHA256` ile özetlenir; birim telefon numaraları veritabanında **256-bit AEAD (`SHA-256 CTR + HMAC-SHA256`)** ile şifrelenir (`enc:v1:...`), genel gözlemcide maskelenir.
3. **Enjeksiyon (Injection):** Django parametrik ORM sorguları, `SQLi/XSS` güvenlik duvarı ve Excel/CSV formül enjeksiyonu koruması.
4. **Güvensiz Tasarım (Insecure Design):** API oran sınırlama (`Rate Limiting`) ve 5 ardışık başarısız girişte **15 dakika otomatik hesap kilitleme (Brute-Force koruması)**.
5. **Güvenlik Yanlış Yapılandırması (Security Misconfiguration):** `CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` başlıkları, teknik hata gizleyici ve varsayılan şifre denetimi.
6. **Güncel Olmayan Bileşenler (Vulnerable Components):** Harici eski PDF eklentisi olmadan yerel yazdırma motoru ve çalışma zamanı paket sürüm tarayıcısı.
7. **Kimlik Doğrulama Hataları (Identification & Auth Failures):** Güçlü şifre politikası (8+ karakter, büyük/küçük harf ve rakam), 24 saat süreli Token ve **RFC 6238 TOTP İki Adımlı Doğrulama (2FA)**.
8. **Veri Bütünlüğü Hataları (Software & Data Integrity Failures):** Her cari hareket için zincirleme **HMAC-SHA256 dijital imza** (`integrity_hash`) ve dışa aktarılan CSV dosyalarında `SHA-256 Checksum` mührü.
9. **İzleme ve Loglama Hataları (Security Logging & Monitoring Failures):** Tüm kritik işlemler ve engellenen saldırılar `SecurityAuditLog` tablosuna IP ve zaman damgasıyla kaydedilir.
10. **Sunucu Taraflı İstek Sahteciliği (SSRF):** Belge/dekont URL'leri katı `HTTPS` beyaz listesinden geçirilir; `localhost`, `127.0.0.1`, `169.254.169.254` ve özel iç ağ IP'leri engellenir.

## API Uç Noktaları

| Yöntem | Yol | Açıklama |
|---|---|---|
| GET | `/api/health/` | Sunucu sağlık kontrolü |
| POST | `/api/auth/login/` | Giriş (SQLi, Brute-Force kilidi ve 2FA TOTP destekli) → `{token, user}` |
| POST | `/api/auth/logout/` | Çıkış |
| GET | `/api/auth/me/` | Oturumdaki kullanıcı |
| POST | `/api/auth/change-password/` | Oturumdaki kullanıcının kendi şifresini güçlü şifreyle güncellemesi |
| GET/POST | `/api/auth/2fa/` | İki Adımlı Doğrulama (2FA - TOTP) kurulumu ve aktivasyonu |
| GET | `/api/security/overview/` | OWASP Top 10 (1–10) güvenlik adımları, bileşen taraması ve denetim logları |
| POST | `/api/security/verify-integrity/` | Cari hareketlerin HMAC-SHA256 dijital imza zinciri doğrulaması |
| POST | `/api/security/validate-url/` | SSRF beyaz liste ve iç ağ (`localhost` / özel IP) URL kontrolü |
| GET/POST | `/api/units/` | Cariler (telefonlar veritabanında şifreli, gözlemcide maskeli, IDOR korumalı) |
| PATCH/DELETE | `/api/units/{id}/` | Cari güncelle / sil (yönetici) |
| GET/POST | `/api/transactions/?unit=&type=&search=` | Cari hareketler (HMAC-SHA256 imzalı, SSRF korumalı belge URL'li) |
| PATCH/DELETE | `/api/transactions/{id}/` | Satır içi tarih, birim, tür, açıklama, tutar düzenleme / silme (yönetici) |
| GET/POST/PATCH/DELETE | `/api/users/` | Kullanıcı ve yetki yönetimi (yönetici) |
| POST | `/api/users/{id}/set-password/` | Güçlü şifre politikasıyla şifre belirle (yönetici) |
| POST | `/api/users/{id}/unlock/` | Brute-force kilitli hesabın kilidini aç (yönetici) |
| POST | `/api/reset-defaults/` | Varsayılan verileri yükle (yönetici) |
