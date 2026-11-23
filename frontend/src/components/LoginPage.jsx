import { useState } from 'react';
import SilivriSerhendiLogo from '../Logo.jsx';
import { IconEye, IconEyeOff, IconLock, IconShield } from '../icons.jsx';
import { inputCls, labelCls, primaryBtn } from '../constants.js';

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '', otpCode: '' });
  const [requires2FA, setRequires2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (username, password, otpCode = '') => {
    setBusy(true);
    setError('');
    setInfo('');
    const res = await onLogin(username, password, otpCode);
    if (res?.requires2FA) {
      setRequires2FA(true);
      setForm((prev) => ({ ...prev, username, password }));
      setInfo(res.detail || '2FA doğrulama kodunu girin.');
    } else if (res?.error) {
      setError(res.error);
    }
    setBusy(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit(form.username, form.password, requires2FA ? form.otpCode : '');
  };

  return (
    <div className="min-h-screen flex items-center justify-center serhendi-login-bg p-4">
      <div className="w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-emerald-900/15 overflow-hidden">
        <div className="bg-slate-900 px-6 py-5 flex items-center gap-3">
          <div className="bg-white rounded-2xl p-1.5">
            <SilivriSerhendiLogo className="w-9 h-10" showText={false} />
          </div>
          <div>
            <div className="text-white font-black tracking-wide">SİLİVRİ SERHENDİ</div>
            <div className="text-xs font-semibold text-[#d4af37]">Güvenli Kullanıcı Giriş Ekranı</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{error}</div>
          )}
          {info && (
            <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[#0f6b36] text-xs font-bold">{info}</div>
          )}

          <div>
            <label className={labelCls}>Kullanıcı Adı</label>
            <input
              type="text"
              required
              autoFocus
              disabled={requires2FA}
              autoComplete="username"
              autoCapitalize="none"
              placeholder="Kullanıcı adınızı girin"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Giriş Şifresi</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={requires2FA}
                autoComplete="current-password"
                placeholder="Şifrenizi girin"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={`${inputCls} pr-10 py-2.5`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Şifreyi göster / gizle"
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          {requires2FA && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-extrabold text-[#0f6b36]">
                <IconShield className="w-4 h-4" />
                2FA İki Adımlı Doğrulama Kodu (6 Hane)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                placeholder="000000"
                value={form.otpCode}
                onChange={(e) => setForm({ ...form, otpCode: e.target.value.replace(/\D/g, '') })}
                className={`${inputCls} text-center font-mono text-base tracking-widest font-black`}
              />
              <button
                type="button"
                onClick={() => {
                  setRequires2FA(false);
                  setForm({ ...form, otpCode: '' });
                  setInfo('');
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ← Farklı hesapla giriş yap
              </button>
            </div>
          )}

          <button type="submit" disabled={busy} className={`${primaryBtn} w-full py-2.5 text-sm`}>
            <IconLock />
            {busy ? 'Doğrulanıyor...' : requires2FA ? '2FA Kodunu Doğrula & Giriş Yap' : 'Giriş Yap'}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 pt-1">
            <IconShield className="w-3.5 h-3.5 text-[#0f6b36]" />
            <span>OWASP Top 10 • Brute-Force, SQLi & 2FA Korumalı</span>
          </div>
        </form>
      </div>
    </div>
  );
}
