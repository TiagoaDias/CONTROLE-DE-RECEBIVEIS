import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Purchase, Installment } from '../types';

interface ProductPurchasePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  debtorName: string;
  purchase?: Purchase;
  installments?: Installment[];
  onToast?: (msg: string) => void;
}

export const ProductPurchasePrintModal: React.FC<ProductPurchasePrintModalProps> = ({
  isOpen,
  onClose,
  productName,
  debtorName,
  purchase,
  installments = [],
  onToast,
}) => {
  const [printImage, setPrintImage] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanKey = `haspaho_print_${(debtorName || 'global').toLowerCase().replace(/\s+/g, '_')}_${(productName || 'item').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // Carregar imagem salva no localStorage ou fallback
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(cleanKey);
      if (saved) {
        setPrintImage(saved);
      } else {
        setPrintImage(null);
      }
    } catch {
      setPrintImage(null);
    }
  }, [isOpen, cleanKey]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (onToast) onToast('Por favor, selecione um arquivo de imagem (PNG, JPG ou WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        try {
          localStorage.setItem(cleanKey, base64);
          setPrintImage(base64);
          if (onToast) onToast(`Print de ${productName} carregado com sucesso!`);
        } catch {
          setPrintImage(base64);
          if (onToast) onToast('Print carregado temporariamente.');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    try {
      localStorage.removeItem(cleanKey);
    } catch {
      // ignore
    }
    setPrintImage(null);
    if (onToast) onToast('Print personalizado removido.');
  };

  const isSmartTv = /smart\s*tv|tv/i.test(productName);
  const totalAmount = purchase?.totalAmount || installments.reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0) || 965.00;
  const storeName = purchase?.store || (isSmartTv ? 'Boca Rica / Magalu' : 'Loja Parceira');
  const cardName = purchase?.cardName || installments[0]?.cardName || 'Nubank Croma';
  const totalInstallmentsCount = purchase?.installmentsTotal || installments.length || 10;
  const singleValue = purchase?.installmentValue || installments[0]?.amount || (totalAmount / (totalInstallmentsCount || 1));

  const modalElement = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[150] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Janelinha Otimizada e Perfeitamente Enquadrada no Mobile */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-slate-900 border border-cyan-400/40 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white animate-in zoom-in-95 duration-200 max-h-[85dvh] sm:max-h-[88vh] my-auto scrollbar-thin"
      >
        {/* Topo da Telinha */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-2.5 sm:p-3.5 border-b border-cyan-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">
                {isSmartTv ? 'tv' : 'receipt_long'}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-xs sm:text-sm text-white truncate">
                  Print da Compra • {productName}
                </h3>
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 text-[9px] font-bold">
                  Comprovante
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-cyan-200/80 truncate">
                Devedor(a): <strong className="text-white">{debtorName}</strong> • {storeName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 ml-2"
            title="Fechar janelinha"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Resumo Rápido da Compra */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-2 sm:p-2.5 bg-slate-950/60 border-b border-white/5 text-center text-xs shrink-0">
          <div className="bg-white/5 p-1.5 sm:p-2 rounded-xl border border-white/5">
            <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block font-medium">Valor Total</span>
            <span className="font-mono font-bold text-amber-300 text-[11px] sm:text-[13px]">
              R$ {totalAmount.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <div className="bg-white/5 p-1.5 sm:p-2 rounded-xl border border-white/5">
            <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block font-medium">Parcelamento</span>
            <span className="font-mono font-bold text-cyan-300 text-[11px] sm:text-[13px]">
              {totalInstallmentsCount}x R$ {singleValue.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <div className="bg-white/5 p-1.5 sm:p-2 rounded-xl border border-white/5">
            <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block font-medium">Cartão</span>
            <span className="font-mono font-bold text-purple-300 text-[11px] sm:text-[13px] truncate block" title={cardName}>
              {cardName}
            </span>
          </div>
        </div>

        {/* Área Central Roleável (Scrollable Body) */}
        <div className="p-2.5 sm:p-4 flex-1 flex flex-col gap-2.5 overflow-y-auto min-h-0">
          <div className="flex items-center justify-between text-xs text-slate-300 px-1 shrink-0">
            <span className="font-bold flex items-center gap-1.5 text-cyan-300 text-xs">
              <span className="material-symbols-outlined text-[15px]">photo_camera</span>
              <span>{printImage ? 'Print Carregado' : 'Visualização do Print'}</span>
            </span>
            {printImage && (
              <button
                type="button"
                onClick={() => setIsZoomed(!isZoomed)}
                className="text-[11px] text-cyan-400 hover:text-cyan-200 underline font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {isZoomed ? 'zoom_out' : 'zoom_in'}
                </span>
                <span>{isZoomed ? 'Reduzir' : 'Ampliar'}</span>
              </button>
            )}
          </div>

          {/* Contêiner de Imagem com Altura Responsiva */}
          <div className={`relative w-full rounded-2xl bg-black/60 border border-cyan-400/30 overflow-hidden flex items-center justify-center transition-all shrink-0 ${
            isZoomed ? 'max-h-[280px] sm:max-h-[360px]' : 'max-h-[160px] sm:max-h-[220px]'
          }`}>
            {printImage ? (
              <img
                src={printImage}
                alt={`Print da compra do produto ${productName}`}
                className="w-full h-full object-contain cursor-pointer"
                onClick={() => setIsZoomed(!isZoomed)}
                title="Clique para alternar zoom"
              />
            ) : (
              /* Print Realista Padrão Gerado Eletronicamente para o Produto */
              <div className="w-full p-3 sm:p-4 flex flex-col gap-2 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-200 select-none">
                <div className="flex items-center justify-between pb-2 border-b border-white/10 text-[10px] sm:text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-[9px] sm:text-[10px]">
                      COMPRA APROVADA
                    </span>
                    <span className="text-slate-400 font-mono">#MAGA-884920</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">10/08/2026 14:32</span>
                </div>

                <div className="flex items-start gap-2.5 pt-0.5">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                    <span className="material-symbols-outlined text-[20px] sm:text-[24px]">
                      {isSmartTv ? 'tv' : 'shopping_bag'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-white text-xs sm:text-sm leading-tight truncate">
                      {isSmartTv ? 'Smart TV 50" Crystal 4K UHD Wi-Fi Bluetooth HDR' : productName}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Vendido e entregue por: <strong className="text-slate-200">{storeName}</strong>
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Destinatário: <strong className="text-cyan-300">{debtorName}</strong>
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed border-white/10 flex items-center justify-between text-[10px] sm:text-[11px] font-mono">
                  <span className="text-slate-400">Total Pago:</span>
                  <span className="text-amber-300 font-bold text-xs">
                    R$ {totalAmount.toFixed(2).replace('.', ',')} ({totalInstallmentsCount}x no {cardName})
                  </span>
                </div>

                <div className="text-center pt-0.5 text-[9.5px] text-cyan-300/80 italic">
                  📸 Print padrão gerado. Você pode carregar a foto real da compra abaixo!
                </div>
              </div>
            )}
          </div>

          {/* Input oculto de upload de imagem */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Botões de Ação para o Print */}
          <div className="flex items-center gap-2 pt-1 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer min-w-0"
              title="Carregar imagem do print do produto"
            >
              <span className="material-symbols-outlined text-[16px] shrink-0">upload_file</span>
              <span className="truncate">{printImage ? 'Trocar Print' : 'Carregar Imagem'}</span>
            </button>

            {printImage && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-white/10 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-white/15 hover:border-red-400/30 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0"
                title="Remover imagem personalizada e voltar ao padrão"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span className="hidden sm:inline">Remover</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer shrink-0"
            >
              Concluído
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
};
