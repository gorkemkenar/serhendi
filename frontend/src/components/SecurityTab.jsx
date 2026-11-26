import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { IconEye, IconEyeOff, IconLock, IconShield } from '../icons.jsx';
import { inputCls, labelCls, primaryBtn } from '../constants.js';

export default function SecurityTab({ currentUser, onNotify, onSelfPasswordChanged }) {
  const isOwner = currentUser?.role === 'owner' || currentUser?.isOwner;
  const [section, setSection] = useState('settings'); // 'settings' | 'steps' | 'logs'
  const [overview, setOverview] = useState(null);
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const loadSecurity = useCallback(async () => {
    setLoading(true);
    try {
      const ov = await api.security.overview();
      setOverview(ov);
    } catch (err) {
      onNotify?.(err?.message || 'Güvenlik verileri alınamadı.', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadSecurity();
  }, [loadSecurity]);

  const handleChangeOwnPassword = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword.trim() !== pwdForm.confirmPassword.trim()) {
      onNotify?.('Yeni şifre ve şifre tekrarı birbiriyle eşleşmiyor!', 'error');
      return;
    }
    setBusyAction(true);
    try {
      const res = await api.changeOwnPassword(pwdForm.currentPassword.trim(), pwdForm.newPassword.trim());
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      onNotify?.(res.detail || 'Şifreniz başarıyla güncellendi.');
      onSelfPasswordChanged?.(res.user);
      await loadSecurity();
    } catch (err) {
      onNotify?.(err?.message || 'Şifre güncellenemedi.', 'error');
    } finally {
      setBusyAction(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
        Güvenlik paneli yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ÜST BAŞLIK & MOBİL UYUMLU ALT SEKMELER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
            <IconShield className="w-5 h-5" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">Güvenlik & Şifre Yönetimi</h2>
        </div>

        {/* MOBİL UYUMLU SEKME SEÇİCİ (10 Koruma Adımı Yalnızca Owner'da Görünür) */}
        <div className={`grid ${isOwner ? 'grid-cols-3' : 'grid-cols-2'} gap-1 p-1 rounded-xl bg-slate-100 text-xs font-semibold`}>
          <button
            type="button"
            onClick={() => setSection('settings')}
            className={`px-3 py-2 rounded-lg transition cursor-pointer ${
              section === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Şifremi Değiştir
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => setSection('steps')}
              className={`px-3 py-2 rounded-lg transition cursor-pointer ${
                section === 'steps' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              10 Koruma Adımı
            </button>
          )}
          <button
            type="button"
            onClick={() => setSection('logs')}
            className={`px-3 py-2 rounded-lg transition cursor-pointer ${
              section === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Kayıtlar ({overview?.logs?.length || 0})
          </button>
        </div>
      </div>

      {/* 1. BÖLÜM: ŞİFREMİ DEĞİŞTİR */}
      {section === 'settings' && (
        <div className="max-w-lg mx-auto">
          <form onSubmit={handleChangeOwnPassword} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-emerald-50 text-[#0f6b36]">
                <IconLock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Şifremi Değiştir (@{currentUser.username})</h3>
            </div>

            <div>
              <label className={labelCls}>Mevcut Şifreniz</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  placeholder="Mevcut şifrenizi girin"
                  autoComplete="current-password"
                  value={pwdForm.currentPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                  className={`${inputCls} pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showCurrent ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Yeni Güçlü Şifre</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Örn: Serhendi!2026"
                    autoComplete="new-password"
                    value={pwdForm.newPassword}
                    onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                    className={`${inputCls} pr-9`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showNew ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Yeni Şifre Tekrar</label>
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  minLength={8}
                  placeholder="Yeni şifreyi tekrar girin"
                  autoComplete="new-password"
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <button type="submit" disabled={busyAction} className={`${primaryBtn} w-full py-2.5 text-xs sm:text-sm`}>
              {busyAction ? 'Şifre Güncelleniyor...' : 'Şifremi Güncelle ve Kaydet'}
            </button>
          </form>
        </div>
      )}

      {/* 2. BÖLÜM: 10 GÜVENLİK ADIMI (YALNIZCA SİSTEM SAHİBİ / OWNER GÖREBİLİR) */}
      {isOwner && section === 'steps' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(overview?.steps || []).map((step) => (
            <div key={step.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-[#0f6b36] border border-emerald-200 whitespace-nowrap">
                  Aktif
                </span>
              </div>
              <p className="text-xs text-slate-600">{step.prevention}</p>
              <div className="pt-1.5 text-[11px] font-medium text-slate-400">{step.metric}</div>
            </div>
          ))}
        </div>
      )}

      {/* 3. BÖLÜM: GÜVENLİK DENETİM KAYITLARI (MOBİL KART / LİSTE GÖRÜNÜMÜ) */}
      {section === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
          {(overview?.logs || []).length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">Henüz güvenlik kaydı bulunmuyor.</div>
          )}
          {(overview?.logs || []).map((log) => (
            <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      log.severity === 'CRITICAL'
                        ? 'bg-rose-50 text-rose-700'
                        : log.severity === 'WARNING'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {log.action}
                  </span>
                  <span className="font-semibold text-slate-700">@{log.username}</span>
                  <span className="text-slate-400 font-mono text-[11px]">{log.ip_address}</span>
                </div>
                <p className="text-slate-600">{log.description}</p>
              </div>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString('tr-TR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
