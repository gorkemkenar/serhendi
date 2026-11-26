import Modal from './Modal.jsx';
import { IconSmartphone } from '../icons.jsx';
import { primaryBtn } from '../constants.js';

export default function InstallModal({ onClose }) {
  return (
    <Modal title="Telefona İndir / Ana Ekrana Ekle" icon={<IconSmartphone />} onClose={onClose}>
      <div className="space-y-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-sm font-extrabold text-slate-900">Android (Chrome):</div>
          <p className="text-xs text-slate-600 mt-1">
            Sağ üstteki <b>Üç Nokta (⋮)</b> menüsünden <b>"Ana ekrana ekle"</b> veya <b>"Uygulamayı yükle"</b> seçeneğine basın.
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-sm font-extrabold text-slate-900">iPhone (Safari):</div>
          <p className="text-xs text-slate-600 mt-1">
            Alt menüdeki <b>Paylaş</b> simgesine basıp <b>"Ana Ekrana Ekle"</b> seçeneğini seçin.
          </p>
        </div>
        <button type="button" onClick={onClose} className={`${primaryBtn} w-full py-2.5 text-sm`}>
          Kapat
        </button>
      </div>
    </Modal>
  );
}
