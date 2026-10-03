import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface ShareScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageBlob: Blob | null;
  fileName: string;
  title: string;
  description?: string;
  onToast: (msg: string) => void;
}

export const ShareScreenshotModal: React.FC<ShareScreenshotModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageBlob,
  fileName,
  title,
  description,
  onToast,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !imageUrl) return null;

  const handleDownloadAgain = () => {
    try {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onToast(`📥 Print salvo na pasta Downloads / Galeria (${fileName})`);
    } catch (e) {
      console.error('Erro ao baixar print:', e);
      onToast('Erro ao baixar arquivo.');
    }
  };

  const handleCopyClipboard = async () => {
    try {
      if (imageBlob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new window.ClipboardItem({ 'image/png': imageBlob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        onToast('📸 Print copiado para a área de transferência! Pode colar (Ctrl+V) onde desejar.');
        return;
      }
    } catch (err) {
      console.warn('Erro ao copiar imagem para clipboard:', err);
    }
    // Fallback: copia o link ou instrui download
    handleDownloadAgain();
  };

  const handleNativeShare = async () => {
    try {
      if (imageBlob && navigator.share) {
        const file = new File([imageBlob], fileName, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: title || 'Comprovante / Print HASPAHO',
            text: description || 'Segue o print do comprovante gerado pelo sistema.',
            files: [file],
          });
          onToast('Compartilhamento aberto com sucesso!');
          return;
        } else {
          await navigator.share({
            title: title || 'Comprovante / Print HASPAHO',
            text: `${title} - ${fileName}`,
          });
          onToast('Compartilhamento enviado!');
          return;
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn('Falha no compartilhamento nativo:', err);
      }
    }
    // Fallback para WhatsApp
    handleShareWhatsApp();
  };

  const handleShareWhatsApp = () => {
    const text = `*${(title || 'COMPROVANTE OFICIAL').toUpperCase()}*\n\n` +
      `📄 Arquivo gerado: *${fileName}*\n` +
      `${description ? `ℹ️ ${description}\n\n` : ''}` +
      `_O print em alta resolução foi salvo na pasta de Downloads / Galeria do dispositivo._`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onToast('Abrindo WhatsApp para envio!');
  };

  const handlePrintImage = () => {
    try {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title} - ${fileName}</title>
              <style>
                body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; background: #fff; }
                img { max-width: 100%; height: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px; }
                @media print {
                  body { padding: 0; }
                  img { max-width: 100%; box-shadow: none; border-radius: 0; }
                }
              </style>
            </head>
            <body>
              <img src="${imageUrl}" onload="window.print();" />
            </body>
          </html>
        `);
        printWin.document.close();
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[999999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-cyan-400/50 rounded-3xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.95)] flex flex-col max-h-[94vh] overflow-hidden text-white my-auto animate-in zoom-in-95 duration-150 relative">
        
        {/* Top Header */}
        <div className="shrink-0 bg-slate-950 px-4 py-3.5 sm:px-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
              <span className="material-symbols-outlined text-[22px]">share</span>
            </span>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base text-white truncate">
                Print Capturado com Sucesso!
              </h3>
              <p className="text-[11px] text-emerald-400 font-medium truncate flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                Salvo na pasta Downloads / Galeria
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar (X)"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body: Location feedback + Image Preview */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Caixa de Notificação do Local Salvo */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/50 border-2 border-emerald-500/50 flex items-start gap-3 shadow-inner">
            <span className="material-symbols-outlined text-emerald-400 text-[24px] shrink-0 mt-0.5">
              folder_zip
            </span>
            <div className="text-xs min-w-0">
              <span className="font-extrabold text-emerald-300 text-sm block">
                Arquivo Salvo no Dispositivo:
              </span>
              <p className="text-slate-200 text-xs mt-1 leading-relaxed">
                📁 O print foi gravado na sua pasta de <b>Downloads</b> (no computador) ou na sua <b>Galeria</b> (no celular).
              </p>
              <div className="mt-2 bg-slate-900/90 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-emerald-200 truncate">
                {fileName}
              </div>
            </div>
          </div>

          {/* Prévia da Imagem Capturada */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold px-1">
              <span>Prévia do Print Exclusivo do Painel:</span>
              <span className="text-cyan-300 font-mono">PNG 2x HD</span>
            </div>
            <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 max-h-[280px] sm:max-h-[340px] flex items-center justify-center p-2 shadow-inner">
              <img
                src={imageUrl}
                alt="Print Capturado"
                className="max-h-full max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>

        {/* Rodapé de Ações de Compartilhamento */}
        <div className="shrink-0 bg-slate-950 border-t border-white/10 p-3.5 sm:p-4 space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* 1. Compartilhar / Enviar */}
            <button
              type="button"
              onClick={handleNativeShare}
              className="h-10 px-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
              title="Compartilhar imagem para contatos"
            >
              <span className="material-symbols-outlined text-[17px]">share</span>
              <span>Enviar Print</span>
            </button>

            {/* 2. WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="h-10 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
              title="Enviar no WhatsApp"
            >
              <span className="material-symbols-outlined text-[17px]">send</span>
              <span>WhatsApp</span>
            </button>

            {/* 3. Copiar Imagem */}
            <button
              type="button"
              onClick={handleCopyClipboard}
              className="h-10 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all cursor-pointer"
              title="Copiar imagem para área de transferência"
            >
              <span className="material-symbols-outlined text-[17px]">
                {copied ? 'done_all' : 'content_copy'}
              </span>
              <span>{copied ? 'Copiado!' : 'Copiar (Ctrl+V)'}</span>
            </button>

            {/* 4. Baixar Novamente */}
            <button
              type="button"
              onClick={handleDownloadAgain}
              className="h-10 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all cursor-pointer"
              title="Baixar arquivo PNG novamente"
            >
              <span className="material-symbols-outlined text-[17px]">download</span>
              <span>Baixar PNG</span>
            </button>
          </div>

          <div className="flex justify-between items-center pt-1 text-[11px] text-slate-400">
            <button
              type="button"
              onClick={handlePrintImage}
              className="hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">print</span>
              <span>Imprimir esta imagem</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white font-bold text-xs cursor-pointer transition-all"
            >
              Concluído / Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
