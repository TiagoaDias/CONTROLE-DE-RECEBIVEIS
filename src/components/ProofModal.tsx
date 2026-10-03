import { safeToFixed, safeFormatCurrency, safeToNumber } from "../utils/numberUtils";
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { HaspahoLogo } from './HaspahoLogo';
import { registerAuthCode } from '../utils/authRegistry';
import { printHtmlContent } from '../utils/printHelper';
import { Installment, Debtor, UserAccount } from '../types';
import { valorPorExtenso } from '../utils/numberToWordsPtBr';
import { downloadIndividualReceiptPdf } from '../utils/receiptPdfHelper';
import { generatePixQrCodeDataUrl } from '../utils/pixQrCodeHelper';

interface ProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    payer: string;
    amount: string;
    date: string;
    dest: string;
    auth: string;
    item: string;
    debtorId?: string;
  } | null;
  installments?: Installment[];
  onToast: (msg: string) => void;
  currentUser?: UserAccount | null;
  debtors?: Debtor[];
  onSettleInstallment?: (inst: Installment) => void;
  onOpenExtratoTotal?: (purchaseId?: string, debtorId?: string) => void;
}

/**
 * ProofModal - RECIBO DE PAGAMENTO INDIVIDUAL
 * "O recibo ele é individual. Quando é algo total, aí não estamos falando de recibo, estamos falando de extrato."
 */
export const ProofModal: React.FC<ProofModalProps> = ({
  isOpen,
  onClose,
  data,
  installments = [],
  onToast,
  currentUser,
  debtors = [],
  onOpenExtratoTotal,
}) => {
  if (!isOpen || !data) return null;

  const receiptRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Registra automaticamente o código de autenticação no Registro Central Oficial
  useEffect(() => {
    if (isOpen && data && data.auth) {
      registerAuthCode({
        auth: data.auth,
        type: 'recibo',
        payer: data.payer,
        amount: data.amount,
        date: data.date,
        bank: 'Nubank Croma / Asaas IP',
        item: data.item,
        destination: data.dest,
        status: 'AUTÊNTICO E LIQUIDADO',
      });
    }
  }, [isOpen, data]);

  // Parser dos detalhes da parcela quitada
  const parsedInstallment = useMemo(() => {
    if (!data || !data.item) {
      return { product: 'Parcela', current: '1', total: '1', didacticText: 'Parcela 1 de 1' };
    }
    const raw = String(data.item).trim();

    // Formato 1: Item (Parcela 3/10) ou Item (Parcela #3/10) ou Item (Parcela 3 de 10)
    const match1 = raw.match(/(.*?)\s*\(\s*(?:Parcela\s*#?)?\s*(\d+)\s*(?:\/|\s+de\s+)\s*(\d+)\s*\)/i);
    if (match1) {
      const current = match1[2];
      const total = match1[3];
      const product = match1[1].trim();
      return {
        product: product || 'Produto',
        current: current || '1',
        total: total || '1',
        didacticText: `Parcela ${current} de ${total} (${current}ª Parcela)`,
      };
    }

    // Formato 2: Item - Parcela 3/10 ou Item - 3/10
    const match2 = raw.match(/(.*?)(?:[-–—]\s*|\s+)(?:Parcela\s*#?)?(\d+)\s*(?:\/|\s+de\s+)\s*(\d+)/i);
    if (match2) {
      const current = match2[2];
      const total = match2[3];
      const product = match2[1].replace(/[\(\[\-–—]/g, '').trim();
      return {
        product: product || 'Produto',
        current: current || '1',
        total: total || '1',
        didacticText: `Parcela ${current} de ${total} (${current}ª Parcela)`,
      };
    }

    return {
      product: raw || 'Produto',
      current: '1',
      total: '1',
      didacticText: raw || 'Parcela Individual',
    };
  }, [data]);

  // Devedor identificado
  const currentDebtor = useMemo(() => {
    if (!data) return null;
    if (data.debtorId) {
      const found = debtors.find((d) => d && d.id === data.debtorId);
      if (found) return found;
    }
    const cleanPayer = (data.payer || '').toLowerCase().trim();
    if (!cleanPayer) return null;
    return (
      debtors.find((d) => {
        if (!d || !d.name) return false;
        const dName = String(d.name).toLowerCase().trim();
        return dName && (dName === cleanPayer || cleanPayer.includes(dName) || dName.includes(cleanPayer));
      }) || null
    );
  }, [data, debtors]);

  // Valor numérico e conversão oficial por extenso
  const numericAmount = useMemo(() => {
    if (!data?.amount) return 0;
    const str = String(data.amount).replace('R$', '').trim();
    if (str.includes(',')) {
      const clean = str.replace(/\./g, '').replace(',', '.');
      return parseFloat(clean) || 0;
    }
    return parseFloat(str) || 0;
  }, [data]);

  const amountInWords = useMemo(() => {
    return valorPorExtenso(numericAmount || 0);
  }, [numericAmount]);

  const creditorName = currentUser?.name || 'Tiago Dias';
  const creditorCompany = currentUser?.companyName || 'HASPAHO Tecnologia da Informação';
  const creditorPix = currentUser?.pixKey || '(14) 99733-9863';
  const creditorPhone = currentUser?.phoneWhatsapp || '(14) 99733-9863';
  const creditorLocation = `${currentUser?.city || 'Mineiros do Tietê'} - ${currentUser?.state || 'SP'}`;

  // Gera o QR Code PIX
  useEffect(() => {
    if (isOpen && creditorPix && numericAmount > 0) {
      generatePixQrCodeDataUrl(creditorPix, numericAmount, creditorName)
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => setQrCodeDataUrl(''));
    }
  }, [isOpen, creditorPix, numericAmount, creditorName]);

  if (!isOpen || !data) return null;

  const handleCopyProtocol = () => {
    navigator.clipboard?.writeText(data.auth);
    onToast('Código de autenticação individual copiado com sucesso!');
  };

  // Disparar o download direto do PDF do Recibo Individual
  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      onToast(`📄 Baixando recibo individual da Parcela #${parsedInstallment.current}/${parsedInstallment.total}...`);

      await downloadIndividualReceiptPdf({
        payerName: currentDebtor?.name || data.payer,
        payerPhone: currentDebtor?.phone,
        creditorName,
        creditorCompany,
        creditorPix,
        creditorLocation,
        productName: parsedInstallment.product,
        installmentNumber: Number(parsedInstallment.current) || 1,
        totalInstallments: Number(parsedInstallment.total) || 1,
        amount: numericAmount,
        paymentDate: data.date,
        paymentMethod: data.dest,
        authCode: data.auth,
      });

      onToast('✅ Recibo individual em PDF baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao baixar recibo em PDF:', err);
      onToast('Erro ao baixar recibo em PDF. Tente novamente.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Enviar Recibo Individual no WhatsApp
  const handleShareWhatsApp = () => {
    const text = `*RECIBO DE PAGAMENTO INDIVIDUAL*
*${creditorCompany.toUpperCase()}*

Confirmamos o recebimento e liquidação com plena quitação jurídica da parcela discriminada abaixo:

━━━━━━━━━━━━━━━━━━━━━━━━━━
🏛️ *QUALIFICAÇÃO:*
• *Credor / Titular:* ${creditorName} (${creditorCompany})
• *Chave PIX:* ${creditorPix}
• *Pagador(a) / Devedor(a):* ${currentDebtor?.name || data.payer}
• *Contato:* ${currentDebtor?.phone || '(14) 99712-0484'}

━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *DISCRIMINAÇÃO DA PARCELA QUITADA:*
• *Produto / Referência:* ${parsedInstallment.product}
• *Parcela:* ${parsedInstallment.current} de ${parsedInstallment.total} (${parsedInstallment.current}ª Parcela)
• *Valor Quitado:* *${data.amount}*
• *Valor por Extenso:* _"${amountInWords}"_
• *Data da Liquidação:* ${data.date}
• *Forma de Pagamento:* ${data.dest}
• *Situação:* *AUTÊNTICO E LIQUIDADO (PARCELA QUITADA)*

━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 *DECLARAÇÃO DE QUITAÇÃO:*
_Recebemos a quantia supra de ${data.amount}, conferindo quitação exclusiva e integral da referida parcela individual, nos termos do Art. 320 do Código Civil._

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 *Chave de Validação Digital SHA-256:*
\`${data.auth}\`

_Recibo emitido com eficácia probatória plena de quitação nos termos do Artigo 320 do Código Civil e Lei Federal nº 14.063/2020._`;

    const encoded = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onToast('Abrindo WhatsApp com o recibo individual da parcela!');
  };



  // Imprimir Recibo Individual
  const handlePrint = () => {
    if (!receiptRef.current) {
      handleDownloadPdf();
      return;
    }
    const success = printHtmlContent(
      `Recibo Individual - Parcela ${parsedInstallment.current} de ${parsedInstallment.total} - ${data.payer}`,
      receiptRef.current,
      () => handleDownloadPdf()
    );
    if (!success) {
      handleDownloadPdf();
    }
  };

  return (
    <div className="fixed inset-0 z-[900] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Modal Card com Foco Exclusivo no Recibo Individual Reenquadrado (COM LUZ) */}
      <div className="w-full max-w-xl sm:max-w-2xl bg-white rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.35)] ring-2 ring-cyan-400/50 border-2 border-cyan-400/60 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* ============================================================ */}
        {/* 1. TOPO FIXO DO MODAL                                        */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="h-8 sm:h-8.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 shrink-0"
              title="Voltar para a tela anterior"
            >
              <span className="material-symbols-outlined text-[17px]">arrow_back</span>
              <span>Voltar</span>
            </button>
            <span className="w-8.5 h-8.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-[20px]">download_done</span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                  Recibo de Pagamento Individual
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {parsedInstallment.didacticText}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                Comprovante exclusivo desta parcela • Eficácia probatória plena (Art. 320 CC)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Fechar"
              aria-label="Fechar comprovante"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. CORPO ROLÁVEL COM O RECIBO ESTRITAMENTE INDIVIDUAL         */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 overscroll-contain bg-slate-50/70">
          
          {/* Container Capturável do Recibo Oficial Reenquadrado */}
          <div
            ref={receiptRef}
            className="w-full max-w-lg mx-auto bg-white border-2 border-emerald-500/30 rounded-2xl p-4 sm:p-6 flex flex-col gap-3.5 shadow-sm relative overflow-hidden"
          >
            {/* Marca d'água oficial HASPAHO A4 translúcida no fundo */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 opacity-[0.045] select-none">
              <div className="w-[300px] sm:w-[420px] h-[340px] sm:h-[460px] flex items-center justify-center">
                <HaspahoLogo size="2xl" variant="icon" className="scale-[2.5]" />
              </div>
            </div>

            {/* Top Brand Header do Recibo com Carimbo Redondo PAGO */}
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-2 relative z-10">
              <div className="flex items-center gap-2">
                <HaspahoLogo size="lg" variant="horizontal" className="h-9 sm:h-11" />
              </div>
              
              <div className="flex items-center gap-3">
                {/* Carimbo Redondo Notarial Ultra Visível "PAGO" */}
                <div className="inline-flex items-center justify-center select-none rotate-[-12deg] hover:rotate-0 transition-transform duration-200 shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3.5px] sm:border-[4px] border-emerald-600 border-dashed bg-emerald-500/20 flex flex-col items-center justify-center p-0.5 shadow-lg shadow-emerald-700/20 ring-4 ring-emerald-500/30">
                    <div className="w-full h-full rounded-full border-2 border-emerald-600 flex flex-col items-center justify-center text-center p-1 bg-white/90 backdrop-blur-xs">
                      <span className="text-[7.5px] sm:text-[8.5px] font-black uppercase tracking-widest text-emerald-950 leading-none">
                        ★ COMPROVADO ★
                      </span>
                      <span className="text-xl sm:text-2xl font-black tracking-widest text-emerald-700 font-mono drop-shadow-sm my-0.5 leading-none">
                        PAGO
                      </span>
                      <div className="flex items-center gap-0.5 text-[6.5px] sm:text-[7.5px] font-black text-emerald-900 uppercase tracking-tight leading-none">
                        <span className="material-symbols-outlined text-[9px] sm:text-[11px] text-emerald-700 font-black">verified</span>
                        <span>100% QUITADO</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 text-[10.5px] font-black uppercase tracking-wider shadow-xs border-2 border-emerald-400">
                  <span className="material-symbols-outlined text-[16px] text-emerald-700 font-bold">verified</span>
                  <span>RECIBO INDIVIDUAL AUTÊNTICO</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse ml-0.5" />
                </div>
              </div>
            </div>

            {/* Chave de Autenticação Digital em Destaque */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-xl p-3 flex flex-col gap-1.5 shadow-xs relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-emerald-700">lock</span>
                  Código Criptográfico de Autenticação da Parcela
                </span>
                <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded-full">
                  Registro Central Oficial
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-white border border-emerald-200 px-3 py-2 rounded-lg">
                <span className="font-mono font-black text-slate-900 text-xs sm:text-sm select-all tracking-wide break-all">
                  {data.auth}
                </span>
                <button
                  type="button"
                  onClick={handleCopyProtocol}
                  className="shrink-0 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                  title="Copiar Chave"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>Copiar</span>
                </button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SEÇÃO 1: QUALIFICAÇÃO DAS PARTES                             */}
            {/* ============================================================ */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 relative z-10">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-blue-600">groups</span>
                  1. Qualificação das Partes Contratantes
                </span>
                <span className="text-[9.5px] font-bold text-slate-500">
                  Relação de Repasse e Financiamento
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                {/* PARTE CREDORA (Tiago Dias - Credor Oficial) */}
                <div className="p-3 bg-white rounded-lg border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-blue-700">
                      Credor / Titular
                    </span>
                    <span className="material-symbols-outlined text-[15px] text-blue-600">verified_user</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                    {creditorName}
                  </h4>
                  <p className="text-[11px] text-slate-600 font-medium leading-tight">
                    <b>Instituição:</b> {creditorCompany}
                  </p>
                  <p className="text-[10.5px] text-slate-500 leading-tight">
                    <b>Domicílio:</b> {creditorLocation}
                  </p>
                  <p className="text-[10.5px] text-slate-700 font-mono font-semibold pt-1 border-t border-slate-100 truncate">
                    <b>PIX Oficial:</b> {creditorPix}
                  </p>
                </div>

                {/* PARTE DEVEDORA / PAGADORA */}
                <div className="p-3 bg-white rounded-lg border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700">
                      Pagador(a) / Devedor(a)
                    </span>
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">person</span>
                  </div>
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate">
                    {currentDebtor?.name || data.payer}
                  </h4>
                  <p className="text-[11px] text-slate-600 font-medium leading-tight">
                    <b>Vínculo:</b> {currentDebtor?.relation || 'Titular da Compra / Plano Parcelado'}
                  </p>
                  <p className="text-[10.5px] text-slate-500 leading-tight">
                    <b>Contato/WhatsApp:</b> {currentDebtor?.phone || '(14) 99712-0484'}
                  </p>
                  <p className="text-[10.5px] text-slate-700 font-mono font-semibold pt-1 border-t border-slate-100 truncate">
                    <b>Chave Informada:</b> {currentDebtor?.pixKey || 'Cadastro Interno'}
                  </p>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SEÇÃO 2: DISCRIMINAÇÃO DA PARCELA INDIVIDUAL QUITADA          */}
            {/* ============================================================ */}
            <div className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-emerald-50/80 border-2 border-emerald-300 rounded-xl p-3.5 sm:p-5 space-y-3.5 shadow-xs relative z-10">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                <span className="text-[11px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-emerald-700">payments</span>
                  2. Discriminação da Parcela Individual Quitada
                </span>
                <span className="text-[9.5px] font-extrabold text-emerald-800 bg-emerald-200 px-2.5 py-0.5 rounded-full">
                  Quitação Exclusiva Desta Parcela
                </span>
              </div>

              {/* Destaque do Valor Confirmado com Carimbo Redondo PAGO */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border-2 border-emerald-300 shadow-2xs relative overflow-hidden">
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block">
                    VALOR LIQUIDADO DESTA PARCELA (INDIVIDUAL)
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {parsedInstallment.product} • Parcela {parsedInstallment.current} de {parsedInstallment.total}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tracking-tight mt-1">
                    {data.amount}
                  </div>
                </div>

                {/* Carimbo Redondo Oficial "PAGO" Gigante */}
                <div className="inline-flex items-center justify-center select-none rotate-[-10deg] hover:rotate-0 transition-transform duration-200 shrink-0">
                  <div className="w-22 h-22 sm:w-26 sm:h-26 rounded-full border-[3.5px] border-dashed border-emerald-600 bg-emerald-500/15 flex flex-col items-center justify-center p-1 shadow-md shadow-emerald-600/20 ring-4 ring-emerald-500/20">
                    <div className="w-full h-full rounded-full border-2 border-emerald-600 flex flex-col items-center justify-center text-center p-1 bg-white/80">
                      <span className="text-[7.5px] sm:text-[8.5px] font-black uppercase tracking-widest text-emerald-900 leading-none">
                        ★ QUITADO ★
                      </span>
                      <span className="text-2xl sm:text-3xl font-black tracking-widest text-emerald-700 font-mono drop-shadow-xs my-0.5 leading-none">
                        PAGO
                      </span>
                      <div className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-black text-emerald-900 uppercase tracking-tight leading-none">
                        <span className="material-symbols-outlined text-[10px] text-emerald-700 font-black">verified</span>
                        <span>100% LIQUIDADO</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Valor por Extenso em Destaque */}
              <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 text-xs">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Valor Expresso em Moeda Nacional (Por Extenso):
                </span>
                <p className="text-xs sm:text-sm font-bold text-emerald-950 italic">
                  "{amountInWords}"
                </p>
              </div>

              {/* Detalhes Específicos Desta Parcela */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 shadow-2xs">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Parcela</span>
                  <span className="font-black text-slate-900 text-xs sm:text-sm">
                    {parsedInstallment.current} de {parsedInstallment.total}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 shadow-2xs">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Data e Hora</span>
                  <span className="font-black text-slate-900 text-xs sm:text-sm">
                    {data.date}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 shadow-2xs col-span-2 sm:col-span-1">
                  <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Forma / Canal</span>
                  <span className="font-black text-emerald-700 text-xs sm:text-sm truncate block">
                    {data.dest}
                  </span>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SEÇÃO 3: DECLARAÇÃO FORMAL DE QUITAÇÃO INDIVIDUAL             */}
            {/* ============================================================ */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-slate-700 text-xs relative z-10">
              <span className="text-[10.5px] font-black text-slate-900 uppercase tracking-wider block">
                3. Declaração Formal de Quitação Individual (Art. 320 do Código Civil)
              </span>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Pelo presente recibo oficial, o <b>CREDOR</b> qualificado declara haver recebido do(a) <b>PAGADOR(A)</b> a importância líquida e certa de <b>{data.amount} ({amountInWords})</b>, conferindo-lhe plena, geral e irrevogável quitação <b>exclusivamente e restritamente da Parcela {parsedInstallment.current} de {parsedInstallment.total}</b> referente à aquisição de <b>"{parsedInstallment.product}"</b>, nos termos dos Artigos 319 e 320 do Código Civil Brasileiro e Lei Federal nº 14.063/2020.
              </p>
              <div className="pt-2 flex items-center justify-between border-t border-slate-200/80 text-[10px] text-slate-500 font-mono flex-wrap gap-1">
                <span>Data do Registro: {data.date}</span>
                <span>Assinatura Digital: {creditorName} ({creditorCompany})</span>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SEÇÃO 4: PAGAMENTOS FUTUROS E CHAVE PIX                       */}
            {/* ============================================================ */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 flex items-center gap-3 relative z-10">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code PIX"
                  className="w-14 h-14 rounded-lg border border-emerald-300 bg-white p-1 shrink-0 shadow-2xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg border border-slate-200 bg-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-slate-400 text-[24px]">qr_code_2</span>
                </div>
              )}
              <div className="min-w-0 text-xs space-y-0.5">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider block">
                  Chave PIX Oficial para Próximas Quitações:
                </span>
                <p className="font-mono font-bold text-slate-900 text-xs sm:text-sm truncate">
                  {creditorPix}
                </p>
                <p className="text-[10px] text-slate-500">
                  Titular: {creditorName} • {creditorCompany}
                </p>
              </div>
            </div>

            {/* Rodapé de auditoria dentro do recibo */}
            <div className="pt-1 border-t border-dashed border-slate-200 text-center relative z-10">
              <span className="text-[9.5px] text-slate-400 font-medium">
                HASPAHO TI • Comprovante de Pagamento Individual de Parcela • Desenvolvido por Tiago Dias
              </span>
            </div>
          </div>

          {/* ============================================================ */}
          {/* BANNER INFORMATIVO: DISTINÇÃO ENTRE RECIBO E EXTRATO         */}
          {/* "Quando é algo total, aí estamos falando de extrato."        */}
          {/* ============================================================ */}
          {onOpenExtratoTotal && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-950 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700 text-[20px] shrink-0">receipt_long</span>
                <div>
                  <span className="font-bold block text-amber-900">
                    Deseja consultar o total consolidado de todas as parcelas pagas?
                  </span>
                  <p className="text-[11px] text-amber-800">
                    O recibo é individual desta parcela. Para ver a soma e o histórico de todas as parcelas, acesse o <b>Extrato Total</b>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExtratoTotal(undefined, currentDebtor?.id || data.debtorId);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                <span>Ver Extrato Total</span>
              </button>
            </div>
          )}

        </div>

        {/* ============================================================ */}
        {/* 3. RODAPÉ FIXO DE AÇÕES (WhatsApp, Baixar PDF)               */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-slate-50 border-t border-slate-200 p-3 sm:p-4 z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Botão Baixar PDF Funcional e em Destaque */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>{isGeneratingPdf ? 'Baixando...' : 'Baixar Recibo (PDF)'}</span>
            </button>

            {/* Botão WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="h-10 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span>WhatsApp</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
