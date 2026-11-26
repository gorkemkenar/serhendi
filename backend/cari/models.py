from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.db import models

from .security import compute_transaction_hash, decrypt_sensitive, encrypt_sensitive, mask_phone


def _next_code(model, prefix, width, start):
    """BRM-01 / HRK-1001 gibi sıradaki kodu üretir."""
    nums = []
    for code in model.objects.filter(pk__startswith=prefix).values_list('pk', flat=True):
        try:
            nums.append(int(code[len(prefix):]))
        except ValueError:
            continue
    n = max(nums) + 1 if nums else start
    return f'{prefix}{n:0{width}d}'


class Unit(models.Model):
    """Cari / Birim (ör. Merkez Dergah)."""

    id = models.CharField('Birim Kodu', max_length=20, primary_key=True, editable=False)
    name = models.CharField('Cari / Birim Adı', max_length=150)
    contact = models.CharField('Yetkili', max_length=150, blank=True, default='Yetkili')
    # 2. Kriptografik Hatalar: Telefon numarası veritabanında şifrelenmiş (enc:v1:...) olarak saklanır.
    phone = models.CharField('Telefon (Şifreli)', max_length=255, blank=True, default='-')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']
        verbose_name = 'Cari / Birim'
        verbose_name_plural = 'Cariler / Birimler'

    def __str__(self):
        return f'{self.id} - {self.name}'

    @property
    def plain_phone(self) -> str:
        return decrypt_sensitive(self.phone)

    @property
    def masked_phone(self) -> str:
        return mask_phone(self.phone)

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = _next_code(Unit, 'BRM-', 2, 1)
        if self.phone and self.phone != '-' and not str(self.phone).startswith('enc:v1:'):
            self.phone = encrypt_sensitive(self.phone)
        super().save(*args, **kwargs)


class User(AbstractUser):
    class Role(models.TextChoices):
        OWNER = 'owner', 'Sistem Sahibi (Owner)'
        SUPER_ADMIN = 'super_admin', 'Baş Yönetici (Admin)'
        ADMIN = 'admin', 'Yönetici'
        VIEWER_ALL = 'viewer_all', 'Genel Gözlemci (Salt Okunur)'
        VIEWER_UNIT = 'viewer_unit', 'Birim Gözlemcisi (Kısıtlı)'

    ROLE_RANK = {
        Role.OWNER: 5,
        Role.SUPER_ADMIN: 4,
        Role.ADMIN: 3,
        Role.VIEWER_ALL: 2,
        Role.VIEWER_UNIT: 1,
    }

    full_name = models.CharField('Hesap / Kişi Adı', max_length=150, blank=True)
    role = models.CharField('Rol', max_length=20, choices=Role.choices, default=Role.VIEWER_ALL)
    unit = models.ForeignKey(
        Unit,
        verbose_name='Cari / Birim',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='observers',
    )
    # 7. Kimlik Doğrulama & 4. Güvensiz Tasarım: 2FA (TOTP) ve Hesap Kilitleme (Brute-force koruması)
    two_factor_enabled = models.BooleanField('2FA (İki Adımlı Doğrulama) Aktif', default=False)
    totp_secret = models.CharField('TOTP Gizli Anahtarı', max_length=64, blank=True, default='')
    failed_login_attempts = models.PositiveSmallIntegerField('Başarısız Giriş Sayısı', default=0)
    locked_until = models.DateTimeField('Kilit Bitiş Zamanı', null=True, blank=True)
    must_change_password = models.BooleanField('Varsayılan Şifre Değiştirilmeli', default=False)

    class Meta:
        verbose_name = 'Kullanıcı'
        verbose_name_plural = 'Kullanıcılar'

    @property
    def effective_role(self):
        if self.role == self.Role.OWNER:
            return self.Role.OWNER
        if self.is_superuser or self.role == self.Role.SUPER_ADMIN:
            return self.Role.SUPER_ADMIN
        return self.role

    @property
    def is_owner_role(self):
        return self.effective_role == self.Role.OWNER

    @property
    def is_super_admin_role(self):
        return self.effective_role in (self.Role.OWNER, self.Role.SUPER_ADMIN)

    @property
    def is_admin_role(self):
        return self.effective_role in (self.Role.OWNER, self.Role.SUPER_ADMIN, self.Role.ADMIN)

    @property
    def role_rank(self) -> int:
        return self.ROLE_RANK.get(self.effective_role, 0)

    def can_manage_user(self, target_user) -> bool:
        """5 Kademeli Rol Hiyerarşisi:
        - Sistem Sahibi (Owner - Seviye 5): Baş Yönetici (Admin), Yönetici ve tüm gözlemcileri kontrol edebilir.
          Kimse (Admin dahil) Owner hesabını değiştiremez, şifresini sıfırlayamaz veya silemez.
        - Baş Yönetici (Admin - Seviye 4): Yöneticileri (Seviye 3) ve gözlemcileri (Seviye 2 & 1) kontrol edebilir;
          fakat Owner hesabına müdahale edemez.
        - Yönetici (Seviye 3): Yalnızca Genel Gözlemci ve Birim Gözlemcisi hesaplarını kontrol edebilir.
        """
        if not self.is_admin_role:
            return False
        if target_user.is_owner_role:
            return self.pk == target_user.pk and self.is_owner_role
        if self.is_owner_role:
            return True
        if self.effective_role == self.Role.SUPER_ADMIN:
            return target_user.effective_role in (
                self.Role.SUPER_ADMIN,
                self.Role.ADMIN,
                self.Role.VIEWER_ALL,
                self.Role.VIEWER_UNIT,
            )
        return target_user.effective_role in (self.Role.VIEWER_ALL, self.Role.VIEWER_UNIT)

    def can_assign_role(self, target_role: str) -> bool:
        """
        - Sistem Sahibi (Owner): Baş Yönetici (super_admin), Yönetici (admin) ve tüm gözlemci rollerini atayabilir.
        - Baş Yönetici (Admin): Yönetici (admin) ve gözlemci rollerini atayabilir.
        - Yönetici: Yalnızca gözlemci rollerini atayabilir.
        """
        if not self.is_admin_role:
            return False
        if self.is_owner_role:
            return target_role in (
                self.Role.SUPER_ADMIN,
                self.Role.ADMIN,
                self.Role.VIEWER_ALL,
                self.Role.VIEWER_UNIT,
            )
        if self.effective_role == self.Role.SUPER_ADMIN:
            return target_role in (self.Role.ADMIN, self.Role.VIEWER_ALL, self.Role.VIEWER_UNIT)
        return target_role in (self.Role.VIEWER_ALL, self.Role.VIEWER_UNIT)

    @property
    def display_name(self):
        return self.full_name or self.username


class UnitItem(models.Model):
    """Cari içindeki kalem bazlı borç takibi (Örn: Kumanya, Kandil Simidi, Patates -> Borç / Ödenen / Kalan)."""

    id = models.CharField('Kalem Kodu', max_length=20, primary_key=True, editable=False)
    unit = models.ForeignKey(Unit, verbose_name='Cari / Birim', on_delete=models.CASCADE, related_name='items')
    name = models.CharField('Kalem Adı', max_length=150)
    description = models.CharField('Kalem Detayı / Neye Ait', max_length=255, blank=True, default='')
    debt = models.DecimalField('Borç (₺)', max_digits=14, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    paid = models.DecimalField('Ödenen (₺)', max_digits=14, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        verbose_name = 'Cari Kalemi'
        verbose_name_plural = 'Cari Kalemleri'

    def __str__(self):
        return f'{self.unit_id} - {self.name}'

    @property
    def remaining(self):
        return (self.debt or 0) - (self.paid or 0)

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = _next_code(UnitItem, 'KLM-', 4, 101)
        super().save(*args, **kwargs)


class Transaction(models.Model):
    class Type(models.TextChoices):
        MAL_SEVKIYATI = 'Mal Sevkiyatı', 'Mal Sevkiyatı'
        BORC_KAYDI = 'Borç Kaydı', 'Borç Kaydı'
        NAKIT_TAHSILAT = 'Nakit Tahsilat', 'Nakit Tahsilat'
        HAVALE_EFT = 'Havale / EFT', 'Havale / EFT'
        IADE_MAHSUP = 'İade / Mahsup', 'İade / Mahsup'
        ALACAK_KAYDI = 'Alacak Kaydı', 'Alacak Kaydı'

    # Borç yönlü işlem türleri; geri kalanlar alacak (ödeme) yönlüdür.
    DEBT_TYPES = {Type.MAL_SEVKIYATI, Type.BORC_KAYDI}

    id = models.CharField('İşlem No', max_length=20, primary_key=True, editable=False)
    date = models.DateField('Tarih')
    unit = models.ForeignKey(Unit, verbose_name='Cari / Birim', on_delete=models.CASCADE, related_name='transactions')
    item = models.ForeignKey(
        UnitItem,
        verbose_name='Bağlı Kalem',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='transactions',
    )
    category = models.CharField('Kalem / Kategori', max_length=120, blank=True, default='Genel')
    type = models.CharField('Tür', max_length=30, choices=Type.choices)
    description = models.CharField('Açıklama', max_length=255, blank=True)
    debt = models.DecimalField('Borç (₺)', max_digits=14, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    credit = models.DecimalField('Alacak (₺)', max_digits=14, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    created_by = models.CharField('Kaydı Giren', max_length=150, blank=True)
    # 10. SSRF Koruması: Dış belge/dekont bağlantısı yalnızca beyaz listedeki HTTPS alan adlarını kabul eder.
    document_url = models.CharField('Belge / Dekont URL', max_length=500, blank=True, default='')
    # 8. Veri Bütünlüğü: Her hareket HMAC-SHA256 imzası ve önceki kaydın özetiyle zincirlenir.
    prev_hash = models.CharField('Önceki Zincir Özeti', max_length=64, blank=True, default='GENESIS', editable=False)
    integrity_hash = models.CharField('HMAC-SHA256 Bütünlük İmzası', max_length=64, blank=True, default='', editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = 'Cari Hareket'
        verbose_name_plural = 'Cari Hareketler'

    def __str__(self):
        return f'{self.id} - {self.unit_id} - {self.type}'

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = _next_code(Transaction, 'HRK-', 4, 1001)
            last_tx = Transaction.objects.exclude(pk=self.pk).order_by('id').last()
            self.prev_hash = (last_tx.integrity_hash if last_tx and last_tx.integrity_hash else 'GENESIS')
        if not self.prev_hash:
            self.prev_hash = 'GENESIS'
        self.integrity_hash = compute_transaction_hash(self, self.prev_hash)
        super().save(*args, **kwargs)


class SecurityAuditLog(models.Model):
    """9. İzleme ve Loglama Hataları: Güvenlik olayları ve şüpheli hareket kaydı."""

    class Severity(models.TextChoices):
        INFO = 'INFO', 'Bilgi'
        WARNING = 'WARNING', 'Uyarı'
        CRITICAL = 'CRITICAL', 'Kritik Alarm'

    timestamp = models.DateTimeField('Zaman', auto_now_add=True, db_index=True)
    action = models.CharField('Olay Kodu', max_length=60, db_index=True)
    severity = models.CharField('Seviye', max_length=15, choices=Severity.choices, default=Severity.INFO, db_index=True)
    username = models.CharField('Kullanıcı', max_length=150, blank=True, default='anonim')
    ip_address = models.CharField('IP Adresi', max_length=64, blank=True, default='127.0.0.1')
    path = models.CharField('İstek Yolu', max_length=255, blank=True, default='')
    description = models.CharField('Açıklama', max_length=500)
    metadata = models.JSONField('Ek Veri', default=dict, blank=True)

    class Meta:
        ordering = ['-timestamp', '-id']
        verbose_name = 'Güvenlik Denetim Kaydı'
        verbose_name_plural = 'Güvenlik Denetim Kayıtları'

    def __str__(self):
        return f'[{self.severity}] {self.action} ({self.username})'
