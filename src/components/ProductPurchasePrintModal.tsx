import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { Purchase, Installment } from '../types';
import { playAppSound } from '../utils/soundUtils';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanKey = `haspaho_print_${(debtorName || 'global').toLowerCase().replace(/\s+/g, '_')}_${(productName || 'item').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // Carregar imagem salva no localStorage
  useEffect(() => {
    if (!isOpen) {
      setIsFullscreen(false);
      return;
    }
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

  // Resetar zoom e pan ao abrir o modo fullscreen
  const handleOpenFullscreen = useCallback(() => {
    setZoomLevel(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsFullscreen(true);
    playAppSound('pop');

    try {
      confetti({
        particleCount: 38,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
      });
    } catch {
      // ignore
    }
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Fechar com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          handleCloseFullscreen();
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, isOpen, handleCloseFullscreen, onClose]);

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
          playAppSound('success');
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
    playAppSound('whoosh');
  };

  const handleDownloadImage = () => {
    if (!printImage) return;
    try {
      const link = document.createElement('a');
      link.href = printImage;
      link.download = `comprovante_${debtorName.replace(/\s+/g, '_')}_${productName.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (onToast) onToast('Download do print iniciado!');
      playAppSound('cheerful');
    } catch {
      if (onToast) onToast('Não foi possível salvar o arquivo.');
    }
  };

  // Controles de Pan (arrastar a imagem quando com zoom)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch controls para mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.touches[0].clientX - pan.x,
      y: e.touches[0].clientY - pan.y,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || zoomLevel <= 1 || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStartRef.current.x,
      y: e.touches[0].clientY - dragStartRef.current.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Duplo clique / toque para alternar zoom 1x e 2x
  const handleDoubleTap = () => {
    if (zoomLevel > 1) {
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoomLevel(2);
    }
    playAppSound('click');
  };

  const isSmartTv = /smart\s*tv|tv/i.test(productName);
  const totalAmount = purchase?.totalAmount || installments.reduce((acc, curr) => acc + (curr.amount || curr.originalAmount || 0), 0) || 965.00;
  const storeName = purchase?.store || (isSmartTv ? 'Boca Rica / Magalu' : 'Loja Parceira');
  const cardName = purchase?.cardName || installments[0]?.cardName || 'Nubank Croma';
  const totalInstallmentsCount = purchase?.installmentsTotal || installments.length || 10;
  const singleValue = purchase?.installmentValue || installments[0]?.amount || (totalAmount / (totalInstallmentsCount || 1));

  // =========================================================================
  // 1. VISUALIZADOR INTUITIVO E DIVERTIDO EM TELA CHEIA (FULLSCREEN VIEWER)
  // =========================================================================
  const fullscreenViewer = isFullscreen ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Print Completo da Compra"
      className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-2xl flex flex-col select-none overflow-hidden animate-in fade-in duration-200"
    >
      {/* Luz ambiente e estrelas de fundo cósmico */}
      <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-25 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

      {/* Barra Superior Flutuante (Header) */}
      <div className="relative z-20 px-3 sm:px-5 py-2.5 sm:py-3.5 bg-slate-900/90 border-b border-cyan-400/40 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[19px]">fullscreen</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-black text-xs sm:text-sm text-white truncate">
                Print Completo • {productName}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                100% Visível
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-cyan-200/90 truncate">
              Devedor(a): <strong className="text-white">{debtorName}</strong> • R$ {totalAmount.toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCloseFullscreen}
          className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-red-600/90 hover:bg-red-600 active:scale-95 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0 border border-red-400/60"
          title="Fechar tela cheia"
        >
          <span className="material-symbols-outlined text-[17px]">close</span>
          <span>Fechar</span>
        </button>
      </div>

      {/* Área Central Interativa: Imagem Exibida por Completo */}
      <div
        className="relative z-10 flex-1 w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-hidden touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleTap}
      >
        {printImage ? (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
            className="flex items-center justify-center max-w-full max-h-full cursor-grab active:cursor-grabbing select-none"
          >
            <img
              src={printImage}
              alt={`Print completo de ${productName}`}
              className="max-w-[94vw] max-h-[74vh] sm:max-h-[78vh] object-contain rounded-2xl shadow-2xl border-2 border-cyan-400/50 bg-black/60 pointer-events-none"
              draggable={false}
            />
          </div>
        ) : (
          /* Visualizador do Print Padrão Gerado Eletronicamente por Completo */
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
            className="w-full max-w-md p-4 sm:p-6 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100 border-2 border-cyan-400/60 shadow-2xl flex flex-col gap-3 select-none"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-[10px]">
                COMPRA APROVADA
              </span>
              <span className="text-slate-400 font-mono text-[11px]">10/08/2026 14:32</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
                <span className="material-symbols-outlined text-[26px]">
                  {isSmartTv ? 'tv' : 'receipt_long'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-black text-white text-sm sm:text-base leading-tight">
                  {isSmartTv ? 'Smart TV 50" Crystal 4K UHD Wi-Fi' : productName}
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Vendido por: <strong className="text-white">{storeName}</strong>
                </p>
                <p className="text-xs text-slate-300">
                  Destinatário: <strong className="text-cyan-300">{debtorName}</strong>
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-dashed border-white/15 flex items-center justify-between text-xs sm:text-sm font-mono">
              <span className="text-slate-400">Total Pago:</span>
              <span className="text-amber-300 font-black text-base">
                R$ {totalAmount.toFixed(2).replace('.', ',')} ({totalInstallmentsCount}x no {cardName})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Ferramentas Flutuante Inferior (Controles Interativos e Divertidos) */}
      <div className="relative z-20 pb-3 sm:pb-5 px-3 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/95 border border-cyan-400/60 shadow-[0_10px_35px_rgba(0,0,0,0.6)] rounded-2xl px-2.5 sm:px-3.5 py-1.5 backdrop-blur-xl max-w-[96vw] overflow-x-auto scrollbar-none">
          {/* Zoom Menos */}
          <button
            type="button"
            onClick={() => {
              setZoomLevel((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))));
              playAppSound('click');
            }}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Diminuir Zoom"
          >
            <span className="material-symbols-outlined text-[18px]">zoom_out</span>
          </button>

          {/* Indicador de Porcentagem do Zoom */}
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1);
              setPan({ x: 0, y: 0 });
              playAppSound('click');
            }}
            className="px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono font-black text-xs shrink-0 cursor-pointer hover:bg-cyan-500/30 active:scale-95 transition-all"
            title="Redefinir para 100%"
          >
            {Math.round(zoomLevel * 100)}%
          </button>

          {/* Zoom Mais */}
          <button
            type="button"
            onClick={() => {
              setZoomLevel((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))));
              playAppSound('click');
            }}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Aumentar Zoom"
          >
            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
          </button>

          <div className="w-[1px] h-5 bg-white/20 shrink-0 mx-0.5" />

          {/* Botão Girar 90° */}
          <button
            type="button"
            onClick={() => {
              setRotation((r) => (r + 90) % 360);
              playAppSound('click');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
            title="Girar 90 graus"
          >
            <span className="material-symbols-outlined text-[16px]">rotate_right</span>
            <span className="hidden sm:inline">Girar</span>
          </button>

          {/* Botão Ajustar / Centralizar */}
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1);
              setRotation(0);
              setPan({ x: 0, y: 0 });
              playAppSound('click');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
            title="Ajustar ao tamanho original"
          >
            <span className="material-symbols-outlined text-[16px]">fit_screen</span>
            <span className="hidden sm:inline">Ajustar</span>
          </button>

          {/* Botão Baixar Print */}
          {printImage && (
            <button
              type="button"
              onClick={handleDownloadImage}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 active:scale-90 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0 border border-emerald-400/50"
              title="Baixar imagem do comprovante"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span className="hidden sm:inline">Salvar</span>
            </button>
          )}
        </div>

        {/* Dica Didática e Divertida */}
        <p className="text-[10px] sm:text-[11px] text-cyan-200/80 font-medium text-center">
          💡 Dica: Arraste para mover ou dê dois toques rápidos para zoom interativo!
        </p>
      </div>
    </div>
  ) : null;

  // =========================================================================
  // 2. MODAL PRINCIPAL COMPACTO E ORGANIZADO NA VERSÃO MOBILE
  // =========================================================================
  const modalElement = (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-slate-900 border-2 border-cyan-400/60 rounded-2xl sm:rounded-3xl shadow-[0_0_35px_rgba(6,182,212,0.25)] overflow-hidden flex flex-col text-white animate-in zoom-in-95 duration-200 max-h-[96dvh] sm:max-h-[90vh] my-auto scrollbar-thin"
        >
          {/* Topo da Telinha (Header Organizado) */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-2.5 sm:p-3.5 border-b border-cyan-500/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">
                  {isSmartTv ? 'tv' : 'receipt_long'}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-extrabold text-xs sm:text-sm text-white truncate">
                    Print da Compra • {productName}
                  </h3>
                  <span className="px-1.5 py-0.2 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/50 text-[9px] font-black uppercase">
                    Comprovante
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-cyan-200/90 truncate">
                  Devedor(a): <strong className="text-white">{debtorName}</strong> • {storeName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 ml-1.5 border border-white/10"
              title="Fechar janela"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Resumo Rápido da Compra (3 Cards em Grid Organizado) */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-2 sm:p-2.5 bg-slate-950/70 border-b border-white/10 text-center text-xs shrink-0">
            <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-xl border border-white/10 shadow-2xs">
              <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block font-medium">Valor Total</span>
              <span className="font-mono font-black text-amber-300 text-[11px] sm:text-[13px]">
                R$ {totalAmount.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-xl border border-white/10 shadow-2xs">
              <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block font-medium">Parcelamento</span>
              <span className="font-mono font-black text-cyan-300 text-[11px] sm:text-[13px]">
                {totalInstallmentsCount}x R$ {singleValue.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="bg-slate-900/90 p-1.5 sm:p-2 rounded-xl border border-white/10 shadow-2xs">
              <span className="text-[8.5px] sm:text-[9.5px] text-slate-400 block font-medium">Cartão</span>
              <span className="font-mono font-black text-purple-300 text-[11px] sm:text-[13px] truncate block" title={cardName}>
                {cardName}
              </span>
            </div>
          </div>

          {/* Área Central: Prévia do Print com Acesso Direto à Expansão */}
          <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col gap-2 overflow-y-auto min-h-0">
            <div className="flex items-center justify-between text-xs text-slate-300 px-0.5 shrink-0">
              <span className="font-bold flex items-center gap-1.5 text-cyan-300 text-xs">
                <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                <span>{printImage ? 'Print Carregado' : 'Visualização do Print'}</span>
              </span>

              {/* Botão de Destaque: Expandir Print Completo */}
              <button
                type="button"
                onClick={handleOpenFullscreen}
                className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-[11px] flex items-center gap-1 transition-all shadow-xs active:scale-95 cursor-pointer border border-cyan-400/60"
                title="Abrir imagem por completo em tela cheia com zoom interativo"
              >
                <span className="material-symbols-outlined text-[15px]">fullscreen</span>
                <span>Expandir Tela Cheia</span>
              </button>
            </div>

            {/* Contêiner de Prévia Interativo (Toque para Expandir por Completo) */}
            <div
              onClick={handleOpenFullscreen}
              className="group relative w-full rounded-2xl bg-black/80 border-2 border-cyan-400/40 hover:border-cyan-400 transition-all overflow-hidden flex items-center justify-center min-h-[160px] max-h-[220px] sm:max-h-[260px] cursor-pointer shadow-inner shrink-0"
              title="Toque para expandir e ver o print completo"
            >
              {printImage ? (
                <>
                  <img
                    src={printImage}
                    alt={`Prévia do print de ${productName}`}
                    className="w-full h-full object-contain max-h-[210px] sm:max-h-[250px] transition-transform duration-300 group-hover:scale-102"
                  />
                  {/* Badge Flutuante Divertido sobre a Imagem */}
                  <div className="absolute top-2 right-2 bg-slate-900/90 text-cyan-300 border border-cyan-400/60 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shadow-md backdrop-blur-md">
                    <span className="material-symbols-outlined text-[13px] text-cyan-400 animate-pulse">zoom_in</span>
                    <span>Toque para Expandir</span>
                  </div>

                  {/* Faixa inferior de incentivo */}
                  <div className="absolute inset-x-0 bottom-0 py-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-center gap-1 text-[10px] text-cyan-200 font-bold">
                    <span className="material-symbols-outlined text-[13px]">touch_app</span>
                    <span>Clique para ver o comprovante completo</span>
                  </div>
                </>
              ) : (
                /* Print Padrão Gerado com Dica de Upload */
                <div className="w-full p-3 sm:p-4 flex flex-col gap-2 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-200 select-none">
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[10px] sm:text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-[9px]">
                      COMPRA APROVADA
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">10/08/2026 14:32</span>
                  </div>
                  <div className="flex items-start gap-2 pt-0.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                      <span className="material-symbols-outlined text-[18px]">
                        {isSmartTv ? 'tv' : 'shopping_bag'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-white text-xs leading-tight truncate">
                        {isSmartTv ? 'Smart TV 50" Crystal 4K UHD Wi-Fi' : productName}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Destinatário: <strong className="text-cyan-300">{debtorName}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="text-center pt-1 text-[9.5px] text-cyan-300/90 italic flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">photo_camera</span>
                    <span>Toque em &quot;Carregar Imagem&quot; para inserir a foto real!</span>
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

            {/* Barra de Ações (Botões Organizados no Mobile) */}
            <div className="flex items-center gap-1.5 pt-1 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2 px-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer min-w-0"
                title="Carregar ou trocar o arquivo do print"
              >
                <span className="material-symbols-outlined text-[16px] shrink-0">upload_file</span>
                <span className="truncate">{printImage ? 'Trocar Print' : 'Carregar Imagem'}</span>
              </button>

              {printImage && (
                <button
                  type="button"
                  onClick={handleOpenFullscreen}
                  className="py-2 px-2.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/50 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
                  title="Ver completo em tela cheia"
                >
                  <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                  <span className="hidden sm:inline">Ver Completo</span>
                </button>
              )}

              {printImage && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="h-8.5 w-8.5 rounded-xl bg-white/10 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-white/15 hover:border-red-400/30 flex items-center justify-center transition-all cursor-pointer shrink-0"
                  title="Remover imagem personalizada"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer shrink-0"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizador Fullscreen Imersivo */}
      {fullscreenViewer}
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
};
