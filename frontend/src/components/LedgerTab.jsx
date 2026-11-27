import { useMemo, useState } from 'react';
import { IconDownload, IconPlus, IconSearch, IconTrash } from '../icons.jsx';
import { TRANSACTION_TYPES, formatTRY, primaryBtn } from '../constants.js';

const filterCls =
  'w-full sm:w-auto px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0f6b36]';

export default function LedgerTab({
  transactions,
  units,
  unitItems = [],
  isAdmin,
  isUnitObserver,
  searchQuery,
  onSearch,
  unitFilter,
  onUnitFilter,
  itemFilter = 'ALL',
  onItemFilter,
  typeFilter,
  onTypeFilter,
  onExport,
  onNewTx,
  onUpdateTx,
  onDeleteTx
}) {
  const [editingCell, setEditingCell] = useState(null); // { id, field, value }

  const availableCategories = useMemo(() => {
    const names = new Set();
    unitItems.forEach((i) => {
      if (unitFilter === 'ALL' || i.unitId === unitFilter) names.add(i.name);
    });
    transactions.forEach((t) => {
      if (t.category && (unitFilter === 'ALL' || t.unitId === unitFilter)) names.add(t.category);
    });
    return Array.from(names);
  }, [unitItems, transactions, unitFilter]);

  const startEdit = (tx, field) => {
    if (!isAdmin) return;
    if ((field === 'debt' || field === 'credit') && !(Number(tx[field]) > 0)) return;
    setEditingCell({ id: tx.id, field, value: tx[field] || '' });
  };

  const saveInlineEdit = async (overrideVal) => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const rawVal = overrideVal !== undefined ? overrideVal : editingCell.value;
    setEditingCell(null);
    const original = transactions.find((t) => t.id === id);
    if (!original) return;

    if (field === 'type') {
      if (original.type === rawVal) return;
      const currentAmount = Math.max(Number(original.debt) || 0, Number(original.credit) || 0);
      const nextDir = TRANSACTION_TYPES.find((t) => t.label === rawVal)?.direction || 'DEBT';
      await onUpdateTx(id, {
        type: rawVal,
        debt: nextDir === 'DEBT' ? currentAmount : 0,
        credit: nextDir === 'CREDIT' ? currentAmount : 0
      });
      return;
    }

    if (field === 'itemId') {
      const chosenItem = unitItems.find((i) => i.id === rawVal);
      await onUpdateTx(id, {
        itemId: chosenItem ? chosenItem.id : null,
        category: chosenItem ? chosenItem.name : 'Genel'
      });
      return;
    }

    const nextVal = field === 'debt' || field === 'credit' ? Math.max(0, parseFloat(rawVal) || 0) : String(rawVal).trim();
    if (!nextVal && (field === 'date' || field === 'unitId')) return;
    if (original[field] === nextVal || String(original[field]) === String(nextVal)) return;
    await onUpdateTx(id, { [field]: nextVal });
  };

  const isEditing = (tx, field) => editingCell?.id === tx.id && editingCell?.field === field;

  const cellInput = (type, extra) => (
    <input
      autoFocus
      type={type}
      value={editingCell.value}
      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
      onBlur={() => saveInlineEdit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') saveInlineEdit();
        if (e.key === 'Escape') setEditingCell(null);
      }}
      className={`px-2 py-1 text-xs border border-[#0f6b36] rounded bg-white focus:outline-none ${extra}`}
    />
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-3.5 sm:p-4 border-b border-slate-100">
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 flex-1">
          <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
            <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Hareket, kalem veya birim ara..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0f6b36]"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            {!isUnitObserver && (
              <select value={unitFilter} onChange={(e) => onUnitFilter(e.target.value)} className={filterCls}>
                <option value="ALL">Tüm Cariler ({units.length})</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
            {onItemFilter && (
              <select value={itemFilter} onChange={(e) => onItemFilter(e.target.value)} className={filterCls}>
                <option value="ALL">Tüm Kalemler</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilter(e.target.value)}
              className={`${filterCls} ${!isUnitObserver ? 'col-span-2 sm:col-span-1' : ''}`}
            >
              <option value="ALL">Tüm İşlem Türleri</option>
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.label} value={t.label}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <button
            onClick={onExport}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <IconDownload />
            Excel (CSV)
          </button>
          {isAdmin && (
            <button onClick={() => onNewTx()} className={`${primaryBtn} px-4 py-2 text-xs sm:text-sm`}>
              <IconPlus />
              Yeni Hareket
            </button>
          )}
        </div>
      </div>

      {transactions.length === 0 && (
        <div className="p-10 text-center text-xs sm:text-sm text-slate-500">
          Kriterlere uygun cari hareket bulunamadı.
        </div>
      )}

      {/* MOBİL KART LİSTESİ (< md) */}
      {transactions.length > 0 && (
        <div className="md:hidden divide-y divide-slate-100">
          {transactions.map((tx) => {
            const uObj = units.find((u) => u.id === tx.unitId);
            const tObj = TRANSACTION_TYPES.find((t) => t.label === tx.type);
            const linkedItem = unitItems.find((i) => i.id === tx.itemId);
            const itemName = linkedItem?.name || tx.itemName || tx.category || 'Genel';
            const debt = Number(tx.debt) || 0;
            const credit = Number(tx.credit) || 0;

            return (
              <div key={tx.id} className="p-3.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                      {uObj?.name || tx.unitId}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-[#0f6b36] border border-emerald-200 text-[10px] font-bold">
                        {itemName}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${tObj?.badge || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                        {tx.type}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {tx.date}
                        {tx.time && <span className="ml-1 text-[10px] text-slate-400/90 font-normal">{tx.time}</span>}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`text-sm font-black tabular-nums ${debt > 0 ? 'text-rose-600' : 'text-[#0f6b36]'}`}>
                      {debt > 0 ? `+${formatTRY(debt)}` : `-${formatTRY(credit)}`}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onDeleteTx(tx)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-700 flex items-center justify-between gap-2">
                  <span>{tx.description}</span>
                  {tx.documentUrl && (
                    <a
                      href={tx.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-1.5 py-0.5 rounded bg-emerald-50 text-[#0f6b36] border border-emerald-200 text-[10px] font-bold shrink-0"
                    >
                      Belge
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MASAÜSTÜ TABLO GÖRÜNÜMÜ (md+) */}
      {transactions.length > 0 && (
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 text-left">
                <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70">Tarih</th>
                <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70">Cari / Birim</th>
                <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70">Cari Detay</th>
                <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70">Tür</th>
                <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70">İşlem Açıklaması</th>
                <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70 text-right">Borç (₺)</th>
                <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70 text-right">Ödenen (₺)</th>
                {isAdmin && <th className="py-2.5 px-3.5 font-bold text-center">Sil</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => {
                const uObj = units.find((u) => u.id === tx.unitId);
                const tObj = TRANSACTION_TYPES.find((t) => t.label === tx.type);
                const linkedItem = unitItems.find((i) => i.id === tx.itemId);
                const itemName = linkedItem?.name || tx.itemName || tx.category || 'Genel';
                const itemDesc = linkedItem?.description || tx.itemDescription || '';
                const unitSpecificItems = unitItems.filter((i) => i.unitId === tx.unitId);
                const debt = Number(tx.debt) || 0;
                const credit = Number(tx.credit) || 0;
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td
                      onClick={() => !isEditing(tx, 'date') && startEdit(tx, 'date')}
                      className={`py-2.5 px-3.5 border-r border-slate-200/70 whitespace-nowrap text-slate-600 ${
                        isAdmin ? 'cursor-pointer hover:bg-amber-50/70' : ''
                      }`}
                    >
                      {isEditing(tx, 'date') ? (
                        cellInput('date', 'w-32')
                      ) : (
                        <div className="flex items-baseline gap-1.5">
                          <span>{tx.date}</span>
                          {tx.time && <span className="text-[10px] text-slate-400 font-normal tabular-nums">{tx.time}</span>}
                        </div>
                      )}
                    </td>
                    <td
                      onClick={() => !isEditing(tx, 'unitId') && startEdit(tx, 'unitId')}
                      className={`py-2.5 px-3.5 border-r border-slate-200/70 font-semibold text-slate-800 whitespace-nowrap ${
                        isAdmin ? 'cursor-pointer hover:bg-amber-50/70' : ''
                      }`}
                    >
                      {isEditing(tx, 'unitId') ? (
                        <select
                          autoFocus
                          value={editingCell.value}
                          onChange={(e) => saveInlineEdit(e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          className="px-2 py-1 text-xs border border-[#0f6b36] rounded bg-white focus:outline-none"
                        >
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div>{uObj?.name || tx.unitId}</div>
                      )}
                    </td>

                    <td
                      onClick={() => !isEditing(tx, 'itemId') && startEdit(tx, 'itemId')}
                      className={`py-2.5 px-3.5 border-r border-slate-200/70 ${
                        isAdmin ? 'cursor-pointer hover:bg-amber-50/70' : ''
                      }`}
                    >
                      {isEditing(tx, 'itemId') ? (
                        <select
                          autoFocus
                          value={editingCell.value || ''}
                          onChange={(e) => saveInlineEdit(e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          className="w-full px-2 py-1 text-xs border border-[#0f6b36] rounded bg-white focus:outline-none"
                        >
                          <option value="">Genel (Kalemsiz)</option>
                          {unitSpecificItems.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div>
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-[#0f6b36] border border-emerald-200 text-[11px] font-bold">
                            <span>{itemName}</span>
                          </div>
                          {itemDesc && <div className="text-[11px] text-slate-500 mt-0.5">{itemDesc}</div>}
                        </div>
                      )}
                    </td>

                    <td
                      onClick={() => !isEditing(tx, 'type') && startEdit(tx, 'type')}
                      className={`py-2.5 px-3.5 border-r border-slate-200/70 whitespace-nowrap ${
                        isAdmin ? 'cursor-pointer hover:bg-amber-50/70' : ''
                      }`}
                    >
                      {isEditing(tx, 'type') ? (
                        <select
                          autoFocus
                          value={editingCell.value}
                          onChange={(e) => saveInlineEdit(e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          className="px-2 py-1 text-xs border border-[#0f6b36] rounded bg-white focus:outline-none"
                        >
                          {TRANSACTION_TYPES.map((t) => (
                            <option key={t.label} value={t.label}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${tObj?.badge || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                          {tx.type}
                        </span>
                      )}
                    </td>
                    <td
                      onClick={() => !isEditing(tx, 'description') && startEdit(tx, 'description')}
                      className={`py-2.5 px-3.5 border-r border-slate-200/70 text-slate-700 ${isAdmin ? 'cursor-text hover:bg-amber-50/70' : ''}`}
                    >
                      {isEditing(tx, 'description') ? (
                        cellInput('text', 'w-full')
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{tx.description}</span>
                          {tx.documentUrl && (
                            <a
                              href={tx.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-1.5 py-0.5 rounded bg-emerald-50 text-[#0f6b36] border border-emerald-200 text-[10px] font-bold hover:underline"
                            >
                              Belge
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td
                      onClick={() => !isEditing(tx, 'debt') && startEdit(tx, 'debt')}
                      className={`py-2.5 px-3.5 border-r border-slate-200/70 text-right font-semibold tabular-nums whitespace-nowrap ${
                        debt > 0 ? 'text-rose-600' : 'text-slate-300'
                      } ${isAdmin && debt > 0 ? 'cursor-text hover:bg-amber-50/70' : ''}`}
                    >
                      {isEditing(tx, 'debt') ? cellInput('number', 'w-28 text-right') : debt > 0 ? formatTRY(debt) : '-'}
                    </td>
                    <td
                      onClick={() => !isEditing(tx, 'credit') && startEdit(tx, 'credit')}
                      className={`py-2.5 px-3.5 border-r border-slate-200/70 text-right font-semibold tabular-nums whitespace-nowrap ${
                        credit > 0 ? 'text-[#0f6b36]' : 'text-slate-300'
                      } ${isAdmin && credit > 0 ? 'cursor-text hover:bg-amber-50/70' : ''}`}
                    >
                      {isEditing(tx, 'credit') ? cellInput('number', 'w-28 text-right') : credit > 0 ? formatTRY(credit) : '-'}
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 px-3.5 text-center">
                        <button onClick={() => onDeleteTx(tx)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="Sil">
                          <IconTrash />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
