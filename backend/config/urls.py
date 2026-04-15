import os

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]

# Médias : en DEBUG, ou si DJANGO_SERVE_MEDIA=1 (démo PaaS sans stockage objet — pas pour forte charge).
_serve_media = settings.DEBUG or os.environ.get('DJANGO_SERVE_MEDIA', '').strip() == '1'
if _serve_media:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
