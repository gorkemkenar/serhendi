import { useState } from 'react';
import Modal from './Modal.jsx';
import { IconBuilding } from '../icons.jsx';
import { inputCls, labelCls, primaryBtn } from '../constants.js';

export default function UnitModal({ unit, onClose, onSubmit }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: unit?.name || '',
    contact: unit?.contact || '',
    phone: unit?.phone || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    const ok = await onSubmit(unit?.id || null, form);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title={unit ? 'Cari / Birim Bilgilerini Düzenle' : 'Yeni Cari / Birim Ekle'}
      subtitle={unit ? unit.id : undefined}
      icon={<IconBuilding />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className={labelCls}>Cari / Birim Adı</label>
          <input
            type="text"
            required
            autoFocus
            placeholder="Örn: Merkez Dergah"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Yetkili Kişi</label>
            <input
              type="text"
              placeholder="Ad Soyad"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Telefon Numarası</label>
            <input
              type="tel"
              placeholder="0532 000 00 00"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={`${inputCls} tabular-nums`}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
            İptal
          </button>
          <button type="submit" disabled={busy} className={`${primaryBtn} px-5 py-2 text-sm`}>
            {busy ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
