import Modal from './Modal.jsx';
import { IconFileText, IconPlus, IconTrash } from '../icons.jsx';
import { TRANSACTION_TYPES, formatTRY, primaryBtn } from '../constants.js';

export default function ItemDetailModal({ item, unit, transactions = [], isAdmin, onClose, onNewTx, onDeleteTx }) {
  if (!item) return null;

  const debt = Number(item.debt) || 0;
  const paid = Number(item.paid) || 0;
  const remaining = debt - paid;

  // Bu kaleme ait tüm cari hareketleri filtrele ve tarihe göre sırala
  const itemTxs = transactions
    .filter(
      (t) =>
        t.unitId === item.unitId &&
        (t.itemId === item.id || (t.category && t.category.toLowerCase() === item.name.toLowerCase()))
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));

  return (
    <Modal
      title={`${item.name} — Yapılan Hareketler`}
      subtitle={`${unit?.name || item.unitName || item.unitId} (${item.id})`}
      icon={<IconFileText />}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* KALEM AİDİYET & DETAY BİLGİSİ */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs space-y-0.5">
            <div className="font-bold text-slate-800">
              Cari / Birim: <span className="text-[#0f6b36]">{unit?.name || item.unitName || item.unitId}</span>
            </div>
            <div className="text-slate-500">
              <b>Kalem Detayı / Neye Ait:</b> {item.description || `${unit?.name || ''} — ${item.name} Kalemi`}
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNewTx?.(item.unitId, item.id);
              }}
              className={`${primaryBtn} px-3.5 py-2 text-xs whitespace-nowrap`}
            >
              <IconPlus className="w-3.5 h-3.5" />
              Bu Kaleme Hareket Ekle
            </button>
          )}
        </div>

        {/* BORÇ | ÖDENEN | KALAN ÖZET KUTULARI */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
            <div className="text-[11px] font-bold uppercase text-rose-700">Toplam Borç</div>
            <div className="text-sm sm:text-base font-black text-rose-600 tabular-nums mt-0.5">{formatTRY(debt)}</div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="text-[11px] font-bold uppercase text-[#0f6b36]">Toplam Ödenen</div>
            <div className="text-sm sm:text-base font-black text-[#0f6b36] tabular-nums mt-0.5">{formatTRY(paid)}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 text-white">
            <div className="text-[11px] font-bold uppercase text-slate-300">Kalan Borç</div>
            <div
              className={`text-sm sm:text-base font-black tabular-nums mt-0.5 ${
                remaining > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {formatTRY(remaining)}
            </div>
          </div>
        </div>

        {/* BU KALEME YAPILAN HAREKETLER LİSTESİ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              {item.name} Kalemine Yapılan Hareketler ({itemTxs.length})
            </h4>
          </div>

          {itemTxs.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
              Bu kaleme ait kayıtlı cari hareket bulunmuyor.
              {isAdmin && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNewTx?.(item.unitId, item.id);
                    }}
                    className="text-[#0f6b36] font-bold hover:underline cursor-pointer"
                  >
                    + İlk hareketi eklemek için tıklayın
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 text-left">
                      <th className="py-2.5 px-3 font-bold border-b border-slate-200">Tarih / No</th>
                      <th className="py-2.5 px-3 font-bold border-b border-slate-200">Tür</th>
                      <th className="py-2.5 px-3 font-bold border-b border-slate-200">Açıklama</th>
                      <th className="py-2.5 px-3 font-bold border-b border-slate-200 text-right">Borç (₺)</th>
                      <th className="py-2.5 px-3 font-bold border-b border-slate-200 text-right">Ödenen (₺)</th>
                      {isAdmin && <th className="py-2.5 px-2.5 font-bold border-b border-slate-200 text-center">Sil</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemTxs.map((tx) => {
                      const tObj = TRANSACTION_TYPES.find((t) => t.label === tx.type);
                      const txDebt = Number(tx.debt) || 0;
                      const txCredit = Number(tx.credit) || 0;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">{tx.date}</div>
                            <div className="font-mono text-[10px] text-slate-400">{tx.id}</div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                tObj?.badge || 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            <div>{tx.description}</div>
                            {tx.createdBy && <div className="text-[10px] text-slate-400">Kaydeden: {tx.createdBy}</div>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums text-rose-600 whitespace-nowrap">
                            {txDebt > 0 ? formatTRY(txDebt) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums text-[#0f6b36] whitespace-nowrap">
                            {txCredit > 0 ? formatTRY(txCredit) : '-'}
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 px-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => onDeleteTx?.(tx)}
                                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Hareketi Sil"
                              >
                                <IconTrash className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}
