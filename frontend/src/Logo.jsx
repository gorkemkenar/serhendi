// --- SİLİVRİ SERHENDİ ÖZEL YEŞİL & ALTIN LOGO ---
export default function SilivriSerhendiLogo({ className = 'w-11 h-12', showText = true, dark = false }) {
  return (
    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
      <svg
        viewBox="0 0 120 140"
        className={`${className} shrink-0`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SİLİVRİ SERHENDİ Logo"
      >
        <path
          d="M60 6 C65 16, 71 21, 82 25 C71 29, 65 34, 60 42 C55 34, 49 29, 38 25 C49 21, 55 16, 60 6 Z"
          fill="#d4af37"
        />
        <path
          d="M42 35 C49 31, 56 37, 56 49 C56 64, 41 75, 34 91 C27 107, 32 126, 48 132 C30 129, 20 112, 24 91 C28 73, 47 62, 48 49 C49 41, 45 38, 42 35 Z"
          fill="#0f6b36"
        />
        <path
          d="M78 35 C71 31, 64 37, 64 49 C64 64, 79 75, 86 91 C93 107, 88 126, 72 132 C90 129, 100 112, 96 91 C92 73, 73 62, 72 49 C71 41, 75 38, 78 35 Z"
          fill="#0f6b36"
        />
        <path
          d="M60 80 C65 92, 79 99, 82 113 C84 123, 75 134, 60 134 C45 134, 36 123, 38 113 C41 99, 55 92, 60 80 Z M60 88 C54 98, 44 104, 43 113 C42 121, 49 128, 60 128 C71 128, 78 121, 77 113 C76 104, 66 98, 60 88 Z"
          fill="#0f6b36"
          fillRule="evenodd"
        />
      </svg>
      {showText && (
        <div className="leading-tight min-w-0">
          <div className={`text-sm sm:text-base font-black tracking-wide truncate ${dark ? 'text-white' : 'text-[#0f6b36]'}`}>
            SİLİVRİ SERHENDİ
          </div>
          <div className="text-[10px] sm:text-[11px] font-bold tracking-wider text-[#b8952b] truncate">
            BİRİM &amp; CARİ TAKİP SİSTEMİ
          </div>
        </div>
      )}
    </div>
  );
}
