import { useMemo, useState } from 'react';
import { IconDownload, IconPlus, IconSearch, IconShield, IconTrash } from '../icons.jsx';
import { TRANSACTION_TYPES, formatTRY, primaryBtn } from '../constants.js';

const filterCls =
  'px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0f6b36]';

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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 flex-1">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Hareket, kalem veya birim ara..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0f6b36]"
            />
          </div>
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
                  Kalem: {cat}
                </option>
              ))}
            </select>
          )}
          <select value={typeFilter} onChange={(e) => onTypeFilter(e.target.value)} className={filterCls}>
            <option value="ALL">Tüm İşlem Türleri</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t.label} value={t.label}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            title="SHA-256 Dijital Bütünlük İmzalı CSV İndir"
          >
            <IconDownload />
            İmzalı Excel (CSV)
          </button>
          {isAdmin && (
            <button onClick={() => onNewTx()} className={`${primaryBtn} px-4 py-2 text-xs sm:text-sm`}>
              <IconPlus />
              Yeni Hareket
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 text-left">
              <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70">Tarih</th>
              <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70">Cari / Birim</th>
              <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70">Ait Olduğu Kalem & Detay</th>
              <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70">Tür</th>
              <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70">İşlem Açıklaması</th>
              <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70 text-right">Borç (₺)</th>
              <th className="py-2.5 px-3.5 font-bold border-r border-slate-200/70 text-right">Ödenen (₺)</th>
              {isAdmin && <th className="py-2.5 px-3.5 font-bold text-center">Sil</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="py-10 text-center text-slate-500">
                  Kriterlere uygun cari hareket bulunamadı.
                </td>
              </tr>
            )}
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
                    title={isAdmin ? 'Tarihi düzenlemek için tıklayın' : ''}
                  >
                    {isEditing(tx, 'date') ? cellInput('date', 'w-32') : tx.date}
                  </td>
                  <td
                    onClick={() => !isEditing(tx, 'unitId') && startEdit(tx, 'unitId')}
                    className={`py-2.5 px-3.5 border-r border-slate-200/70 font-semibold text-slate-800 whitespace-nowrap ${
                      isAdmin ? 'cursor-pointer hover:bg-amber-50/70' : ''
                    }`}
                    title={isAdmin ? 'Cari/Birimi değiştirmek için tıklayın' : ''}
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

                  {/* AİT OLDUĞU KALEM & DETAY SÜTUNU */}
                  <td
                    onClick={() => !isEditing(tx, 'itemId') && startEdit(tx, 'itemId')}
                    className={`py-2.5 px-3.5 border-r border-slate-200/70 min-w-[165px] ${
                      isAdmin ? 'cursor-pointer hover:bg-amber-50/70' : ''
                    }`}
                    title={isAdmin ? 'Ait olduğu kalemi değiştirmek için tıklayın' : ''}
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
                    title={isAdmin ? 'İşlem türünü değiştirmek için tıklayın' : ''}
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
                    className={`py-2.5 px-3.5 border-r border-slate-200/70 min-w-[180px] text-slate-700 ${isAdmin ? 'cursor-text hover:bg-amber-50/70' : ''}`}
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
    </div>
  );
}
