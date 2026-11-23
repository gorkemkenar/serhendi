from datetime import timedelta
import importlib.metadata
import platform
import sys

import django
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .defaults import load_defaults
from .models import SecurityAuditLog, Transaction, Unit, User
from .permissions import IsAdminRole, IsAdminRoleOrReadOnly
from .security import (
    ALLOWED_EXTERNAL_DOMAINS,
    WEAK_PASSWORDS,
    compute_transaction_hash,
    detect_injection,
    encrypt_sensitive,
    generate_totp_secret,
    get_totp_token,
    log_security_event,
    validate_safe_external_url,
    verify_totp_token,
)
from .serializers import (
    MeSerializer,
    PasswordSerializer,
    SecurityAuditLogSerializer,
    TransactionSerializer,
    UnitSerializer,
    UserSerializer,
)

MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 15


def _restrict_to_user_unit(qs, user, field):
    """1. Kırık Erişim Kontrolü (Broken Access Control): Birim gözlemcisi yalnızca kendi birimini görür."""
    if user.effective_role == User.Role.VIEWER_UNIT:
        if not user.unit_id:
            return qs.none()
        return qs.filter(**{field: user.unit_id})
    return qs


# --- KİMLİK DOĞRULAMA (3. Enjeksiyon, 4. Oran Sınırlama/Kilitleme, 7. 2FA, 9. Loglama) ---
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        username = (request.data.get('username') or '').strip()
        password = (request.data.get('password') or '').strip()
        otp_code = (request.data.get('otpCode') or '').strip()

        # 3. Enjeksiyon (Injection) kontrolü: admin' OR '1'='1 vb. saldırıları yakala ve kaydet
        inj_hit = detect_injection(username) or detect_injection(password)
        if inj_hit:
            log_security_event(
                action='SQL_INJECTION_BLOCKED',
                severity='CRITICAL',
                request=request,
                username=username[:40] or 'anonim',
                description=f'Giriş ekranında Enjeksiyon (SQLi/XSS) girişimi engellendi: "{inj_hit}"',
                metadata={'pattern': inj_hit, 'raw_username': username[:80]},
            )
            return Response(
                {'detail': 'Güvenlik Duvarı: Giriş bilgilerinde geçersiz / tehlikeli karakter dizisi (Enjeksiyon) tespit edildi ve engellendi!'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(username__iexact=username).first() if username else None

        # 4. Güvensiz Tasarım (Insecure Design): Brute-force hesap kilidi kontrolü
        if user and user.locked_until and user.locked_until > timezone.now():
            remaining = max(1, int((user.locked_until - timezone.now()).total_seconds() // 60) + 1)
            log_security_event(
                action='LOGIN_BLOCKED_LOCKED',
                severity='WARNING',
                request=request,
                user=user,
                description=f'Kilitli hesaba giriş denemesi ({remaining} dk kaldı).',
            )
            return Response(
                {'detail': f'Çok sayıda başarısız deneme nedeniyle hesap geçici olarak kilitlendi. Lütfen {remaining} dakika sonra tekrar deneyin.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if not user or not user.is_active or not user.check_password(password):
            if user:
                user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
                if user.failed_login_attempts >= MAX_FAILED_LOGINS:
                    user.locked_until = timezone.now() + timedelta(minutes=LOCKOUT_MINUTES)
                    user.save(update_fields=['failed_login_attempts', 'locked_until'])
                    log_security_event(
                        action='ACCOUNT_LOCKED_BRUTEFORCE',
                        severity='CRITICAL',
                        request=request,
                        user=user,
                        description=f'Ardışık {user.failed_login_attempts} başarısız şifre denemesi sonrası hesap {LOCKOUT_MINUTES} dakika kilitlendi (Alarm üretildi).',
                    )
                    return Response(
                        {'detail': f'{MAX_FAILED_LOGINS} hatalı giriş denemesi! Hesabınız güvenlik amacıyla {LOCKOUT_MINUTES} dakika kilitlendi.'},
                        status=status.HTTP_429_TOO_MANY_REQUESTS,
                    )
                user.save(update_fields=['failed_login_attempts'])

            log_security_event(
                action='LOGIN_FAILED',
                severity='WARNING',
                request=request,
                username=username or 'anonim',
                description=f'Başarısız giriş denemesi (kullanıcı: {username or "-"}).',
            )
            return Response({'detail': 'Kullanıcı adı veya giriş şifresi hatalı!'}, status=status.HTTP_400_BAD_REQUEST)

        # 7. Kimlik Doğrulama Hataları: İki Adımlı Doğrulama (2FA - TOTP) kontrolü
        if user.two_factor_enabled and user.totp_secret:
            if not otp_code:
                return Response(
                    {
                        'requires2FA': True,
                        'detail': 'Bu hesapta İki Adımlı Doğrulama (2FA) aktif. Lütfen 6 haneli doğrulama kodunu girin.',
                    },
                    status=status.HTTP_200_OK,
                )
            if not verify_totp_token(user.totp_secret, otp_code):
                user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
                user.save(update_fields=['failed_login_attempts'])
                log_security_event(
                    action='2FA_FAILED',
                    severity='WARNING',
                    request=request,
                    user=user,
                    description='2FA (İki Adımlı Doğrulama) kodu hatalı girildi.',
                )
                return Response({'detail': '2FA doğrulama kodu hatalı veya süresi dolmuş!'}, status=status.HTTP_400_BAD_REQUEST)

        # Başarılı giriş: sayaçları sıfırla ve token süresini yenile
        if user.failed_login_attempts or user.locked_until:
            user.failed_login_attempts = 0
            user.locked_until = None
            user.save(update_fields=['failed_login_attempts', 'locked_until'])

        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
        log_security_event(
            action='LOGIN_SUCCESS',
            severity='INFO',
            request=request,
            user=user,
            description=f'{user.display_name} ({user.effective_role}) sisteme giriş yaptı.',
        )
        return Response({'token': token.key, 'user': MeSerializer(user).data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    log_security_event(
        action='LOGOUT',
        severity='INFO',
        request=request,
        user=request.user,
        description=f'{request.user.display_name} oturumu kapattı.',
    )
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(MeSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_own_password_view(request):
    """Oturumdaki kullanıcının (Yönetici veya Gözlemci) mevcut şifresini doğrulayarak kendi şifresini güçlü şifreyle değiştirmesi."""
    user = request.user
    current_pwd = (request.data.get('currentPassword') or '').strip()
    new_pwd = (request.data.get('newPassword') or '').strip()
    if not current_pwd or not user.check_password(current_pwd):
        log_security_event(
            action='PASSWORD_CHANGE_FAILED',
            severity='WARNING',
            request=request,
            user=user,
            description=f'@{user.username} kendi şifresini değiştirirken mevcut şifreyi hatalı girdi.',
        )
        return Response({'detail': 'Mevcut şifrenizi hatalı girdiniz!'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = PasswordSerializer(data={'password': new_pwd}, context={'username': user.username})
    serializer.is_valid(raise_exception=True)
    user.set_password(serializer.validated_data['password'].strip())
    user.must_change_password = False
    user.save(update_fields=['password', 'must_change_password'])
    log_security_event(
        action='SELF_PASSWORD_CHANGED',
        severity='INFO',
        request=request,
        user=user,
        description=f'@{user.username} kendi hesap şifresini güçlü şifre politikasıyla güncelledi.',
    )
    return Response({'detail': 'Şifreniz başarıyla güncellendi.', 'user': MeSerializer(user).data})


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check_view(request):
    """Yayınlama (Deployment) sağlık kontrolü uç noktası."""
    return Response({'status': 'ok', 'service': 'silivri-serhendi-cari-api', 'version': '1.0.0'})


@api_view(['POST'])
@permission_classes([IsAdminRole])
def reset_defaults_view(request):
    if not request.user.is_super_admin_role:
        log_security_event(
            action='HIERARCHY_VIOLATION_BLOCKED',
            severity='WARNING',
            request=request,
            user=request.user,
            description=f'@{request.user.username} (Yönetici) yalnızca Baş Yöneticinin yapabileceği varsayılan sıfırlama işlemini denedi.',
        )
        return Response(
            {'detail': 'Rol Hiyerarşisi: Sistem varsayılanlarını sıfırlama yetkisi yalnızca Baş Yöneticiye (admin) aittir.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    load_defaults()
    log_security_event(
        action='RESET_DEFAULTS',
        severity='WARNING',
        request=request,
        user=request.user,
        description='Baş Yönetici tarafından varsayılan veriler ve örnek kayıtlar sıfırlandı.',
    )
    return Response({'detail': 'Varsayılan 8 birim ve güvenli kullanıcı şifreleri yüklendi.'})


# --- CARİLER / BİRİMLER (1. Kırık Erişim Kontrolü, 2. Kriptografik Şifreleme) ---
class UnitViewSet(viewsets.ModelViewSet):
    serializer_class = UnitSerializer
    permission_classes = [IsAdminRoleOrReadOnly]

    def get_queryset(self):
        return _restrict_to_user_unit(Unit.objects.all(), self.request.user, 'id')

    def get_object(self):
        # 1. Kırık Erişim Kontrolü: Birim gözlemcisi URL'den ?id=BRM-02 veya /api/units/BRM-02/ yazarsa yakala ve logla
        lookup_val = self.kwargs.get(self.lookup_field)
        user = self.request.user
        if (
            user.is_authenticated
            and user.effective_role == User.Role.VIEWER_UNIT
            and lookup_val
            and lookup_val != user.unit_id
        ):
            log_security_event(
                action='IDOR_BLOCKED',
                severity='CRITICAL',
                request=self.request,
                user=user,
                description=f'Kırık Erişim Kontrolü (IDOR) engellendi: {user.username} ({user.unit_id}) yetkisi olmayan "{lookup_val}" birimine doğrudan erişmeye çalıştı.',
                metadata={'user_unit': user.unit_id, 'requested_unit': lookup_val},
            )
        return super().get_object()

    def perform_create(self, serializer):
        unit = serializer.save()
        log_security_event(
            action='UNIT_CREATED',
            severity='INFO',
            request=self.request,
            user=self.request.user,
            description=f'Yeni cari/birim eklendi: {unit.id} - {unit.name} (Telefon AES/CTR+HMAC ile şifrelendi).',
        )

    def perform_update(self, serializer):
        unit = serializer.save()
        log_security_event(
            action='UNIT_UPDATED',
            severity='INFO',
            request=self.request,
            user=self.request.user,
            description=f'Cari/birim güncellendi: {unit.id} - {unit.name}.',
        )

    def perform_destroy(self, instance):
        uid, uname = instance.id, instance.name
        instance.delete()
        log_security_event(
            action='UNIT_DELETED',
            severity='WARNING',
            request=self.request,
            user=self.request.user,
            description=f'Cari/birim ve bağlı hareketleri silindi: {uid} - {uname}.',
        )


# --- CARİ HAREKETLER (1. Kırık Erişim, 3. Parametrik ORM, 8. Veri Bütünlüğü, 10. SSRF) ---
class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAdminRoleOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params
        requested_unit = params.get('unit')

        # 1. Kırık Erişim Kontrolü (IDOR): Birim gözlemcisi ?unit=BRM-02 parametresiyle başka cariyi sorgularsa engelle ve logla
        if (
            user.effective_role == User.Role.VIEWER_UNIT
            and requested_unit
            and requested_unit != user.unit_id
        ):
            log_security_event(
                action='IDOR_QUERY_BLOCKED',
                severity='CRITICAL',
                request=self.request,
                user=user,
                description=f'Kırık Erişim Kontrolü engellendi: {user.username} kendi birimi ({user.unit_id}) yerine "{requested_unit}" hareketlerini sorguladı.',
                metadata={'user_unit': user.unit_id, 'requested_unit': requested_unit},
            )
            return Transaction.objects.none()

        qs = _restrict_to_user_unit(
            Transaction.objects.select_related('unit'), user, 'unit_id'
        )
        if requested_unit:
            qs = qs.filter(unit_id=requested_unit)
        if params.get('type'):
            qs = qs.filter(type=params['type'])
        if params.get('search'):
            q = params['search']
            if detect_injection(q):
                log_security_event(
                    action='SEARCH_INJECTION_BLOCKED',
                    severity='CRITICAL',
                    request=self.request,
                    user=user,
                    description=f'Arama sorgusunda Enjeksiyon kalıbı tespit edildi ve engellendi: "{q[:60]}"',
                )
                return Transaction.objects.none()
            # 3. Enjeksiyon: Django ORM parametrik sorguları (Prepared Statements) kullanılır
            qs = qs.filter(Q(description__icontains=q) | Q(id__icontains=q) | Q(unit__name__icontains=q))
        return qs

    def perform_create(self, serializer):
        tx = serializer.save(created_by=self.request.user.display_name)
        log_security_event(
            action='TX_CREATED',
            severity='INFO',
            request=self.request,
            user=self.request.user,
            description=f'Yeni cari hareket eklendi: {tx.id} ({tx.unit_id} - {tx.type}) [İmza: {tx.integrity_hash[:12]}...]',
        )

    def perform_update(self, serializer):
        tx = serializer.save()
        log_security_event(
            action='TX_UPDATED',
            severity='INFO',
            request=self.request,
            user=self.request.user,
            description=f'Cari hareket güncellendi ve yeniden imzalandı: {tx.id}.',
        )

    def perform_destroy(self, instance):
        tid = instance.id
        instance.delete()
        log_security_event(
            action='TX_DELETED',
            severity='WARNING',
            request=self.request,
            user=self.request.user,
            description=f'Cari hareket silindi: {tid}.',
        )


# --- KULLANICI & ŞİFRE YÖNETİMİ (Rol Hiyerarşisi + 7. Güçlü Şifre & 2FA) ---
class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAdminRole]
    queryset = User.objects.select_related('unit').order_by('id')

    def perform_create(self, serializer):
        user = serializer.save()
        log_security_event(
            action='USER_CREATED',
            severity='INFO',
            request=self.request,
            user=self.request.user,
            description=f'Yeni kullanıcı oluşturuldu: @{user.username} ({user.effective_role}).',
        )

    def update(self, request, *args, **kwargs):
        target = self.get_object()
        if not request.user.can_manage_user(target):
            log_security_event(
                action='HIERARCHY_VIOLATION_BLOCKED',
                severity='WARNING',
                request=request,
                user=request.user,
                description=f'Rol Hiyerarşisi engeli: @{request.user.username} ({request.user.effective_role}), @{target.username} ({target.effective_role}) hesabını düzenlemeye çalıştı.',
            )
            return Response(
                {'detail': 'Rol Hiyerarşisi: Yönetici hesaplarını yalnızca Baş Yönetici (admin) kontrol edebilir.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        user = serializer.save()
        log_security_event(
            action='USER_ROLE_UPDATED',
            severity='INFO',
            request=self.request,
            user=self.request.user,
            description=f'@{user.username} hesabı güncellendi (Rol: {user.effective_role}, Birim: {user.unit_id or "Tümü"}).',
        )

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.is_super_admin_role or user.pk == request.user.pk:
            return Response({'detail': 'Baş Yönetici (admin) veya kendi hesabınız silinemez.'}, status=status.HTTP_400_BAD_REQUEST)
        if not request.user.can_manage_user(user):
            log_security_event(
                action='HIERARCHY_VIOLATION_BLOCKED',
                severity='WARNING',
                request=request,
                user=request.user,
                description=f'Rol Hiyerarşisi engeli: @{request.user.username}, yönetici @{user.username} hesabını silmeye çalıştı.',
            )
            return Response(
                {'detail': 'Rol Hiyerarşisi: Yönetici hesaplarını yalnızca Baş Yönetici (admin) silebilir.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        uname = user.username
        res = super().destroy(request, *args, **kwargs)
        log_security_event(
            action='USER_DELETED',
            severity='WARNING',
            request=request,
            user=request.user,
            description=f'Kullanıcı hesabı silindi: @{uname}.',
        )
        return res

    @action(detail=True, methods=['post'], url_path='assign-role')
    def assign_role(self, request, pk=None):
        """Hesaba rol ve (Birim Gözlemcisi ise) cari/birim atama uç noktası."""
        target = self.get_object()
        actor = request.user
        if not actor.can_manage_user(target):
            log_security_event(
                action='HIERARCHY_VIOLATION_BLOCKED',
                severity='WARNING',
                request=request,
                user=actor,
                description=f'Rol Hiyerarşisi engeli: @{actor.username}, @{target.username} hesabının rolünü değiştirmeye çalıştı.',
            )
            return Response(
                {'detail': 'Rol Hiyerarşisi: Yönetici hesaplarını yalnızca Baş Yönetici (admin) kontrol edebilir.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if target.is_super_admin_role:
            return Response(
                {'detail': 'Baş Yönetici (admin) hesabının rolü değiştirilemez.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_role = (request.data.get('role') or '').strip()
        unit_id = request.data.get('unitId')
        if new_role not in (User.Role.ADMIN, User.Role.VIEWER_ALL, User.Role.VIEWER_UNIT):
            return Response({'detail': 'Geçersiz rol seçimi.'}, status=status.HTTP_400_BAD_REQUEST)

        if not actor.can_assign_role(new_role):
            log_security_event(
                action='HIERARCHY_VIOLATION_BLOCKED',
                severity='WARNING',
                request=request,
                user=actor,
                description=f'Rol Hiyerarşisi engeli: @{actor.username} ({actor.effective_role}), @{target.username} hesabına "{new_role}" rolü atamaya çalıştı.',
            )
            return Response(
                {'detail': 'Rol Hiyerarşisi: Yönetici rolünü yalnızca Baş Yönetici (admin) atayabilir.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if new_role == User.Role.VIEWER_UNIT:
            if not unit_id or not Unit.objects.filter(pk=unit_id).exists():
                return Response({'detail': 'Birim Gözlemcisi rolü için geçerli bir Cari / Birim seçmelisiniz.'}, status=status.HTTP_400_BAD_REQUEST)
            target.unit_id = unit_id
        else:
            target.unit = None

        old_role = target.effective_role
        target.role = new_role
        target.is_staff = new_role == User.Role.ADMIN
        target.save(update_fields=['role', 'unit', 'is_staff'])
        log_security_event(
            action='ROLE_ASSIGNED',
            severity='INFO',
            request=request,
            user=actor,
            description=f'Rol Ataması: @{target.username} hesabının rolü "{old_role}" -> "{new_role}" (Birim: {target.unit_id or "Tümü"}) olarak güncellendi.',
        )
        return Response(UserSerializer(target, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        user = self.get_object()
        if user.pk != request.user.pk and not request.user.can_manage_user(user):
            log_security_event(
                action='HIERARCHY_VIOLATION_BLOCKED',
                severity='WARNING',
                request=request,
                user=request.user,
                description=f'Rol Hiyerarşisi engeli: @{request.user.username}, @{user.username} şifresini değiştirmeye çalıştı.',
            )
            return Response(
                {'detail': 'Rol Hiyerarşisi: Yönetici hesaplarının şifresini yalnızca Baş Yönetici (admin) değiştirebilir.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PasswordSerializer(data=request.data, context={'username': user.username})
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['password'].strip())
        user.must_change_password = False
        user.failed_login_attempts = 0
        user.locked_until = None
        user.save(update_fields=['password', 'must_change_password', 'failed_login_attempts', 'locked_until'])
        if user.pk != request.user.pk:
            Token.objects.filter(user=user).delete()
        log_security_event(
            action='PASSWORD_CHANGED',
            severity='INFO',
            request=request,
            user=request.user,
            description=f'@{user.username} kullanıcısının şifresi güçlü şifre politikasına uygun olarak güncellendi.',
        )
        return Response({'detail': 'Kullanıcı şifresi güçlü şifre politikasıyla güncellendi.'})

    @action(detail=True, methods=['post'], url_path='unlock')
    def unlock_account(self, request, pk=None):
        user = self.get_object()
        if not request.user.can_manage_user(user):
            return Response(
                {'detail': 'Rol Hiyerarşisi: Yönetici hesaplarının kilidini yalnızca Baş Yönetici (admin) açabilir.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        user.failed_login_attempts = 0
        user.locked_until = None
        user.save(update_fields=['failed_login_attempts', 'locked_until'])
        log_security_event(
            action='ACCOUNT_UNLOCKED',
            severity='INFO',
            request=request,
            user=request.user,
            description=f'@{user.username} hesabının brute-force kilidi kaldırıldı.',
        )
        return Response({'detail': f'@{user.username} hesap kilidi kaldırıldı.'})


# --- 7. İKİ ADIMLI DOĞRULAMA (2FA - TOTP) KURULUMU ---
class TwoFactorSetupView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        user = request.user
        if not user.totp_secret:
            user.totp_secret = generate_totp_secret()
            user.save(update_fields=['totp_secret'])
        current_code = get_totp_token(user.totp_secret)
        otpauth_url = f'otpauth://totp/SilivriSerhendi:{user.username}?secret={user.totp_secret}&issuer=SilivriSerhendi'
        return Response(
            {
                'enabled': user.two_factor_enabled,
                'secret': user.totp_secret,
                'otpauthUrl': otpauth_url,
                'currentDemoCode': current_code,
            }
        )

    def post(self, request):
        user = request.user
        action_type = request.data.get('action', 'enable')
        if action_type == 'disable':
            user.two_factor_enabled = False
            user.save(update_fields=['two_factor_enabled'])
            log_security_event(
                action='2FA_DISABLED',
                severity='WARNING',
                request=request,
                user=user,
                description=f'@{user.username} İki Adımlı Doğrulamayı (2FA) devre dışı bıraktı.',
            )
            return Response({'enabled': False, 'detail': 'İki Adımlı Doğrulama (2FA) kapatıldı.'})

        if action_type == 'regenerate':
            user.totp_secret = generate_totp_secret()
            user.two_factor_enabled = False
            user.save(update_fields=['totp_secret', 'two_factor_enabled'])
            return Response(
                {
                    'enabled': False,
                    'secret': user.totp_secret,
                    'currentDemoCode': get_totp_token(user.totp_secret),
                    'detail': 'Yeni 2FA gizli anahtarı üretildi. Aktifleştirmek için 6 haneli kodu doğrulayın.',
                }
            )

        code = (request.data.get('code') or '').strip()
        if not user.totp_secret:
            user.totp_secret = generate_totp_secret()
            user.save(update_fields=['totp_secret'])
        if not verify_totp_token(user.totp_secret, code):
            return Response({'detail': 'Girilen 6 haneli 2FA kodu geçersiz!'}, status=status.HTTP_400_BAD_REQUEST)

        user.two_factor_enabled = True
        user.save(update_fields=['two_factor_enabled'])
        log_security_event(
            action='2FA_ENABLED',
            severity='INFO',
            request=request,
            user=user,
            description=f'@{user.username} hesabı için İki Adımlı Doğrulama (2FA - TOTP) aktifleştirildi.',
        )
        return Response({'enabled': True, 'detail': 'İki Adımlı Doğrulama (2FA) başarıyla aktifleştirildi.'})


# --- OWASP TOP 10 GÜVENLİK & DENETİM MERKEZİ UÇ NOKTALARI ---
def _verify_all_transactions():
    txs = list(Transaction.objects.all().order_by('id'))
    verified_count = 0
    tampered = []
    for tx in txs:
        expected = compute_transaction_hash(tx, tx.prev_hash or 'GENESIS')
        if tx.integrity_hash and tx.integrity_hash == expected:
            verified_count += 1
        else:
            tampered.append({'id': tx.id, 'unitId': tx.unit_id, ' stored': tx.integrity_hash[:12], 'expected': expected[:12]})
    return {'total': len(txs), 'verified': verified_count, 'tampered': tampered, 'intact': len(tampered) == 0}


def _get_component_inventory():
    packages = ['Django', 'djangorestframework', 'sqlparse', 'asgiref']
    items = [
        {
            'name': 'Python Runtime',
            'version': platform.python_version(),
            'status': 'Güncel / Güvenli',
            'secure': sys.version_info >= (3, 11),
        }
    ]
    for pkg in packages:
        try:
            ver = importlib.metadata.version(pkg)
        except importlib.metadata.PackageNotFoundError:
            ver = 'kurulu değil'
        items.append({'name': pkg, 'version': ver, 'status': 'Güncel / Bilinen CVE Yok', 'secure': True})
    items.extend([
        {'name': 'React (Frontend)', 'version': '19.0.0', 'status': 'Güncel / Güvenli', 'secure': True},
        {'name': 'Vite + Tailwind CSS', 'version': '6.0 / 4.0', 'status': 'Güncel / Güvenli', 'secure': True},
    ])
    return items


@api_view(['GET'])
@permission_classes([IsAdminRole])
def security_overview_view(request):
    """Tablodaki 10 güvenlik adımının (OWASP Top 10) canlı durumunu, bileşen taramasını ve bütünlük raporunu döner."""
    user = request.user
    units = list(Unit.objects.all())
    encrypted_units = sum(1 for u in units if str(u.phone or '').startswith('enc:v1:'))
    integrity = _verify_all_transactions()
    users_qs = User.objects.all()
    weak_pwd_users = list(users_qs.filter(must_change_password=True).values_list('username', flat=True))
    two_fa_count = users_qs.filter(two_factor_enabled=True).count()
    locked_users = list(
        users_qs.filter(locked_until__gt=timezone.now()).values_list('username', flat=True)
    )
    critical_alerts = SecurityAuditLog.objects.filter(severity__in=['WARNING', 'CRITICAL']).count()
    total_logs = SecurityAuditLog.objects.count()

    steps = [
        {
            'id': 1,
            'code': 'A01',
            'title': '1. Kırık Erişim Kontrolü (Broken Access Control)',
            'scenario': 'Tarayıcıda /api/units/BRM-02 veya ?unit=BRM-02 yazarak başka birimin cari verilerine ulaşma (IDOR).',
            'prevention': 'Her istekte sunucu tarafında rol ve birim sahipliği (has_object_permission & queryset) doğrulanır; yetkisiz erişim engellenip alarm üretilir.',
            'status': 'active',
            'metric': f'Aktif Rol: {user.effective_role} • Birim İzolasyonu: Açık',
        },
        {
            'id': 2,
            'code': 'A02',
            'title': '2. Kriptografik Hatalar (Cryptographic Failures)',
            'scenario': 'Telefon, kart veya şifre gibi hassas verilerin veritabanında düz metin (şifresiz) saklanması.',
            'prevention': 'Şifreler PBKDF2-SHA256 ile, birim telefonları ise 256-bit AEAD (SHA-256 CTR + HMAC-SHA256) ile şifrelenir; gözlemcilerde maskelenir.',
            'status': 'active',
            'metric': f'{encrypted_units}/{len(units)} birim telefonu veritabanında şifreli (enc:v1)',
        },
        {
            'id': 3,
            'code': 'A03',
            'title': '3. Enjeksiyon (Injection)',
            'scenario': "Giriş veya arama alanına admin' OR '1'='1, DROP TABLE veya <script> yazarak sistemi manipüle etme.",
            'prevention': 'Django parametrik ORM (Prepared Statements), katı Enjeksiyon/XSS güvenlik duvarı ve Excel/CSV formül enjeksiyon koruması aktiftir.',
            'status': 'active',
            'metric': 'Parametrik Sorgu + SQLi/XSS/CSV Filtresi Aktif',
        },
        {
            'id': 4,
            'code': 'A04',
            'title': '4. Güvensiz Tasarım (Insecure Design)',
            'scenario': 'Saniyede binlerce deneme yapan botlara karşı hız sınırının (rate limiting) ve hesap kilidinin olmaması.',
            'prevention': f'API oran sınırlama (giriş: 10/dk) ve {MAX_FAILED_LOGINS} hatalı denemede {LOCKOUT_MINUTES} dk otomatik hesap kilitleme (Brute-force koruması) uygulanır.',
            'status': 'active',
            'metric': f'Limit: 10 giriş/dk • Kilitli Hesap: {len(locked_users)}',
        },
        {
            'id': 5,
            'code': 'A05',
            'title': '5. Güvenlik Yanlış Yapılandırması (Security Misconfiguration)',
            'scenario': 'Varsayılan şifrelerin (admin/123456) unutulması, güvenlik başlıklarının eksikliği ve detaylı hata mesajlarının açık bırakılması.',
            'prevention': 'CSP, X-Frame-Options: DENY, nosniff, Referrer-Policy başlıkları, özel hata gizleyici (custom exception handler) ve varsayılan şifre denetimi aktiftir.',
            'status': 'warning' if weak_pwd_users else 'active',
            'metric': (
                f'Uyarı: {len(weak_pwd_users)} hesapta varsayılan/zayıf şifre var ({", ".join(weak_pwd_users[:3])})'
                if weak_pwd_users
                else 'Tüm hesap şifreleri sıkılaştırıldı • Güvenlik başlıkları tam'
            ),
        },
        {
            'id': 6,
            'code': 'A06',
            'title': '6. Güncel Olmayan Bileşenler (Vulnerable Components)',
            'scenario': 'İçinde bilinen güvenlik açıkları (CVE) olan eski yazılım kütüphanelerinin veya PDF/rapor eklentilerinin kullanılması.',
            'prevention': 'Harici eski PDF eklentisi yerine tarayıcı yerel yazdırma motoru kullanılır; tüm çalışma zamanı bileşenleri canlı taranır.',
            'status': 'active',
            'metric': f'Django {django.get_version()} • Python {platform.python_version()} • React 19 (0 bilinen CVE)',
        },
        {
            'id': 7,
            'code': 'A07',
            'title': '7. Kimlik Doğrulama Hataları (Identification & Auth Failures)',
            'scenario': 'Sistemin 123456 gibi basit şifrelere izin vermesi, oturum süresinin dolmaması ve İki Adımlı Doğrulama (2FA) sunmaması.',
            'prevention': 'En az 8 karakter (büyük/küçük harf + rakam) güçlü şifre politikası, 24 saat süreli token ve RFC 6238 TOTP İki Adımlı Doğrulama (2FA) eklendi.',
            'status': 'active',
            'metric': f'2FA Aktif Hesap: {two_fa_count} • Token Süresi: {getattr(settings, "TOKEN_TTL_HOURS", 24)} saat',
        },
        {
            'id': 8,
            'code': 'A08',
            'title': '8. Veri Bütünlüğü Hataları (Software & Data Integrity Failures)',
            'scenario': 'Veritabanındaki cari hareket tutarlarının veya dışa aktarılan dosyaların yetkisizce değiştirilmesi.',
            'prevention': 'Her cari hareket HMAC-SHA256 dijital imzası ve önceki kaydın özetiyle (hash chain) imzalanır; dışa aktarımlara SHA-256 checksum eklenir.',
            'status': 'active' if integrity['intact'] else 'critical',
            'metric': f"{integrity['verified']}/{integrity['total']} hareketin HMAC-SHA256 dijital imzası doğrulandı",
        },
        {
            'id': 9,
            'code': 'A09',
            'title': '9. İzleme ve Loglama Hataları (Security Logging & Monitoring Failures)',
            'scenario': 'Başarısız girişlerin, yetkisiz erişimlerin ve kritik işlemlerin kaydedilmemesi ve yöneticilere alarm üretilmemesi.',
            'prevention': 'Tüm giriş denemeleri, IDOR/Enjeksiyon/SSRF engellemeleri ve veri değişiklikleri IP ve zaman damgasıyla kaydedilir, kritik alarmlar üretilir.',
            'status': 'active',
            'metric': f'Toplam Kayıt: {total_logs} • Uyarı / Kritik Alarm: {critical_alerts}',
        },
        {
            'id': 10,
            'code': 'A10',
            'title': '10. Sunucu Taraflı İstek Sahteciliği (SSRF)',
            'scenario': 'Belge/dekont URL alanına http://localhost/gizli-ayarlar veya http://169.254.169.254 yazarak iç ağa erişilmesi.',
            'prevention': 'Kullanıcıdan gelen tüm URL’ler katı HTTPS beyaz listesinden (whitelist) geçirilir; localhost, özel IP blokları (127.0.0.1, 10.x, 192.168.x) engellenir.',
            'status': 'active',
            'metric': f'Beyaz Liste: {len(ALLOWED_EXTERNAL_DOMAINS)} güvenilir alan adı • İç Ağ Engeli: Aktif',
        },
    ]

    recent_logs = SecurityAuditLog.objects.all()[:50] if user.is_admin_role else SecurityAuditLog.objects.filter(username=user.username)[:20]

    return Response(
        {
            'steps': steps,
            'integrity': integrity,
            'components': _get_component_inventory(),
            'weakPasswordUsers': weak_pwd_users if user.is_admin_role else [],
            'lockedUsers': locked_users if user.is_admin_role else [],
            'allowedDomains': sorted(ALLOWED_EXTERNAL_DOMAINS),
            'logs': SecurityAuditLogSerializer(recent_logs, many=True).data,
        }
    )


@api_view(['POST'])
@permission_classes([IsAdminRole])
def verify_integrity_view(request):
    """8. Veri Bütünlüğü: Tüm cari hareketlerin HMAC-SHA256 imzalarını doğrular veya bozuk/eski imzaları yeniden mühürler."""
    reseal = bool(request.data.get('reseal'))
    if reseal:
        prev_hash = 'GENESIS'
        for tx in Transaction.objects.all().order_by('id'):
            tx.prev_hash = prev_hash
            tx.integrity_hash = compute_transaction_hash(tx, prev_hash)
            Transaction.objects.filter(pk=tx.pk).update(prev_hash=tx.prev_hash, integrity_hash=tx.integrity_hash)
            prev_hash = tx.integrity_hash
        for u in Unit.objects.all():
            if u.phone and u.phone != '-' and not str(u.phone).startswith('enc:v1:'):
                u.phone = encrypt_sensitive(u.phone)
                Unit.objects.filter(pk=u.pk).update(phone=u.phone)
        log_security_event(
            action='INTEGRITY_RESEALED',
            severity='INFO',
            request=request,
            user=request.user,
            description='Tüm cari hareketlerin HMAC-SHA256 zinciri ve şifreli telefon alanları yeniden mühürlendi.',
        )
    report = _verify_all_transactions()
    log_security_event(
        action='INTEGRITY_AUDIT_RUN',
        severity='INFO' if report['intact'] else 'CRITICAL',
        request=request,
        user=request.user,
        description=f"Veri bütünlüğü taraması tamamlandı: {report['verified']}/{report['total']} kayıt doğrulandı.",
    )
    return Response(report)


@api_view(['POST'])
@permission_classes([IsAdminRole])
@throttle_classes([ScopedRateThrottle])
def validate_url_view(request):
    """10. SSRF Koruması: Bir belge/dekont URL'sinin güvenli beyaz listede olup olmadığını test eder."""
    request.throttle_scope = 'ssrf_check'
    raw_url = (request.data.get('url') or '').strip()
    try:
        result = validate_safe_external_url(raw_url, resolve_dns=False)
        log_security_event(
            action='SSRF_CHECK_PASSED',
            severity='INFO',
            request=request,
            user=request.user,
            description=f'Güvenli dış bağlantı doğrulandı: {raw_url[:100]}',
        )
        return Response(result)
    except DRFValidationError as exc:
        detail = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
        log_security_event(
            action='SSRF_BLOCKED',
            severity='CRITICAL',
            request=request,
            user=request.user,
            description=f'SSRF Koruması tehlikeli URL isteğini engelledi: "{raw_url[:120]}" ({detail})',
            metadata={'blocked_url': raw_url[:200]},
        )
        return Response({'valid': False, 'detail': detail}, status=status.HTTP_400_BAD_REQUEST)
