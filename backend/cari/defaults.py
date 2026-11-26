"""Varsayılan 8 birim, örnek hareketler ve Rol Hiyerarşisine uygun güvenli şifreli kullanıcılar."""
from decimal import Decimal

from django.db import transaction as db_transaction

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
]

# Her cari / birim için kalem kalem borç listesi: (id, birim, kalem adı, kalem detayı / neye ait, borç, ödenen)
DEFAULT_UNIT_ITEMS = [
    ('KLM-0101', 'BRM-01', 'Kumanya', 'Dergah Aylık Erzak & Kumanya Kolisi', 80000, 55000),
    ('KLM-0102', 'BRM-01', 'Kandil Simidi', 'Kandil Gecesi Simit Dağıtımı', 35000, 25000),
    ('KLM-0103', 'BRM-01', 'Patates', 'Çuval Patates & Kışlık Sebze Sevkiyatı', 30000, 15000),
    ('KLM-0104', 'BRM-02', 'Kumanya', 'Yenimahalle Erzak & Kumanya Paketi', 50000, 30000),
    ('KLM-0105', 'BRM-02', 'Kandil Simidi', 'Kandil Simidi & İkramlık', 20000, 12000),
    ('KLM-0106', 'BRM-02', 'Patates', 'Mutfak Patates & Soğan Tedariki', 18000, 8000),
    ('KLM-0107', 'BRM-03', 'Kumanya', 'Kiptaş 2 Kumanya Dağıtım Paketi', 42000, 0),
    ('KLM-0108', 'BRM-03', 'Kandil Simidi', 'Kandil Simidi التوزيع', 18000, 0),
    ('KLM-0109', 'BRM-03', 'Patates', 'Çuval Patates Sevkiyatı', 12000, 0),
    ('KLM-0110', 'BRM-04', 'Kumanya', 'Mimar Sinan Dönem Kumanyası', 54000, 54000),
    ('KLM-0111', 'BRM-04', 'Kandil Simidi', 'Kandil Simidi Kolisi', 22000, 22000),
    ('KLM-0112', 'BRM-04', 'Patates', 'Çuval Patates Alımı', 18000, 18000),
    ('KLM-0113', 'BRM-05', 'Kumanya', 'Mavi Yelken Kumanya & Gıda', 35000, 0),
    ('KLM-0114', 'BRM-05', 'Kandil Simidi', 'Kandil Simidi Paketi', 15000, 0),
    ('KLM-0115', 'BRM-05', 'Patates', 'Kışlık Patates Çuvalı', 11500, 0),
    ('KLM-0116', 'BRM-06', 'Kumanya', 'Gümüşyaka Dergah Aylık Kumanya & Erzak', 45000, 25000),
    ('KLM-0117', 'BRM-06', 'Kandil Simidi', 'Gümüşyaka Kandil Simidi Dağıtımı', 20000, 10000),
    ('KLM-0118', 'BRM-06', 'Patates', 'Gümüşyaka Mutfak Patates Çuvalı', 18000, 8000),
    ('KLM-0119', 'BRM-07', 'Kumanya', 'Danamandıra Kumanya Sevkiyatı', 30000, 0),
    ('KLM-0120', 'BRM-07', 'Kandil Simidi', 'Kandil Simidi Paketi', 14000, 0),
    ('KLM-0121', 'BRM-07', 'Patates', 'Patates Tedariki', 10000, 0),
    ('KLM-0122', 'BRM-08', 'Kumanya', 'Silivri İl Heyeti Genel Kumanya', 120000, 90000),
    ('KLM-0123', 'BRM-08', 'Kandil Simidi', 'İl Heyeti Kandil Simidi Organizasyonu', 50000, 35000),
    ('KLM-0124', 'BRM-08', 'Patates', 'İl Heyeti Toplu Patates Sevkiyatı', 40000, 25000),
]

# (id, tarih, birim, kalem_id, kalem_adı, tür, açıklama, borç, alacak)
DEFAULT_TRANSACTIONS = [
    ('HRK-1001', '2026-11-02', 'BRM-01', 'KLM-0101', 'Kumanya', 'Mal Sevkiyatı', 'Merkez Dergah Dönem Kumanya & Erzak Sevkiyatı', 145000, 0),
    ('HRK-1002', '2026-11-05', 'BRM-01', 'KLM-0101', 'Kumanya', 'Havale / EFT', 'Merkez Dergah Kumanya Banka Havale Ödemesi', 0, 95000),
    ('HRK-1003', '2026-11-07', 'BRM-02', 'KLM-0104', 'Kumanya', 'Borç Kaydı', 'Yenimahalle Dergah Kumanya & Simit Borç Kaydı', 88000, 0),
    ('HRK-1004', '2026-11-09', 'BRM-02', 'KLM-0104', 'Kumanya', 'Nakit Tahsilat', 'Makbuz Karşılığı Kumanya Nakit Tahsilat', 0, 50000),
    ('HRK-1005', '2026-11-11', 'BRM-03', 'KLM-0107', 'Kumanya', 'Mal Sevkiyatı', 'Kiptaş 2 Dergah Kumanya Sevkiyat Paketi', 72000, 0),
    ('HRK-1006', '2026-11-12', 'BRM-04', 'KLM-0110', 'Kumanya', 'Borç Kaydı', 'Mimar Sinan Dergah Kumanya Ürün Sevkiyatı', 94000, 0),
    ('HRK-1007', '2026-11-14', 'BRM-04', 'KLM-0110', 'Kumanya', 'Alacak Kaydı', 'Mimar Sinan Dergah Kumanya Hesap Alacak Mahsubu', 0, 94000),
    ('HRK-1008', '2026-11-15', 'BRM-05', 'KLM-0113', 'Kumanya', 'Mal Sevkiyatı', 'Mavi yelken Dergah Kumanya Sevkiyat Kaydı', 61500, 0),
    ('HRK-1009', '2026-11-17', 'BRM-06', 'KLM-0116', 'Kumanya', 'Borç Kaydı', 'Gümüşyaka Dergah Kumanya & Patates Borç Kaydı', 83000, 0),
    ('HRK-1010', '2026-11-18', 'BRM-06', 'KLM-0116', 'Kumanya', 'İade / Mahsup', 'Gümüşyaka Dergah Kumanya Ödeme / Mahsup Kaydı', 0, 43000),
    ('HRK-1011', '2026-11-19', 'BRM-07', 'KLM-0119', 'Kumanya', 'Mal Sevkiyatı', 'Danamandıra Dergah Kumanya Sevkiyat Teslimatı', 54000, 0),
    ('HRK-1012', '2026-11-20', 'BRM-08', 'KLM-0122', 'Kumanya', 'Borç Kaydı', 'Silivri il heyeti Genel Kumanya Sevkiyat Kaydı', 210000, 0),
    ('HRK-1013', '2026-11-21', 'BRM-08', 'KLM-0122', 'Kumanya', 'Havale / EFT', 'Silivri il heyeti Kumanya Kısmi Tahsilat Ödemesi', 0, 150000),
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

    has_existing_units = Unit.objects.exists()
    for uid, name, contact, phone in DEFAULT_UNITS:
        if force_reset or not Unit.objects.filter(pk=uid).exists():
            Unit.objects.update_or_create(
                id=uid,
                defaults={'name': name, 'contact': contact, 'phone': encrypt_sensitive(phone)},
            )

    has_existing_items = UnitItem.objects.exists()
    if force_reset or not has_existing_items:
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

    has_existing_txs = Transaction.objects.exists()
    if force_reset or not has_existing_txs:
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

    if force_reset or not has_existing_units:
        SecurityAuditLog.objects.create(
            action='DEFAULTS_LOADED',
            severity=SecurityAuditLog.Severity.INFO,
            username='system',
            ip_address='127.0.0.1',
            description='Varsayılan 8 birim (şifreli), cari kalemler, hareketler ve kullanıcılar yüklendi.',
        )
