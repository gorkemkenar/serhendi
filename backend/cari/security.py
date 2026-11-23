"""OWASP Top 10 (1-10) güvenlik adımları: şifreleme, TOTP 2FA, bütünlük imzası, SSRF/Enjeksiyon filtreleri ve denetim kaydı."""
import base64
import hashlib
import hmac
import ipaddress
import os
import re
import socket
import struct
import time
from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

# --- 2. KRİPTOGRAFİK HATALAR (Cryptographic Failures): Hassas Veri Şifreleme & Maskeleme ---
ENC_PREFIX = 'enc:v1:'


def _derive_key(purpose: str) -> bytes:
    secret = (getattr(settings, 'SECRET_KEY', '') or 'serhendi-default-key').encode('utf-8')
    return hashlib.sha256(secret + b':' + purpose.encode('utf-8')).digest()


def _keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < length:
        block = hmac.new(key, nonce + struct.pack('>I', counter), hashlib.sha256).digest()
        out.extend(block)
        counter += 1
    return bytes(out[:length])


def encrypt_sensitive(plaintext: str) -> str:
    """Hassas veriyi (telefon, kart/IBAN notu vb.) SHA-256 CTR + HMAC-SHA256 (AEAD) ile şifreler."""
    val = (plaintext or '').strip()
    if not val or val == '-' or val.startswith(ENC_PREFIX):
        return val or '-'
    enc_key = _derive_key('field-encryption-256')
    mac_key = _derive_key('field-mac-256')
    nonce = os.urandom(16)
    raw = val.encode('utf-8')
    stream = _keystream(enc_key, nonce, len(raw))
    cipher = bytes(a ^ b for a, b in zip(raw, stream))
    tag = hmac.new(mac_key, nonce + cipher, hashlib.sha256).digest()[:16]
    payload = base64.urlsafe_b64encode(nonce + tag + cipher).decode('ascii')
    return f'{ENC_PREFIX}{payload}'


def decrypt_sensitive(stored: str) -> str:
    """Şifrelenmiş hassas veriyi HMAC doğrulaması yaparak çözer."""
    if not stored or not stored.startswith(ENC_PREFIX):
        return stored or '-'
    try:
        raw_blob = base64.urlsafe_b64decode(stored[len(ENC_PREFIX):].encode('ascii'))
        nonce, tag, cipher = raw_blob[:16], raw_blob[16:32], raw_blob[32:]
        enc_key = _derive_key('field-encryption-256')
        mac_key = _derive_key('field-mac-256')
        expected_tag = hmac.new(mac_key, nonce + cipher, hashlib.sha256).digest()[:16]
        if not hmac.compare_digest(tag, expected_tag):
            return '[ŞİFRE BÜTÜNLÜK HATASI]'
        stream = _keystream(enc_key, nonce, len(cipher))
        plain = bytes(a ^ b for a, b in zip(cipher, stream))
        return plain.decode('utf-8')
    except Exception:
        return '[ÇÖZÜLEMEDİ]'


def mask_phone(phone: str) -> str:
    """Yetkisiz/gözlemci görünümlerinde telefon numarasının ortasını maskeler."""
    plain = decrypt_sensitive(phone)
    if not plain or plain == '-' or len(plain) < 7:
        return plain or '-'
    digits = re.sub(r'\D', '', plain)
    if len(digits) >= 10:
        return f'{digits[:4]} *** ** {digits[-2:]}'
    return plain[:3] + '***' + plain[-2:]


# --- 3. ENJEKSİYON (Injection): SQL / Komut / XSS / CSV Formül Enjeksiyonu Koruması ---
INJECTION_PATTERNS = [
    re.compile(r"(?i)(\b(union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set|xp_cmdshell)\b)"),
    re.compile(r"(?i)('|\")\s*or\s*('|\")?\d+('|\")?\s*=\s*('|\")?\d+"),
    re.compile(r"(?i)(--\s|;\s*(drop|select|insert|delete|update)\b|/\*.*?\*/)"),
    re.compile(r"(?i)(<script\b|javascript:|onerror\s*=|onload\s*=|<iframe\b)"),
]

CSV_FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')


def detect_injection(value: str) -> str | None:
    """Metin içinde bilinen SQLi / XSS / Komut enjeksiyonu kalıbı varsa eşleşen kuralı döner."""
    if not value or not isinstance(value, str):
        return None
    for pat in INJECTION_PATTERNS:
        m = pat.search(value)
        if m:
            return m.group(0)
    return None


def sanitize_text_input(value: str, field_label: str = 'Alan', neutralize_csv: bool = True) -> str:
    """Enjeksiyon kalıplarını reddeder ve CSV formül enjeksiyonunu etkisizleştirir."""
    val = (value or '').strip()
    hit = detect_injection(val)
    if hit:
        raise DRFValidationError(
            f'{field_label} içinde güvenlik politikasına aykırı ifade tespit edildi (Enjeksiyon Koruması).'
        )
    if neutralize_csv and val.startswith(CSV_FORMULA_PREFIXES) and not re.match(r'^-[0-9]', val):
        val = "'" + val
    return val


# --- 5. GÜVENLİK YANLIŞ YAPILANDIRMASI (Security Misconfiguration): Güvenlik Başlıkları, CORS & Hata Gizleme ---
class SecurityHeadersMiddleware:
    """Tüm yanıtlara sıkı HTTP güvenlik başlıkları ve Vercel <-> Render CORS başlıklarını ekler."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from django.http import HttpResponse

        origin = request.META.get('HTTP_ORIGIN', '')
        allowed_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        allow_all = '*' in allowed_origins
        origin_allowed = bool(
            origin
            and (
                allow_all
                or origin in allowed_origins
                or origin.endswith('.vercel.app')
                or origin.startswith('http://localhost:')
                or origin.startswith('http://127.0.0.1:')
            )
        )

        if request.method == 'OPTIONS' and origin_allowed:
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        if origin_allowed:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, Accept, X-Requested-With'
            response['Vary'] = 'Origin'

        response.setdefault('X-Content-Type-Options', 'nosniff')
        response.setdefault('X-Frame-Options', 'DENY')
        response.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.setdefault('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
        response.setdefault(
            'Content-Security-Policy',
            "default-src 'self'; connect-src 'self' https:; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
        )
        if request.path.startswith('/api/'):
            response.setdefault('Cache-Control', 'no-store, no-cache, must-revalidate, private')
        return response


def custom_exception_handler(exc, context):
    """Üretimde/API'de detaylı yığın izlerini (stack trace) gizler, güvenli mesaj döner."""
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response
    request = context.get('request')
    log_security_event(
        action='SYSTEM_ERROR',
        severity='WARNING',
        request=request,
        description='Beklenmeyen sunucu hatası yakalandı ve detayları istemciden gizlendi.',
        metadata={'error_type': exc.__class__.__name__},
    )
    return Response(
        {'detail': 'İşlem sırasında beklenmeyen bir hata oluştu. Teknik detaylar güvenlik amacıyla gizlenmiştir.'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


# --- 7. KİMLİK DOĞRULAMA HATALARI (Identification & Auth Failures): Güçlü Şifre & TOTP 2FA ---
WEAK_PASSWORDS = {
    '1234', '12345', '123456', '12345678', '1111', '0000', 'admin', 'password', 'qwerty', 'serhendi', 'admin123'
}


def validate_strong_password(password: str, username: str = '') -> None:
    """Yeni şifrelerde zayıf/varsayılan şifreleri engeller, karmaşıklık zorunlu kılar."""
    pwd = (password or '').strip()
    if len(pwd) < 8:
        raise DRFValidationError('Güçlü şifre politikası: Şifre en az 8 karakter olmalıdır.')
    if pwd.lower() in WEAK_PASSWORDS:
        raise DRFValidationError('Bu şifre çok yaygın/tahmin edilebilir olduğu için güvenlik politikasınca engellendi.')
    if username and username.lower() in pwd.lower():
        raise DRFValidationError('Şifre, kullanıcı adını içeremez.')
    has_upper = any(c.isupper() for c in pwd)
    has_lower = any(c.islower() for c in pwd)
    has_digit = any(c.isdigit() for c in pwd)
    if not (has_upper and has_lower and has_digit):
        raise DRFValidationError('Şifre en az 1 büyük harf, 1 küçük harf ve 1 rakam içermelidir.')


class StrongPasswordValidator:
    """Django AUTH_PASSWORD_VALIDATORS uyumlu güçlü şifre doğrulayıcı."""

    def validate(self, password, user=None):
        try:
            validate_strong_password(password, getattr(user, 'username', '') or '')
        except DRFValidationError as exc:
            detail = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
            raise ValidationError(detail)

    def get_help_text(self):
        return 'Şifreniz en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermelidir.'


def generate_totp_secret() -> str:
    return base64.b32encode(os.urandom(20)).decode('ascii').rstrip('=')


def get_totp_token(secret: str, timestamp: int | None = None, step: int = 30) -> str:
    """RFC 6238 uyumlu 6 haneli TOTP kodu üretir."""
    if not secret:
        return ''
    ts = int(time.time() if timestamp is None else timestamp)
    counter = ts // step
    padded = secret.upper() + '=' * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(padded.encode('ascii'))
    msg = struct.pack('>Q', counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f'{code:06d}'


def verify_totp_token(secret: str, code: str, window: int = 1) -> bool:
    """±1 zaman penceresi (30sn) toleransıyla 6 haneli 2FA kodunu doğrular."""
    clean = re.sub(r'\s+', '', str(code or ''))
    if not secret or not clean.isdigit() or len(clean) != 6:
        return False
    now = int(time.time())
    for offset in range(-window, window + 1):
        if hmac.compare_digest(get_totp_token(secret, now + offset * 30), clean):
            return True
    return False


# --- 8. VERİ BÜTÜNLÜĞÜ HATALARI (Software & Data Integrity Failures): HMAC-SHA256 Dijital İmza ---
def compute_transaction_hash(tx, prev_hash: str = 'GENESIS') -> str:
    """Cari hareketin tüm kritik alanları ve önceki zincir özeti üzerinden HMAC-SHA256 imzası üretir."""
    key = _derive_key('transaction-integrity-hmac')
    payload = '|'.join([
        str(tx.id),
        str(tx.date),
        str(tx.unit_id),
        str(tx.type),
        str(tx.description or ''),
        f'{tx.debt:.2f}' if hasattr(tx.debt, '__format__') else str(tx.debt),
        f'{tx.credit:.2f}' if hasattr(tx.credit, '__format__') else str(tx.credit),
        str(tx.created_by or ''),
        str(prev_hash or 'GENESIS'),
    ])
    return hmac.new(key, payload.encode('utf-8'), hashlib.sha256).hexdigest()


# --- 10. SUNUCU TARAFLI İSTEK SAHTECİLİĞİ (SSRF): Katı Beyaz Liste ve İç Ağ Engeli ---
ALLOWED_EXTERNAL_DOMAINS = {
    'belge.serhendi.org.tr',
    'arsiv.serhendi.org.tr',
    'cdn.serhendi.org.tr',
    'gib.gov.tr',
    'earsivportal.efatura.gov.tr',
}

BLOCKED_HOSTNAMES = {
    'localhost',
    'localhost.localdomain',
    'metadata.google.internal',
    '169.254.169.254',
    '0.0.0.0',
    'ip6-localhost',
}


def validate_safe_external_url(raw_url: str, resolve_dns: bool = False) -> dict:
    """Kullanıcıdan gelen URL'yi SSRF'e karşı doğrular: iç ağ, localhost, metadata ve beyaz liste dışı alan adlarını reddeder."""
    url = (raw_url or '').strip()
    if not url:
        return {'valid': True, 'url': '', 'host': '', 'reason': 'Boş URL'}

    parsed = urlparse(url)
    if parsed.scheme != 'https':
        raise DRFValidationError('SSRF Koruması: Yalnızca güvenli HTTPS protokolüne sahip bağlantılara izin verilir.')

    host = (parsed.hostname or '').lower().strip('.')
    if not host:
        raise DRFValidationError('SSRF Koruması: Geçerli bir alan adı belirtilmedi.')

    if parsed.username or parsed.password:
        raise DRFValidationError('SSRF Koruması: URL içinde kimlik bilgisi (@) kullanımına izin verilmez.')

    if host in BLOCKED_HOSTNAMES or host.endswith('.local') or host.endswith('.internal'):
        raise DRFValidationError(f'SSRF Koruması: İç ağ veya yerel sunucu adresine ({host}) erişim engellendi.')

    # Doğrudan IP adresi yazılmışsa özel/loopback/link-local kontrolü yap
    try:
        ip_obj = ipaddress.ip_address(host)
        if (
            ip_obj.is_private
            or ip_obj.is_loopback
            or ip_obj.is_link_local
            or ip_obj.is_multicast
            or ip_obj.is_reserved
            or ip_obj.is_unspecified
        ):
            raise DRFValidationError(f'SSRF Koruması: İç ağ IP adresine ({ip_obj}) erişim kesinlikle yasaktır.')
        raise DRFValidationError('SSRF Koruması: Doğrudan IP adresi yerine yalnızca beyaz listedeki alan adları kullanılabilir.')
    except ValueError:
        pass

    if host not in ALLOWED_EXTERNAL_DOMAINS:
        allowed_str = ', '.join(sorted(ALLOWED_EXTERNAL_DOMAINS))
        raise DRFValidationError(
            f'SSRF Koruması: "{host}" güvenilir beyaz listede (whitelist) değil. İzin verilenler: {allowed_str}'
        )

    if parsed.port not in (None, 443):
        raise DRFValidationError('SSRF Koruması: Standart dışı port (443 harici) erişimi engellendi.')

    if resolve_dns:
        try:
            infos = socket.getaddrinfo(host, 443)
            for info in infos:
                resolved_ip = ipaddress.ip_address(info[4][0])
                if resolved_ip.is_private or resolved_ip.is_loopback or resolved_ip.is_link_local:
                    raise DRFValidationError(f'SSRF Koruması: Alan adı iç ağ IP adresine ({resolved_ip}) çözümlendi.')
        except socket.gaierror:
            pass

    return {'valid': True, 'url': url, 'host': host, 'reason': 'Beyaz liste ve iç ağ kontrolünden geçti.'}


# --- 9. İZLEME VE LOGLAMA HATALARI (Security Logging & Monitoring Failures) ---
def get_client_ip(request) -> str:
    if request is None:
        return '127.0.0.1'
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR') or '127.0.0.1'


def log_security_event(
    action: str,
    severity: str = 'INFO',
    request=None,
    user=None,
    username: str = '',
    description: str = '',
    metadata: dict | None = None,
):
    """Kritik işlemleri ve şüpheli hareketleri veritabanına kaydeder."""
    try:
        from .models import SecurityAuditLog

        actor = user
        if actor is None and request is not None and getattr(request, 'user', None) and request.user.is_authenticated:
            actor = request.user
        uname = username or (actor.username if actor else 'anonim')
        ip_addr = get_client_ip(request)
        path = getattr(request, 'path', '') or ''
        return SecurityAuditLog.objects.create(
            action=action,
            severity=severity,
            username=uname,
            ip_address=ip_addr,
            path=path[:255],
            description=description[:500],
            metadata=metadata or {},
        )
    except Exception:
        return None
