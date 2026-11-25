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

# Her cari / birim için kalem kalem borç listesi: (id, birim, kalem adı, borç, ödenen)
DEFAULT_UNIT_ITEMS = [
    ('KLM-0101', 'BRM-01', 'Kumanya', 80000, 55000),
    ('KLM-0102', 'BRM-01', 'Kandil Simidi', 35000, 25000),
    ('KLM-0103', 'BRM-01', 'Patates', 30000, 15000),
    ('KLM-0104', 'BRM-02', 'Kumanya', 50000, 30000),
    ('KLM-0105', 'BRM-02', 'Kandil Simidi', 20000, 12000),
    ('KLM-0106', 'BRM-02', 'Patates', 18000, 8000),
    ('KLM-0107', 'BRM-03', 'Kumanya', 42000, 0),
    ('KLM-0108', 'BRM-03', 'Kandil Simidi', 18000, 0),
    ('KLM-0109', 'BRM-03', 'Patates', 12000, 0),
    ('KLM-0110', 'BRM-04', 'Kumanya', 54000, 54000),
    ('KLM-0111', 'BRM-04', 'Kandil Simidi', 22000, 22000),
    ('KLM-0112', 'BRM-04', 'Patates', 18000, 18000),
    ('KLM-0113', 'BRM-05', 'Kumanya', 35000, 0),
    ('KLM-0114', 'BRM-05', 'Kandil Simidi', 15000, 0),
    ('KLM-0115', 'BRM-05', 'Patates', 11500, 0),
    ('KLM-0116', 'BRM-06', 'Kumanya', 45000, 25000),
    ('KLM-0117', 'BRM-06', 'Kandil Simidi', 20000, 10000),
    ('KLM-0118', 'BRM-06', 'Patates', 18000, 8000),
    ('KLM-0119', 'BRM-07', 'Kumanya', 30000, 0),
    ('KLM-0120', 'BRM-07', 'Kandil Simidi', 14000, 0),
    ('KLM-0121', 'BRM-07', 'Patates', 10000, 0),
    ('KLM-0122', 'BRM-08', 'Kumanya', 120000, 90000),
    ('KLM-0123', 'BRM-08', 'Kandil Simidi', 50000, 35000),
    ('KLM-0124', 'BRM-08', 'Patates', 40000, 25000),
]

# (id, tarih, birim, tür, açıklama, borç, alacak)
DEFAULT_TRANSACTIONS = [
    ('HRK-1001', '2026-11-02', 'BRM-01', 'Mal Sevkiyatı', 'Merkez Dergah Dönem Malzeme Sevkiyatı', 145000, 0),
    ('HRK-1002', '2026-11-05', 'BRM-01', 'Havale / EFT', 'Merkez Dergah Banka Havale Ödemesi', 0, 95000),
    ('HRK-1003', '2026-11-07', 'BRM-02', 'Borç Kaydı', 'Yenimahalle Dergah Tedarik Borç Kaydı', 88000, 0),
    ('HRK-1004', '2026-11-09', 'BRM-02', 'Nakit Tahsilat', 'Makbuz Karşılığı Nakit Tahsilat', 0, 50000),
    ('HRK-1005', '2026-11-11', 'BRM-03', 'Mal Sevkiyatı', 'Kiptaş 2 Dergah Sevkiyat Paketi', 72000, 0),
    ('HRK-1006', '2026-11-12', 'BRM-04', 'Borç Kaydı', 'Mimar Sinan Dergah Ürün Sevkiyatı', 94000, 0),
    ('HRK-1007', '2026-11-14', 'BRM-04', 'Alacak Kaydı', 'Mimar Sinan Dergah Hesap Alacak Mahsubu', 0, 94000),
    ('HRK-1008', '2026-11-15', 'BRM-05', 'Mal Sevkiyatı', 'Mavi yelken Dergah Sevkiyat Kaydı', 61500, 0),
    ('HRK-1009', '2026-11-17', 'BRM-06', 'Borç Kaydı', 'Gümüşyaka Dergah Dönemsel Borç Kaydı', 83000, 0),
    ('HRK-1010', '2026-11-18', 'BRM-06', 'İade / Mahsup', 'Gümüşyaka Dergah İade Mahsup Kaydı', 0, 43000),
    ('HRK-1011', '2026-11-19', 'BRM-07', 'Mal Sevkiyatı', 'Danamandıra Dergah Sevkiyat Teslimatı', 54000, 0),
    ('HRK-1012', '2026-11-20', 'BRM-08', 'Borç Kaydı', 'Silivri il heyeti Genel Sevkiyat Kaydı', 210000, 0),
    ('HRK-1013', '2026-11-21', 'BRM-08', 'Havale / EFT', 'Silivri il heyeti Kısmi Tahsilat Ödemesi', 0, 150000),
]

# Rol Hiyerarşisi (Seviye 4 -> Seviye 1) ve Güçlü Şifreli Deneme Hesapları:
# (ad, kullanıcı adı, güçlü şifre, rol, birim)
DEFAULT_USERS = [
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
def load_defaults():
    """Birimleri ve hareketleri sıfırlar, rol hiyerarşisine uygun güvenli şifreli kullanıcıları yükler."""
    Transaction.objects.all().delete()
    UnitItem.objects.all().delete()
    Unit.objects.all().delete()

    for uid, name, contact, phone in DEFAULT_UNITS:
        Unit.objects.create(id=uid, name=name, contact=contact, phone=encrypt_sensitive(phone))

    for iid, unit_id, iname, debt, paid in DEFAULT_UNIT_ITEMS:
        UnitItem.objects.create(
            id=iid,
            unit_id=unit_id,
            name=iname,
            debt=Decimal(debt),
            paid=Decimal(paid),
        )

    prev_hash = 'GENESIS'
    for tid, date, unit_id, tx_type, desc, debt, credit in DEFAULT_TRANSACTIONS:
        tx = Transaction(
            id=tid,
            date=date,
            unit_id=unit_id,
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
        user, _ = User.objects.get_or_create(username=username)
        user.full_name = full_name
        user.role = role
        user.unit_id = unit_id
        user.is_active = True
        user.is_staff = role in ('super_admin', 'admin')
        user.is_superuser = role == 'super_admin'
        user.failed_login_attempts = 0
        user.locked_until = None
        user.must_change_password = password.lower() in WEAK_PASSWORDS or len(password) < 8
        user.set_password(password)
        user.save()

    SecurityAuditLog.objects.create(
        action='DEFAULTS_LOADED',
        severity=SecurityAuditLog.Severity.INFO,
        username='system',
        ip_address='127.0.0.1',
        description='Varsayılan 8 birim (şifreli), 13 cari hareket (HMAC-SHA256 imzalı) ve 4 kademeli rol hiyerarşisi kullanıcıları yüklendi.',
    )
