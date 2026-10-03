import React from 'react';
import { UserAccount } from '../types';
import { HaspahoLogo } from './HaspahoLogo';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  if (!isOpen) return null;

  const developerPhone = '14997339863';
  const developerPhoneFormatted = '(14) 99733-9863';
  const whatsappUrl = `https://wa.me/55${developerPhone}?text=${encodeURIComponent(
    `Olá Tiago Dias, acabei de acessar o Sistema HASPAHO de Gestão de Devedores e Pagamentos Parcelados!`
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col animate-in zoom-in-95 duration-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão de Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-950 text-white flex items-center justify-center transition-all cursor-pointer z-40 shadow-md border border-white/20 active:scale-95"
          aria-label="Fechar janela de apresentação"
          title="Fechar"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Top Header Background Banner - Compacto e Elegante */}
        <div className="relative bg-gradient-to-br from-[#061b30] via-[#0b3d66] to-[#041628] pt-4 pb-3.5 px-4 sm:px-6 text-white text-center flex flex-col items-center shrink-0">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Logo Badge Compacto */}
          <div className="p-1.5 sm:p-2 bg-white rounded-xl shadow-md ring-1 ring-emerald-400/40 mb-2 inline-flex items-center justify-center">
            <HaspahoLogo size="xs" variant="horizontal" darkTheme={false} />
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black tracking-wider uppercase mb-1.5">
            <span className="material-symbols-outlined text-[13px]">verified</span>
            Primeiro Acesso Concluído com Sucesso
          </div>

          <h2 className="text-sm sm:text-base font-black text-white leading-tight max-w-md mb-1">
            Seja bem-vindo ao Sistema HASPAHO!
          </h2>

          <p className="text-slate-200 text-[11px] sm:text-xs max-w-sm leading-snug">
            Olá, <strong className="text-white font-bold">{user.name || user.username}</strong>! Sua conta está ativa com controle de parcelas e autenticação digital.
          </p>
        </div>

        {/* Content Body - Sem Barra de Rolagem */}
        <div className="p-3.5 sm:p-4 space-y-2.5 text-slate-700 text-xs flex-1">
          {/* Developer & Company Compact Banner */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50/40 to-emerald-50/50 rounded-xl p-2.5 sm:p-3 border border-blue-200/80 shadow-2xs flex items-center justify-between gap-2.5">
            <div className="min-w-0 space-y-0.5">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-blue-700 bg-blue-100/90 px-1.5 py-0.2 rounded">
                Empresa &amp; Desenvolvimento
              </span>
              <h3 className="text-xs sm:text-[13px] font-black text-slate-900 leading-tight truncate">
                HASPAHO Tecnologia da Informação
              </h3>
              <p className="text-[10.5px] text-slate-600 font-medium truncate">
                Desenvolvido por: <strong className="text-slate-900 font-bold">Profissional Full Stack Tiago Dias</strong>
              </p>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] text-blue-600">location_on</span>
                <span>Mineiros do Tietê, SP • Interior Paulista</span>
              </p>
            </div>

            {/* Direct WhatsApp Contact Button */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer shrink-0"
              title="Abrir WhatsApp Oficial"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-[8px] font-normal opacity-90">Contato Direto</span>
                <span className="font-bold text-[10.5px]">{developerPhoneFormatted}</span>
              </div>
            </a>
          </div>

          {/* Key Features Grid (4 items compactos) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/80 border border-emerald-200/80 flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[15px]">psychology</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-[11px] text-emerald-950 leading-tight">Recepção Autônoma IA</h4>
                  <span className="px-1 py-0.2 rounded bg-emerald-600 text-white text-[8px] font-black uppercase">Novo</span>
                </div>
                <p className="text-[10px] text-emerald-800 leading-tight mt-0.5 line-clamp-2">
                  Envie fotos ou texto para cadastrar clientes e parcelas automaticamente com Gemini.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">table_chart</span>
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-[11px] text-slate-900 leading-tight">Planilha Financeira</h4>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                  Gestão visual de cobranças, quitação rápida com 1 clique e controle em tempo real.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">history_edu</span>
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-[11px] text-slate-900 leading-tight">Contratos &amp; Assinatura</h4>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                  Emissão com valores por extenso, assinatura na tela e PDF oficial autenticado.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[15px]">verified</span>
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-[11px] text-slate-900 leading-tight">Extrato &amp; Autenticação</h4>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                  Chave digital oficial gerada após liquidação e validação de autenticidade.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Compacto */}
        <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 truncate">
            <span className="material-symbols-outlined text-[15px] text-emerald-600">lock</span>
            <span className="truncate">Ambiente Seguro • <strong>{user.email || user.username}</strong></span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-8 sm:h-9 px-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 transition-all cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 sm:h-9 px-4 rounded-xl bg-[#0b3d66] hover:bg-[#07243e] text-white font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <span>Acessar Painel</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
