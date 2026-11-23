import SilivriSerhendiLogo from '../Logo.jsx';
import { IconPrinter } from '../icons.jsx';
import { formatTRY, primaryBtn } from '../constants.js';

export default function StatementTab({ report, units, isUnitObserver, statementUnitId, onSelectUnit }) {
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
        <div className="print-area bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-[#0f6b36]">
            <div className="flex items-start gap-3">
              <SilivriSerhendiLogo className="w-11 h-12" showText={false} />
              <div>
                <div className="text-[11px] font-bold tracking-wider text-[#b8952b]">SİLİVRİ SERHENDİ • BİRİM & CARİ TAKİP SİSTEMİ</div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">{report.unit.name} — Cari Hesap Ekstresi</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Yetkili: {report.unit.contact} • Tel: {report.unit.phone} • Tarih: {new Date().toLocaleDateString('tr-TR')}
                </p>
              </div>
            </div>

            {/* ALT ALTA (DİKEY SATIRLARDA) TOPLAM BORÇ / ALACAK / NET BAKİYE */}
            <div className="flex flex-col gap-2 min-w-[220px]">
              <div className="flex items-center justify-between gap-4 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-100">
                <span className="text-xs font-bold text-rose-700">Toplam Borç</span>
                <span className="text-sm font-black text-rose-600 tabular-nums">{formatTRY(report.totalDebt)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="text-xs font-bold text-[#0f6b36]">Toplam Alacak</span>
                <span className="text-sm font-black text-[#0f6b36] tabular-nums">{formatTRY(report.totalCredit)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 px-3.5 py-2 rounded-xl bg-slate-900">
                <span className="text-xs font-bold text-slate-200">Net Bakiye</span>
                <span
                  className={`text-base sm:text-lg font-black mt-0.5 tabular-nums ${
                    report.netBalance > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatTRY(report.netBalance)}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 text-left">
                  <th className="py-2 px-3 font-bold border border-slate-200">Tarih</th>
                  <th className="py-2 px-3 font-bold border border-slate-200">No</th>
                  <th className="py-2 px-3 font-bold border border-slate-200">Tür</th>
                  <th className="py-2 px-3 font-bold border border-slate-200">Açıklama</th>
                  <th className="py-2 px-3 font-bold border border-slate-200 text-right">Borç (₺)</th>
                  <th className="py-2 px-3 font-bold border border-slate-200 text-right">Alacak (₺)</th>
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
                    <td className="py-2 px-3 border border-slate-200 font-mono text-[11px] text-slate-500 whitespace-nowrap">{r.id}</td>
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
      )}
    </div>
  );
}
