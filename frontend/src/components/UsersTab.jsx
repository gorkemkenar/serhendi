import { useState } from 'react';
import { IconCheck, IconEdit, IconEye, IconEyeOff, IconLock, IconPlus, IconShield, IconTrash, IconUsers } from '../icons.jsx';
import { getRoleBadge, inputCls, labelCls, primaryBtn } from '../constants.js';

export default function UsersTab({
  users,
  units,
  currentUser,
  onCreateUser,
  onUpdateUser,
  onAssignRole,
  onUnlockUser,
  onSetPassword,
  onDeleteUser,
  onResetDefaults
}) {
  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.isSuperAdmin;
  const currentUserId = currentUser?.id;

  const emptyForm = { name: '', username: '', password: '', role: 'viewer_all', unitId: units[0]?.id || '' };
  const [form, setForm] = useState(emptyForm);
  const [showAddForm, setShowAddForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState({});
  const [drafts, setDrafts] = useState({});
  const [roleDrafts, setRoleDrafts] = useState({}); // { [userId]: { role, unitId } }
  const [editName, setEditName] = useState(null); // { id, name }

  const handleCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onCreateUser({
      name: form.name,
      username: form.username,
      password: form.password,
      role: form.role,
      unitId: form.role === 'viewer_unit' ? form.unitId || units[0]?.id || null : null
    });
    setBusy(false);
    if (ok) {
      setForm({ ...emptyForm, unitId: units[0]?.id || '' });
      setShowAddForm(false);
    }
  };

  const handlePassword = async (uid) => {
    const ok = await onSetPassword(uid, drafts[uid] || '');
    if (ok) {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
      setVisible((prev) => ({ ...prev, [uid]: false }));
    }
  };

  const getRoleDraft = (u) =>
    roleDrafts[u.id] || {
      role: u.role,
      unitId: u.unitId || units[0]?.id || ''
    };

  const updateRoleDraft = (uid, patch, fallback) => {
    setRoleDrafts((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] || fallback), ...patch }
    }));
  };

  const saveRowRole = async (u) => {
    const d = getRoleDraft(u);
    const ok = await onAssignRole(u.id, {
      role: d.role,
      unitId: d.role === 'viewer_unit' ? d.unitId || units[0]?.id || null : null
    });
    if (ok) {
      setRoleDrafts((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
    }
  };

  const saveEditName = async () => {
    if (!editName || !editName.name.trim()) return;
    const ok = await onUpdateUser(editName.id, { name: editName.name.trim() });
    if (ok) setEditName(null);
  };

  return (
    <div className="space-y-4">
      {/* ÜST ÖZET & YENİ HESAP BUTONU */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
            <IconUsers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Kullanıcı, Rol & Şifre Yönetimi</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSuperAdmin
                ? 'Baş Yönetici (Admin): Yöneticiler ve gözlemciler dahil tüm hesaplara rol ve şifre atayabilirsiniz.'
                : 'Yönetici: Gözlemci hesaplarına rol, birim ve şifre atayabilirsiniz (Yöneticileri yalnızca Admin kontrol eder).'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={onResetDefaults}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer whitespace-nowrap"
            >
              Varsayılanları Yükle
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className={`${primaryBtn} px-3.5 py-2 text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-initial`}
          >
            <IconPlus />
            {showAddForm ? 'Formu Kapat' : 'Yeni Hesap Ekle'}
          </button>
        </div>
      </div>

      {/* YENİ KULLANICI EKLEME FORMU (AÇILIR/KAPANIR - MOBİL UYUMLU) */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Yeni Hesap Oluştur & Rol Ata</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Ad Soyad / Hesap Adı</label>
              <input
                type="text"
                required
                placeholder="Örn: Ahmet Yılmaz"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Kullanıcı Adı</label>
              <input
                type="text"
                required
                autoCapitalize="none"
                placeholder="ahmet"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Güçlü Şifre (8+ krk)</label>
              <input
                type="text"
                required
                minLength={8}
                placeholder="Örn: Serhendi!2026"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Rol</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
                <option value="viewer_all">Genel Gözlemci (Tüm Birimler)</option>
                <option value="viewer_unit">Birim Gözlemcisi (Tek Birim)</option>
                {isSuperAdmin && <option value="admin">Yönetici</option>}
              </select>
            </div>
          </div>

          {form.role === 'viewer_unit' && (
            <div className="max-w-sm">
              <label className={labelCls}>Bağlı Cari / Birim</label>
              <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className={inputCls}>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-500">
              Şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermelidir.
            </span>
            <button type="submit" disabled={busy} className={`${primaryBtn} px-5 py-2 text-xs sm:text-sm`}>
              {busy ? 'Kaydediliyor...' : 'Hesabı Kaydet'}
            </button>
          </div>
        </form>
      )}

      {/* KULLANICI KARTLARI (SADE & MOBİL UYUMLU GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {users.map((u) => {
          const assigned = units.find((unit) => unit.id === u.unitId);
          const rm = getRoleBadge(u.role);
          const RoleIcon = rm.Icon;
          const shown = !!visible[u.id];
          const draft = drafts[u.id] ?? '';
          const canManageThis = Boolean(u.canManage);
          const canEditRole = canManageThis && !u.isSuperAdmin;
          const rDraft = getRoleDraft(u);
          const roleChanged =
            rDraft.role !== u.role || (rDraft.role === 'viewer_unit' && String(rDraft.unitId || '') !== String(u.unitId || ''));
          const isEditingName = editName?.id === u.id;

          return (
            <div key={u.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3">
              {/* ÜST KISIM: KULLANICI ADI & MEVCUT ROL ROZETİ */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {isEditingName ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={editName.name}
                        onChange={(e) => setEditName({ ...editName, name: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditName()}
                        className="px-2.5 py-1 text-xs font-bold border border-slate-300 rounded-lg bg-white"
                      />
                      <button
                        type="button"
                        onClick={saveEditName}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Kaydet
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-sm truncate">{u.name}</span>
                      {canManageThis && (
                        <button
                          type="button"
                          onClick={() => setEditName({ id: u.id, name: u.name })}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Adı düzenle"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mt-0.5">
                    @{u.username}
                    {u.twoFactorEnabled && <span className="ml-2 text-emerald-700 font-semibold">• 2FA Açık</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${rm.cls}`}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    {rm.short}
                  </span>
                  {canManageThis && !u.isSuperAdmin && u.id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => onDeleteUser(u)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Hesabı Sil"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* ORTA KISIM: ROL & BİRİM ATAMA */}
              {canEditRole ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rol & Birim Ataması</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={rDraft.role}
                      onChange={(e) =>
                        updateRoleDraft(
                          u.id,
                          { role: e.target.value },
                          { role: u.role, unitId: u.unitId || units[0]?.id || '' }
                        )
                      }
                      className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#0f6b36]"
                    >
                      <option value="viewer_all">Genel Gözlemci (Tümü)</option>
                      <option value="viewer_unit">Birim Gözlemcisi (Tek Birim)</option>
                      {isSuperAdmin && <option value="admin">Yönetici</option>}
                    </select>

                    {rDraft.role === 'viewer_unit' ? (
                      <select
                        value={rDraft.unitId}
                        onChange={(e) =>
                          updateRoleDraft(
                            u.id,
                            { unitId: e.target.value },
                            { role: u.role, unitId: u.unitId || units[0]?.id || '' }
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#0f6b36]"
                      >
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center px-2.5 py-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl">
                        Kapsam: Tüm Birimler
                      </div>
                    )}
                  </div>

                  {roleChanged && (
                    <button
                      type="button"
                      onClick={() => saveRowRole(u)}
                      className="w-full py-2 rounded-xl text-xs font-bold bg-[#0f6b36] text-white hover:bg-[#095327] cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <IconCheck className="w-3.5 h-3.5" />
                      Yeni Rolü Kaydet
                    </button>
                  )}
                </div>
              ) : (
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 flex items-center justify-between">
                  <span>Kapsam: {assigned ? assigned.name : 'Tüm Birimler'}</span>
                  <span className="font-semibold text-slate-600">
                    {u.isSuperAdmin ? 'Tam Sistem Yetkisi' : 'Sadece Admin Kontrol Eder'}
                  </span>
                </div>
              )}

              {/* ALT KISIM: ŞİFRE DEĞİŞTİRME & KİLİT AÇMA */}
              {canManageThis && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <IconLock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={shown ? 'text' : 'password'}
                      value={draft}
                      placeholder="Yeni güçlü şifre belirle..."
                      autoComplete="new-password"
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && draft.trim() && handlePassword(u.id)}
                      className="w-full pl-8 pr-8 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#0f6b36]"
                    />
                    <button
                      type="button"
                      onClick={() => setVisible((prev) => ({ ...prev, [u.id]: !prev[u.id] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Şifreyi göster / gizle"
                    >
                      {shown ? <IconEyeOff className="w-3.5 h-3.5" /> : <IconEye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {draft.trim() && (
                    <button
                      type="button"
                      onClick={() => handlePassword(u.id)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      Şifreyi Kaydet
                    </button>
                  )}
                  {u.isLocked && (
                    <button
                      type="button"
                      onClick={() => onUnlockUser?.(u)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer whitespace-nowrap"
                    >
                      Kilidi Aç
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
