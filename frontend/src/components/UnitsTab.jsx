import { Fragment, useState } from 'react';
import { IconEdit, IconGrid, IconPlus, IconSearch, IconTable, IconTrash } from '../icons.jsx';
import { formatTRY, primaryBtn } from '../constants.js';

const balanceBadge = (n) =>
  n > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-[#0f6b36] border-emerald-200';

export default function UnitsTab({
  units,
  isAdmin,
  isUnitObserver,
  search,
  onSearch,
  viewMode,
  onViewMode,
  onNewUnit,
  onNewTx,
  onEditUnit,
  onQuickSave,
  onDeleteUnit,
  onShowStatement,
  onSelectItem,
  onCreateItem,
  onUpdateItem,
  onDeleteItem
}) {
  const [quick, setQuick] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});
  const [newItemForms, setNewItemForms] = useState({});
  const [editItem, setEditItem] = useState(null);

  const isExpanded = (uid) => {
    if (isUnitObserver) return true;
    return Boolean(expandedIds[uid]);
  };

  const toggleExpand = (uid) => {
    setExpandedIds((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  const startQuick = (u) => {
    if (!isAdmin) return;
    setQuick({ id: u.id, name: u.name, contact: u.contact, phone: u.phone });
  };

  const saveQuick = async (e) => {
    e?.preventDefault?.();
    if (!quick) return;
    const ok = await onQuickSave(quick);
    if (ok) setQuick(null);
  };

  const onEnter = (e) => e.key === 'Enter' && saveQuick();

  const getNewForm = (uid) => newItemForms[uid] || { name: '', description: '', debt: '', paid: '' };
  const setNewForm = (uid, patch) => {
    setNewItemForms((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] || { name: '', description: '', debt: '', paid: '' }), ...patch }
    }));
  };

  const handleAddItem = async (e, unitId) => {
    e.preventDefault();
    const f = getNewForm(unitId);
    if (!f.name.trim()) return;
    const ok = await onCreateItem?.({
      unitId,
      name: f.name.trim(),
      description: (f.description || '').trim(),
      debt: Math.max(0, parseFloat(f.debt) || 0).toFixed(2),
      paid: Math.max(0, parseFloat(f.paid) || 0).toFixed(2)
    });
    if (ok) {
      setNewItemForms((prev) => ({ ...prev, [unitId]: { name: '', description: '', debt: '', paid: '' } }));
    }
  };

  const handleSaveEditItem = async (e) => {
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

  const renderUnitItemsPanel = (u) => {
    const items = u.items || [];
    const form = getNewForm(u.id);

    return (
      <div className="p-3 sm:p-4 bg-slate-50/90 border-t border-slate-200 space-y-2.5 w-full max-w-full overflow-hidden">
        {items.length === 0 ? (
          <div className="p-3 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-500">
            Henüz kalem eklenmemiş.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {items.map((item) => {
              const debt = Number(item.debt) || 0;
              const paid = Number(item.paid) || 0;
              const rem = debt - paid;
              const isEditingThis = isAdmin && editItem?.id === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col justify-between gap-2 min-w-0"
                >
                  {isEditingThis ? (
                    <form onSubmit={handleSaveEditItem} className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Kalem Adı</label>
                        <input
                          type="text"
                          required
                          autoFocus
                          value={editItem.name}
                          onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                          className="w-full px-2.5 py-1 text-xs font-bold border border-[#0f6b36] rounded-lg bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-rose-600 uppercase">Borç (₺)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editItem.debt}
                            onChange={(e) => setEditItem({ ...editItem, debt: e.target.value })}
                            className="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-lg bg-white tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#0f6b36] uppercase">Ödenen (₺)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editItem.paid}
                            onChange={(e) => setEditItem({ ...editItem, paid: e.target.value })}
                            className="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-lg bg-white tabular-nums"
                          />
                        </div>
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <button
                          type="submit"
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-[#0f6b36] text-white cursor-pointer"
                        >
                          Kaydet
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditItem(null)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                        >
                          İptal
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div
                          onClick={() => onSelectItem?.(item, u)}
                          className="cursor-pointer group flex-1 truncate"
                        >
                          <span className="text-sm font-extrabold text-slate-900 group-hover:text-[#0f6b36] group-hover:underline">
                            {item.name}
                          </span>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onNewTx?.(u.id, item.id)}
                              className="px-2 py-1 rounded-md bg-emerald-50 text-[#0f6b36] border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                            >
                              + İşlem
                            </button>
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
                              className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                              title="Düzenle"
                            >
                              <IconEdit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteItem?.(item)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Sil"
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div
                        onClick={() => onSelectItem?.(item, u)}
                        className="grid grid-cols-3 gap-1.5 text-center cursor-pointer"
                      >
                        <div className="p-1.5 sm:p-2 rounded-lg bg-rose-50/70 border border-rose-100 hover:border-rose-300 min-w-0">
                          <div className="text-[10px] font-bold uppercase text-rose-700">Borç</div>
                          <div className="text-[11px] sm:text-xs font-extrabold text-rose-600 tabular-nums mt-0.5 truncate">{formatTRY(debt)}</div>
                        </div>
                        <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 hover:border-emerald-300 min-w-0">
                          <div className="text-[10px] font-bold uppercase text-[#0f6b36]">Ödenen</div>
                          <div className="text-[11px] sm:text-xs font-extrabold text-[#0f6b36] tabular-nums mt-0.5 truncate">{formatTRY(paid)}</div>
                        </div>
                        <div className="p-1.5 sm:p-2 rounded-lg bg-slate-100 border border-slate-200 hover:border-slate-300 min-w-0">
                          <div className="text-[10px] font-bold uppercase text-slate-600">Kalan</div>
                          <div
                            className={`text-[11px] sm:text-xs font-black tabular-nums mt-0.5 truncate ${
                              rem > 0 ? 'text-rose-700' : 'text-[#0f6b36]'
                            }`}
                          >
                            {formatTRY(rem)}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isAdmin && (
          <form
            onSubmit={(e) => handleAddItem(e, u.id)}
            className="p-2.5 rounded-xl bg-white border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 items-center"
          >
            <input
              type="text"
              required
              placeholder="Kalem Adı (Örn: Kumanya)"
              value={form.name}
              onChange={(e) => setNewForm(u.id, { name: e.target.value })}
              className="col-span-2 sm:col-span-1 w-full px-2.5 py-2 sm:py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#0f6b36]"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Borç (₺)"
              value={form.debt}
              onChange={(e) => setNewForm(u.id, { debt: e.target.value })}
              className="w-full px-2.5 py-2 sm:py-1.5 text-xs border border-slate-300 rounded-lg bg-white tabular-nums focus:outline-none focus:border-[#0f6b36]"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ödenen (₺)"
              value={form.paid}
              onChange={(e) => setNewForm(u.id, { paid: e.target.value })}
              className="w-full px-2.5 py-2 sm:py-1.5 text-xs border border-slate-300 rounded-lg bg-white tabular-nums focus:outline-none focus:border-[#0f6b36]"
            />
            <button
              type="submit"
              className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold bg-[#0f6b36] hover:bg-[#095327] text-white cursor-pointer"
            >
              <IconPlus className="w-3.5 h-3.5" />
              Kalem Ekle
            </button>
          </form>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* ÜST BAŞLIK & ARAÇLAR (MOBİL UYUMLU) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 sm:p-4 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900">Cariler & Bakiyeler</h2>
          <div className="hidden md:inline-flex p-1 rounded-lg bg-slate-100">
            <button
              onClick={() => onViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <IconTable className="w-3.5 h-3.5" />
              Tablo
            </button>
            <button
              onClick={() => onViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <IconGrid className="w-3.5 h-3.5" />
              Kartlar
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {!isUnitObserver && (
            <div className="relative flex-1 sm:w-56">
              <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari, yetkili veya kalem ara..."
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 sm:py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#0f6b36]"
              />
            </div>
          )}

          {isAdmin && (
            <div className="grid grid-cols-2 sm:flex items-center gap-2">
              <button
                onClick={onNewUnit}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                <IconPlus />
                Yeni Cari
              </button>
              <button onClick={() => onNewTx()} className={`${primaryBtn} px-3.5 py-2 text-xs whitespace-nowrap`}>
                <IconPlus />
                Yeni Hareket
              </button>
            </div>
          )}
        </div>
      </div>

      {units.length === 0 && (
        <div className="p-10 text-center text-sm text-slate-500">Gösterilecek cari / birim bulunamadı.</div>
      )}

      {/* MOBİL GÖRÜNÜM (< md): YATAY TAŞMA OLMAYAN TAM EKRAN KART LİSTESİ */}
      {units.length > 0 && (
        <div className="md:hidden divide-y divide-slate-200">
          {units.map((u) => {
            const editing = isAdmin && quick?.id === u.id;
            const open = isExpanded(u.id);

            return (
              <div key={u.id} className="bg-white">
                <div className="p-3.5 space-y-2.5">
                  {editing ? (
                    <form onSubmit={saveQuick} className="space-y-2">
                      <input
                        type="text"
                        autoFocus
                        value={quick.name}
                        onChange={(e) => setQuick({ ...quick, name: e.target.value })}
                        placeholder="Cari / Birim Adı"
                        className="w-full px-2.5 py-1.5 text-sm font-bold border border-[#0f6b36] rounded-lg bg-white"
                      />
                      <input
                        type="text"
                        value={quick.contact}
                        onChange={(e) => setQuick({ ...quick, contact: e.target.value })}
                        placeholder="Yetkili Adı"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="submit"
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-[#0f6b36] text-white cursor-pointer"
                        >
                          Kaydet
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuick(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                        >
                          İptal
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 cursor-pointer" onClick={() => toggleExpand(u.id)}>
                        <div className="font-extrabold text-slate-900 text-sm truncate hover:text-[#0f6b36]">{u.name}</div>
                        <div className="text-xs text-slate-500 truncate">{u.contact}</div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onEditUnit(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                          >
                            <IconEdit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteUnit(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* YAN YANA EŞİT BORÇ | ÖDENEN | KALAN KUTULARI */}
                  <div
                    onClick={() => toggleExpand(u.id)}
                    className="grid grid-cols-3 gap-1.5 text-center cursor-pointer"
                  >
                    <div className="p-2 rounded-xl bg-rose-50/70 border border-rose-100 min-w-0">
                      <div className="text-[10px] font-bold uppercase text-rose-700">Borç</div>
                      <div className="text-xs font-extrabold text-rose-600 tabular-nums mt-0.5 truncate">
                        {formatTRY(u.totalDebt)}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 min-w-0">
                      <div className="text-[10px] font-bold uppercase text-[#0f6b36]">Ödenen</div>
                      <div className="text-xs font-extrabold text-[#0f6b36] tabular-nums mt-0.5 truncate">
                        {formatTRY(u.totalCredit)}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 min-w-0">
                      <div className="text-[10px] font-bold uppercase text-slate-600">Kalan</div>
                      <div
                        className={`text-xs font-black tabular-nums mt-0.5 truncate ${
                          u.netBalance > 0 ? 'text-rose-700' : 'text-[#0f6b36]'
                        }`}
                      >
                        {formatTRY(u.netBalance)}
                      </div>
                    </div>
                  </div>
                </div>

                {open && renderUnitItemsPanel(u)}
              </div>
            );
          })}
        </div>
      )}

      {/* MASAÜSTÜ TABLO GÖRÜNÜMÜ (md+) */}
      {units.length > 0 && viewMode === 'table' && (
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 text-left">
                <th className="py-2.5 px-4 font-bold">Cari / Birim</th>
                <th className="py-2.5 px-4 font-bold">Yetkili</th>
                <th className="py-2.5 px-4 font-bold text-right">Toplam Borç (₺)</th>
                <th className="py-2.5 px-4 font-bold text-right">Toplam Ödenen (₺)</th>
                <th className="py-2.5 px-4 font-bold text-right">Kalan Bakiye (₺)</th>
                {isAdmin && <th className="py-2.5 px-4 font-bold text-right">İşlemler</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.map((u) => {
                const editing = isAdmin && quick?.id === u.id;
                const open = isExpanded(u.id);
                return (
                  <Fragment key={u.id}>
                    <tr className={editing ? 'bg-amber-50/50' : open ? 'bg-emerald-50/30' : 'hover:bg-slate-50/70'}>
                      <td className="py-3 px-4">
                        {editing ? (
                          <input
                            type="text"
                            autoFocus
                            value={quick.name}
                            onChange={(e) => setQuick({ ...quick, name: e.target.value })}
                            onKeyDown={onEnter}
                            placeholder="Cari / Birim Adı"
                            className="w-full px-2.5 py-1.5 text-sm font-bold border border-[#0f6b36] rounded-lg bg-white focus:outline-none"
                          />
                        ) : (
                          <div
                            onClick={() => toggleExpand(u.id)}
                            className="cursor-pointer group"
                          >
                            <div className="font-bold text-slate-900 group-hover:text-[#0f6b36] group-hover:underline">{u.name}</div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 text-xs">
                        {editing ? (
                          <input
                            type="text"
                            value={quick.contact}
                            onChange={(e) => setQuick({ ...quick, contact: e.target.value })}
                            onKeyDown={onEnter}
                            placeholder="Yetkili Adı"
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#0f6b36]"
                          />
                        ) : (
                          <span
                            onClick={() => startQuick(u)}
                            className={isAdmin ? 'cursor-pointer hover:text-[#0f6b36] hover:underline font-medium' : ''}
                          >
                            {u.contact}
                          </span>
                        )}
                      </td>
                      <td
                        onClick={() => !editing && toggleExpand(u.id)}
                        className="py-3 px-4 text-right font-semibold text-rose-600 tabular-nums whitespace-nowrap cursor-pointer"
                      >
                        {formatTRY(u.totalDebt)}
                      </td>
                      <td
                        onClick={() => !editing && toggleExpand(u.id)}
                        className="py-3 px-4 text-right font-semibold text-[#0f6b36] tabular-nums whitespace-nowrap cursor-pointer"
                      >
                        {formatTRY(u.totalCredit)}
                      </td>
                      <td
                        onClick={() => !editing && toggleExpand(u.id)}
                        className="py-3 px-4 text-right whitespace-nowrap cursor-pointer"
                      >
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-extrabold border tabular-nums ${balanceBadge(u.netBalance)}`}>
                          {formatTRY(u.netBalance)}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4">
                          {editing ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={saveQuick}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0f6b36] hover:bg-[#095327] text-white cursor-pointer"
                              >
                                Kaydet
                              </button>
                              <button
                                type="button"
                                onClick={() => setQuick(null)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                              >
                                İptal
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onEditUnit(u)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                                title="Cari Bilgilerini Düzenle"
                              >
                                <IconEdit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteUnit(u)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Cariyi Sil"
                              >
                                <IconTrash />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={isAdmin ? 6 : 5} className="p-0">
                          {renderUnitItemsPanel(u)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MASAÜSTÜ KARTLAR GÖRÜNÜMÜ (md+) */}
      {units.length > 0 && viewMode === 'grid' && (
        <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          {units.map((u) => {
            const editing = isAdmin && quick?.id === u.id;
            const open = isExpanded(u.id);
            return (
              <div key={u.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="p-4 flex flex-col flex-1">
                  {editing ? (
                    <form onSubmit={saveQuick} className="space-y-2 mb-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Cari / Birim Adı</label>
                        <input
                          type="text"
                          autoFocus
                          value={quick.name}
                          onChange={(e) => setQuick({ ...quick, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-sm font-bold border border-[#0f6b36] rounded-lg bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Yetkili Kişi</label>
                        <input
                          type="text"
                          value={quick.contact}
                          onChange={(e) => setQuick({ ...quick, contact: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold border border-[#0f6b36] rounded-lg bg-white focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <button type="submit" className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-[#0f6b36] text-white cursor-pointer">
                          Kaydet
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuick(null)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                        >
                          İptal
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div onClick={() => toggleExpand(u.id)} className="cursor-pointer">
                        <div className="text-base font-extrabold text-slate-900 hover:text-[#0f6b36]">{u.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{u.contact}</div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditUnit(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                          >
                            <IconEdit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteUnit(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    onClick={() => toggleExpand(u.id)}
                    className="grid grid-cols-3 gap-2 text-center cursor-pointer"
                  >
                    <div className="p-2 rounded-xl bg-rose-50/70 border border-rose-100">
                      <div className="text-[10px] font-bold uppercase text-rose-700">Borç</div>
                      <div className="text-xs font-extrabold text-rose-600 tabular-nums mt-0.5">{formatTRY(u.totalDebt)}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
                      <div className="text-[10px] font-bold uppercase text-[#0f6b36]">Ödenen</div>
                      <div className="text-xs font-extrabold text-[#0f6b36] tabular-nums mt-0.5">{formatTRY(u.totalCredit)}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                      <div className="text-[10px] font-bold uppercase text-slate-600">Kalan</div>
                      <div className={`text-xs font-black tabular-nums mt-0.5 ${u.netBalance > 0 ? 'text-rose-700' : 'text-[#0f6b36]'}`}>
                        {formatTRY(u.netBalance)}
                      </div>
                    </div>
                  </div>
                </div>
                {open && renderUnitItemsPanel(u)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
