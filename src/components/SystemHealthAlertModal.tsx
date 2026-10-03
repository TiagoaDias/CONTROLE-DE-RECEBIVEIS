import React, { useState, useEffect } from 'react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { systemHealthSentinel, SystemHealthReport } from '../utils/systemHealthSentinel';
import { capturePanelScreenshot } from '../utils/screenshotHelper';

interface SystemHealthAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
  detectedError?: { message: string; source?: string; stack?: string } | null;
}

export const SystemHealthAlertModal: React.FC<SystemHealthAlertModalProps> = ({
  isOpen,
  onClose,
  onToast,
  detectedError,
}) => {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      handleRunCheck();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunCheck = async () => {
    setIsRunningCheck(true);
    try {
      const rep = await systemHealthSentinel.runDiagnostics();
      setReport(rep);
    } catch {
      // Ignorar erro silencioso
    } finally {
      setIsRunningCheck(false);
    }
  };

  const developerPhone = '5514997339863';
  const developerEmail = 'tiagodias8888@gmail.com';
  const developerName = 'Tiago Dias (Desenvolvedor Full Stack)';

  const handleContactWhatsAppWithScreenshot = async () => {
    try {
      setIsCapturing(true);
      onToast('📸 Capturando print da tela para envio ao desenvolvedor...');
      
      const res = await capturePanelScreenshot(
        document.body,
        `Erro_Sistema_HASPAHO_${Date.now()}.png`
      );

      const errorMessage = detectedError?.message || report?.errorsLogged?.[0]?.message || 'Instabilidade verificada pelo usuário';
      const text = `🚨 *RELATO DE SUPORTE TÉCNICO - SISTEMA HASPAHO*\n\n` +
        `Olá Tiago Dias, desenvolvedor full stack!\n` +
        `Detectei uma questão/instabilidade no sistema:\n\n` +
        `📝 *Detalhes:* ${errorMessage}\n` +
        `🕒 *Data/Hora:* ${new Date().toLocaleString('pt-BR')}\n` +
        `🌐 *Dispositivo:* ${navigator.userAgent.substring(0, 70)}...\n\n` +
        `📸 *Print da Tela:* Acabei de salvar o print em alta resolução nos meus Downloads / Galeria para anexar aqui na conversa.\n\n` +
        `Aguardo seu retorno para resolução. Obrigado!`;

      const url = `https://api.whatsapp.com/send?phone=${developerPhone}&text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      onToast('WhatsApp aberto! Por favor, anexe o print que foi salvo nos seus Downloads.');
    } catch (err) {
      console.warn('Erro ao disparar print de suporte:', err);
      const fallbackUrl = `https://api.whatsapp.com/send?phone=${developerPhone}&text=${encodeURIComponent('Olá Tiago Dias, preciso de suporte técnico no sistema HASPAHO.')}`;
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent('Suporte Técnico / Reporte de Erro - Sistema HASPAHO');
    const body = encodeURIComponent(
      `Olá Tiago Dias,\n\nIdentifiquei a seguinte mensagem no sistema:\n\n${detectedError?.message || 'Solicitação de suporte'}\n\nData: ${new Date().toLocaleString('pt-BR')}\n\n(Segue print em anexo)`
    );
    window.open(`mailto:${developerEmail}?subject=${subject}&body=${body}`);
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto animate-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 border-b border-indigo-500/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-[26px]">health_and_safety</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white leading-tight">
                  Sentinela Inteligente & Suporte Técnico
                </h3>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Online 24/7
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Monitoramento anônimo preventivo e canal direto com o desenvolvedor
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          
          {/* Card de Aviso / Instrução de Suporte */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border-2 border-amber-300/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
              <span className="material-symbols-outlined text-amber-600 text-[22px]">contact_support</span>
              <span>Canal Oficial do Desenvolvedor & Programador Full Stack</span>
            </div>

            <p className="text-slate-700 leading-relaxed text-xs sm:text-[13px]">
              Caso haja algum eventual problema no sistema, programa, software ou aplicativo, entre em contato imediatamente com o desenvolvedor <b>{developerName}</b> pelo WhatsApp no número <b>(14) 99733-9863</b>.
            </p>

            <div className="p-3 bg-white/90 rounded-xl border border-amber-200 text-amber-950 font-medium space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                <span className="material-symbols-outlined text-[16px] text-amber-700">photo_camera</span>
                <span>Instrução Importante:</span>
              </div>
              <p className="text-[11.5px] leading-tight text-slate-700">
                Por favor, <b>tire um print da tela</b> e nos envie junto com a mensagem explicando o que estava fazendo. O mais breve possível a falha será corrigida e resolvida!
              </p>
            </div>

            {/* Ações Rápidas de Contato */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleContactWhatsAppWithScreenshot}
                disabled={isCapturing}
                className="flex-1 min-w-[240px] h-11 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <WhatsAppIcon className="w-5 h-5 text-white" size={19} />
                <span>{isCapturing ? 'Capturando Print...' : '📸 Tirar Print & Abrir WhatsApp de Tiago Dias'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendEmail}
                className="h-11 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px]">mail</span>
                <span>E-mail</span>
              </button>
            </div>
          </div>

          {/* Resultado do Diagnóstico Automatizado */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-blue-600">monitor_heart</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm">
                  Análise Anônima de Integridade em Tempo Real
                </span>
              </div>

              <button
                type="button"
                onClick={handleRunCheck}
                disabled={isRunningCheck}
                className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              >
                <span className={`material-symbols-outlined text-[14px] ${isRunningCheck ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                <span>{isRunningCheck ? 'Verificando...' : 'Reavaliar Agora'}</span>
              </button>
            </div>

            {report && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>Última checagem: <b>{report.lastCheck}</b></span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                    report.status === 'healthy'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : report.status === 'warning'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}>
                    {report.status === 'healthy' ? '✅ Sistema 100% Operacional' : report.status === 'warning' ? '⚠️ Alertas Registrados' : '❌ Falha Identificada'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {report.checks.map((c, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                        c.passed
                          ? 'bg-white border-slate-200 text-slate-700'
                          : 'bg-red-50/80 border-red-200 text-red-900'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${c.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                        {c.passed ? 'check_circle' : 'error'}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-[11px]">{c.name}</div>
                        <div className="text-[10px] text-slate-500 line-clamp-2">{c.details}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dados do Desenvolvedor Responsável */}
          <div className="p-3.5 bg-slate-900 text-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                Engenheiro de Software & Responsável Técnico
              </span>
              <h4 className="font-black text-white text-xs sm:text-sm">
                Tiago Dias • Desenvolvedor Full Stack
              </h4>
              <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                WhatsApp: (14) 99733-9863 • E-mail: tiagodias8888@gmail.com
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              Entendido / Fechar
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
