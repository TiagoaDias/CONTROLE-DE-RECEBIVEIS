import React, { useState } from 'react';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtorName: string;
  phone: string;
  amount: string;
  product: string;
  dueDate: string;
  onToast: (msg: string) => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  debtorName,
  phone,
  amount,
  product,
  dueDate,
  onToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [pixKey, setPixKey] = useState('14997339863');

  if (!isOpen) return null;

  const defaultMessage = `Olá, ${debtorName}! Tudo bem? Passando para te lembrar que a parcela de ${amount} referente ao ${product} (vencida em ${dueDate}) ainda consta como pendente no fechamento da fatura. Segue a chave Pix se preferir: ${pixKey}. Muito obrigado!`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(defaultMessage);
    setCopied(true);
    onToast('Mensagem copiada para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    const rawPhone = phone.replace(/\D/g, '');
    const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
    const text = encodeURIComponent(defaultMessage);
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-2xl p-5 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">chat</span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-base">Lembrete Amigável</h3>
              <span className="text-xs text-slate-500">{debtorName} • {phone}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Editable Pix Key */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">pix</span>
            Sua Chave Pix para Recebimento:
          </label>
          <input
            type="text"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="Sua chave Pix (Ex: 14997339863)"
            className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
          />
        </div>

        {/* Pre-formatted Message Box */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600">Pré-visualização da mensagem personalizada:</label>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-700 text-xs leading-relaxed select-all">
            <p>
              Olá, {debtorName}! Tudo bem? Passando para te lembrar que a parcela de{' '}
              <strong className="text-slate-900">{amount}</strong> referente ao{' '}
              <em className="font-medium text-slate-900">{product}</em> (vencida em {dueDate}) ainda consta como pendente no fechamento da fatura. Segue a chave Pix se preferir: <code className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">{pixKey}</code>. Muito obrigado!
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleCopy}
            className="h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
          <button
            onClick={handleSend}
            className="flex-1 h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
            <span>Enviar pelo WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
