import mimetypes
from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404, HttpResponse
from django.urls import include, path, re_path

admin.site.site_header = 'SİLİVRİ SERHENDİ Yönetim'
admin.site.site_title = 'SİLİVRİ SERHENDİ'


def serve_spa(request, resource: str = ''):
    """Yayınlama modunda derlenmiş React (frontend/dist) uygulamasını ve PWA dosyalarını doğrudan sunar."""
    dist_dir: Path = getattr(settings, 'FRONTEND_DIST_DIR', Path())
    if not dist_dir or not dist_dir.exists():
        return HttpResponse(
            'Ön yüz derlemesi (frontend/dist) bulunamadı. Lütfen "npm --prefix frontend run build" komutunu çalıştırın.',
            status=503,
            content_type='text/plain; charset=utf-8',
        )

    clean_res = (resource or '').lstrip('/')
    if clean_res:
        candidate = (dist_dir / clean_res).resolve()
        if str(candidate).startswith(str(dist_dir.resolve())) and candidate.is_file():
            content_type, _ = mimetypes.guess_type(str(candidate))
            return FileResponse(open(candidate, 'rb'), content_type=content_type or 'application/octet-stream')
        if clean_res.startswith('assets/'):
            raise Http404('Statik dosya bulunamadı.')

    index_file = dist_dir / 'index.html'
    if not index_file.is_file():
        raise Http404('index.html bulunamadı.')
    return FileResponse(open(index_file, 'rb'), content_type='text/html; charset=utf-8')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('cari.urls')),
    re_path(r'^(?P<resource>.*)$', serve_spa, name='spa-entry'),
]
