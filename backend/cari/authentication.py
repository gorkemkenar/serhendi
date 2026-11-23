"""Süreli (TTL) Token kimlik doğrulaması."""
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ExpiringTokenAuthentication(TokenAuthentication):
    """Belirlenen süreyi (varsayılan 24 saat) aşan token'ları geçersiz kılar."""

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        ttl_hours = getattr(settings, 'TOKEN_TTL_HOURS', 24)
        if ttl_hours and token.created < timezone.now() - timedelta(hours=ttl_hours):
            token.delete()
            raise AuthenticationFailed('Oturum anahtarınızın süresi doldu. Lütfen tekrar giriş yapın.')
        return user, token
