import os
import threading
import time
import urllib.request

from django.apps import AppConfig

_keep_alive_started = False


def _self_keep_alive_loop():
    """Render üzerinde çalışırken her 10 dakikada bir dış URL'ye ping atarak 15 dakikalık uyku modunu engeller."""
    target = os.environ.get('RENDER_EXTERNAL_URL', 'https://serhendi.onrender.com').rstrip('/') + '/api/health/'
    time.sleep(20)
    while True:
        try:
            req = urllib.request.Request(target, headers={'User-Agent': 'Serhendi-KeepAlive/1.0'})
            with urllib.request.urlopen(req, timeout=20):
                pass
        except Exception:
            pass
        time.sleep(600)


class CariConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'cari'
    verbose_name = 'Birim & Cari Takip'

    def ready(self):
        global _keep_alive_started
        if _keep_alive_started:
            return
        if os.environ.get('RENDER') or os.environ.get('RENDER_EXTERNAL_URL') or os.environ.get('DJANGO_DEBUG') == '0':
            _keep_alive_started = True
            # Sunucu yeni bir konteynerde başlarsa eksik varsayılan hesapları (mevcut şifreleri ezmeden) otomatik tamamla
            try:
                from django.db.utils import OperationalError, ProgrammingError
                from .defaults import load_defaults

                load_defaults(force_reset=False)
            except (OperationalError, ProgrammingError, Exception):
                pass
            t = threading.Thread(target=_self_keep_alive_loop, daemon=True, name='render-keep-alive')
            t.start()
