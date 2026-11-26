import { Fragment, useState } from 'react';
import { IconEdit, IconGrid, IconPlus, IconSearch, IconTable, IconTrash } from '../icons.jsx';
import { formatTRY, primaryBtn } from '../constants.js';

const balanceBadge = (n) =>
  n > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-[#0f6b36] border-emerald-200';

const PRESET_ITEMS = [
  { name: 'Kumanya', description: 'Aylık Erzak & Kumanya Kolisi' },
  { name: 'Kandil Simidi', description: 'Kandil Gecesi Simit Dağıtımı' },
  { name: 'Patates', description: 'Mutfak Çuval Patates Sevkiyatı' },
  { name: 'Kurban', description: 'Kurban & Et Organizasyonu' },
  { name: 'Takvim / Dergi', description: 'Yıllık Takvim & Yayın Dağıtımı' }
];

export default function UnitsTab({
  units,
  transactions = [],
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
      <div className="p-3.5 sm:p-4 bg-slate-50/90 border-t border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs sm:text-sm font-extrabold text-slate-900">
              {u.name} — Kalem Kalem Borç & Detay Listesi ({items.length} Kalem)
            </div>
            <p className="text-[11px] text-slate-500">
              Her kalemin hangi cariye ve neye ait olduğu, Borç / Ödenen / Kalan tutarları ve bağlı hareketleri
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Hızlı Kalem Seç:</span>
              {PRESET_ITEMS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setNewForm(u.id, { name: preset.name, description: `${u.name} - ${preset.description}` })}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 hover:border-[#0f6b36] hover:text-[#0f6b36] cursor-pointer"
                >
                  + {preset.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* KALEM KARTLARI (BORÇ - ÖDENEN - KALAN + NEYE AİT DETAYI + BAĞLI HAREKETLER) */}
        {items.length === 0 ? (
          <div className="p-4 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-500">
            Bu cari için henüz kalem eklenmemiş.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => {
              const debt = Number(item.debt) || 0;
              const paid = Number(item.paid) || 0;
              const rem = debt - paid;
              const isEditingThis = isAdmin && editItem?.id === item.id;
              const itemTxs = transactions.filter(
                (t) => t.unitId === u.id && (t.itemId === item.id || (t.category && t.category.toLowerCase() === item.name.toLowerCase()))
              );

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col justify-between gap-2.5"
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
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Kalem Detayı / Neye Ait?</label>
                        <input
                          type="text"
                          placeholder="Örn: Gümüşyaka Dergah Aylık Kumanya Kolisi"
                          value={editItem.description || ''}
                          onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
                          className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
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
                      {/* ÜST BAŞLIK: KALEM ADI + HANGİ CARİYE VE NEYE AİT OLDUĞU (TIKLANINCA HAREKETLER POP-UP AÇILIR) */}
                      <div className="border-b border-slate-100 pb-2 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div
                            onClick={() => onSelectItem?.(item, u)}
                            className="cursor-pointer group flex-1"
                            title="Bu kaleme yapılan hareketleri görmek için tıklayın"
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-extrabold text-slate-900 group-hover:text-[#0f6b36] group-hover:underline">
                                {item.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[#0f6b36] text-[10px] font-bold">
                                Hareketleri Gör ({itemTxs.length})
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold text-[#0f6b36]">
                              Aidiyet: {u.name}
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => onNewTx?.(u.id, item.id)}
                                className="px-2 py-1 rounded-md bg-emerald-50 text-[#0f6b36] border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                                title="Bu kaleme yeni borç veya ödeme hareketi ekle"
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
                                title="Kalemi Düzenle"
                              >
                                <IconEdit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteItem?.(item)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Kalemi Sil"
                              >
                                <IconTrash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          <b className="text-slate-600">Detay / Neye Ait:</b>{' '}
                          {item.description || `${u.name} — ${item.name} Kalemi`}
                        </div>
                      </div>

                      {/* BORÇ | ÖDENEN | KALAN (TIKLANINCA KALEM HAREKETLERİ POP-UP AÇILIR) */}
                      <div
                        onClick={() => onSelectItem?.(item, u)}
                        className="grid grid-cols-3 gap-1.5 text-center cursor-pointer"
                        title="Kaleme yapılan hareketleri görmek için tıklayın"
                      >
                        <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-100 hover:border-rose-300">
                          <div className="text-[10px] font-bold uppercase text-rose-700">Borç</div>
                          <div className="text-xs font-extrabold text-rose-600 tabular-nums mt-0.5">{formatTRY(debt)}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 hover:border-emerald-300">
                          <div className="text-[10px] font-bold uppercase text-[#0f6b36]">Ödenen</div>
                          <div className="text-xs font-extrabold text-[#0f6b36] tabular-nums mt-0.5">{formatTRY(paid)}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 hover:border-slate-300">
                          <div className="text-[10px] font-bold uppercase text-slate-600">Kalan</div>
                          <div
                            className={`text-xs font-black tabular-nums mt-0.5 ${rem > 0 ? 'text-rose-700' : 'text-[#0f6b36]'
                              }`}
                          >
                            {formatTRY(rem)}
                          </div>
                        </div>
                      </div>

                      {/* BU KALEME AİT SON HAREKETLER ÖZETİ */}
                      {itemTxs.length > 0 && (
                        <div className="pt-1.5 border-t border-slate-100 space-y-1">
                          <div className="text-[10px] font-bold uppercase text-slate-400">
                            Bu Kaleme Ait Hareketler ({itemTxs.length})
                          </div>
                          {itemTxs.slice(0, 2).map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between text-[11px] text-slate-600 gap-2">
                              <span className="truncate">
                                <b className="text-slate-700">{tx.date}:</b> {tx.description}
                              </span>
                              <span
                                className={`font-bold tabular-nums shrink-0 ${Number(tx.debt) > 0 ? 'text-rose-600' : 'text-[#0f6b36]'
                                  }`}
                              >
                                {Number(tx.debt) > 0 ? `+${formatTRY(tx.debt)}` : `-${formatTRY(tx.credit)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* YENİ KALEM EKLEME FORMU (KALEM ADI + NEYE AİT DETAYI + BORÇ + ÖDENEN) */}
        {isAdmin && (
          <form
            onSubmit={(e) => handleAddItem(e, u.id)}
            className="p-3 rounded-xl bg-white border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end"
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Yeni Kalem Adı</label>
              <input
                type="text"
                required
                placeholder="Örn: Kumanya, Patates..."
                value={form.name}
                onChange={(e) => setNewForm(u.id, { name: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#0f6b36]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Kalem Detayı / Neye Ait?</label>
              <input
                type="text"
                placeholder={`Örn: ${u.name} erzak alımı`}
                value={form.description}
                onChange={(e) => setNewForm(u.id, { description: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#0f6b36]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-rose-700 mb-1">Borç (₺)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.debt}
                onChange={(e) => setNewForm(u.id, { debt: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white tabular-nums focus:outline-none focus:border-[#0f6b36]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0f6b36] mb-1">Ödenen (₺)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.paid}
                onChange={(e) => setNewForm(u.id, { paid: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white tabular-nums focus:outline-none focus:border-[#0f6b36]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#0f6b36] hover:bg-[#095327] text-white cursor-pointer"
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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      {/* Başlık & araçlar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Cariler, Kalem Detayları & Güncel Bakiyeler</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Her carinin yanındaki <b>"Kalemler"</b> butonuna tıklayarak kalemlerin neye ait olduğunu, <b>Borç / Ödenen / Kalan</b> tutarlarını ve o kaleme ait hareketleri görebilirsiniz.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-lg bg-slate-100">
            <button
              onClick={() => onViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
            >
              <IconTable className="w-3.5 h-3.5" />
              Tablo
            </button>
            <button
              onClick={() => onViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
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
                placeholder="Cari, yetkili veya kalem ara..."
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
              <button onClick={() => onNewTx()} className={`${primaryBtn} px-4 py-2 text-xs sm:text-sm`}>
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
                <th className="py-2.5 px-4 font-bold">Cari / Birim & Kalem Özeti</th>
                <th className="py-2.5 px-4 font-bold">Yetkili</th>
                <th className="py-2.5 px-4 font-bold text-right">Toplam Borç (₺)</th>
                <th className="py-2.5 px-4 font-bold text-right">Toplam Ödenen (₺)</th>
                <th className="py-2.5 px-4 font-bold text-right">Kalan Bakiye (₺)</th>
                <th className="py-2.5 px-4 font-bold text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.map((u) => {
                const editing = isAdmin && quick?.id === u.id;
                const open = isExpanded(u.id);
                const itemCount = (u.items || []).length;
                return (
                  <Fragment key={u.id}>
                    <tr className={editing ? 'bg-amber-50/50' : open ? 'bg-emerald-50/30' : 'hover:bg-slate-50/70'}>
                      <td className="py-3 px-4 min-w-[220px]">
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
                            title="Kalem detaylarını açmak / kapatmak için tıklayın"
                          >
                            <div className="font-bold text-slate-900 group-hover:text-[#0f6b36] group-hover:underline">{u.name}</div>
                            <div className="text-[11px] text-slate-400 font-semibold">
                              {itemCount} kalem ({(u.items || []).map((i) => i.name).join(', ') || 'Kalem yok'})
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 text-xs min-w-[130px]">
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
                            title={isAdmin ? 'Yetkili adını düzenlemek için tıklayın' : ''}
                          >
                            {u.contact}
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
                              onClick={() => toggleExpand(u.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer whitespace-nowrap ${open
                                ? 'bg-[#0f6b36] text-white border-[#0f6b36]'
                                : 'bg-emerald-50 text-[#0f6b36] border-emerald-200 hover:bg-emerald-100'
                                }`}
                            >
                              Kalemler ({itemCount})
                            </button>
                            <button
                              onClick={() => onShowStatement(u.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer whitespace-nowrap"
                            >
                              Ekstre
                            </button>
                            {isAdmin && (
                              <>
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
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={6} className="p-0">
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

      {units.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          {units.map((u) => {
            const editing = isAdmin && quick?.id === u.id;
            const open = isExpanded(u.id);
            const itemCount = (u.items || []).length;
            return (
              <div key={u.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{u.name}</span>
                    <span>{itemCount} kalem</span>
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
                    <div className="mb-3">
                      <div
                        onClick={() => startQuick(u)}
                        className={`text-base font-extrabold text-slate-900 ${isAdmin ? 'cursor-pointer hover:text-[#0f6b36]' : ''}`}
                      >
                        {u.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">Yetkili: {u.contact}</div>
                    </div>
                  )}

                  {/* KART İÇİNDE KALEM ÖZET LİSTESİ */}
                  {(u.items || []).length > 0 && (
                    <div className="mb-3 space-y-1.5 border-t border-slate-100 pt-2.5">
                      {(u.items || []).map((item) => {
                        const d = Number(item.debt) || 0;
                        const p = Number(item.paid) || 0;
                        const r = d - p;
                        return (
                          <div
                            key={item.id}
                            onClick={() => onSelectItem?.(item, u)}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-[#0f6b36] text-xs space-y-1 cursor-pointer transition"
                            title="Bu kaleme yapılan hareketleri görmek için tıklayın"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900">{item.name}</span>
                              <span className="text-[10px] font-semibold text-[#0f6b36]">{u.name}</span>
                            </div>
                            {item.description && <div className="text-[11px] text-slate-500">{item.description}</div>}
                            <div className="grid grid-cols-3 gap-1 text-[11px] tabular-nums pt-0.5">
                              <div>
                                <span className="text-slate-400">Borç: </span>
                                <span className="font-bold text-rose-600">{formatTRY(d)}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">Ödenen: </span>
                                <span className="font-bold text-[#0f6b36]">{formatTRY(p)}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">Kalan: </span>
                                <span className={`font-extrabold ${r > 0 ? 'text-rose-700' : 'text-[#0f6b36]'}`}>{formatTRY(r)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3 mt-auto">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Toplam Borç:</span>
                      <span className="font-bold text-rose-600 tabular-nums">{formatTRY(u.totalDebt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Toplam Ödenen:</span>
                      <span className="font-bold text-[#0f6b36] tabular-nums">{formatTRY(u.totalCredit)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-dashed border-slate-200">
                      <span className="font-bold text-slate-700">Kalan Bakiye:</span>
                      <span className={`font-black tabular-nums ${u.netBalance > 0 ? 'text-rose-600' : 'text-[#0f6b36]'}`}>
                        {formatTRY(u.netBalance)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(u.id)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-[#0f6b36] border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                    >
                      {open ? 'Kalemleri Gizle' : `Kalem Detayları & Ekle (${itemCount})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => onShowStatement(u.id)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                    >
                      Ekstre
                    </button>
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
