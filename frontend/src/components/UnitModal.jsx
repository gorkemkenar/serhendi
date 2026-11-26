import { useState } from 'react';
import Modal from './Modal.jsx';
import { IconBuilding } from '../icons.jsx';
import { inputCls, labelCls, primaryBtn } from '../constants.js';

const DEFAULT_INITIAL_ITEMS = [
  { name: 'Kumanya', description: 'Aylık Erzak & Kumanya Kolisi', selected: true },
  { name: 'Kandil Simidi', description: 'Kandil Gecesi Simit Dağıtımı', selected: true },
  { name: 'Patates', description: 'Mutfak Çuval Patates Sevkiyatı', selected: true },
  { name: 'Kurban', description: 'Kurban & Et Organizasyonu', selected: false },
  { name: 'Takvim / Dergi', description: 'Yıllık Takvim & Yayın Dağıtımı', selected: false }
];

export default function UnitModal({ unit, onClose, onSubmit }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: unit?.name || '',
    contact: unit?.contact || '',
    phone: unit?.phone || ''
  });
  const [initialItems, setInitialItems] = useState(DEFAULT_INITIAL_ITEMS);

  const toggleInitialItem = (idx) => {
    setInitialItems((prev) => prev.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    const chosenItems = !unit ? initialItems.filter((it) => it.selected) : [];
    const ok = await onSubmit(unit?.id || null, { ...form, initialItems: chosenItems });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title={unit ? 'Cari / Birim Bilgilerini Düzenle' : 'Yeni Cari / Birim Ekle'}
      subtitle={unit ? unit.id : 'Cari bilgilerini ve başlangıç kalemlerini seçin'}
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

        {!unit && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className={labelCls}>Bu Cariye Otomatik Açılacak Başlangıç Kalemleri</label>
            <div className="space-y-1.5">
              {initialItems.map((it, idx) => (
                <label
                  key={it.name}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={it.selected}
                      onChange={() => toggleInitialItem(idx)}
                      className="rounded border-slate-300 text-[#0f6b36]"
                    />
                    <span className="font-bold text-slate-800">{it.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{it.description}</span>
                </label>
              ))}
            </div>
          </div>
        )}

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
