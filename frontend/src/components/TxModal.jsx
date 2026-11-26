import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { IconPlus, IconShield } from '../icons.jsx';
import { TRANSACTION_TYPES, formatTRY, inputCls, labelCls, primaryBtn, todayISO } from '../constants.js';

const PRESET_CATEGORIES = ['Kumanya', 'Kandil Simidi', 'Patates', 'Kurban', 'Takvim / Dergi', 'Genel'];

export default function TxModal({ units, unitItems = [], defaultUnitId, defaultItemId = '', onClose, onSubmit }) {
  const [busy, setBusy] = useState(false);
  const initialUnitId = defaultUnitId || units[0]?.id || '';
  const [form, setForm] = useState({
    date: todayISO(),
    unitId: initialUnitId,
    itemId: defaultItemId || '',
    customCategory: '',
    type: 'Mal Sevkiyatı',
    description: '',
    amount: '',
    documentUrl: ''
  });

  // Seçili cariye ait mevcut kalemler
  const currentUnitItems = unitItems.filter((i) => i.unitId === form.unitId);
  const selectedItem = currentUnitItems.find((i) => i.id === form.itemId);

  useEffect(() => {
    const itemsForUnit = unitItems.filter((i) => i.unitId === form.unitId);
    if (defaultItemId && itemsForUnit.some((i) => i.id === defaultItemId)) {
      setForm((prev) => ({ ...prev, itemId: defaultItemId }));
    } else if (!itemsForUnit.some((i) => i.id === form.itemId) && form.itemId !== '__NEW__') {
      setForm((prev) => ({ ...prev, itemId: itemsForUnit[0]?.id || '' }));
    }
  }, [form.unitId, unitItems, defaultItemId, form.itemId]);

  const direction = TRANSACTION_TYPES.find((t) => t.label === form.type)?.direction;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const isNewCat = form.itemId === '__NEW__';
    const categoryName = isNewCat
      ? form.customCategory.trim() || 'Genel'
      : selectedItem?.name || form.customCategory.trim() || 'Genel';
    const ok = await onSubmit({
      ...form,
      itemId: isNewCat ? null : form.itemId || null,
      category: categoryName
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title="Yeni Cari Hareket (Kalem Bağlantılı)" icon={<IconPlus />} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className={labelCls}>1. Hangi Cari / Birim?</label>
          <select
            value={form.unitId}
            onChange={(e) => setForm({ ...form, unitId: e.target.value })}
            className={inputCls}
            required
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* HANGİ KALEME EKLENECEĞİ SEÇİMİ */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <label className={labelCls}>2. Hangi Kaleme Eklenecek? (Kalem Seçimi)</label>
          <select
            value={form.itemId}
            onChange={(e) => setForm({ ...form, itemId: e.target.value })}
            className={inputCls}
          >
            {currentUnitItems.map((item) => {
              const rem = (Number(item.debt) || 0) - (Number(item.paid) || 0);
              return (
                <option key={item.id} value={item.id}>
                  {item.name} — Kalan: {formatTRY(rem)}
                </option>
              );
            })}
            <option value="__NEW__">+ Yeni Kalem Oluştur / Farklı Kalem Yaz...</option>
            <option value="">Genel (Kalemsiz Cari Hareket)</option>
          </select>

          {selectedItem && (
            <div className="px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 space-y-0.5">
              <div className="font-bold text-slate-800">
                Seçili Kalem: <span className="text-[#0f6b36]">{selectedItem.name}</span>
              </div>
              {selectedItem.description && (
                <div>
                  <b>Cari Detay:</b> {selectedItem.description}
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-0.5 tabular-nums">
                <span>
                  Mevcut Borç: <b className="text-rose-600">{formatTRY(selectedItem.debt)}</b>
                </span>
                <span>
                  Ödenen: <b className="text-[#0f6b36]">{formatTRY(selectedItem.paid)}</b>
                </span>
                <span>
                  Kalan: <b>{formatTRY((Number(selectedItem.debt) || 0) - (Number(selectedItem.paid) || 0))}</b>
                </span>
              </div>
            </div>
          )}

          {(form.itemId === '__NEW__' || currentUnitItems.length === 0) && (
            <div className="space-y-1.5 pt-1">
              <input
                type="text"
                required={form.itemId === '__NEW__'}
                placeholder="Yeni kalem adı yazın (Örn: Kumanya, Kandil Simidi, Patates...)"
                value={form.customCategory}
                onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                className={inputCls}
              />
              <div className="flex flex-wrap gap-1">
                {PRESET_CATEGORIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm({ ...form, itemId: '__NEW__', customCategory: p })}
                    className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-[#0f6b36] cursor-pointer"
                  >
                    + {p}
                  </button>
                ))}
              </div>
            </div>
          )}
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
            {direction === 'DEBT'
              ? `Bu tutar seçili kalemin (${selectedItem?.name || form.customCategory || 'Cari'}) BORÇ hanesine eklenir.`
              : `Bu tutar seçili kalemin (${selectedItem?.name || form.customCategory || 'Cari'}) ÖDENEN hanesine eklenir.`}
          </p>
        </div>
        <div>
          <label className={labelCls}>İşlem Detayı / Açıklama (Neye Ait?)</label>
          <input
            type="text"
            required
            placeholder="Örn: 50 Koli Kumanya Teslimi / Kandil Simidi Nakit Tahsilatı..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Dekont / Belge URL (İsteğe Bağlı)</label>
          <input
            type="url"
            placeholder="https://belge.serhendi.org.tr/dekont-101.pdf"
            value={form.documentUrl}
            onChange={(e) => setForm({ ...form, documentUrl: e.target.value })}
            className={inputCls}
          />
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <IconShield className="w-3.5 h-3.5 text-[#0f6b36] shrink-0" />
            <span>Yalnızca güvenli HTTPS beyaz listesindeki alan adları kabul edilir.</span>
          </p>
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
