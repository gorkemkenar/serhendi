import { useState } from 'react';
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
  onShowStatement
}) {
  // Satır/Kart içi hızlı cari adı & telefon düzenleme durumu
  const [quick, setQuick] = useState(null);

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

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      {/* Başlık & araçlar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Cariler, Telefonlar & Güncel Bakiyeler</h2>
          {isAdmin && (
            <p className="text-xs text-slate-500 mt-0.5">
              Cari adı veya telefon numarasına tıklayarak ya da Düzenle butonuyla anında değiştirebilirsiniz.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-lg bg-slate-100">
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

          {!isUnitObserver && (
            <div className="relative">
              <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari, yetkili veya tel ara..."
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#0f6b36]"
              />
            </div>
          )}

          {isAdmin && (
            <>
              <button
                onClick={onNewUnit}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <IconPlus />
                Yeni Cari / Birim
              </button>
              <button onClick={onNewTx} className={`${primaryBtn} px-4 py-2 text-xs sm:text-sm`}>
                <IconPlus />
                Yeni Hareket
              </button>
            </>
          )}
        </div>
      </div>

      {units.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Gösterilecek cari / birim bulunamadı.</div>}

      {units.length > 0 && viewMode === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 text-left">
                <th className="py-2.5 px-4 font-bold">Cari / Birim Adı</th>
                <th className="py-2.5 px-4 font-bold">Yetkili</th>
                <th className="py-2.5 px-4 font-bold">Telefon Numarası</th>
                <th className="py-2.5 px-4 font-bold text-right">Toplam Borç (₺)</th>
                <th className="py-2.5 px-4 font-bold text-right">Toplam Alacak (₺)</th>
                <th className="py-2.5 px-4 font-bold text-right">Net Bakiye (₺)</th>
                <th className="py-2.5 px-4 font-bold">Son İşlem</th>
                <th className="py-2.5 px-4 font-bold text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.map((u) => {
                const editing = isAdmin && quick?.id === u.id;
                return (
                  <tr key={u.id} className={editing ? 'bg-amber-50/50' : 'hover:bg-slate-50/70'}>
                    <td className="py-3 px-4 min-w-[200px]">
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
                          onClick={() => startQuick(u)}
                          className={isAdmin ? 'cursor-pointer group' : ''}
                          title={isAdmin ? 'Cari adını düzenlemek için tıklayın' : ''}
                        >
                          <div className="font-bold text-slate-900 group-hover:text-[#0f6b36] group-hover:underline">{u.name}</div>
                          <div className="text-[11px] text-slate-400 font-semibold">
                            {u.id} • {u.txCount} hareket
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 text-xs min-w-[140px]">
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
                        u.contact
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 tabular-nums whitespace-nowrap min-w-[140px]">
                      {editing ? (
                        <input
                          type="tel"
                          value={quick.phone}
                          onChange={(e) => setQuick({ ...quick, phone: e.target.value })}
                          onKeyDown={onEnter}
                          placeholder="05xx xxx xx xx"
                          className="w-full px-2.5 py-1.5 text-xs font-semibold border border-[#0f6b36] rounded-lg bg-white focus:outline-none tabular-nums"
                        />
                      ) : (
                        <span
                          onClick={() => startQuick(u)}
                          className={`inline-flex items-center gap-1.5 font-semibold ${isAdmin ? 'cursor-pointer hover:text-[#0f6b36] hover:underline' : ''}`}
                          title={isAdmin ? 'Telefon numarasını düzenlemek için tıklayın' : ''}
                        >
                          {u.phone}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-rose-600 tabular-nums whitespace-nowrap">{formatTRY(u.totalDebt)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-[#0f6b36] tabular-nums whitespace-nowrap">{formatTRY(u.totalCredit)}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-extrabold border tabular-nums ${balanceBadge(u.netBalance)}`}>
                        {formatTRY(u.netBalance)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">{u.lastTxDate}</td>
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
                            onClick={() => onShowStatement(u.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-[#0f6b36] hover:text-white text-slate-800 transition cursor-pointer whitespace-nowrap"
                          >
                            Ekstre Gör
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditUnit(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 cursor-pointer"
                                title="Cari Adı ve Telefonu Düzenle"
                              >
                                <IconEdit className="w-3.5 h-3.5" />
                                Düzenle
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteUnit(u)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Cariyi Sil"
                              >
                                <IconTrash />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {units.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-4">
          {units.map((u) => {
            const editing = isAdmin && quick?.id === u.id;
            return (
              <div key={u.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md transition">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{u.id}</span>
                  <span>{u.lastTxDate}</span>
                </div>

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
                      <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Telefon Numarası</label>
                      <input
                        type="tel"
                        value={quick.phone}
                        onChange={(e) => setQuick({ ...quick, phone: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs font-semibold border border-[#0f6b36] rounded-lg bg-white tabular-nums focus:outline-none"
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
                  <div className="mb-3">
                    <div
                      onClick={() => startQuick(u)}
                      className={`text-base font-extrabold text-slate-900 ${isAdmin ? 'cursor-pointer hover:text-[#0f6b36]' : ''}`}
                    >
                      {u.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{u.contact}</div>
                    <div
                      onClick={() => startQuick(u)}
                      className={`text-xs font-semibold text-slate-700 tabular-nums mt-0.5 ${isAdmin ? 'cursor-pointer hover:text-[#0f6b36]' : ''}`}
                    >
                      {u.phone}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3 mt-auto">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Toplam Borç:</span>
                    <span className="font-bold text-rose-600 tabular-nums">{formatTRY(u.totalDebt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Toplam Alacak:</span>
                    <span className="font-bold text-[#0f6b36] tabular-nums">{formatTRY(u.totalCredit)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-dashed border-slate-200">
                    <span className="font-bold text-slate-700">Net Bakiye:</span>
                    <span className={`font-black tabular-nums ${u.netBalance > 0 ? 'text-rose-600' : 'text-[#0f6b36]'}`}>
                      {formatTRY(u.netBalance)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onShowStatement(u.id)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-[#0f6b36] hover:text-white text-slate-800 transition cursor-pointer"
                  >
                    Cari Ekstre Aç
                  </button>
                  {isAdmin && !editing && (
                    <button
                      type="button"
                      onClick={() => onEditUnit(u)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 cursor-pointer"
                    >
                      Düzenle
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
