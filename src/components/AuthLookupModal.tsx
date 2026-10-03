import React, { useState } from 'react';
import { Installment, TransactionRecord } from '../types';
import { HaspahoLogo } from './HaspahoLogo';
import { lookupAuthCode } from '../utils/authRegistry';

interface AuthLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultKey?: string;
  installments?: Installment[];
  transactions?: TransactionRecord[];
  onOpenProof?: (payer: string, amount: string, date: string, dest: string, auth: string, item: string) => void;
}

export const AuthLookupModal: React.FC<AuthLookupModalProps> = ({
  isOpen,
  onClose,
  defaultKey = '',
  installments = [],
  transactions = [],
  onOpenProof,
}) => {
  const [authKey, setAuthKey] = useState(defaultKey);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    auth: string;
    payer: string;
    amount: string;
    date: string;
    bank: string;
    pixKey: string;
    status: string;
    item?: string;
    destination?: string;
  } | null>(null);

  if (!isOpen) return null;

  const performSearch = (queryKey: string) => {
    const cleanKey = queryKey.trim();
    if (!cleanKey) return;

    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);

      const res = lookupAuthCode(cleanKey, installments, transactions);
      if (res.found && res.record) {
        setSearchResult({
          found: true,
          auth: res.record.auth,
          payer: res.record.payer,
          amount: res.record.amount,
          date: res.record.date,
          bank: res.record.bank,
          pixKey: res.record.pixKey || '(14) 99712-0484',
          status: res.record.status,
          item: res.record.item,
          destination: res.record.destination,
        });
        return;
      }

      // Not found
      setSearchResult({
        found: false,
        auth: cleanKey,
        payer: '',
        amount: '',
        date: '',
        bank: '',
        pixKey: '',
        status: 'CHAVE NÃO ENCONTRADA OU INVÁLIDA',
      });
    }, 300);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(authKey);
  };

  const handleQuickKey = (key: string) => {
    setAuthKey(key);
    performSearch(key);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setAuthKey(text.trim());
      }
    } catch {
      // ignore
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleClose = () => {
    setSearchResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden box-border animate-in zoom-in-95 duration-200">
        
        {/* Header Compacto & Elegante */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-emerald-50/20 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 p-1 rounded-xl bg-white shadow-2xs border border-slate-200/80">
              <HaspahoLogo size="sm" variant="icon" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight truncate">
                  Consulta de Autenticação Bancária
                </h3>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                HASPAHO • Validação Oficial de Comprovantes • Asaas IP & BACEN
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            title="Fechar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Corpo do Modal - Sem Rolagem Quando Exibir o Resultado */}
        <div className="p-4 sm:p-5 flex-1">
          {searchResult && searchResult.found ? (
            /* ============================================================== */
            /* TELA DE RESULTADO: TODAS AS INFORMAÇÕES VISÍVEIS DE UMA VEZ   */
            /* ============================================================== */
            <div className="space-y-3 animate-in fade-in zoom-in-98 duration-200">
              {/* Barra de Status & Ação Nova Busca */}
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-1.5 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[17px] text-emerald-600 shrink-0">
                    verified
                  </span>
                  <span className="text-[11px] sm:text-xs font-black text-emerald-900 uppercase tracking-wide truncate">
                    {searchResult.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSearchResult(null)}
                    className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-white hover:bg-emerald-100/50 px-2.5 py-0.5 rounded-lg border border-emerald-300 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Fazer nova consulta"
                  >
                    <span className="material-symbols-outlined text-[13px]">search</span>
                    <span>Nova Busca</span>
                  </button>
                  <span className="text-[9px] font-black text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    ASAAS • BACEN
                  </span>
                </div>
              </div>

              {/* Linha de Destaque: Protocolo + Valor */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                      Protocolo / Auth
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(searchResult.auth)}
                      className="text-[9px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 cursor-pointer bg-white px-1.5 py-0.5 rounded border border-slate-200"
                    >
                      <span className="material-symbols-outlined text-[11px]">
                        {copiedKey ? 'check' : 'content_copy'}
                      </span>
                      {copiedKey ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <span className="font-mono font-bold text-slate-900 text-[11px] sm:text-xs truncate mt-1">
                    {searchResult.auth}
                  </span>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 flex flex-col justify-between">
                  <span className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">
                    Valor Liquidado
                  </span>
                  <span className="font-black text-emerald-700 text-lg sm:text-xl leading-tight mt-0.5">
                    {searchResult.amount}
                  </span>
                </div>
              </div>

              {/* Card Central Compacto com Dados Completos */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-100">
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">
                      Pagador / Devedor
                    </span>
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm truncate block mt-0.5">
                      {searchResult.payer}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">
                      Data e Horário
                    </span>
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate block mt-0.5">
                      {searchResult.date}
                    </span>
                  </div>
                </div>

                <div className="pb-2 border-b border-slate-100 min-w-0">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">
                    Item / Parcela Vinculada
                  </span>
                  <span className="font-bold text-slate-900 text-xs sm:text-sm truncate block mt-0.5">
                    {searchResult.item}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pb-1.5 border-b border-slate-100">
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">
                      Instituição Liquidante
                    </span>
                    <span className="font-medium text-slate-800 text-[11px] truncate block mt-0.5">
                      {searchResult.bank}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">
                      Chave PIX Destino
                    </span>
                    <span className="font-mono font-semibold text-slate-800 text-[11px] truncate block mt-0.5">
                      {searchResult.pixKey}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">
                    Destinatário
                  </span>
                  <span className="font-bold text-slate-900">
                    {searchResult.destination || 'Tiago Dias (Credor)'}
                  </span>
                </div>
              </div>

              {/* Botão de Ação Primária */}
              {onOpenProof && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenProof(
                      searchResult.payer,
                      searchResult.amount,
                      searchResult.date,
                      searchResult.destination || 'Tiago Dias (Credor)',
                      searchResult.auth,
                      searchResult.item || 'Parcela'
                    );
                    handleClose();
                  }}
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:from-emerald-800 active:to-teal-900 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <span className="material-symbols-outlined text-[19px]">receipt_long</span>
                  <span>Abrir Recibo Oficial Completo & Opções</span>
                </button>
              )}
            </div>
          ) : searchResult && !searchResult.found ? (
            /* ============================================================== */
            /* QUANDO NÃO ENCONTRADO: AVISO + BOTÃO PARA DIGITAR OUTRO       */
            /* ============================================================== */
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">error</span>
                </div>
                <h4 className="font-bold text-red-900 text-sm">Chave Não Encontrada</h4>
                <p className="text-xs text-red-700 max-w-sm mx-auto leading-relaxed">
                  Não localizamos comprovante para o protocolo <code className="font-mono font-bold">{searchResult.auth}</code>.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchResult(null)}
                  className="mt-2 px-4 py-2 bg-white text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>Tentar Outro Código</span>
                </button>
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* TELA INICIAL: FORMULÁRIO DE BUSCA + EXEMPLOS RÁPIDOS          */
            /* ============================================================== */
            <form onSubmit={handleSearch} className="space-y-3.5 animate-in fade-in duration-200">
              <div>
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wide mb-2">
                  <span className="material-symbols-outlined text-[17px] text-emerald-600">shield_lock</span>
                  Chave ou Protocolo de Autenticação
                </label>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="ex: E18236128202609191432"
                      value={authKey}
                      onChange={(e) => setAuthKey(e.target.value)}
                      className="w-full h-12 pl-3.5 pr-16 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-600 focus:ring-3 focus:ring-emerald-500/15 outline-none transition-all shadow-inner"
                      required
                    />
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg text-[10px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                      title="Colar da área de transferência"
                    >
                      <span className="material-symbols-outlined text-[12px]">content_paste</span>
                      <span>Colar</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isSearching}
                    className="h-12 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:from-emerald-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isSearching ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">search</span>
                    )}
                    <span>Consultar</span>
                  </button>
                </div>
              </div>

              {/* Exemplos Rápidos com 1 Clique */}
              <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200/80 space-y-2">
                <span className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                  Exemplos Rápidos Disponíveis:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickKey('E18236128202609191432')}
                    className="p-2.5 bg-white hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-black text-emerald-800 group-hover:text-emerald-900">
                        E18236128202609191432
                      </span>
                      <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                        R$ 170,00
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium truncate">
                      Jucelia Aizza • Smart TV (Parcela 1/18)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickKey('E18236128202609201550')}
                    className="p-2.5 bg-white hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-black text-emerald-800 group-hover:text-emerald-900">
                        E18236128202609201550
                      </span>
                      <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                        R$ 180,00
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium truncate">
                      Aline Ferreira • Fogão (Parcela 1/10)
                    </p>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Rodapé Compacto */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] sm:text-[11px] font-semibold truncate">
            <span className="material-symbols-outlined text-[15px] text-emerald-600 shrink-0">verified_user</span>
            <span className="truncate">Ambiente Criptografado TLS 256-bit • Asaas IP</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {searchResult && (
              <button
                type="button"
                onClick={() => setSearchResult(null)}
                className="px-3 h-8.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Nova Busca
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="px-4 h-8.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
            >
              Fechar Consulta
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
