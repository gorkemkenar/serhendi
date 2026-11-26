import { useState } from 'react';
import Modal from './Modal.jsx';
import { IconEdit, IconFileText, IconPlus, IconTrash } from '../icons.jsx';
import { TRANSACTION_TYPES, formatTRY, primaryBtn } from '../constants.js';

export default function ItemDetailModal({
  item,
  unit,
  transactions = [],
  isAdmin,
  onClose,
  onNewTx,
  onUpdateTx,
  onDeleteTx
}) {
  const [editTx, setEditTx] = useState(null); // { id, date, type, description, amount }

  if (!item) return null;

  const debt = Number(item.debt) || 0;
  const paid = Number(item.paid) || 0;
  const remaining = debt - paid;

  const itemTxs = transactions
    .filter(
      (t) =>
        t.unitId === item.unitId &&
        (t.itemId === item.id || (t.category && t.category.toLowerCase() === item.name.toLowerCase()))
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));

  const startEditTx = (tx) => {
    if (!isAdmin) return;
    const currentAmt = Math.max(Number(tx.debt) || 0, Number(tx.credit) || 0);
    setEditTx({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      description: tx.description,
      amount: currentAmt
    });
  };

  const saveEditTx = async (e) => {
    e?.preventDefault?.();
    if (!editTx || !onUpdateTx) return;
    const amt = Math.max(0, parseFloat(editTx.amount) || 0);
    const dir = TRANSACTION_TYPES.find((t) => t.label === editTx.type)?.direction || 'DEBT';
    await onUpdateTx(editTx.id, {
      date: editTx.date,
      type: editTx.type,
      description: editTx.description.trim(),
      debt: dir === 'DEBT' ? amt : 0,
      credit: dir === 'CREDIT' ? amt : 0
    });
    setEditTx(null);
  };

  return (
    <Modal
      title={`${item.name} — Hareketler`}
      icon={<IconFileText />}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-3.5">
        <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-800 truncate">
            Cari: <span className="text-[#0f6b36]">{unit?.name || item.unitName || item.unitId}</span>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNewTx?.(item.unitId, item.id);
              }}
              className={`${primaryBtn} px-3 py-1.5 text-xs whitespace-nowrap`}
            >
              <IconPlus className="w-3.5 h-3.5" />
              Hareket Ekle
            </button>
          )}
        </div>

        {/* YAN YANA EŞİT BORÇ | ÖDENEN | KALAN */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 text-center">
          <div className="p-2 sm:p-3 rounded-xl bg-rose-50 border border-rose-100 min-w-0">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase text-rose-700 truncate">Borç</div>
            <div className="text-xs sm:text-base font-black text-rose-600 tabular-nums mt-0.5 truncate">{formatTRY(debt)}</div>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-emerald-50 border border-emerald-100 min-w-0">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase text-[#0f6b36] truncate">Ödenen</div>
            <div className="text-xs sm:text-base font-black text-[#0f6b36] tabular-nums mt-0.5 truncate">{formatTRY(paid)}</div>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-slate-900 text-white min-w-0">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase text-slate-300 truncate">Kalan</div>
            <div
              className={`text-xs sm:text-base font-black tabular-nums mt-0.5 truncate ${
                remaining > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {formatTRY(remaining)}
            </div>
          </div>
        </div>

        {/* HAREKETLER LİSTESİ (MOBİL UYUMLU KART/LİSTE) */}
        <div className="space-y-2">
          {itemTxs.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
              Bu kaleme ait kayıtlı cari hareket bulunmuyor.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 sm:max-h-72 overflow-y-auto overscroll-contain">
              {itemTxs.map((tx) => {
                const tObj = TRANSACTION_TYPES.find((t) => t.label === tx.type);
                const txDebt = Number(tx.debt) || 0;
                const txCredit = Number(tx.credit) || 0;
                const isEditing = isAdmin && editTx?.id === tx.id;

                return (
                  <div key={tx.id} className="p-2.5 sm:p-3 text-xs">
                    {isEditing ? (
                      <form onSubmit={saveEditTx} className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={editTx.date}
                            onChange={(e) => setEditTx({ ...editTx, date: e.target.value })}
                            className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                          />
                          <select
                            value={editTx.type}
                            onChange={(e) => setEditTx({ ...editTx, type: e.target.value })}
                            className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                          >
                            {TRANSACTION_TYPES.map((t) => (
                              <option key={t.label} value={t.label}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editTx.description}
                            onChange={(e) => setEditTx({ ...editTx, description: e.target.value })}
                            placeholder="Açıklama"
                            className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editTx.amount}
                            onChange={(e) => setEditTx({ ...editTx, amount: e.target.value })}
                            placeholder="Tutar (₺)"
                            className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white tabular-nums"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="submit"
                            className="flex-1 py-1.5 rounded-lg bg-[#0f6b36] text-white font-bold cursor-pointer"
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTx(null)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                          >
                            İptal
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                tObj?.badge || 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {tx.type}
                            </span>
                            <span className="text-[11px] text-slate-400">{tx.date}</span>
                          </div>
                          <div className="text-slate-800 font-medium truncate">{tx.description}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`font-black tabular-nums ${
                              txDebt > 0 ? 'text-rose-600' : 'text-[#0f6b36]'
                            }`}
                          >
                            {txDebt > 0 ? `+${formatTRY(txDebt)}` : `-${formatTRY(txCredit)}`}
                          </span>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditTx(tx)}
                                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
                              >
                                <IconEdit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteTx?.(tx)}
                                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <IconTrash className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
