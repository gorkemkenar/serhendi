import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { IconCheck, IconLock, IconShield, IconX } from '../icons.jsx';
import { inputCls, labelCls, primaryBtn } from '../constants.js';

export default function SecurityTab({ currentUser, isAdmin, onNotify, onRefreshUsers, onSelfPasswordChanged }) {
  const [section, setSection] = useState('settings'); // 'settings' | 'steps' | 'logs'
  const [overview, setOverview] = useState(null);
  const [twoFA, setTwoFA] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });
  const [urlToCheck, setUrlToCheck] = useState('');
  const [urlResult, setUrlResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const loadSecurity = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, tfa] = await Promise.all([api.security.overview(), api.twoFactor.status()]);
      setOverview(ov);
      setTwoFA(tfa);
    } catch (err) {
      onNotify?.(err?.message || 'Güvenlik verileri alınamadı.', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadSecurity();
  }, [loadSecurity]);

  const handleEnable2FA = async (e) => {
    e.preventDefault();
    setBusyAction(true);
    try {
      const res = await api.twoFactor.enable(otpInput);
      onNotify?.(res.detail || '2FA aktifleştirildi.');
      setOtpInput('');
      await loadSecurity();
      onRefreshUsers?.();
    } catch (err) {
      onNotify?.(err?.message || '2FA doğrulanamadı.', 'error');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDisable2FA = async () => {
    setBusyAction(true);
    try {
      const res = await api.twoFactor.disable();
      onNotify?.(res.detail || '2FA devre dışı bırakıldı.');
      await loadSecurity();
      onRefreshUsers?.();
    } catch (err) {
      onNotify?.(err?.message || 'İşlem başarısız.', 'error');
    } finally {
      setBusyAction(false);
    }
  };

  const handleChangeOwnPassword = async (e) => {
    e.preventDefault();
    setBusyAction(true);
    try {
      const res = await api.changeOwnPassword(pwdForm.currentPassword, pwdForm.newPassword);
      setPwdForm({ currentPassword: '', newPassword: '' });
      onNotify?.(res.detail || 'Şifreniz güncellendi.');
      onSelfPasswordChanged?.(res.user);
      await loadSecurity();
    } catch (err) {
      onNotify?.(err?.message || 'Şifre güncellenemedi.', 'error');
    } finally {
      setBusyAction(false);
    }
  };

  const handleVerifyIntegrity = async (reseal = false) => {
    setBusyAction(true);
    try {
      const res = await api.security.verifyIntegrity(reseal);
      onNotify?.(
        res.intact
          ? `Veri bütünlüğü doğrulandı: ${res.verified}/${res.total} kayıt sağlam.`
          : `Dikkat: ${res.tampered.length} kayıtta bütünlük uyuşmazlığı bulundu!`,
        res.intact ? 'success' : 'error'
      );
      await loadSecurity();
    } catch (err) {
      onNotify?.(err?.message || 'Bütünlük kontrolü yapılamadı.', 'error');
    } finally {
      setBusyAction(false);
    }
  };

  const handleCheckUrl = async (e, presetUrl) => {
    e?.preventDefault?.();
    const target = (presetUrl !== undefined ? presetUrl : urlToCheck).trim();
    if (!target) return;
    setUrlToCheck(target);
    setBusyAction(true);
    try {
      const res = await api.security.validateUrl(target);
      setUrlResult({ ok: true, message: `Güvenli bağlantı (${res.host})` });
      await loadSecurity();
    } catch (err) {
      setUrlResult({ ok: false, message: err?.message || 'SSRF Koruması tarafından engellendi.' });
      await loadSecurity();
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
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Güvenlik & Denetim</h2>
            <p className="text-xs text-slate-500">
              2FA doğrulama, şifre güncelleme, veri bütünlüğü ve OWASP güvenlik kontrolleri
            </p>
          </div>
        </div>

        {/* MOBİL UYUMLU 3'LÜ SEKME SEÇİCİ */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSection('settings')}
            className={`px-3 py-2 rounded-lg transition cursor-pointer ${
              section === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Ayarlar & 2FA
          </button>
          <button
            type="button"
            onClick={() => setSection('steps')}
            className={`px-3 py-2 rounded-lg transition cursor-pointer ${
              section === 'steps' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            10 Koruma Adımı
          </button>
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

      {/* 1. BÖLÜM: AYARLAR, ŞİFRE, 2FA & HIZLI DENETİM */}
      {section === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KENDİ ŞİFRENİ GÜNCELLE */}
          <form onSubmit={handleChangeOwnPassword} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <IconLock className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">Şifremi Değiştir (@{currentUser.username})</h3>
            </div>
            <div>
              <label className={labelCls}>Mevcut Şifre</label>
              <input
                type="password"
                required
                placeholder="Mevcut şifreniz"
                autoComplete="current-password"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Yeni Güçlü Şifre</label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="En az 8 karakter (Büyük/küçük harf + rakam)"
                autoComplete="new-password"
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={busyAction} className={`${primaryBtn} w-full py-2.5 text-xs sm:text-sm`}>
              Şifremi Güncelle
            </button>
          </form>

          {/* İKİ ADIMLI DOĞRULAMA (2FA) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <IconShield className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">İki Adımlı Doğrulama (2FA)</h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                  twoFA?.enabled ? 'bg-emerald-50 text-[#0f6b36] border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {twoFA?.enabled ? 'Açık' : 'Kapalı'}
              </span>
            </div>

            {twoFA && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-slate-500">Anahtar Kodu:</div>
                  <div className="font-mono font-semibold text-slate-800 break-all select-all">{twoFA.secret}</div>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-slate-500">Anlık Kod:</span>
                    <button
                      type="button"
                      onClick={() => setOtpInput(twoFA.currentDemoCode)}
                      className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono font-bold cursor-pointer"
                    >
                      {twoFA.currentDemoCode} (Seç)
                    </button>
                  </div>
                </div>

                {!twoFA.enabled ? (
                  <form onSubmit={handleEnable2FA} className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      placeholder="6 haneli kod"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      className={`${inputCls} font-mono text-center`}
                    />
                    <button type="submit" disabled={busyAction} className={`${primaryBtn} px-4 py-2 text-xs whitespace-nowrap`}>
                      Aktifleştir
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={handleDisable2FA}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                  >
                    2FA Korumasını Kapat
                  </button>
                )}
              </div>
            )}
          </div>

          {/* BÜTÜNLÜK İMZASI & SSRF BAĞLANTI KONTROLÜ */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Bütünlük & Bağlantı Kontrolü</h3>
              {isAdmin && (
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => handleVerifyIntegrity(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  İmzaları Doğrula
                </button>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-600">HMAC-SHA256 Hareket İmzaları:</span>
              <span className="font-bold text-[#0f6b36]">
                {overview?.integrity?.verified || 0}/{overview?.integrity?.total || 0} Doğrulandı
              </span>
            </div>

            <form onSubmit={handleCheckUrl} className="space-y-2 text-xs">
              <label className={labelCls}>SSRF Bağlantı Testi (Beyaz Liste)</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="https://belge.serhendi.org.tr/..."
                  value={urlToCheck}
                  onChange={(e) => setUrlToCheck(e.target.value)}
                  className={inputCls}
                />
                <button type="submit" disabled={busyAction} className="px-3 py-2 rounded-xl bg-slate-800 text-white font-semibold cursor-pointer">
                  Test
                </button>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={(e) => handleCheckUrl(e, 'http://localhost/ayarlar')}
                  className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] cursor-pointer"
                >
                  localhost dene
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCheckUrl(e, 'https://belge.serhendi.org.tr/dekont.pdf')}
                  className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] cursor-pointer"
                >
                  güvenli URL dene
                </button>
              </div>
              {urlResult && (
                <div
                  className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 ${
                    urlResult.ok ? 'bg-emerald-50 border-emerald-200 text-[#0f6b36]' : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {urlResult.ok ? <IconCheck className="w-3.5 h-3.5 shrink-0" /> : <IconX className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{urlResult.message}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 2. BÖLÜM: 10 GÜVENLİK ADIMI (SADE KART LİSTESİ) */}
      {section === 'steps' && (
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
