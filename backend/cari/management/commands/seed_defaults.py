from django.core.management.base import BaseCommand

from cari.defaults import load_defaults


class Command(BaseCommand):
    help = 'Eksik olan varsayılan birimleri, örnek cari hareketleri ve kullanıcıları (mevcut şifreleri ezmeden) yükler.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Mevcut verileri ve kullanıcı şifrelerini zorla varsayılanlara sıfırlar.',
        )

    def handle(self, *args, **options):
        force = bool(options.get('force'))
        load_defaults(force_reset=force)
        self.stdout.write(self.style.SUCCESS('Varsayılan birimler, hareketler ve kullanıcılar kontrol edildi / yüklendi.'))
