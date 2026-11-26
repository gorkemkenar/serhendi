import { useState } from 'react';
import SilivriSerhendiLogo from '../Logo.jsx';
import { IconEdit, IconPlus, IconPrinter, IconTrash } from '../icons.jsx';
import { formatTRY, primaryBtn } from '../constants.js';

const PRESET_ITEMS = [
  { name: 'Kumanya' },
  { name: 'Kandil Simidi' },
  { name: 'Patates' },
  { name: 'Kurban' },
  { name: 'Takvim / Dergi' }
];

export default function StatementTab({
  report,
  units,
  isAdmin,
  isUnitObserver,
  statementUnitId,
  onSelectUnit,
  onSelectItem,
  onCreateItem,
  onUpdateItem,
  onDeleteItem
}) {
  const [newForm, setNewForm] = useState({ name: '', description: '', debt: '', paid: '' });
  const [editItem, setEditItem] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!report.unit || !newForm.name.trim()) return;
    const ok = await onCreateItem?.({
      unitId: report.unit.id,
      name: newForm.name.trim(),
      description: (newForm.description || '').trim(),
      debt: Math.max(0, parseFloat(newForm.debt) || 0).toFixed(2),
      paid: Math.max(0, parseFloat(newForm.paid) || 0).toFixed(2)
    });
    if (ok) setNewForm({ name: '', description: '', debt: '', paid: '' });
  };

  const handleSaveEdit = async (e) => {
    e?.preventDefault?.();
    if (!editItem || !editItem.name.trim()) return;
    const ok = await onUpdateItem?.(editItem.id, {
      name: editItem.name.trim(),
      description: (editItem.description || '').trim(),
      debt: Math.max(0, parseFloat(editItem.debt) || 0).toFixed(2),
      paid: Math.max(0, parseFloat(editItem.paid) || 0).toFixed(2)
    });
    if (ok) setEditItem(null);
  };

  const unitItems = report.unit?.items || [];

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-600">Cari / Birim:</span>
          {isUnitObserver ? (
            <span className="px-3.5 py-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-900">{report.unit?.name}</span>
          ) : (
            <select
              value={statementUnitId}
              onChange={(e) => onSelectUnit(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#0f6b36]"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <button onClick={() => window.print()} className={`${primaryBtn} px-4 py-2 text-xs sm:text-sm`} disabled={!report.unit}>
          <IconPrinter />
          Yazdır / PDF
        </button>
      </div>

      {!report.unit && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">Ekstre için cari / birim bulunamadı.</div>
      )}

      {report.unit && (
        <div className="print-area bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-[#0f6b36]">
            <div className="flex items-start gap-3">
              <SilivriSerhendiLogo className="w-11 h-12" showText={false} />
              <div>
                <div className="text-[11px] font-bold tracking-wider text-[#b8952b]">SİLİVRİ SERHENDİ • BİRİM & CARİ TAKİP SİSTEMİ</div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">{report.unit.name} — Cari Hesap Ekstresi</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Yetkili: {report.unit.contact} • Tarih: {new Date().toLocaleDateString('tr-TR')}
                </p>
              </div>
            </div>

            {/* YAN YANA EŞİT TOPLAM BORÇ / ÖDENEN / KALAN BAKİYE */}
            <div className="grid grid-cols-3 gap-2.5 sm:min-w-[420px]">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-center">
                <div className="text-[11px] font-bold uppercase text-rose-700">Toplam Borç</div>
                <div className="text-sm sm:text-base font-black text-rose-600 tabular-nums mt-0.5">{formatTRY(report.totalDebt)}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <div className="text-[11px] font-bold uppercase text-[#0f6b36]">Toplam Ödenen</div>
                <div className="text-sm sm:text-base font-black text-[#0f6b36] tabular-nums mt-0.5">{formatTRY(report.totalCredit)}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 text-center">
                <div className="text-[11px] font-bold uppercase text-slate-200">Kalan Bakiye</div>
                <div
                  className={`text-sm sm:text-base font-black mt-0.5 tabular-nums ${
                    report.netBalance > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatTRY(report.netBalance)}
                </div>
              </div>
            </div>
          </div>

          {/* 1. BÖLÜM: KALEM LİSTESİ */}
          <div className="space-y-3">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">Kalemler</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 text-left">
                    <th className="py-2.5 px-3.5 font-bold border border-slate-200">Kalem Adı</th>
                    <th className="py-2.5 px-3.5 font-bold border border-slate-200 text-right">Borç (₺)</th>
                    <th className="py-2.5 px-3.5 font-bold border border-slate-200 text-right">Ödenen (₺)</th>
                    <th className="py-2.5 px-3.5 font-bold border border-slate-200 text-right">Kalan (₺)</th>
                    {isAdmin && <th className="no-print py-2.5 px-3.5 font-bold border border-slate-200 text-right">İşlem</th>}
                  </tr>
                </thead>
                <tbody>
                  {unitItems.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="py-6 text-center text-slate-500 border border-slate-200">
                        Henüz kalem eklenmemiş.
                      </td>
                    </tr>
                  )}
                  {unitItems.map((item) => {
                    const debt = Number(item.debt) || 0;
                    const paid = Number(item.paid) || 0;
                    const rem = debt - paid;
                    const isEditing = isAdmin && editItem?.id === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3.5 border border-slate-200 font-bold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editItem.name}
                              onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                              className="w-full px-2 py-1 text-xs border border-[#0f6b36] rounded bg-white"
                            />
                          ) : (
                            <div
                              onClick={() => onSelectItem?.(item, report.unit)}
                              className="flex items-center gap-1.5 cursor-pointer group"
                            >
                              <span className="group-hover:text-[#0f6b36] group-hover:underline">{item.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 border border-slate-200 text-right tabular-nums font-bold text-rose-600">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editItem.debt}
                              onChange={(e) => setEditItem({ ...editItem, debt: e.target.value })}
                              className="w-28 px-2 py-1 text-xs text-right border border-slate-300 rounded bg-white"
                            />
                          ) : (
                            formatTRY(debt)
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 border border-slate-200 text-right tabular-nums font-bold text-[#0f6b36]">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editItem.paid}
                              onChange={(e) => setEditItem({ ...editItem, paid: e.target.value })}
                              className="w-28 px-2 py-1 text-xs text-right border border-slate-300 rounded bg-white"
                            />
                          ) : (
                            formatTRY(paid)
                          )}
                        </td>
                        <td
                          className={`py-2.5 px-3.5 border border-slate-200 text-right tabular-nums font-black ${
                            rem > 0 ? 'text-rose-700' : 'text-[#0f6b36]'
                          }`}
                        >
                          {formatTRY(rem)}
                        </td>
                        {isAdmin && (
                          <td className="no-print py-2.5 px-3.5 border border-slate-200 text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="inline-flex gap-1">
                                <button
                                  type="button"
                                  onClick={handleSaveEdit}
                                  className="px-2.5 py-1 rounded bg-[#0f6b36] text-white text-xs font-bold cursor-pointer"
                                >
                                  Kaydet
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditItem(null)}
                                  className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                                >
                                  İptal
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditItem({
                                      id: item.id,
                                      name: item.name,
                                      description: item.description || '',
                                      debt,
                                      paid
                                    })
                                  }
                                  className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
                                  title="Düzenle"
                                >
                                  <IconEdit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteItem?.(item)}
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Sil"
                                >
                                  <IconTrash className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isAdmin && (
              <form
                onSubmit={handleAdd}
                className="no-print p-2.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center"
              >
                <input
                  type="text"
                  required
                  placeholder="Kalem Adı (Örn: Kumanya)"
                  value={newForm.name}
                  onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Borç (₺)"
                  value={newForm.debt}
                  onChange={(e) => setNewForm({ ...newForm, debt: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white tabular-nums"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ödenen (₺)"
                  value={newForm.paid}
                  onChange={(e) => setNewForm({ ...newForm, paid: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white tabular-nums"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0f6b36] hover:bg-[#095327] text-white cursor-pointer"
                >
                  <IconPlus className="w-3.5 h-3.5" />
                  Kalem Ekle
                </button>
              </form>
            )}
          </div>

          {/* 2. BÖLÜM: TARİHSEL CARİ HAREKET GEÇMİŞİ (HANGİ KALEME AİT OLDUĞUYLA BİRLİKTE) */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-700">Cari Hareket Geçmişi</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 text-left">
                    <th className="py-2 px-3 font-bold border border-slate-200">Tarih</th>
                    <th className="py-2 px-3 font-bold border border-slate-200">Ait Olduğu Kalem</th>
                    <th className="py-2 px-3 font-bold border border-slate-200">Tür</th>
                    <th className="py-2 px-3 font-bold border border-slate-200">Açıklama</th>
                    <th className="py-2 px-3 font-bold border border-slate-200 text-right">Borç (₺)</th>
                    <th className="py-2 px-3 font-bold border border-slate-200 text-right">Ödenen (₺)</th>
                    <th className="py-2 px-3 font-bold border border-slate-200 text-right">Yürüyen Bakiye (₺)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 border border-slate-200">
                        Bu cariye ait hareket bulunmuyor.
                      </td>
                    </tr>
                  )}
                  {report.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 px-3 border border-slate-200 whitespace-nowrap">{r.date}</td>
                      <td className="py-2 px-3 border border-slate-200 whitespace-nowrap font-bold text-[#0f6b36]">
                        {r.itemName || r.category || 'Genel'}
                      </td>
                      <td className="py-2 px-3 border border-slate-200 whitespace-nowrap font-semibold">{r.type}</td>
                      <td className="py-2 px-3 border border-slate-200">{r.description}</td>
                      <td className="py-2 px-3 border border-slate-200 text-right tabular-nums text-rose-600 font-semibold whitespace-nowrap">
                        {Number(r.debt) > 0 ? formatTRY(r.debt) : '-'}
                      </td>
                      <td className="py-2 px-3 border border-slate-200 text-right tabular-nums text-[#0f6b36] font-semibold whitespace-nowrap">
                        {Number(r.credit) > 0 ? formatTRY(r.credit) : '-'}
                      </td>
                      <td
                        className={`py-2 px-3 border border-slate-200 text-right tabular-nums font-extrabold whitespace-nowrap ${
                          r.runningBalance > 0 ? 'text-rose-700' : 'text-[#0f6b36]'
                        }`}
                      >
                        {formatTRY(r.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
