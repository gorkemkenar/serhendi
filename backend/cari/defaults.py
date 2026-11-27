"""Varsayılan 8 birim, örnek hareketler ve Rol Hiyerarşisine uygun güvenli şifreli kullanıcılar."""
from decimal import Decimal

from django.db import models, transaction as db_transaction

from .models import SecurityAuditLog, Transaction, Unit, UnitItem, User
from .security import WEAK_PASSWORDS, encrypt_sensitive

ADMIN_NAME = 'Silivri Serhendi Baş Yönetici'

DEFAULT_UNITS = [
    ('BRM-01', 'Merkez Dergah', 'Ahmet Yılmaz', '0532 101 01 01'),
    ('BRM-02', 'Yenimahalle Dergah', 'Mehmet Demir', '0532 102 02 02'),
    ('BRM-03', 'Kiptaş 2 Dergah', 'Mustafa Kaya', '0532 103 03 03'),
    ('BRM-04', 'Mimar Sinan Dergah', 'Ali Çelik', '0532 104 04 04'),
    ('BRM-05', 'Mavi yelken Dergah', 'Hüseyin Şahin', '0532 105 05 05'),
    ('BRM-06', 'Gümüşyaka Dergah', 'İbrahim Yıldız', '0532 106 06 06'),
    ('BRM-07', 'Danamandıra Dergah', 'Ömer Aydın', '0532 107 07 07'),
    ('BRM-08', 'Silivri il heyeti', 'Yusuf Arslan', '0532 108 08 08'),
    ('BRM-09', 'Nezir Dergah', 'Yetkili', '0532 109 09 09'),
]

# Her cari / birim için kalem kalem borç listesi: (id, birim, kalem adı, kalem detayı, borç, ödenen)
# 2026 SİLİVRİ PATATES verileri (Adet açıklamaya "X Çuval" şeklinde yazılmıştır, birim fiyat yazılmaz)
DEFAULT_UNIT_ITEMS = [
    ('KLM-0101', 'BRM-01', 'Kumanya', '', 0, 0),
    ('KLM-0102', 'BRM-01', 'Kandil Simidi', '', 0, 0),
    ('KLM-0103', 'BRM-01', 'Patates', '23 Çuval', 41400, 26100),
    ('KLM-0104', 'BRM-02', 'Kumanya', '', 0, 0),
    ('KLM-0105', 'BRM-02', 'Kandil Simidi', '', 0, 0),
    ('KLM-0106', 'BRM-02', 'Patates', '18 Çuval', 32400, 32400),
    ('KLM-0107', 'BRM-03', 'Kumanya', '', 0, 0),
    ('KLM-0108', 'BRM-03', 'Kandil Simidi', '', 0, 0),
    ('KLM-0109', 'BRM-03', 'Patates', '9 Çuval', 16200, 16200),
    ('KLM-0110', 'BRM-04', 'Kumanya', '', 0, 0),
    ('KLM-0111', 'BRM-04', 'Kandil Simidi', '', 0, 0),
    ('KLM-0112', 'BRM-04', 'Patates', '8 Çuval', 14400, 14400),
    ('KLM-0113', 'BRM-05', 'Kumanya', '', 0, 0),
    ('KLM-0114', 'BRM-05', 'Kandil Simidi', '', 0, 0),
    ('KLM-0115', 'BRM-05', 'Patates', '10 Çuval', 18000, 14700),
    ('KLM-0116', 'BRM-06', 'Kumanya', '', 0, 0),
    ('KLM-0117', 'BRM-06', 'Kandil Simidi', '', 0, 0),
    ('KLM-0118', 'BRM-06', 'Patates', '25 Çuval', 45000, 45000),
    ('KLM-0119', 'BRM-07', 'Kumanya', '', 0, 0),
    ('KLM-0120', 'BRM-07', 'Kandil Simidi', '', 0, 0),
    ('KLM-0121', 'BRM-07', 'Patates', '9 Çuval', 16200, 16200),
    ('KLM-0122', 'BRM-08', 'Kumanya', '', 0, 0),
    ('KLM-0123', 'BRM-08', 'Kandil Simidi', '', 0, 0),
    ('KLM-0124', 'BRM-08', 'Patates', '16 Çuval', 28800, 28800),
    ('KLM-0125', 'BRM-09', 'Kumanya', '', 0, 0),
    ('KLM-0126', 'BRM-09', 'Kandil Simidi', '', 0, 0),
    ('KLM-0127', 'BRM-09', 'Patates', '2 Çuval', 3600, 0),
]

# (id, tarih, birim, kalem_id, kalem_adı, tür, açıklama, borç, alacak)
DEFAULT_TRANSACTIONS = [
    ('HRK-1001', '2026-11-27', 'BRM-05', 'KLM-0115', 'Patates', 'Malzeme', '10 Çuval', 18000, 0),
    ('HRK-1002', '2026-11-27', 'BRM-05', 'KLM-0115', 'Patates', 'Nakit Tahsilat', '10 Çuval', 0, 14700),
    ('HRK-1003', '2026-11-27', 'BRM-04', 'KLM-0112', 'Patates', 'Malzeme', '8 Çuval', 14400, 0),
    ('HRK-1004', '2026-11-27', 'BRM-04', 'KLM-0112', 'Patates', 'Nakit Tahsilat', '8 Çuval', 0, 14400),
    ('HRK-1005', '2026-11-27', 'BRM-01', 'KLM-0103', 'Patates', 'Malzeme', '23 Çuval', 41400, 0),
    ('HRK-1006', '2026-11-27', 'BRM-01', 'KLM-0103', 'Patates', 'Nakit Tahsilat', '23 Çuval', 0, 26100),
    ('HRK-1007', '2026-11-27', 'BRM-06', 'KLM-0118', 'Patates', 'Malzeme', '25 Çuval', 45000, 0),
    ('HRK-1008', '2026-11-27', 'BRM-06', 'KLM-0118', 'Patates', 'Nakit Tahsilat', '25 Çuval', 0, 45000),
    ('HRK-1009', '2026-11-27', 'BRM-03', 'KLM-0109', 'Patates', 'Malzeme', '9 Çuval', 16200, 0),
    ('HRK-1010', '2026-11-27', 'BRM-03', 'KLM-0109', 'Patates', 'Nakit Tahsilat', '9 Çuval', 0, 16200),
    ('HRK-1011', '2026-11-27', 'BRM-02', 'KLM-0106', 'Patates', 'Malzeme', '18 Çuval', 32400, 0),
    ('HRK-1012', '2026-11-27', 'BRM-02', 'KLM-0106', 'Patates', 'Nakit Tahsilat', '18 Çuval', 0, 32400),
    ('HRK-1013', '2026-11-27', 'BRM-07', 'KLM-0121', 'Patates', 'Malzeme', '9 Çuval', 16200, 0),
    ('HRK-1014', '2026-11-27', 'BRM-07', 'KLM-0121', 'Patates', 'Nakit Tahsilat', '9 Çuval', 0, 16200),
    ('HRK-1015', '2026-11-27', 'BRM-09', 'KLM-0127', 'Patates', 'Malzeme', '2 Çuval', 3600, 0),
    ('HRK-1016', '2026-11-27', 'BRM-08', 'KLM-0124', 'Patates', 'Malzeme', '16 Çuval', 28800, 0),
    ('HRK-1017', '2026-11-27', 'BRM-08', 'KLM-0124', 'Patates', 'Nakit Tahsilat', '16 Çuval', 0, 28800),
]

# Rol Hiyerarşisi (Seviye 5 Owner -> Seviye 1) ve Güçlü Şifreli Hesaplar:
# (ad, kullanıcı adı, güçlü şifre, rol, birim)
DEFAULT_USERS = [
    ('Görkem Kenar (Sistem Sahibi)', 'gorkem', 'Serhendi!Owner#2026', 'owner', None),
    (ADMIN_NAME, 'admin', 'Serhendi!Admin26', 'super_admin', None),
    ('Cari İşlemler Yöneticisi', 'yonetici', 'Serhendi!Ynt26', 'admin', None),
    ('Genel Merkez Gözlemci', 'genel', 'Serhendi!Gnl26', 'viewer_all', None),
    ('Merkez Dergah Gözlemci', 'merkez', 'Serhendi!Mrk01', 'viewer_unit', 'BRM-01'),
    ('Yenimahalle Dergah Gözlemci', 'yenimahalle', 'Serhendi!Ynm02', 'viewer_unit', 'BRM-02'),
    ('Kiptaş 2 Dergah Gözlemci', 'kiptas2', 'Serhendi!Kpt03', 'viewer_unit', 'BRM-03'),
    ('Mimar Sinan Dergah Gözlemci', 'mimarsinan', 'Serhendi!Mmr04', 'viewer_unit', 'BRM-04'),
    ('Mavi yelken Dergah Gözlemci', 'maviyelken', 'Serhendi!Mvy05', 'viewer_unit', 'BRM-05'),
    ('Gümüşyaka Dergah Gözlemci', 'gumusyaka', 'Serhendi!Gms06', 'viewer_unit', 'BRM-06'),
    ('Danamandıra Dergah Gözlemci', 'danamandira', 'Serhendi!Dnm07', 'viewer_unit', 'BRM-07'),
    ('Silivri il heyeti Gözlemci', 'ilheyeti', 'Serhendi!Ilh08', 'viewer_unit', 'BRM-08'),
    ('Nezir Dergah Gözlemci', 'nezir', 'Serhendi!Nzr09', 'viewer_unit', 'BRM-09'),
]


@db_transaction.atomic
def load_defaults(force_reset: bool = False):
    """Varsayılan birimleri, kalemleri, hareketleri ve kullanıcıları yükler.

    - force_reset=False (Derleme / Başlangıç sırasında seed_defaults):
      Yalnızca eksik olan varsayılan birim, kalem ve kullanıcıları oluşturur.
      Mevcut kullanıcıların değiştirilmiş şifrelerine, rollerine veya eklenen kayıtlara ASLA dokunmaz.
    - force_reset=True (Arayüzden "Varsayılanları Yükle" butonuna basıldığında):
      Birimleri, kalemleri ve hareketleri sıfırlar; varsayılan şifreleri yeniden yükler.
    """
    if force_reset:
        Transaction.objects.all().delete()
        UnitItem.objects.all().delete()
        Unit.objects.all().delete()

    # Yalnızca veritabanı TAMAMEN BOŞSA (ilk kurulum) veya yönetici "Varsayılanları Yükle" (force_reset=True) dediyse birim/kalem/hareket yükle.
    # Böylece silinen veya değiştirilen hiçbir cari, kalem ya da hareket yeniden başlatmada geri gelmez veya sıfırlanmaz.
    has_any_units = Unit.objects.exists()
    if force_reset or not has_any_units:
        for uid, name, contact, phone in DEFAULT_UNITS:
            Unit.objects.update_or_create(
                id=uid,
                defaults={'name': name, 'contact': contact, 'phone': encrypt_sensitive(phone)},
            )

        for iid, unit_id, iname, idesc, debt, paid in DEFAULT_UNIT_ITEMS:
            if Unit.objects.filter(pk=unit_id).exists():
                UnitItem.objects.update_or_create(
                    id=iid,
                    defaults={
                        'unit_id': unit_id,
                        'name': iname,
                        'description': idesc,
                        'debt': Decimal(debt),
                        'paid': Decimal(paid),
                    },
                )

        prev_hash = 'GENESIS'
        for tid, date, unit_id, item_id, cat_name, tx_type, desc, debt, credit in DEFAULT_TRANSACTIONS:
            if Unit.objects.filter(pk=unit_id).exists():
                linked_item = UnitItem.objects.filter(pk=item_id).first()
                tx = Transaction(
                    id=tid,
                    date=date,
                    unit_id=unit_id,
                    item=linked_item,
                    category=cat_name,
                    type=tx_type,
                    description=desc,
                    debt=Decimal(debt),
                    credit=Decimal(credit),
                    created_by=ADMIN_NAME,
                    prev_hash=prev_hash,
                )
                tx.save()
                prev_hash = tx.integrity_hash

    for full_name, username, password, role, unit_id in DEFAULT_USERS:
        user, created = User.objects.get_or_create(username=username)
        if created or force_reset or not user.has_usable_password():
            user.full_name = full_name
            user.role = role
            user.unit_id = unit_id if Unit.objects.filter(pk=unit_id).exists() else None
            user.is_active = True
            user.is_staff = role in ('owner', 'super_admin', 'admin')
            user.is_superuser = role in ('owner', 'super_admin')
            user.failed_login_attempts = 0
            user.locked_until = None
            user.must_change_password = password.lower() in WEAK_PASSWORDS or len(password) < 8
            user.set_password(password)
            user.save()

    # Mevcut kalemlerde otomatik doldurulmuş hazır açıklamaları temizle ve hareket geçmişini senkronize et
    auto_descriptions = {
        'Dergah Aylık Erzak & Kumanya Kolisi',
        'Kandil Gecesi Simit Dağıtımı',
        'Çuval Patates & Kışlık Sebze Sevkiyatı',
        'Yenimahalle Erzak & Kumanya Paketi',
        'Kandil Simidi & İkramlık',
        'Mutfak Patates & Soğan Tedariki',
        'Kiptaş 2 Kumanya Dağıtım Paketi',
        'Kandil Simidi التوزيع',
        'Çuval Patates Sevkiyatı',
        'Mimar Sinan Dönem Kumanyası',
        'Kandil Simidi Kolisi',
        'Çuval Patates Alımı',
        'Mavi Yelken Kumanya & Gıda',
        'Kandil Simidi Paketi',
        'Kışlık Patates Çuvalı',
        'Gümüşyaka Dergah Aylık Kumanya & Erzak',
        'Gümüşyaka Kandil Simidi Dağıtımı',
        'Gümüşyaka Mutfak Patates Çuvalı',
        'Danamandıra Kumanya Sevkiyatı',
        'Patates Tedariki',
        'Silivri İl Heyeti Genel Kumanya',
        'İl Heyeti Kandil Simidi Organizasyonu',
        'İl Heyeti Toplu Patates Sevkiyatı',
    }
    for item in UnitItem.objects.select_related('unit').all():
        if item.description and (item.description in auto_descriptions or item.description.endswith(' Kalemi')):
            UnitItem.objects.filter(pk=item.pk).update(description='')
            item.description = ''

        # Eğer bu kaleme bağlı hiç hareket yoksa ve veritabanında bu birime ait hiç hareket yoksa başlangıç hareketi oluştur
        has_linked_tx = Transaction.objects.filter(
            models.Q(item=item) | models.Q(unit=item.unit, category__iexact=item.name)
        ).exists()
        if not has_linked_tx and not has_any_units:
            # Aynı birimde eşleşmeyen HRK-1001..1013 varsa ve bu kalem Kumanya ise bağla, yoksa kalemin kendi hareketini oluştur
            if (item.debt or 0) > 0:
                Transaction.objects.create(
                    date='2026-11-01',
                    unit=item.unit,
                    item=item,
                    category=item.name,
                    type=Transaction.Type.MALZEME,
                    description=item.description or f'{item.unit.name} {item.name} Borç Kaydı',
                    debt=item.debt,
                    credit=Decimal('0'),
                    created_by=ADMIN_NAME,
                )
            if (item.paid or 0) > 0:
                Transaction.objects.create(
                    date='2026-11-10',
                    unit=item.unit,
                    item=item,
                    category=item.name,
                    type=Transaction.Type.NAKIT_TAHSILAT,
                    description=f'{item.unit.name} {item.name} Ödeme / Tahsilat Kaydı',
                    debt=Decimal('0'),
                    credit=item.paid,
                    created_by=ADMIN_NAME,
                )

    # Eski 'Mal Sevkiyatı' kayıtlarını 'Malzeme' olarak güncelle
    for tx in Transaction.objects.filter(type='Mal Sevkiyatı'):
        tx.type = 'Malzeme'
        tx.save()

    # 2026 SİLİVRİ PATATES tablosu verilerini bir defaya mahsus dergahlara yükle
    if not SecurityAuditLog.objects.filter(action='PATATES_2026_LOADED_V2').exists():
        # Nezir Dergah ve eksik birimleri ekle (mevcut birimlerin yetkili/telefon bilgilerine dokunma)
        for uid, name, contact, phone in DEFAULT_UNITS:
            if not Unit.objects.filter(pk=uid).exists():
                Unit.objects.create(
                    id=uid,
                    name=name,
                    contact=contact,
                    phone=encrypt_sensitive(phone),
                )

        # Her birimin Patates kalemini bul (isme veya ID'ye göre) ve güncelle, mükerrer Patates kalemi varsa temizle
        for iid, unit_id, iname, idesc, debt, paid in DEFAULT_UNIT_ITEMS:
            if not Unit.objects.filter(pk=unit_id).exists():
                continue
            if iname == 'Patates':
                existing_patates = list(
                    UnitItem.objects.filter(unit_id=unit_id, name__iexact='Patates').order_by('id')
                )
                if existing_patates:
                    target_item = existing_patates[0]
                    target_item.name = 'Patates'
                    target_item.description = idesc
                    target_item.debt = Decimal(debt)
                    target_item.paid = Decimal(paid)
                    target_item.save()
                    # Aynı birimde mükerrer başka Patates kalemi açılmışsa sil
                    for extra in existing_patates[1:]:
                        extra.delete()
                else:
                    UnitItem.objects.update_or_create(
                        id=iid,
                        defaults={
                            'unit_id': unit_id,
                            'name': iname,
                            'description': idesc,
                            'debt': Decimal(debt),
                            'paid': Decimal(paid),
                        },
                    )
            elif not UnitItem.objects.filter(unit_id=unit_id, name__iexact=iname).exists():
                UnitItem.objects.update_or_create(
                    id=iid,
                    defaults={
                        'unit_id': unit_id,
                        'name': iname,
                        'description': idesc,
                        'debt': Decimal(debt),
                        'paid': Decimal(paid),
                    },
                )

        # Patates kalemlerine ait cari hareketleri temizle ve tablodaki güncel verilerle yeniden oluştur
        patates_items_by_unit = {
            it.unit_id: it for it in UnitItem.objects.filter(name__iexact='Patates')
        }
        Transaction.objects.filter(
            models.Q(category__iexact='Patates') | models.Q(item__name__iexact='Patates')
        ).delete()

        last_tx = Transaction.objects.order_by('id').last()
        prev_hash = last_tx.integrity_hash if last_tx and last_tx.integrity_hash else 'GENESIS'
        for tid, date, unit_id, item_id, cat_name, tx_type, desc, debt, credit in DEFAULT_TRANSACTIONS:
            if Unit.objects.filter(pk=unit_id).exists():
                linked_item = patates_items_by_unit.get(unit_id) or UnitItem.objects.filter(pk=item_id).first()
                Transaction.objects.filter(pk=tid).delete()
                tx = Transaction(
                    id=tid,
                    date=date,
                    unit_id=unit_id,
                    item=linked_item,
                    category=cat_name,
                    type=tx_type,
                    description=desc,
                    debt=Decimal(debt),
                    credit=Decimal(credit),
                    created_by=ADMIN_NAME,
                    prev_hash=prev_hash,
                )
                tx.save()
                prev_hash = tx.integrity_hash

        SecurityAuditLog.objects.create(
            action='PATATES_2026_LOADED_V2',
            severity=SecurityAuditLog.Severity.INFO,
            username='system',
            ip_address='127.0.0.1',
            description='2026 Silivri Patates verileri (120 Çuval, 216.000 TL Borç, 193.800 TL Ödenen, 22.200 TL Kalan) dergahlara yüklendi.',
        )

    if force_reset or not has_any_units:
        SecurityAuditLog.objects.create(
            action='DEFAULTS_LOADED',
            severity=SecurityAuditLog.Severity.INFO,
            username='system',
            ip_address='127.0.0.1',
            description='Varsayılan 9 birim (şifreli), cari kalemler, hareketler ve kullanıcılar yüklendi.',
        )
