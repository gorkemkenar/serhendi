from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('units', views.UnitViewSet, basename='unit')
router.register('unit-items', views.UnitItemViewSet, basename='unit-item')
router.register('transactions', views.TransactionViewSet, basename='transaction')
router.register('users', views.UserViewSet, basename='user')

urlpatterns = [
    path('health/', views.health_check_view, name='health-check'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/me/', views.me_view, name='me'),
    path('auth/change-password/', views.change_own_password_view, name='change-own-password'),
    path('auth/2fa/', views.TwoFactorSetupView.as_view(), name='two-factor-setup'),
    path('security/overview/', views.security_overview_view, name='security-overview'),
    path('security/verify-integrity/', views.verify_integrity_view, name='security-verify-integrity'),
    path('security/validate-url/', views.validate_url_view, name='security-validate-url'),
    path('reset-defaults/', views.reset_defaults_view, name='reset-defaults'),
    path('', include(router.urls)),
]
