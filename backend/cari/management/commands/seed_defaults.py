from django.core.management.base import BaseCommand

from cari.defaults import load_defaults


class Command(BaseCommand):
    help = 'Varsayılan 8 birimi, örnek cari hareketleri ve kullanıcı şifrelerini yükler.'

    def handle(self, *args, **options):
        load_defaults()
        self.stdout.write(self.style.SUCCESS('Varsayılan birimler, hareketler ve kullanıcılar yüklendi.'))
