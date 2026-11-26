from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .models import SecurityAuditLog, Transaction, Unit, UnitItem, User
from .security import (
    compute_transaction_hash,
    sanitize_text_input,
    validate_safe_external_url,
    validate_strong_password,
)


class UnitSerializer(serializers.ModelSerializer):
    isEncrypted = serializers.SerializerMethodField()

    class Meta:
        model = Unit
        fields = ['id', 'name', 'contact', 'phone', 'isEncrypted']
        read_only_fields = ['id', 'isEncrypted']

    def get_isEncrypted(self, obj):
        return str(obj.phone or '').startswith('enc:v1:')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        # 2. Kriptografik Hatalar: Veritabanında şifreli duran telefon yöneticiye ve ilgili birim gözlemcisine çözülür,
        # genel gözlemcide ise maskelenmiş olarak gösterilir.
        if user and user.is_authenticated and (user.is_admin_role or user.unit_id == instance.id):
            data['phone'] = instance.plain_phone
            data['phoneMasked'] = False
        else:
            data['phone'] = instance.masked_phone
            data['phoneMasked'] = True
        return data

    def validate_name(self, value):
        value = sanitize_text_input(value, 'Cari / Birim adı')
        if not value:
            raise serializers.ValidationError('Cari / Birim adı boş bırakılamaz.')
        return value

    def validate_contact(self, value):
        return sanitize_text_input(value, 'Yetkili adı') or 'Yetkili'

    def validate_phone(self, value):
        return sanitize_text_input(value, 'Telefon numarası', neutralize_csv=False) or '-'


class UnitItemSerializer(serializers.ModelSerializer):
    unitId = serializers.PrimaryKeyRelatedField(source='unit', queryset=Unit.objects.all())
    unitName = serializers.CharField(source='unit.name', read_only=True)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = UnitItem
        fields = ['id', 'unitId', 'unitName', 'name', 'description', 'debt', 'paid', 'remaining', 'year']
        read_only_fields = ['id', 'unitName', 'remaining']
        extra_kwargs = {
            'debt': {'required': False, 'min_value': Decimal('0'), 'max_value': Decimal('50000000.00')},
            'paid': {'required': False, 'min_value': Decimal('0'), 'max_value': Decimal('50000000.00')},
            'year': {'required': False, 'min_value': 2000, 'max_value': 2100},
        }

    def get_remaining(self, obj):
        return (obj.debt or Decimal('0')) - (obj.paid or Decimal('0'))

    def validate_name(self, value):
        val = sanitize_text_input(value, 'Kalem adı')
        if not val:
            raise serializers.ValidationError('Kalem adı boş bırakılamaz (Örn: Kumanya, Kandil Simidi, Patates).')
        return val

    def validate_description(self, value):
        return sanitize_text_input(value, 'Kalem detayı')


class TransactionSerializer(serializers.ModelSerializer):
    unitId = serializers.PrimaryKeyRelatedField(source='unit', queryset=Unit.objects.all())
    unitName = serializers.CharField(source='unit.name', read_only=True)
    itemId = serializers.PrimaryKeyRelatedField(
        source='item', queryset=UnitItem.objects.all(), allow_null=True, required=False
    )
    itemName = serializers.SerializerMethodField()
    itemDescription = serializers.SerializerMethodField()
    category = serializers.CharField(required=False, allow_blank=True, default='Genel')
    createdBy = serializers.CharField(source='created_by', read_only=True)
    documentUrl = serializers.CharField(source='document_url', required=False, allow_blank=True, default='')
    integrityHash = serializers.CharField(source='integrity_hash', read_only=True)
    integrityVerified = serializers.SerializerMethodField()
    # Yeni kayıtta tutar + tür gönderilir; borç/alacak yönü türe göre belirlenir.
    amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        write_only=True,
        required=False,
        min_value=Decimal('0.01'),
        max_value=Decimal('50000000.00'),
    )

    class Meta:
        model = Transaction
        fields = [
            'id',
            'date',
            'unitId',
            'unitName',
            'itemId',
            'itemName',
            'itemDescription',
            'category',
            'type',
            'description',
            'debt',
            'credit',
            'createdBy',
            'documentUrl',
            'integrityHash',
            'integrityVerified',
            'amount',
        ]
        read_only_fields = ['id', 'unitName', 'itemName', 'itemDescription', 'integrityHash', 'integrityVerified']
        extra_kwargs = {
            'debt': {'required': False, 'min_value': Decimal('0'), 'max_value': Decimal('50000000.00')},
            'credit': {'required': False, 'min_value': Decimal('0'), 'max_value': Decimal('50000000.00')},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get('type') == 'Mal Sevkiyatı':
            data['type'] = 'Malzeme'
        return data

    def get_itemName(self, obj):
        if obj.item_id and obj.item:
            return obj.item.name
        return obj.category or 'Genel'

    def get_itemDescription(self, obj):
        if obj.item_id and obj.item:
            return obj.item.description or ''
        return ''

    def get_integrityVerified(self, obj):
        expected = compute_transaction_hash(obj, obj.prev_hash or 'GENESIS')
        return bool(obj.integrity_hash and obj.integrity_hash == expected)

    def validate_category(self, value):
        return sanitize_text_input(value, 'Kalem / Kategori') or 'Genel'

    def validate_description(self, value):
        return sanitize_text_input(value, 'Açıklama')

    def validate_documentUrl(self, value):
        val = (value or '').strip()
        if not val:
            return ''
        validate_safe_external_url(val)
        return val

    def validate(self, attrs):
        amount = attrs.pop('amount', None)
        unit = attrs.get('unit') or getattr(self.instance, 'unit', None)
        item = attrs.get('item', getattr(self.instance, 'item', None))
        category = (attrs.get('category') or '').strip()

        # Hareketin tarihi hangi yıldaysa kalem de o yılın dönemine bağlanır (her yıl sıfırdan başlar)
        tx_date = attrs.get('date') or getattr(self.instance, 'date', None)
        tx_year = tx_date.year if tx_date else timezone.localdate().year

        def _find_or_create_item(name):
            found = UnitItem.objects.filter(unit=unit, name__iexact=name, year=tx_year).order_by('created_at').first()
            return found or UnitItem.objects.create(unit=unit, name=name, year=tx_year)

        # Farklı birimin veya farklı yılın kalemi seçildiyse, aynı isimde bu birim + yıl için ara veya oluştur
        if item is not None and unit is not None and (item.unit_id != unit.id or item.year != tx_year):
            item = _find_or_create_item(item.name)
            attrs['item'] = item

        if item is None and unit is not None and category and category != 'Genel':
            item = _find_or_create_item(category)
            attrs['item'] = item

        if item is not None:
            attrs['category'] = item.name

        if self.instance is None:
            if amount is None:
                raise serializers.ValidationError({'amount': 'Lütfen geçerli bir tutar girin.'})
            tx_type = attrs.get('type')
            is_debt = tx_type in Transaction.DEBT_TYPES
            attrs['debt'] = amount if is_debt else Decimal('0')
            attrs['credit'] = Decimal('0') if is_debt else amount
            if not attrs.get('description'):
                attrs['description'] = f"{attrs.get('category') or ''} - {tx_type}".strip(' -')
        return attrs


class MeSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='display_name', read_only=True)
    role = serializers.CharField(source='effective_role', read_only=True)
    isOwner = serializers.BooleanField(source='is_owner_role', read_only=True)
    isSuperAdmin = serializers.BooleanField(source='is_super_admin_role', read_only=True)
    roleRank = serializers.IntegerField(source='role_rank', read_only=True)
    unitId = serializers.CharField(source='unit_id', read_only=True, allow_null=True)
    twoFactorEnabled = serializers.BooleanField(source='two_factor_enabled', read_only=True)
    mustChangePassword = serializers.BooleanField(source='must_change_password', read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'name',
            'username',
            'role',
            'isOwner',
            'isSuperAdmin',
            'roleRank',
            'unitId',
            'twoFactorEnabled',
            'mustChangePassword',
        ]


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='full_name', max_length=150)
    unitId = serializers.PrimaryKeyRelatedField(
        source='unit', queryset=Unit.objects.all(), allow_null=True, required=False
    )
    password = serializers.CharField(write_only=True, required=False, min_length=8, max_length=128)
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    isProtected = serializers.SerializerMethodField()
    isOwner = serializers.BooleanField(source='is_owner_role', read_only=True)
    isSuperAdmin = serializers.BooleanField(source='is_super_admin_role', read_only=True)
    roleRank = serializers.IntegerField(source='role_rank', read_only=True)
    canManage = serializers.SerializerMethodField()
    isLocked = serializers.SerializerMethodField()
    failedLoginAttempts = serializers.IntegerField(source='failed_login_attempts', read_only=True)
    twoFactorEnabled = serializers.BooleanField(source='two_factor_enabled', read_only=True)
    mustChangePassword = serializers.BooleanField(source='must_change_password', read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'name',
            'username',
            'role',
            'roleRank',
            'isOwner',
            'isSuperAdmin',
            'canManage',
            'unitId',
            'password',
            'isProtected',
            'isLocked',
            'failedLoginAttempts',
            'twoFactorEnabled',
            'mustChangePassword',
        ]
        read_only_fields = [
            'id',
            'roleRank',
            'isOwner',
            'isSuperAdmin',
            'canManage',
            'isLocked',
            'failedLoginAttempts',
            'twoFactorEnabled',
            'mustChangePassword',
        ]

    def get_isProtected(self, obj):
        return obj.is_owner_role or obj.is_super_admin_role

    def get_canManage(self, obj):
        request = self.context.get('request')
        actor = getattr(request, 'user', None)
        if not actor or not actor.is_authenticated:
            return False
        return actor.can_manage_user(obj)

    def get_isLocked(self, obj):
        return bool(obj.locked_until and obj.locked_until > timezone.now())

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['role'] = instance.effective_role
        return data

    def validate_name(self, value):
        value = sanitize_text_input(value, 'Hesap / Kişi adı')
        if not value:
            raise serializers.ValidationError('Ad zorunludur.')
        return value

    def validate_username(self, value):
        value = sanitize_text_input(value, 'Kullanıcı adı')
        qs = User.objects.filter(username__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Bu kullanıcı adı zaten kayıtlı.')
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        actor = getattr(request, 'user', None)
        role = attrs.get('role', getattr(self.instance, 'role', User.Role.VIEWER_ALL))
        unit = attrs.get('unit', getattr(self.instance, 'unit', None))

        # Rol Hiyerarşisi Kontrolü
        if actor and actor.is_authenticated:
            if self.instance is not None and not actor.can_manage_user(self.instance):
                raise serializers.ValidationError(
                    {'role': 'Rol Hiyerarşisi: Bu hesabı yalnızca üst yetkili (Owner / Baş Yönetici) kontrol edebilir.'}
                )
            if 'role' in attrs or self.instance is None:
                if self.instance is not None and self.instance.is_owner_role and role != User.Role.OWNER:
                    raise serializers.ValidationError({'role': 'Sistem Sahibi (Owner) rolü değiştirilemez.'})
                if role == User.Role.OWNER and (self.instance is None or not self.instance.is_owner_role):
                    raise serializers.ValidationError({'role': 'Sistem Sahibi (Owner) rolü başka bir hesaba atanamaz.'})
                if not actor.can_assign_role(role):
                    raise serializers.ValidationError(
                        {'role': 'Rol Hiyerarşisi: Bu rolü atama yetkiniz bulunmuyor.'}
                    )

        if role == User.Role.VIEWER_UNIT and unit is None:
            raise serializers.ValidationError({'unitId': 'Birim gözlemcisi için bir cari / birim seçin.'})
        if role != User.Role.VIEWER_UNIT:
            attrs['unit'] = None
        pwd = (attrs.get('password') or '').strip()
        if self.instance is None and not pwd:
            raise serializers.ValidationError({'password': 'Şifre zorunludur.'})
        if pwd:
            uname = attrs.get('username') or getattr(self.instance, 'username', '')
            validate_strong_password(pwd, uname)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password').strip()
        user = User(**validated_data)
        user.is_staff = user.role in (User.Role.OWNER, User.Role.SUPER_ADMIN, User.Role.ADMIN)
        user.is_superuser = user.role in (User.Role.OWNER, User.Role.SUPER_ADMIN)
        user.must_change_password = False
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = (validated_data.pop('password', '') or '').strip()
        for key, val in validated_data.items():
            setattr(instance, key, val)
        if instance.is_owner_role:
            instance.role = User.Role.OWNER
        instance.is_superuser = instance.role in (User.Role.OWNER, User.Role.SUPER_ADMIN)
        instance.is_staff = instance.is_superuser or instance.role in (User.Role.OWNER, User.Role.SUPER_ADMIN, User.Role.ADMIN)
        if password:
            instance.set_password(password)
            instance.must_change_password = False
        instance.save()
        return instance


class PasswordSerializer(serializers.Serializer):
    password = serializers.CharField(min_length=8, max_length=128)

    def validate_password(self, value):
        username = self.context.get('username', '')
        validate_strong_password(value, username)
        return value


class SecurityAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityAuditLog
        fields = ['id', 'timestamp', 'action', 'severity', 'username', 'ip_address', 'path', 'description', 'metadata']
