from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import SecurityAuditLog, Transaction, Unit, User


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'contact', 'plain_phone')
    search_fields = ('id', 'name', 'contact')


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'date', 'unit', 'type', 'description', 'debt', 'credit', 'created_by', 'integrity_hash')
    list_filter = ('type', 'unit')
    search_fields = ('id', 'description', 'unit__name')
    date_hierarchy = 'date'


@admin.register(User)
class CariUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (
            'Cari & Güvenlik Yetkileri',
            {
                'fields': (
                    'full_name',
                    'role',
                    'unit',
                    'two_factor_enabled',
                    'must_change_password',
                    'failed_login_attempts',
                    'locked_until',
                )
            },
        ),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (('Cari Yetkileri', {'fields': ('full_name', 'role', 'unit')}),)
    list_display = ('username', 'full_name', 'role', 'unit', 'two_factor_enabled', 'is_active')
    list_filter = ('role', 'two_factor_enabled', 'is_active')


@admin.register(SecurityAuditLog)
class SecurityAuditLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'severity', 'action', 'username', 'ip_address', 'description')
    list_filter = ('severity', 'action')
    search_fields = ('username', 'description', 'ip_address', 'action')
    readonly_fields = ('timestamp', 'action', 'severity', 'username', 'ip_address', 'path', 'description', 'metadata')
