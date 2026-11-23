import { useState } from 'react';
import Modal from './Modal.jsx';
import { IconPlus, IconShield } from '../icons.jsx';
import { TRANSACTION_TYPES, inputCls, labelCls, primaryBtn, todayISO } from '../constants.js';

export default function TxModal({ units, defaultUnitId, onClose, onSubmit }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    date: todayISO(),
    unitId: defaultUnitId || units[0]?.id || '',
    type: 'Mal Sevkiyatı',
    description: '',
    amount: '',
    documentUrl: ''
  });

  const direction = TRANSACTION_TYPES.find((t) => t.label === form.type)?.direction;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onSubmit(form);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title="Yeni Cari Hareket" icon={<IconPlus />} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className={labelCls}>Cari / Birim</label>
          <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className={inputCls} required>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tarih</label>
            <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tutar (₺)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="50000000"
              required
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className={`${inputCls} tabular-nums`}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>İşlem Türü</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t.label} value={t.label}>
                {t.label}
              </option>
            ))}
          </select>
          <p className={`mt-1 text-[11px] font-semibold ${direction === 'DEBT' ? 'text-rose-600' : 'text-[#0f6b36]'}`}>
            {direction === 'DEBT' ? 'Bu tutar cariye BORÇ olarak yazılır.' : 'Bu tutar cariye ALACAK (ödeme) olarak yazılır.'}
          </p>
        </div>
        <div>
          <label className={labelCls}>Açıklama</label>
          <input
            type="text"
            required
            placeholder="Açıklama girin"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Dekont / Belge URL (İsteğe Bağlı • SSRF Beyaz Liste Korumalı)</label>
          <input
            type="url"
            placeholder="https://belge.serhendi.org.tr/dekont-101.pdf"
            value={form.documentUrl}
            onChange={(e) => setForm({ ...form, documentUrl: e.target.value })}
            className={inputCls}
          />
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <IconShield className="w-3.5 h-3.5 text-[#0f6b36] shrink-0" />
            <span>Yalnızca güvenli HTTPS beyaz listesindeki alan adları kabul edilir; iç ağ (localhost) engellenir.</span>
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
            İptal
          </button>
          <button type="submit" disabled={busy} className={`${primaryBtn} px-5 py-2 text-sm`}>
            {busy ? 'İmzalanıp Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
