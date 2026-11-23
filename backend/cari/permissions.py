from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Transaction, Unit
from .security import log_security_event


class IsAdminRole(BasePermission):
    message = 'Bu işlem yalnızca yönetici yetkisiyle yapılabilir.'

    def has_permission(self, request, view):
        user = request.user
        allowed = bool(user and user.is_authenticated and user.is_admin_role)
        if not allowed and user and user.is_authenticated:
            log_security_event(
                action='ACCESS_DENIED_ADMIN',
                severity='WARNING',
                request=request,
                user=user,
                description=f'Yetkisiz yönetici işlemi denemesi ({request.method} {request.path}).',
            )
        return allowed


class IsAdminRoleOrReadOnly(BasePermission):
    """1. Kırık Erişim Kontrolü (Broken Access Control):
    - Gözlemciler salt okunur, yöneticiler tam yetkilidir.
    - Her nesne erişiminde (has_object_permission) kullanıcının o cariyi/hareketi görme yetkisi arka planda doğrulanır.
    """

    message = 'Gözlemci hesabındasınız; düzenleme yalnızca yöneticidedir.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        if not user.is_admin_role:
            log_security_event(
                action='ACCESS_DENIED_WRITE',
                severity='WARNING',
                request=request,
                user=user,
                description=f'Gözlemci hesabı ile yazma/silme denemesi engellendi ({request.method} {request.path}).',
            )
            return False
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method not in SAFE_METHODS and not user.is_admin_role:
            return False
        if user.effective_role == user.Role.VIEWER_UNIT:
            target_unit_id = obj.id if isinstance(obj, Unit) else getattr(obj, 'unit_id', None)
            if not user.unit_id or target_unit_id != user.unit_id:
                log_security_event(
                    action='IDOR_BLOCKED',
                    severity='CRITICAL',
                    request=request,
                    user=user,
                    description=f'IDOR / Kırık Erişim Kontrolü engellendi: {user.username} kendi birimi ({user.unit_id}) dışındaki veriye ({target_unit_id}) erişmeye çalıştı.',
                    metadata={'user_unit': user.unit_id, 'target_unit': target_unit_id},
                )
                return False
        return True
