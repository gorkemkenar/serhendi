from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .defaults import load_defaults
from .models import SecurityAuditLog, Transaction, Unit, User
from .security import get_totp_token


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class OwaspTop10SecurityTests(TestCase):
    def setUp(self):
        cache.clear()
        load_defaults()
        self.client = APIClient()

    def test_1_broken_access_control_idor_blocked(self):
        """1. Kırık Erişim Kontrolü: Birim gözlemcisi (merkez / BRM-01) başka birimi (BRM-02) göremez."""
        res = self.client.post('/api/auth/login/', {'username': 'merkez', 'password': 'Serhendi!Mrk01'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {res.data['token']}")

        # Doğrudan başka birimin URL'sine erişim 404 dönmeli ve IDOR_BLOCKED logu üretilmeli
        detail_res = self.client.get('/api/units/BRM-02/')
        self.assertEqual(detail_res.status_code, 404)
        self.assertTrue(SecurityAuditLog.objects.filter(action='IDOR_BLOCKED').exists())

        # Başka birimin hareketlerini ?unit=BRM-02 ile sorgulama boş dönmeli
        tx_res = self.client.get('/api/transactions/?unit=BRM-02')
        self.assertEqual(tx_res.status_code, 200)
        self.assertEqual(len(tx_res.data), 0)
        self.assertTrue(SecurityAuditLog.objects.filter(action='IDOR_QUERY_BLOCKED').exists())

    def test_2_cryptographic_failures_phone_encrypted_at_rest(self):
        """2. Kriptografik Hatalar: Telefon numaraları veritabanında şifreli saklanır, genel gözlemcide maskelenir."""
        unit = Unit.objects.get(pk='BRM-01')
        self.assertTrue(unit.phone.startswith('enc:v1:'))
        self.assertEqual(unit.plain_phone, '0532 101 01 01')
        self.assertIn('***', unit.masked_phone)

    def test_3_injection_blocked_on_login(self):
        """3. Enjeksiyon: admin' OR '1'='1 girişimi engellenir ve kritik alarm üretilir."""
        res = self.client.post(
            '/api/auth/login/',
            {'username': "admin' OR '1'='1", 'password': 'x'},
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertTrue(SecurityAuditLog.objects.filter(action='SQL_INJECTION_BLOCKED', severity='CRITICAL').exists())

    def test_4_insecure_design_bruteforce_lockout(self):
        """4. Güvensiz Tasarım: 5 ardışık hatalı şifre denemesinde hesap kilitlenir."""
        for _ in range(5):
            res = self.client.post('/api/auth/login/', {'username': 'genel', 'password': 'wrongpassword'}, format='json')
        self.assertEqual(res.status_code, 429)
        user = User.objects.get(username='genel')
        self.assertIsNotNone(user.locked_until)
        self.assertTrue(SecurityAuditLog.objects.filter(action='ACCOUNT_LOCKED_BRUTEFORCE').exists())

    def test_5_security_misconfiguration_headers(self):
        """5. Güvenlik Yanlış Yapılandırması: Yanıtlarda güvenlik başlıkları bulunur."""
        res = self.client.post('/api/auth/login/', {'username': 'admin', 'password': 'Serhendi!Admin26'}, format='json')
        self.assertEqual(res['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(res['X-Frame-Options'], 'DENY')
        self.assertIn("default-src 'self'", res['Content-Security-Policy'])

    def test_7_auth_failures_strong_password_and_2fa(self):
        """7. Kimlik Doğrulama: Basit şifreler reddedilir ve 2FA (TOTP) doğrulaması çalışır."""
        res = self.client.post('/api/auth/login/', {'username': 'admin', 'password': 'Serhendi!Admin26'}, format='json')
        admin_id = res.data['user']['id']
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {res.data['token']}")

        # Basit şifre (123456) reddedilmeli
        weak_res = self.client.post(f'/api/users/{admin_id}/set-password/', {'password': '123456'}, format='json')
        self.assertEqual(weak_res.status_code, 400)

        # Güçlü şifre kabul edilmeli
        strong_res = self.client.post(f'/api/users/{admin_id}/set-password/', {'password': 'Serhendi2026!'}, format='json')
        self.assertEqual(strong_res.status_code, 200)

        # 2FA kurulumu ve doğrulaması
        setup = self.client.get('/api/auth/2fa/')
        secret = setup.data['secret']
        code = get_totp_token(secret)
        enable_res = self.client.post('/api/auth/2fa/', {'action': 'enable', 'code': code}, format='json')
        self.assertEqual(enable_res.status_code, 200)
        self.assertTrue(enable_res.data['enabled'])

        # 2FA aktifken kodsuz giriş requires2FA dönmeli
        step1 = self.client.post('/api/auth/login/', {'username': 'admin', 'password': 'Serhendi2026!'}, format='json')
        self.assertTrue(step1.data.get('requires2FA'))

        # 2FA koduyla giriş başarılı olmalı
        step2 = self.client.post(
            '/api/auth/login/',
            {'username': 'admin', 'password': 'Serhendi2026!', 'otpCode': get_totp_token(secret)},
            format='json',
        )
        self.assertIn('token', step2.data)

    def test_8_data_integrity_hmac_chain(self):
        """8. Veri Bütünlüğü: Cari hareketlerin HMAC-SHA256 imzaları doğrulanır, müdahale tespit edilir."""
        res = self.client.post('/api/auth/login/', {'username': 'admin', 'password': 'Serhendi!Admin26'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {res.data['token']}")

        check1 = self.client.post('/api/security/verify-integrity/', {}, format='json')
        self.assertTrue(check1.data['intact'])

        # Veritabanında imza güncellenmeden tutar değiştirilirse (tampering) yakalanmalı
        Transaction.objects.filter(pk='HRK-1001').update(debt=999999)
        check2 = self.client.post('/api/security/verify-integrity/', {}, format='json')
        self.assertFalse(check2.data['intact'])
        self.assertEqual(len(check2.data['tampered']), 1)

    def test_10_ssrf_protection_blocks_localhost_and_allows_whitelist(self):
        """10. SSRF: localhost ve iç ağ IP'leri engellenir, beyaz listedeki HTTPS adresine izin verilir."""
        res = self.client.post('/api/auth/login/', {'username': 'admin', 'password': 'Serhendi!Admin26'}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {res.data['token']}")

        bad1 = self.client.post(
            '/api/security/validate-url/',
            {'url': 'http://localhost/gizli-sunucu-ayarlari'},
            format='json',
        )
        self.assertEqual(bad1.status_code, 400)

        bad2 = self.client.post(
            '/api/security/validate-url/',
            {'url': 'https://127.0.0.1/admin'},
            format='json',
        )
        self.assertEqual(bad2.status_code, 400)

        good = self.client.post(
            '/api/security/validate-url/',
            {'url': 'https://belge.serhendi.org.tr/dekont-1001.pdf'},
            format='json',
        )
        self.assertEqual(good.status_code, 200)
        self.assertTrue(good.data['valid'])

    def test_11_self_password_change_and_health_check(self):
        """Gözlemci kendi şifresini değiştirebilir ve sağlık kontrolü (health check) çalışır."""
        health = self.client.get('/api/health/')
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.data['status'], 'ok')

        res = self.client.post('/api/auth/login/', {'username': 'genel', 'password': 'Serhendi!Gnl26'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {res.data['token']}")

        # Gözlemci (genel) güvenlik ve kullanıcı/rol yönetimi uç noktalarını göremez (403)
        sec_forbidden = self.client.get('/api/security/overview/')
        self.assertEqual(sec_forbidden.status_code, 403)
        users_forbidden = self.client.get('/api/users/')
        self.assertEqual(users_forbidden.status_code, 403)

        # Hatalı mevcut şifre reddedilmeli
        bad_curr = self.client.post(
            '/api/auth/change-password/',
            {'currentPassword': '0000', 'newPassword': 'Serhendi2026!'},
            format='json',
        )
        self.assertEqual(bad_curr.status_code, 400)

        # Doğru mevcut şifre + güçlü yeni şifre kabul edilmeli
        ok_change = self.client.post(
            '/api/auth/change-password/',
            {'currentPassword': 'Serhendi!Gnl26', 'newPassword': 'Serhendi2026!'},
            format='json',
        )
        self.assertEqual(ok_change.status_code, 200)
        self.assertFalse(ok_change.data['user']['mustChangePassword'])

    def test_12_role_hierarchy_enforcement(self):
        """Rol Hiyerarşisi:
        - Yönetici (yonetici) gözlemcilere rol atayabilir (viewer_all <-> viewer_unit).
        - Yönetici (yonetici) kimseye Yönetici (admin) rolü atayamaz ve Baş Yöneticiyi (admin) veya başka bir yöneticiyi kontrol edemez.
        - Baş Yönetici (admin) hem yöneticileri hem de gözlemcileri kontrol edebilir ve Yönetici rolü atayabilir.
        """
        admin_user = User.objects.get(username='admin')
        yonetici_user = User.objects.get(username='yonetici')
        genel_user = User.objects.get(username='genel')

        # 1) Yönetici (yonetici) ile giriş yap
        res_ynt = self.client.post('/api/auth/login/', {'username': 'yonetici', 'password': 'Serhendi!Ynt26'}, format='json')
        self.assertEqual(res_ynt.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {res_ynt.data['token']}")

        # Yönetici, genel gözlemciyi birim gözlemcisi (BRM-02) yapabilir
        assign_ok = self.client.post(
            f'/api/users/{genel_user.id}/assign-role/',
            {'role': 'viewer_unit', 'unitId': 'BRM-02'},
            format='json',
        )
        self.assertEqual(assign_ok.status_code, 200)
        self.assertEqual(assign_ok.data['role'], 'viewer_unit')
        self.assertEqual(assign_ok.data['unitId'], 'BRM-02')

        # Yönetici, gözlemciye Yönetici (admin) rolü ATAYAMAZ (403)
        assign_forbidden = self.client.post(
            f'/api/users/{genel_user.id}/assign-role/',
            {'role': 'admin'},
            format='json',
        )
        self.assertEqual(assign_forbidden.status_code, 403)

        # Yönetici, Baş Yöneticinin (admin) şifresini değiştiremez (403)
        pwd_forbidden = self.client.post(
            f'/api/users/{admin_user.id}/set-password/',
            {'password': 'YeniSifre2026!'},
            format='json',
        )
        self.assertEqual(pwd_forbidden.status_code, 403)

        # 2) Baş Yönetici (admin) ile giriş yap -> Yöneticiyi ve tüm rolleri kontrol edebilir
        res_adm = self.client.post('/api/auth/login/', {'username': 'admin', 'password': 'Serhendi!Admin26'}, format='json')
        self.assertEqual(res_adm.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {res_adm.data['token']}")

        # Baş Yönetici, gözlemciye Yönetici (admin) rolü atayabilir
        promote_res = self.client.post(
            f'/api/users/{genel_user.id}/assign-role/',
            {'role': 'admin'},
            format='json',
        )
        self.assertEqual(promote_res.status_code, 200)
        self.assertEqual(promote_res.data['role'], 'admin')

        # Baş Yönetici, yönetici (yonetici) hesabının rolünü/şifresini kontrol edebilir
        ynt_pwd = self.client.post(
            f'/api/users/{yonetici_user.id}/set-password/',
            {'password': 'Serhendi!Ynt99'},
            format='json',
        )
        self.assertEqual(ynt_pwd.status_code, 200)
