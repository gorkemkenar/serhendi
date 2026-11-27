import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import SilivriSerhendiLogo from './Logo.jsx';
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBuilding,
  IconCheck,
  IconEye,
  IconFileText,
  IconLogOut,
  IconShield,
  IconSmartphone,
  IconTable,
  IconUsers,
  IconX
} from './icons.jsx';
import { formatTRY, getRoleBadge } from './constants.js';
import LoginPage from './components/LoginPage.jsx';
import UnitsTab from './components/UnitsTab.jsx';
import LedgerTab from './components/LedgerTab.jsx';
import StatementTab from './components/StatementTab.jsx';
import UsersTab from './components/UsersTab.jsx';
import SecurityTab from './components/SecurityTab.jsx';
import TxModal from './components/TxModal.jsx';
import UnitModal from './components/UnitModal.jsx';
import ItemDetailModal from './components/ItemDetailModal.jsx';
import InstallModal from './components/InstallModal.jsx';

const txNum = (id) => parseInt(String(id || '').replace(/\D+/g, ''), 10) || 0;
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : txNum(b.id) - txNum(a.id) || String(b.id).localeCompare(String(a.id)));
const byDateAsc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : txNum(a.id) - txNum(b.id) || String(a.id).localeCompare(String(b.id)));

// 3. Enjeksiyon Koruması: Excel/CSV formül enjeksiyonunu (=, +, -, @) istemci tarafında da etkisizleştirir
const safeCsvCell = (val) => {
  let str = String(val ?? '');
  if (/^[=+\-@]/.test(str) && !/^-[0-9]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

export default function App() {
  // --- OTURUM & VERİ ---
  const [currentUser, setCurrentUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [units, setUnits] = useState([]);
  const [unitItems, setUnitItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);

  // --- ARAYÜZ DURUMU ---
  const [activeTab, setActiveTab] = useState('units');
  const [unitViewMode, setUnitViewMode] = useState('table');
  const [unitSearch, setUnitSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [itemFilter, setItemFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statementUnitId, setStatementUnitId] = useState('');

  // --- YIL / DÖNEM SEÇİMİ (Her yıl kalemler ve bakiyeler sıfırdan başlar) ---
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [serverYears, setServerYears] = useState([currentYear]);

  const [txModalContext, setTxModalContext] = useState(null); // null | { unitId?: string, itemId?: string }
  const [selectedItemModal, setSelectedItemModal] = useState(null); // null | { itemId: string, unitId: string }
  const [unitModal, setUnitModal] = useState(null); // null | { unit: Unit | null }
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const isAdmin =
    currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const canManageYears =
    currentUser?.role === 'owner' || currentUser?.role === 'super_admin' || currentUser?.isOwner || currentUser?.isSuperAdmin;
  const isUnitObserver = currentUser?.role === 'viewer_unit';

  const notify = useCallback((text, tone = 'success') => {
    setToast({ text, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const resetSession = useCallback(() => {
    setToken(null);
    setCurrentUser(null);
    setUnits([]);
    setUnitItems([]);
    setTransactions([]);
    setUsers([]);
    setActiveTab('units');
    setUnitFilter('ALL');
    setItemFilter('ALL');
    setTypeFilter('ALL');
    setSearchQuery('');
    setUnitSearch('');
    setSelectedYear(new Date().getFullYear());
  }, []);

  const handleError = useCallback(
    (err) => {
      if (err?.status === 401) {
        resetSession();
        notify('Oturum süresi doldu, lütfen tekrar giriş yapın.', 'error');
        return;
      }
      notify(err?.message || 'Beklenmeyen bir hata oluştu.', 'error');
    },
    [notify, resetSession]
  );

  const loadData = useCallback(
    async (user) => {
      setLoadingData(true);
      try {
        const [unitList, itemList, txList, yearRes] = await Promise.all([
          api.units.list(),
          api.unitItems.list().catch(() => []),
          api.transactions.list(),
          api.years.list().catch(() => ({ years: [new Date().getFullYear()] }))
        ]);
        setUnits(unitList);
        setUnitItems(itemList);
        setTransactions(txList);
        if (Array.isArray(yearRes?.years) && yearRes.years.length > 0) {
          setServerYears(yearRes.years.map(Number));
        }
        setUsers(
          user.role === 'owner' || user.role === 'admin' || user.role === 'super_admin' ? await api.users.list() : []
        );
      } catch (err) {
        handleError(err);
      } finally {
        setLoadingData(false);
      }
    },
    [handleError]
  );

  // Açılışta kayıtlı oturumu doğrula
  useEffect(() => {
    if (!getToken()) {
      setBooting(false);
      return;
    }
    api
      .me()
      .then((user) => {
        setCurrentUser(user);
        return loadData(user);
      })
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, [loadData]);

  // PWA "Ana ekrana ekle" istemi
  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  // Ekstre için geçerli bir birim seçili olsun
  useEffect(() => {
    if (isUnitObserver && currentUser?.unitId) {
      setStatementUnitId(currentUser.unitId);
    } else if (units.length && !units.some((u) => u.id === statementUnitId)) {
      setStatementUnitId(units[0].id);
    }
  }, [units, statementUnitId, isUnitObserver, currentUser]);

  // --- HESAPLAMALAR ---
  // Seçili yılın kalemleri ve hareketleri
  const availableYears = useMemo(() => {
    const years = new Set([currentYear, ...serverYears]);
    unitItems.forEach((i) => i.year && years.add(Number(i.year)));
    transactions.forEach((t) => {
      const y = Number(String(t.date || '').slice(0, 4));
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [unitItems, transactions, currentYear, serverYears]);

  const handleAddYear = async () => {
    if (!canManageYears) return;
    const maxYear = Math.max(currentYear, ...availableYears);
    const nextYear = maxYear + 1;
    if (!window.confirm(`${nextYear} yılı cari dönemini eklemek istediğinize emin misiniz?`)) return;
    try {
      const res = await api.years.create(nextYear);
      if (Array.isArray(res?.years)) {
        setServerYears(res.years.map(Number));
      } else {
        setServerYears((prev) => Array.from(new Set([...prev, nextYear])));
      }
      setSelectedYear(nextYear);
      notify(`${nextYear} yılı eklendi.`);
    } catch (err) {
      handleError(err);
    }
  };

  const handleDeleteYear = async (yearToDelete) => {
    if (!canManageYears) return;
    if (availableYears.length <= 1) {
      notify('Sistemde en az bir dönem yılı kalmalıdır.', 'error');
      return;
    }
    const itemCount = unitItems.filter((i) => Number(i.year || currentYear) === yearToDelete).length;
    const txCount = transactions.filter((t) => String(t.date || '').startsWith(String(yearToDelete))).length;
    const confirmMsg =
      itemCount > 0 || txCount > 0
        ? `${yearToDelete} yılını ve bu yıla ait ${itemCount} kalem ile ${txCount} cari hareketi kalıcı olarak silmek istediğinize emin misiniz?`
        : `${yearToDelete} yılını silmek istediğinize emin misiniz?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await api.years.remove(yearToDelete);
      setUnitItems((prev) => prev.filter((i) => Number(i.year || currentYear) !== yearToDelete));
      setTransactions((prev) => prev.filter((t) => !String(t.date || '').startsWith(String(yearToDelete))));
      const nextYears = Array.isArray(res?.years) && res.years.length > 0
        ? res.years.map(Number)
        : availableYears.filter((y) => y !== yearToDelete);
      setServerYears(nextYears);
      if (selectedYear === yearToDelete) {
        setSelectedYear(nextYears[nextYears.length - 1] || currentYear);
      }
      notify(`${yearToDelete} yılı silindi.`);
    } catch (err) {
      handleError(err);
    }
  };

  const yearItems = useMemo(
    () => unitItems.filter((i) => Number(i.year || currentYear) === selectedYear),
    [unitItems, selectedYear, currentYear]
  );

  const yearTransactions = useMemo(
    () => transactions.filter((t) => String(t.date || '').startsWith(String(selectedYear))),
    [transactions, selectedYear]
  );

  const visibleUnitsWithSummary = useMemo(() => {
    const q = unitSearch.trim().toLocaleLowerCase('tr-TR');
    return units
      .filter((u) => {
        if (!q) return true;
        const uItems = yearItems.filter((i) => i.unitId === u.id);
        return (
          [u.name, u.contact, u.phone, u.id].some((v) => String(v || '').toLocaleLowerCase('tr-TR').includes(q)) ||
          uItems.some((i) => String(i.name || '').toLocaleLowerCase('tr-TR').includes(q))
        );
      })
      .map((unit) => {
        const unitTxs = yearTransactions.filter((t) => t.unitId === unit.id).sort(byDateDesc);
        const items = yearItems.filter((i) => i.unitId === unit.id);
        const itemsDebt = items.reduce((acc, i) => acc + (Number(i.debt) || 0), 0);
        const itemsPaid = items.reduce((acc, i) => acc + (Number(i.paid) || 0), 0);
        // Kaleme bağlı olmayan (Genel / bağımsız) hareketleri de toplama dahil et;
        // böylece hem kalem düzenlemeleri hem de kalemsiz cari hareketler toplama anında yansır.
        const unlinkedTxs = unitTxs.filter((t) => !t.itemId || !items.some((i) => i.id === t.itemId));
        const unlinkedDebt = unlinkedTxs.reduce((acc, t) => acc + (Number(t.debt) || 0), 0);
        const unlinkedCredit = unlinkedTxs.reduce((acc, t) => acc + (Number(t.credit) || 0), 0);
        const totalDebt = items.length > 0 ? itemsDebt + unlinkedDebt : unlinkedDebt;
        const totalCredit = items.length > 0 ? itemsPaid + unlinkedCredit : unlinkedCredit;
        return {
          ...unit,
          items,
          totalDebt,
          totalCredit,
          netBalance: totalDebt - totalCredit,
          lastTxDate: unitTxs.length > 0 ? unitTxs[0].date : '-',
          txCount: unitTxs.length
        };
      });
  }, [units, yearItems, yearTransactions, unitSearch]);

  const kpiStats = useMemo(() => {
    const totalDebt = visibleUnitsWithSummary.reduce((s, u) => s + u.totalDebt, 0);
    const totalCredit = visibleUnitsWithSummary.reduce((s, u) => s + u.totalCredit, 0);
    return { totalDebt, totalCredit, netBalance: totalDebt - totalCredit };
  }, [visibleUnitsWithSummary]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    return yearTransactions
      .filter((tx) => {
        if (unitFilter !== 'ALL' && tx.unitId !== unitFilter) return false;
        if (itemFilter !== 'ALL') {
          const txCat = tx.itemName || tx.category || 'Genel';
          if (txCat !== itemFilter) return false;
        }
        if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
        if (q) {
          const unitName = units.find((u) => u.id === tx.unitId)?.name.toLocaleLowerCase('tr-TR') || '';
          const catName = (tx.itemName || tx.category || '').toLocaleLowerCase('tr-TR');
          return (
            tx.description.toLocaleLowerCase('tr-TR').includes(q) ||
            tx.id.toLocaleLowerCase('tr-TR').includes(q) ||
            unitName.includes(q) ||
            catName.includes(q)
          );
        }
        return true;
      })
      .sort(byDateAsc);
  }, [yearTransactions, unitFilter, itemFilter, typeFilter, searchQuery, units]);

  const statementReport = useMemo(() => {
    const targetId = isUnitObserver ? currentUser?.unitId : statementUnitId;
    const rawUnit = units.find((u) => u.id === targetId) || units[0];
    if (!rawUnit) return { unit: null, rows: [], totalDebt: 0, totalCredit: 0, netBalance: 0 };

    const items = yearItems.filter((i) => i.unitId === rawUnit.id);
    const unit = { ...rawUnit, items };

    let running = 0;
    const rows = yearTransactions
      .filter((t) => t.unitId === unit.id)
      .sort(byDateAsc)
      .map((r) => {
        running += (Number(r.debt) || 0) - (Number(r.credit) || 0);
        return { ...r, runningBalance: running };
      });

    const itemsDebt = items.reduce((s, i) => s + (Number(i.debt) || 0), 0);
    const itemsPaid = items.reduce((s, i) => s + (Number(i.paid) || 0), 0);
    const unlinkedRows = rows.filter((r) => !r.itemId || !items.some((i) => i.id === r.itemId));
    const unlinkedDebt = unlinkedRows.reduce((s, r) => s + (Number(r.debt) || 0), 0);
    const unlinkedCredit = unlinkedRows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    const totalDebt = items.length > 0 ? itemsDebt + unlinkedDebt : unlinkedDebt;
    const totalCredit = items.length > 0 ? itemsPaid + unlinkedCredit : unlinkedCredit;
    return { unit, rows, totalDebt, totalCredit, netBalance: totalDebt - totalCredit };
  }, [units, yearItems, yearTransactions, statementUnitId, isUnitObserver, currentUser]);

  // --- OTURUM İŞLEMLERİ ---
  const handleLogin = async (username, password, otpCode = '') => {
    try {
      const res = await api.login(username.trim(), password, otpCode);
      if (res?.requires2FA) {
        return { requires2FA: true, detail: res.detail };
      }
      const { token, user } = res;
      setToken(token);
      setCurrentUser(user);
      setActiveTab('units');
      setStatementUnitId(user.unitId || '');
      notify(`Giriş yapıldı: ${user.name}`);
      await loadData(user);
      return null;
    } catch (err) {
      return { error: err.message || 'Kullanıcı adı veya giriş şifresi hatalı!' };
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Sunucuya ulaşılamasa da yerel oturumu kapat
    }
    resetSession();
  };

  // --- CARİ / BİRİM İŞLEMLERİ ---
  const handleSaveUnit = async (id, form) => {
    try {
      const payload = { name: form.name, contact: form.contact, phone: form.phone };
      if (id) {
        const updated = await api.units.update(id, payload);
        setUnits((prev) => prev.map((u) => (u.id === id ? updated : u)));
        notify('Cari / Birim bilgileri güncellendi.');
      } else {
        const created = await api.units.create(payload);
        setUnits((prev) => [...prev, created]);
        // Seçilen başlangıç kalemlerini de otomatik oluştur
        if (Array.isArray(form.initialItems) && form.initialItems.length > 0) {
          const createdItems = [];
          for (const it of form.initialItems) {
            try {
              const ci = await api.unitItems.create({
                unitId: created.id,
                name: it.name,
                description: '',
                debt: '0.00',
                paid: '0.00',
                year: selectedYear
              });
              createdItems.push(ci);
            } catch {
              // devam et
            }
          }
          if (createdItems.length > 0) {
            setUnitItems((prev) => [...prev, ...createdItems]);
          }
        }
        notify('Yeni cari / birim ve başlangıç kalemleri eklendi.');
      }
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  };

  const handleQuickSave = async (quick) => {
    if (!quick.name.trim()) {
      notify('Cari / Birim adı boş bırakılamaz.', 'error');
      return false;
    }
    const ok = await handleSaveUnit(quick.id, quick);
    if (ok) notify('Cari / Birim bilgileri güncellendi.');
    return ok;
  };

  const handleDeleteUnit = async (unit) => {
    const count = transactions.filter((t) => t.unitId === unit.id).length;
    const msg = count
      ? `"${unit.name}" ve ona ait ${count} cari hareket kalıcı olarak silinecek. Emin misiniz?`
      : `"${unit.name}" silinecek. Emin misiniz?`;
    if (!window.confirm(msg)) return;
    try {
      await api.units.remove(unit.id);
      setUnits((prev) => prev.filter((u) => u.id !== unit.id));
      setUnitItems((prev) => prev.filter((i) => i.unitId !== unit.id));
      setTransactions((prev) => prev.filter((t) => t.unitId !== unit.id));
      notify('Cari / Birim kaldırıldı.');
    } catch (err) {
      handleError(err);
    }
  };

  // --- CARİ KALEM İŞLEMLERİ (KUMANYA, KANDİL SİMİDİ, PATATES -> BORÇ / ÖDENEN / KALAN) ---
  const handleCreateUnitItem = async (data) => {
    try {
      const created = await api.unitItems.create({ ...data, year: data.year || selectedYear });
      setUnitItems((prev) => [...prev, created]);
      const freshTxs = await api.transactions.list().catch(() => null);
      if (freshTxs) setTransactions(freshTxs);
      notify(`"${created.name}" kalemi ve başlangıç hareketi eklendi.`);
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  };

  const handleUpdateUnitItem = async (id, patch) => {
    try {
      const updated = await api.unitItems.update(id, patch);
      setUnitItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      const freshTxs = await api.transactions.list().catch(() => null);
      if (freshTxs) setTransactions(freshTxs);
      notify(`"${updated.name}" kalemi ve hareket geçmişi güncellendi.`);
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  };

  const handleDeleteUnitItem = async (item) => {
    const linkedCount = transactions.filter(
      (t) =>
        t.unitId === item.unitId &&
        (t.itemId === item.id || (t.category && t.category.toLowerCase() === item.name.toLowerCase()))
    ).length;
    const msg = linkedCount
      ? `"${item.name}" kalemi ve ona bağlı ${linkedCount} cari hareket kalıcı olarak silinecek. Emin misiniz?`
      : `"${item.name}" kalemi silinecek. Emin misiniz?`;
    if (!window.confirm(msg)) return;
    try {
      await api.unitItems.remove(item.id);
      setUnitItems((prev) => prev.filter((i) => i.id !== item.id));
      const freshTxs = await api.transactions.list().catch(() => null);
      if (freshTxs) setTransactions(freshTxs);
      notify('Kalem ve bağlı hareketleri silindi.');
    } catch (err) {
      handleError(err);
    }
  };

  // --- CARİ HAREKET İŞLEMLERİ ---
  const handleCreateTransaction = async (form) => {
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      notify('Lütfen geçerli bir tutar girin.', 'error');
      return false;
    }
    try {
      const created = await api.transactions.create({
        date: form.date,
        unitId: form.unitId,
        itemId: form.itemId || null,
        category: form.category || 'Genel',
        type: form.type,
        description: form.description,
        documentUrl: form.documentUrl || '',
        amount: amt.toFixed(2)
      });
      setTransactions((prev) => [...prev, created]);
      // Kalem toplamları sunucuda güncellendiği için kalem listesini tazele
      const freshItems = await api.unitItems.list().catch(() => null);
      if (freshItems) setUnitItems(freshItems);
      notify(`Yeni cari hareket "${created.itemName || created.category || 'Genel'}" kalemine kaydedildi.`);
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  };

  const handleUpdateTransaction = async (id, patch) => {
    try {
      const updated = await api.transactions.update(id, patch);
      setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
      const freshItems = await api.unitItems.list().catch(() => null);
      if (freshItems) setUnitItems(freshItems);
      notify('Kayıt ve bağlı kalem bakiyesi güncellendi.');
    } catch (err) {
      handleError(err);
    }
  };

  const handleDeleteTransaction = async (tx) => {
    if (!window.confirm(`"${tx.description}" hareketi silinecek. Emin misiniz?`)) return;
    try {
      await api.transactions.remove(tx.id);
      setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
      const freshItems = await api.unitItems.list().catch(() => null);
      if (freshItems) setUnitItems(freshItems);
      notify('Cari hareket silindi.');
    } catch (err) {
      handleError(err);
    }
  };

  // --- KULLANICI İŞLEMLERİ ---
  const handleCreateUser = async (data) => {
    try {
      const created = await api.users.create(data);
      setUsers((prev) => [...prev, created]);
      notify(`${created.name} hesabı güçlü şifreyle eklendi.`);
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  };

  const handleUpdateUser = async (uid, data) => {
    try {
      const updated = await api.users.update(uid, data);
      setUsers((prev) => prev.map((u) => (u.id === uid ? updated : u)));
      if (currentUser?.id === uid) {
        setCurrentUser((prev) => (prev ? { ...prev, name: updated.name, role: updated.role, unitId: updated.unitId } : prev));
      }
      notify('Kullanıcı bilgileri güncellendi.');
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  };

  const handleAssignRole = async (uid, data) => {
    try {
      const updated = await api.users.assignRole(uid, data);
      setUsers((prev) => prev.map((u) => (u.id === uid ? updated : u)));
      notify(`@${updated.username} hesabının rolü (${getRoleBadge(updated.role).short}) olarak güncellendi.`);
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  };

  const handleUnlockUser = async (user) => {
    try {
      const res = await api.users.unlock(user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isLocked: false, failedLoginAttempts: 0 } : u)));
      notify(res?.detail || 'Hesap kilidi kaldırıldı.');
    } catch (err) {
      handleError(err);
    }
  };

  const handleSetPassword = async (uid, password) => {
    if (!password.trim()) {
      notify('Şifre boş olamaz.', 'error');
      return false;
    }
    try {
      await api.users.setPassword(uid, password.trim());
      if (currentUser?.id === uid) {
        setCurrentUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
      }
      setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, mustChangePassword: false } : u)));
      notify('Kullanıcı şifresi güçlü şifre politikasıyla güncellendi.');
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`"${user.name}" kullanıcısı silinecek. Emin misiniz?`)) return;
    try {
      await api.users.remove(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      notify('Kullanıcı silindi.');
    } catch (err) {
      handleError(err);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Tüm birimler ve hareketler silinip varsayılan 8 birim, örnek hareketler ve varsayılan kullanıcı şifreleri yüklenecek. Emin misiniz?')) return;
    try {
      const res = await api.resetDefaults();
      await loadData(currentUser);
      notify(res?.detail || 'Varsayılanlar yüklendi.');
    } catch (err) {
      handleError(err);
    }
  };

  // --- 8. VERİ BÜTÜNLÜĞÜ İMZALI (SHA-256 CHECKSUM) DIŞA AKTARMA ---
  const exportCSV = async () => {
    const headers = [
      'Tarih',
      'Birim',
      'Ait Olduğu Kalem',
      'Kalem Detayı',
      'Tür',
      'Açıklama',
      'Borç (TL)',
      'Ödenen (TL)',
      'Kaydı Giren'
    ];
    const lines = filteredTransactions.map((tx) => {
      const uName = units.find((u) => u.id === tx.unitId)?.name || tx.unitId;
      const linkedItem = unitItems.find((i) => i.id === tx.itemId);
      const itemName = linkedItem?.name || tx.itemName || tx.category || 'Genel';
      const itemDesc = linkedItem?.description || tx.itemDescription || '';
      return [
        tx.date,
        uName,
        itemName,
        itemDesc,
        tx.type,
        tx.description,
        tx.debt,
        tx.credit,
        tx.createdBy
      ]
        .map(safeCsvCell)
        .join(';');
    });
    const bodyContent = [headers.join(';'), ...lines].join('\n');
    let checksumFooter = '';
    try {
      const buf = new TextEncoder().encode(bodyContent);
      const digest = await window.crypto.subtle.digest('SHA-256', buf);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      checksumFooter = `\n"# SHA-256 VERİ BÜTÜNLÜĞÜ İMZASI (CHECKSUM):";"${hex}"`;
    } catch {
      checksumFooter = '';
    }
    const blob = new Blob(['\uFEFF' + bodyContent + checksumFooter], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Silivri_Serhendi_Cari_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('SHA-256 bütünlük imzalı CSV tablosu indirildi.');
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        return;
      } catch {
        // Rehberi aç
      }
    }
    setIsInstallModalOpen(true);
  };

  // --- RENDER ---
  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center serhendi-bg">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <SilivriSerhendiLogo className="w-14 h-16" showText={false} />
          <span className="text-sm font-bold text-slate-500">Yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </>
    );
  }

  const roleInfo = getRoleBadge(currentUser.role);
  const RoleIcon = roleInfo.Icon;

  const tabs = [
    { key: 'units', label: 'Cariler & Bakiyeler', Icon: IconBuilding, count: visibleUnitsWithSummary.length },
    { key: 'ledger', label: 'Cari Hareketler', Icon: IconTable, count: filteredTransactions.length },
    { key: 'statement', label: 'Cari Hesap Ekstresi', Icon: IconFileText },
    ...(isAdmin
      ? [
          { key: 'users', label: 'Kullanıcı & Rol Yönetimi', Icon: IconUsers, count: users.length },
          { key: 'security', label: 'Güvenlik', Icon: IconShield }
        ]
      : [])
  ];

  return (
    <div className="min-h-screen serhendi-bg text-slate-900">
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* ÜST BAŞLIK */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <SilivriSerhendiLogo className="w-9 h-10 sm:w-11 sm:h-12" />
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex flex-col items-end leading-tight">
              <span className="text-sm font-bold text-slate-800 truncate max-w-[220px]">{currentUser.name}</span>
              <span className={`mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${roleInfo.cls}`}>
                <RoleIcon className="w-3 h-3" />
                {roleInfo.label}
              </span>
            </div>
            <span className={`md:hidden inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border ${roleInfo.cls}`}>
              <RoleIcon className="w-3 h-3" />
              {roleInfo.short}
            </span>
            <button
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-50 hover:bg-emerald-100 text-[#0f6b36] border border-emerald-200 transition cursor-pointer"
            >
              <IconSmartphone />
              <span className="hidden lg:inline">Telefona İndir / Ana Ekrana Ekle</span>
              <span className="lg:hidden">İndir</span>
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
            >
              <IconLogOut />
              <span className="hidden sm:inline">Çıkış Yap</span>
              <span className="sm:hidden">Çıkış</span>
            </button>
          </div>
        </div>

        {/* SEKMELER */}
        <nav className="max-w-7xl mx-auto px-3 sm:px-6 flex gap-1 overflow-x-auto -mb-px">
          {tabs.map(({ key, label, Icon: TabIcon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl border-t border-x transition whitespace-nowrap cursor-pointer ${
                activeTab === key ? 'bg-slate-50 text-[#0f6b36] border-slate-200' : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <TabIcon />
              {label}
              {count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    activeTab === key ? 'bg-[#0f6b36] text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        {/* 5. GÜVENLİK YANLIŞ YAPILANDIRMASI UYARISI (Varsayılan Şifre Uyarısı - Sadece Yönetici/Admin) */}
        {isAdmin && currentUser.mustChangePassword && (
          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200">
            <div className="flex items-start gap-2.5">
              <IconShield className="w-4 h-4 text-rose-700 mt-0.5 shrink-0" />
              <p className="text-xs sm:text-sm text-rose-900">
                <b>Güvenlik Yapılandırma Uyarısı (Madde 5 & 7):</b> Hesabınızda varsayılan/basit bir test şifresi kullanılıyor. Canlı kullanımda güvenliğiniz için güçlü bir şifre belirleyin ve 2FA’yı aktifleştirin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-700 text-white hover:bg-rose-800 cursor-pointer whitespace-nowrap"
            >
              Güvenlik Ayarlarına Git
            </button>
          </div>
        )}

        {/* KPI KARTLARI (MOBİLDE YAN YANA 3 EŞİT KUTU) */}
        <section className="no-print grid grid-cols-3 gap-2 sm:gap-4">
          <KpiCard
            title="Toplam Borç"
            value={formatTRY(kpiStats.totalDebt)}
            valueCls="text-rose-600"
            icon={<IconArrowUpRight />}
            iconCls="bg-rose-50 text-rose-600"
          />
          <KpiCard
            title="Toplam Ödenen"
            value={formatTRY(kpiStats.totalCredit)}
            valueCls="text-[#0f6b36]"
            icon={<IconArrowDownLeft />}
            iconCls="bg-emerald-50 text-[#0f6b36]"
          />
          <KpiCard
            title="Kalan Bakiye"
            value={formatTRY(kpiStats.netBalance)}
            valueCls={kpiStats.netBalance > 0 ? 'text-rose-600' : 'text-[#0f6b36]'}
            icon={<IconCheck className="w-5 h-5" />}
            iconCls="bg-amber-50 text-[#b8952b]"
          />
        </section>

        {loadingData && <div className="no-print text-xs font-semibold text-slate-500">Veriler yükleniyor...</div>}

        {activeTab === 'units' && (
          <UnitsTab
            units={visibleUnitsWithSummary}
            transactions={transactions}
            isAdmin={isAdmin}
            isUnitObserver={isUnitObserver}
            search={unitSearch}
            onSearch={setUnitSearch}
            viewMode={unitViewMode}
            onViewMode={setUnitViewMode}
            onNewUnit={() => setUnitModal({ unit: null })}
            onNewTx={(uId, itId) => setTxModalContext({ unitId: uId || '', itemId: itId || '' })}
            onEditUnit={(u) => setUnitModal({ unit: u })}
            onQuickSave={handleQuickSave}
            onDeleteUnit={handleDeleteUnit}
            onShowStatement={(id) => {
              setStatementUnitId(id);
              setActiveTab('statement');
            }}
            onSelectItem={(item, u) => setSelectedItemModal({ itemId: item.id, unitId: u?.id || item.unitId })}
            onCreateItem={handleCreateUnitItem}
            onUpdateItem={handleUpdateUnitItem}
            onDeleteItem={handleDeleteUnitItem}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerTab
            transactions={filteredTransactions}
            units={units}
            unitItems={yearItems}
            isAdmin={isAdmin}
            isUnitObserver={isUnitObserver}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            unitFilter={unitFilter}
            onUnitFilter={setUnitFilter}
            itemFilter={itemFilter}
            onItemFilter={setItemFilter}
            typeFilter={typeFilter}
            onTypeFilter={setTypeFilter}
            onExport={exportCSV}
            onNewTx={(uId, itId) => setTxModalContext({ unitId: uId || '', itemId: itId || '' })}
            onUpdateTx={handleUpdateTransaction}
            onDeleteTx={handleDeleteTransaction}
          />
        )}

        {activeTab === 'statement' && (
          <StatementTab
            report={statementReport}
            year={selectedYear}
            units={units}
            isAdmin={isAdmin}
            isUnitObserver={isUnitObserver}
            statementUnitId={statementUnitId}
            onSelectUnit={setStatementUnitId}
            onSelectItem={(item, u) => setSelectedItemModal({ itemId: item.id, unitId: u?.id || item.unitId })}
            onCreateItem={handleCreateUnitItem}
            onUpdateItem={handleUpdateUnitItem}
            onDeleteItem={handleDeleteUnitItem}
          />
        )}

        {activeTab === 'users' && isAdmin && (
          <UsersTab
            users={users}
            units={units}
            currentUser={currentUser}
            onCreateUser={handleCreateUser}
            onUpdateUser={handleUpdateUser}
            onAssignRole={handleAssignRole}
            onUnlockUser={handleUnlockUser}
            onSetPassword={handleSetPassword}
            onDeleteUser={handleDeleteUser}
            onResetDefaults={handleResetDefaults}
          />
        )}

        {activeTab === 'security' && isAdmin && (
          <SecurityTab
            currentUser={currentUser}
            isAdmin={isAdmin}
            onNotify={notify}
            onRefreshUsers={() => loadData(currentUser)}
            onSelfPasswordChanged={(updatedMe) => {
              if (updatedMe) setCurrentUser(updatedMe);
              loadData(updatedMe || currentUser);
            }}
          />
        )}
      </main>

      {txModalContext && isAdmin && (
        <TxModal
          units={units}
          unitItems={yearItems}
          defaultDate={selectedYear === currentYear ? '' : `${selectedYear}-01-01`}
          defaultUnitId={txModalContext.unitId || (unitFilter !== 'ALL' ? unitFilter : statementUnitId)}
          defaultItemId={txModalContext.itemId || ''}
          onClose={() => setTxModalContext(null)}
          onSubmit={handleCreateTransaction}
        />
      )}

      {selectedItemModal && (
        <ItemDetailModal
          item={unitItems.find((i) => i.id === selectedItemModal.itemId)}
          unit={units.find((u) => u.id === selectedItemModal.unitId)}
          transactions={yearTransactions}
          isAdmin={isAdmin}
          onClose={() => setSelectedItemModal(null)}
          onNewTx={(uId, itId) => setTxModalContext({ unitId: uId || '', itemId: itId || '' })}
          onUpdateTx={handleUpdateTransaction}
          onDeleteTx={handleDeleteTransaction}
        />
      )}

      {unitModal && isAdmin && <UnitModal unit={unitModal.unit} onClose={() => setUnitModal(null)} onSubmit={handleSaveUnit} />}

      {isInstallModalOpen && <InstallModal onClose={() => setIsInstallModalOpen(false)} />}
    </div>
  );
}

function KpiCard({ title, value, valueCls, icon, iconCls }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-4 shadow-sm flex items-center justify-between gap-2 min-w-0">
      <div className="min-w-0">
        <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{title}</div>
        <div className={`text-xs sm:text-2xl font-black mt-0.5 sm:mt-1 tabular-nums truncate ${valueCls}`}>{value}</div>
      </div>
      <div className={`hidden sm:flex p-2.5 rounded-xl shrink-0 ${iconCls}`}>{icon}</div>
    </div>
  );
}

function Toast({ toast, onClose }) {
  const isError = toast.tone === 'error';
  return (
    <div className="no-print fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border text-sm font-semibold ${
          isError ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-[#0f6b36]'
        }`}
      >
        {isError ? <IconX className="w-4 h-4 shrink-0" /> : <IconCheck className="w-4 h-4 shrink-0" />}
        <span className="flex-1">{toast.text}</span>
        <button onClick={onClose} className="opacity-60 hover:opacity-100 cursor-pointer" aria-label="Kapat">
          <IconX className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
