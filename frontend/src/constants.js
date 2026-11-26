import { IconEye, IconLock, IconShield } from './icons.jsx';

export const TRANSACTION_TYPES = [
  { label: 'Malzeme', direction: 'DEBT', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  { label: 'Borç Kaydı', direction: 'DEBT', badge: 'bg-orange-50 text-orange-800 border-orange-200' },
  { label: 'Nakit Tahsilat', direction: 'CREDIT', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'Havale / EFT', direction: 'CREDIT', badge: 'bg-teal-50 text-teal-800 border-teal-200' },
  { label: 'İade / Mahsup', direction: 'CREDIT', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  { label: 'Alacak Kaydı', direction: 'CREDIT', badge: 'bg-cyan-50 text-cyan-800 border-cyan-200' }
];

export const ROLE_HIERARCHY = [
  {
    key: 'owner',
    rank: 5,
    label: 'Seviye 5 • Sistem Sahibi (Owner)',
    short: 'Sistem Sahibi (Owner)',
    desc: 'Sistemin en üst sahibi. Baş Yönetici (Admin), Yönetici ve tüm gözlemcileri kontrol eder; kimse tarafından değiştirilemez veya silinemez.',
    cls: 'bg-slate-900 text-amber-300 border-slate-800'
  },
  {
    key: 'super_admin',
    rank: 4,
    label: 'Seviye 4 • Baş Yönetici (Admin)',
    short: 'Baş Yönetici',
    desc: 'Tam sistem yetkisi. Yöneticileri ve gözlemcileri atayabilir ve kontrol edebilir (Owner hesabına dokunamaz).',
    cls: 'bg-slate-800 text-white border-slate-700'
  },
  {
    key: 'admin',
    rank: 3,
    label: 'Seviye 3 • Yönetici',
    short: 'Yönetici',
    desc: 'Carileri yönetir, gözlemcilere rol/birim atar. Sadece Owner ve Baş Yönetici kontrol edebilir.',
    cls: 'bg-emerald-50 text-[#0f6b36] border-emerald-200'
  },
  {
    key: 'viewer_all',
    rank: 2,
    label: 'Seviye 2 • Genel Gözlemci',
    short: 'Genel Gözlemci',
    desc: 'Tüm birimlerin cari bakiye ve hareketlerini salt okunur inceler.',
    cls: 'bg-slate-100 text-slate-700 border-slate-200'
  },
  {
    key: 'viewer_unit',
    rank: 1,
    label: 'Seviye 1 • Birim Gözlemcisi',
    short: 'Birim Gözlemci',
    desc: 'Sadece kendisine atanan tek bir cari / birimi salt okunur görüntüler.',
    cls: 'bg-slate-100 text-slate-600 border-slate-200'
  }
];

export const formatTRY = (value) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2
  }).format(Number(value) || 0);

export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const getRoleBadge = (role) => {
  if (role === 'owner') {
    return {
      label: 'Sistem Sahibi (Owner)',
      short: 'Owner (Sistem Sahibi)',
      rank: 5,
      cls: 'bg-slate-900 text-amber-300 border-slate-800',
      Icon: IconShield
    };
  }
  if (role === 'super_admin') {
    return {
      label: 'Baş Yönetici (Admin)',
      short: 'Baş Yönetici',
      rank: 4,
      cls: 'bg-slate-800 text-white border-slate-700',
      Icon: IconShield
    };
  }
  if (role === 'admin') {
    return {
      label: 'Yönetici',
      short: 'Yönetici',
      rank: 3,
      cls: 'bg-emerald-50 text-[#0f6b36] border-emerald-200',
      Icon: IconShield
    };
  }
  if (role === 'viewer_all') {
    return {
      label: 'Genel Gözlemci',
      short: 'Genel Gözlemci',
      rank: 2,
      cls: 'bg-slate-100 text-slate-700 border-slate-200',
      Icon: IconEye
    };
  }
  return {
    label: 'Birim Gözlemcisi',
    short: 'Birim Gözlemci',
    rank: 1,
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    Icon: IconLock
  };
};

export const inputCls =
  'w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#0f6b36]';
export const labelCls = 'block text-xs font-bold text-slate-600 mb-1';
export const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-xl font-bold bg-[#0f6b36] hover:bg-[#095327] text-white transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
