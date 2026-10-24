import React, { useState, useEffect, useRef } from 'react';
import { UserAccount, ScreenTab } from '../types';
import { HaspahoLogo } from './HaspahoLogo';

interface HaspahoAutomatedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserAccount | null;
  onNavigateToTab?: (tab: ScreenTab) => void;
  isDarkMode?: boolean;
}

interface ChapterStep {
  stepNumber: number;
  label: string;
  tagline: string;
  actionText: string;
}

interface DemoChapter {
  id: string;
  chapterNumber: number;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  summary: string;
  icon: string;
  iconBg: string;
  targetTab: ScreenTab;
  tabButtonLabel: string;
  steps: ChapterStep[];
  highlights: string[];
}

const DEMO_CHAPTERS: DemoChapter[] = [
  {
    id: 'adicionar_cliente',
    chapterNumber: 1,
    badge: 'Módulo 1 • Base de Clientes',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    title: 'Como Adicionar Cliente & Devedor',
    subtitle: 'Cadastro com Score de Pontualidade e Pasta de Auditoria Automática',
    summary:
      'Cadastre clientes em segundos com CPF, WhatsApp e limite de crédito. O sistema cria automaticamente a pasta do cliente em /historico_clientes/ com arquivos TXT para auditoria.',
    icon: 'person_add',
    iconBg: 'from-emerald-600 to-teal-700',
    targetTab: 'devedores',
    tabButtonLabel: 'Ir para Ficha de Devedores',
    steps: [
      {
        stepNumber: 1,
        label: 'Preenchimento Rápido',
        tagline: 'Nome, CPF, WhatsApp e Limite Inicial',
        actionText: 'Digitando dados do cliente Carlos Eduardo Silva...',
      },
      {
        stepNumber: 2,
        label: 'Score & Diretório TXT',
        tagline: 'Cálculo do Score 850 (Excelente) e criação da pasta oficial',
        actionText: 'Gerando /historico_clientes/carlos_eduardo/ e validando CPF...',
      },
      {
        stepNumber: 3,
        label: 'Cliente Ativo no Sistema',
        tagline: 'Ficha pronta para compras, cobrança WhatsApp e extratos',
        actionText: 'Cliente cadastrado com sucesso! Disponível em todas as telas.',
      },
    ],
    highlights: [
      'Validação de duplicidade de CPF e telefone',
      'Pasta TXT individual criada automaticamente',
      'Score dinâmico de 0 a 1000 pontos',
    ],
  },
  {
    id: 'lancar_compras',
    chapterNumber: 2,
    badge: 'Módulo 2 • Vendas & Parcelamentos',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    title: 'Como Lançar Compras & Gerar Parcelas',
    subtitle: 'Cronograma Automático de Vencimentos em 1 Clique sem Erro de Cálculo',
    summary:
      'Lance produtos vendidos (ex: Notebook, Celular, Móveis). Defina o valor total e o número de parcelas. O HASPAHO calcula todas as datas de vencimento, valores e códigos QR PIX.',
    icon: 'shopping_cart_checkout',
    iconBg: 'from-blue-600 to-indigo-700',
    targetTab: 'parcelas',
    tabButtonLabel: 'Ir para Lançamento de Parcelas',
    steps: [
      {
        stepNumber: 1,
        label: 'Dados da Compra',
        tagline: 'Seleção do cliente, produto e valor total',
        actionText: 'Selecionando Carlos Silva • Notebook Dell Inspiron 15 (R$ 3.600,00)...',
      },
      {
        stepNumber: 2,
        label: 'Divisão em 10x Automática',
        tagline: 'Definição de 10x de R$ 360,00 com vencimento todo dia 10',
        actionText: 'Calculando datas: 10/Abr, 10/Mai, 10/Jun, 10/Jul...',
      },
      {
        stepNumber: 3,
        label: 'Cronograma Salvo & Ativo',
        tagline: '10 parcelas geradas com códigos de autenticação exclusivos',
        actionText: 'Compra lançada! 10 parcelas sincronizadas com o banco e recibos.',
      },
    ],
    highlights: [
      'Cálculo exato de centavos sem discrepância',
      'Datas recorrentes ajustadas com segurança',
      'QR Code Pix gerado para cada parcela',
    ],
  },
  {
    id: 'gestao_devedores',
    chapterNumber: 3,
    badge: 'Módulo 3 • Gestão & Cobrança',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    title: 'Gestão de Devedores, Prazos & Cobrança',
    subtitle: 'Score de Pontualidade, Juros Automáticos e Aviso Amigável no WhatsApp',
    summary:
      'Monitore em tempo real quem está em dia e quem tem parcelas vencendo. Envie lembretes amigáveis com chave PIX pelo WhatsApp em 1 clique sem constrangimento.',
    icon: 'groups',
    iconBg: 'from-amber-600 to-orange-700',
    targetTab: 'devedores',
    tabButtonLabel: 'Ver Painel de Cobrança',
    steps: [
      {
        stepNumber: 1,
        label: 'Visão Geral dos Prazos',
        tagline: 'Filtragem por Em Dia, A Vencer Hoje e Em Atraso',
        actionText: 'Filtrando devedores com pagamentos previstos para esta semana...',
      },
      {
        stepNumber: 2,
        label: 'Juros & Multa Inteligentes',
        tagline: 'Cálculo diário automático conforme configuração do sistema',
        actionText: 'Aplicando cálculo automático de mora sem rasura ou conta manual...',
      },
      {
        stepNumber: 3,
        label: 'Lembrete no WhatsApp em 1 Clique',
        tagline: 'Mensagem profissional com valor, vencimento e chave PIX',
        actionText: 'Mensagem gerada e enviada via WhatsApp com comprovante anexado!',
      },
    ],
    highlights: [
      'Avisos com texto educado e profissional',
      'Chave PIX pronta para o cliente copiar e colar',
      'Histórico de cobranças registrado na ficha',
    ],
  },
  {
    id: 'baixa_pix_gemini',
    chapterNumber: 4,
    badge: 'Módulo 4 • Automação por IA & Voz',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    title: 'Baixa de Parcelas, Rateio PIX & Voz Gemini',
    subtitle: 'Scanner de Comprovantes com Rateio entre Múltiplas Compras',
    summary:
      'Recebeu um PIX de R$ 720,00 para duas compras diferentes? O Gemini identifica o pagador, quita a parcela 01 da TV e a parcela 03 do Celular sem misturar as contas.',
    icon: 'smart_toy',
    iconBg: 'from-cyan-600 to-blue-700',
    targetTab: 'gemini-automacao',
    tabButtonLabel: 'Abrir Automação Gemini',
    steps: [
      {
        stepNumber: 1,
        label: 'Recebimento do Comprovante ou Voz',
        tagline: 'Envio de print PIX ou comando por voz em português',
        actionText: 'Voz detectada: "Baixar parcela 01 de Carlos Silva via PIX"...',
      },
      {
        stepNumber: 2,
        label: 'Rateio Inteligente Gemini',
        tagline: 'Leitura do pagador, autenticação bancária e distribuição',
        actionText: 'IA identifica Carlos Silva • Rateando R$ 360,00 na Compra Notebook...',
      },
      {
        stepNumber: 3,
        label: 'Parcela Liquidada com Recibo',
        tagline: 'Status alterado para PAGO com carimbo de autenticação',
        actionText: 'Parcela baixada! Recibo oficial e extrato atualizados na hora.',
      },
    ],
    highlights: [
      'Comandos por voz e transcrição em tempo real',
      'Rateio entre compras simultâneas do mesmo devedor',
      'Proteção contra duplicidade de comprovante bancário',
    ],
  },
  {
    id: 'base_sistema',
    chapterNumber: 5,
    badge: 'Módulo 5 • Arquitetura Oficial',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    title: 'A Base do Sistema: Estrutura & Auditoria',
    subtitle: 'Ficha Financeira Central, Histórico em TXT e Nuvem Segura',
    summary:
      'Entenda como o HASPAHO conecta clientes, compras, cartões e parcelas. Seus dados contam com dupla persistência: offline imediata e nuvem privada no Firebase.',
    icon: 'verified_user',
    iconBg: 'from-purple-600 to-indigo-800',
    targetTab: 'dashboard',
    tabButtonLabel: 'Ver Dashboard Geral',
    steps: [
      {
        stepNumber: 1,
        label: 'Ficha Unificada',
        tagline: 'Conexão entre cliente, compras, cartões e transações',
        actionText: 'Acessando a base central de dados consolidados do operador...',
      },
      {
        stepNumber: 2,
        label: 'Auditoria em Arquivos TXT',
        tagline: 'Histórico aberto e legível salvo em /historico_clientes/',
        actionText: 'Sincronizando cadastro.txt, movimentacoes.txt e pagamentos.txt...',
      },
      {
        stepNumber: 3,
        label: 'Nuvem Firebase em Tempo Real',
        tagline: 'Isolamento de dados por usuário com backup contínuo',
        actionText: 'Base segura e autenticada! Nenhum dado é perdido ao fechar o app.',
      },
    ],
    highlights: [
      'Exportação e leitura de arquivos TXT sem restrição',
      'Sincronização em tempo real com Firestore',
      'Auditoria de cada pagamento com data, hora e operador',
    ],
  },
];

const SUBSTEP_DURATION_MS = 3800; // ~3.8s por sub-etapa em velocidade 1.0x

export const HaspahoAutomatedTourModal: React.FC<HaspahoAutomatedTourModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onNavigateToTab,
  isDarkMode = false,
}) => {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentSubStepIndex, setCurrentSubStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [stepProgress, setStepProgress] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const currentChapter = DEMO_CHAPTERS[currentChapterIndex];
  const currentStep = currentChapter.steps[currentSubStepIndex];

  // Total elapsed time simulation
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Playback loop controller
  useEffect(() => {
    if (!isOpen) {
      setStepProgress(0);
      return;
    }

    if (!isPlaying) return;

    const intervalMs = 50;
    const effectiveStepDuration = SUBSTEP_DURATION_MS / playbackSpeed;
    const progressIncrement = (intervalMs / effectiveStepDuration) * 100;

    const timer = setInterval(() => {
      setStepProgress((prev) => {
        const next = prev + progressIncrement;
        if (next >= 100) {
          // Advance sub-step or chapter
          setCurrentSubStepIndex((prevSub) => {
            if (prevSub < currentChapter.steps.length - 1) {
              return prevSub + 1;
            } else {
              // Advance to next chapter
              setCurrentChapterIndex((prevChap) => (prevChap + 1) % DEMO_CHAPTERS.length);
              return 0;
            }
          });
          return 0;
        }
        return next;
      });

      setElapsedSeconds((sec) => sec + (intervalMs / 1000) * playbackSpeed);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, playbackSpeed, currentChapterIndex, currentChapter.steps.length]);

  // Spacebar to pause/play
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextStep();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStep();
      } else if (e.code === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentChapterIndex, currentSubStepIndex]);

  if (!isOpen) return null;

  const handleNextStep = () => {
    setStepProgress(0);
    if (currentSubStepIndex < currentChapter.steps.length - 1) {
      setCurrentSubStepIndex((s) => s + 1);
    } else {
      setCurrentChapterIndex((c) => (c + 1) % DEMO_CHAPTERS.length);
      setCurrentSubStepIndex(0);
    }
  };

  const handlePrevStep = () => {
    setStepProgress(0);
    if (currentSubStepIndex > 0) {
      setCurrentSubStepIndex((s) => s - 1);
    } else {
      setCurrentChapterIndex((c) => (c - 1 + DEMO_CHAPTERS.length) % DEMO_CHAPTERS.length);
      setCurrentSubStepIndex(DEMO_CHAPTERS[(currentChapterIndex - 1 + DEMO_CHAPTERS.length) % DEMO_CHAPTERS.length].steps.length - 1);
    }
  };

  const handleSelectChapter = (idx: number) => {
    setStepProgress(0);
    setCurrentChapterIndex(idx);
    setCurrentSubStepIndex(0);
  };

  const handleSelectSubStep = (stepIdx: number) => {
    setStepProgress(0);
    setCurrentSubStepIndex(stepIdx);
  };

  const handleRestartDemo = () => {
    setStepProgress(0);
    setCurrentChapterIndex(0);
    setCurrentSubStepIndex(0);
    setElapsedSeconds(0);
    setIsPlaying(true);
  };

  const handleActionClick = () => {
    if (onNavigateToTab) {
      onNavigateToTab(currentChapter.targetTab);
    }
    onClose();
  };

  const toggleSpeed = () => {
    setPlaybackSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1));
  };

  // Format elapsed time string 00:00
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-slate-950 text-slate-100 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in-95 duration-200">
        
        {/* TOP VIDEO PLAYER STATUS BAR */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <HaspahoLogo size="sm" variant="icon" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="font-black text-xs sm:text-sm text-slate-100 tracking-wide uppercase truncate">
                  HASPAHO DEMO PLAYER • VÍDEO DEMONSTRATIVO AO VIVO
                </span>
                <span className="hidden md:inline-flex px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
                  ENGINE 4.2
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {currentUser?.name ? `Operador: ${currentUser.name}` : 'Sessão Oficial Protegida'} • Base do Sistema Demonstrada
              </p>
            </div>
          </div>

          {/* Quick Player Control Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Speed Toggle */}
            <button
              type="button"
              onClick={toggleSpeed}
              title="Velocidade de Reprodução"
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold border border-slate-700 transition-colors cursor-pointer"
            >
              {playbackSpeed}x
            </button>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              title={isPlaying ? 'Pausar vídeo demonstrativo (Espaço)' : 'Continuar reprodução (Espaço)'}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              <span className="hidden sm:inline">{isPlaying ? 'Pausar' : 'Play'}</span>
            </button>

            {/* Restart */}
            <button
              type="button"
              onClick={handleRestartDemo}
              title="Reiniciar apresentação do início"
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer border border-slate-700"
            >
              <span className="material-symbols-outlined text-[18px]">replay</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              title="Fechar Demonstração (Esc)"
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer border border-slate-700"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* CHAPTER NAVIGATION PILLS (5 CORE MODULES) */}
        <div className="px-3 sm:px-6 py-2.5 bg-slate-900/60 border-b border-slate-800 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-2 min-w-max">
            {DEMO_CHAPTERS.map((chapter, idx) => {
              const isActive = idx === currentChapterIndex;
              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => handleSelectChapter(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm shadow-blue-500/10'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[13px] ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    {chapter.chapterNumber}
                  </span>
                  <span>{chapter.title.split(':')[0]}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* MAIN VIDEO CANVAS & INTERACTIVE SIMULATION */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 space-y-5">
          {/* Chapter Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${currentChapter.badgeColor}`}>
                  {currentChapter.badge}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Etapa {currentSubStepIndex + 1} de {currentChapter.steps.length}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight">
                {currentChapter.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {currentChapter.subtitle}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentChapter.iconBg} text-white flex items-center justify-center shadow-lg`}>
                <span className="material-symbols-outlined text-2xl">{currentChapter.icon}</span>
              </div>
            </div>
          </div>

          {/* SIMULATED VIDEO MONITOR SCREEN */}
          <div className="relative rounded-2xl bg-slate-900 border-2 border-slate-800 shadow-2xl overflow-hidden min-h-[300px] flex flex-col justify-between">
            {/* Monitor Top Frame & Live Action Prompt */}
            <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">AÇÃO DA DEMONSTRAÇÃO:</span>
                <span className="text-slate-200 truncate">{currentStep.actionText}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
                {formatTime(elapsedSeconds)} / 02:30
              </div>
            </div>

            {/* Interactive Screen Simulation Rendered by Chapter & SubStep */}
            <div className="p-4 sm:p-6 flex-1 flex flex-col justify-center">
              {currentChapter.id === 'adicionar_cliente' && (
                <div className="max-w-xl mx-auto w-full space-y-4">
                  {currentSubStepIndex === 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-400 text-sm">person_add</span>
                          Novo Cliente / Devedor
                        </span>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                          Passo 1: Digitação
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase font-bold">Nome Completo</label>
                          <div className="p-2 rounded-lg bg-slate-900 border border-emerald-500/50 text-emerald-300 font-semibold flex items-center justify-between">
                            <span>Carlos Eduardo Silva</span>
                            <span className="w-1.5 h-3 bg-emerald-400 animate-pulse" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase font-bold">WhatsApp / Telefone</label>
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-mono">
                            (11) 98765-4321
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase font-bold">CPF Oficial</label>
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-mono">
                            459.182.730-10
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase font-bold">Limite de Crédito</label>
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 font-bold">
                            R$ 5.000,00
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSubStepIndex === 1 && (
                    <div className="p-5 rounded-xl bg-slate-950/90 border border-emerald-500/40 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-xl animate-spin">sync</span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100">Criando Pasta e Registros TXT Oficiais</div>
                          <div className="text-[11px] text-slate-400 font-mono">/historico_clientes/carlos_eduardo_silva/</div>
                        </div>
                      </div>
                      <div className="space-y-1.5 font-mono text-[11px] bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-300">
                        <div className="flex items-center justify-between text-emerald-400">
                          <span>✓ cadastro.txt criado</span>
                          <span>Autenticado</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-400">
                          <span>✓ movimentacoes.txt inicializado</span>
                          <span>Timestamp UTC</span>
                        </div>
                        <div className="flex items-center justify-between text-cyan-400">
                          <span>✓ Score Inicial Calculado: 850 pts</span>
                          <span className="font-bold">EXCELENTE</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSubStepIndex === 2 && (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-emerald-500/50 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-black text-lg">
                            CS
                          </div>
                          <div>
                            <div className="font-black text-sm text-slate-100 flex items-center gap-2">
                              Carlos Eduardo Silva
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                                ATIVO
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono">(11) 98765-4321 • CPF 459.***.***-10</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Score Pontualidade</div>
                          <div className="text-base font-black text-emerald-400">850 / 1000</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Compras Ativas</div>
                          <div className="text-xs font-bold text-slate-200">0 (Pronto p/ lançar)</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Limite Disp.</div>
                          <div className="text-xs font-bold text-emerald-400">R$ 5.000,00</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                          <div className="text-[10px] text-slate-400">Status</div>
                          <div className="text-xs font-bold text-blue-400">Sem Pendências</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentChapter.id === 'lancar_compras' && (
                <div className="max-w-xl mx-auto w-full space-y-4">
                  {currentSubStepIndex === 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                          <span className="material-symbols-outlined text-blue-400 text-sm">shopping_cart</span>
                          Lançamento de Nova Compra
                        </span>
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                          Passo 1: Detalhes
                        </span>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-between">
                          <span className="text-slate-400">Devedor Selecionado:</span>
                          <span className="font-bold text-slate-200">Carlos Eduardo Silva</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-blue-500/60 flex items-center justify-between">
                          <span className="text-slate-400">Produto / Item:</span>
                          <span className="font-bold text-blue-300">Notebook Dell Inspiron 15</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-700">
                            <span className="text-[10px] text-slate-400 block">Valor Total</span>
                            <span className="font-black text-slate-100 text-sm">R$ 3.600,00</span>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-700">
                            <span className="text-[10px] text-slate-400 block">Condição</span>
                            <span className="font-black text-emerald-400 text-sm">10x Parcelas</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSubStepIndex === 1 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-blue-500/40 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                          <span className="material-symbols-outlined text-blue-400 text-sm animate-spin">calculate</span>
                          Motor HASPAHO Gerando Vencimentos Automáticos
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">10 x R$ 360,00</span>
                      </div>
                      <div className="space-y-1.5 font-mono text-[11px] bg-slate-900 p-3 rounded-lg border border-slate-800">
                        <div className="flex justify-between text-slate-300">
                          <span>Parc 01/10 • Vencimento: 10/Abril</span>
                          <span className="text-emerald-400 font-bold">R$ 360,00</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Parc 02/10 • Vencimento: 10/Maio</span>
                          <span className="text-emerald-400 font-bold">R$ 360,00</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Parc 03/10 • Vencimento: 10/Junho</span>
                          <span className="text-emerald-400 font-bold">R$ 360,00</span>
                        </div>
                        <div className="text-slate-500 text-[10px] text-center pt-1 border-t border-slate-800">
                          ... até Parcela 10/10 (10/Janeiro) calculada com código individual
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSubStepIndex === 2 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/50 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-400 text-sm">verified</span>
                          Compra & Parcelas Gravadas com Sucesso
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                          10x ATIVAS
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-200">Notebook Dell Inspiron 15</div>
                          <div className="text-[10px] text-slate-400 font-mono">Total: R$ 3.600,00 • Cliente: Carlos Silva</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400">1ª Parcela Vence</div>
                          <div className="text-xs font-bold text-amber-400">10/Abril (R$ 360,00)</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                        <span className="material-symbols-outlined text-blue-400 text-sm">qr_code_2</span>
                        <span>QR Code PIX e chave prontos para envio imediato ao comprador.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentChapter.id === 'gestao_devedores' && (
                <div className="max-w-xl mx-auto w-full space-y-4">
                  {currentSubStepIndex === 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
                      <div className="text-xs font-bold text-slate-300 pb-1 border-b border-slate-800 flex items-center justify-between">
                        <span>Painel de Monitoramento de Cobrança</span>
                        <span className="text-[10px] text-amber-400 font-mono">Filtros Inteligentes</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-emerald-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="font-bold text-slate-200">Carlos Silva</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold text-[10px]">
                            EM DIA • Score 850
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-rose-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                            <span className="font-bold text-slate-200">Marcos Oliveira</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 font-bold text-[10px]">
                            ATRASADO (4 DIAS) • Score 420
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSubStepIndex === 1 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-amber-500/40 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <span className="material-symbols-outlined text-amber-400 text-sm">trending_up</span>
                          Cálculo de Juros Diários e Multa
                        </span>
                        <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                          +4 DIAS
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5 font-mono">
                        <div className="flex justify-between text-slate-300">
                          <span>Valor Original da Parcela:</span>
                          <span>R$ 360,00</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>Multa Contratual (2%):</span>
                          <span>+ R$ 7,20</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>Juros Mora Diária:</span>
                          <span>+ R$ 1,44</span>
                        </div>
                        <div className="flex justify-between text-amber-400 font-bold pt-1 border-t border-slate-800 text-sm">
                          <span>Total Atualizado para Cobrança:</span>
                          <span>R$ 368,64</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSubStepIndex === 2 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/50 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-400 text-sm">send</span>
                          Cobrança Amigável via WhatsApp Gerada
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">1 Toque</span>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-slate-200 space-y-2">
                        <p className="text-[11px] leading-relaxed text-slate-300 italic">
                          "Olá Marcos, tudo bem? Lembrando da parcela de R$ 368,64 do seu parcelamento no HASPAHO. Chave PIX: financeiro@haspaho.com. Segue recibo atualizado."
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20 text-[10px]">
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">done_all</span>
                            Pronto para envio sem atrito
                          </span>
                          <span className="text-slate-400 font-mono">PIX Copia e Cola Incluso</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentChapter.id === 'baixa_pix_gemini' && (
                <div className="max-w-xl mx-auto w-full space-y-4">
                  {currentSubStepIndex === 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-cyan-500/40 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                        <span className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                          <span className="material-symbols-outlined text-cyan-400 text-sm">mic</span>
                          Comando por Voz ou Print de PIX
                        </span>
                        <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-bold">
                          Entrada Inteligente
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-xl animate-pulse">graphic_eq</span>
                        </div>
                        <div className="text-xs">
                          <div className="font-bold text-slate-200">Áudio do Operador Detectado:</div>
                          <div className="text-cyan-300 font-mono text-[11px]">
                            "Gemini, recebi R$ 720,00 de Carlos Silva via PIX. Baixar parcelas dele."
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSubStepIndex === 1 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-cyan-500/50 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-100 flex items-center gap-2">
                          <span className="material-symbols-outlined text-cyan-400 text-sm">splitscreen</span>
                          Rateio Inteligente entre Compras Diferentes
                        </span>
                        <span className="text-[10px] text-emerald-400 font-bold">Total PIX: R$ 720,00</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-emerald-500/40 space-y-1">
                          <span className="text-[10px] text-slate-400 block">Compra 1: Notebook</span>
                          <span className="text-emerald-400 font-bold block">R$ 360,00</span>
                          <span className="text-[10px] text-slate-300">Quita Parcela 01/10</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-emerald-500/40 space-y-1">
                          <span className="text-[10px] text-slate-400 block">Compra 2: Smartphone</span>
                          <span className="text-emerald-400 font-bold block">R$ 360,00</span>
                          <span className="text-[10px] text-slate-300">Quita Parcela 03/05</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 text-center font-mono">
                        As compras são liquidadas sem misturar faturas nem gerar resíduo indevido.
                      </div>
                    </div>
                  )}

                  {currentSubStepIndex === 2 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/50 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-400 text-sm">verified_user</span>
                          Liquidação Oficial Concluída
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                          STATUS: PAGO
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-200">
                          <span className="font-bold">Parcela 01/10 • Notebook Dell</span>
                          <span className="text-emerald-400 font-black">R$ 360,00 [PAGO]</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                          <span>Autenticação: HASP-9842-BAIXA-PIX</span>
                          <span>Recibo PDF Gerado</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentChapter.id === 'base_sistema' && (
                <div className="max-w-xl mx-auto w-full space-y-4">
                  {currentSubStepIndex === 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-purple-500/40 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="text-xs font-bold text-slate-200 pb-1 border-b border-slate-800 flex items-center justify-between">
                        <span>A Espinha Dorsal do HASPAHO</span>
                        <span className="text-[10px] text-purple-400 font-mono">Ficha Unificada</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="material-symbols-outlined text-blue-400 text-lg block mb-1">person</span>
                          <span className="font-bold text-slate-200 block text-[11px]">Devedores</span>
                          <span className="text-[10px] text-slate-400">Score & Contato</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="material-symbols-outlined text-emerald-400 text-lg block mb-1">receipt_long</span>
                          <span className="font-bold text-slate-200 block text-[11px]">Parcelas</span>
                          <span className="text-[10px] text-slate-400">Prazos & PIX</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="material-symbols-outlined text-purple-400 text-lg block mb-1">security</span>
                          <span className="font-bold text-slate-200 block text-[11px]">Auditoria</span>
                          <span className="text-[10px] text-slate-400">Logs & Recibos</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSubStepIndex === 1 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-purple-500/40 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-100 flex items-center gap-2">
                          <span className="material-symbols-outlined text-purple-400 text-sm">history_edu</span>
                          Histórico Oficial em Arquivos TXT Abertos
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">100% Auditável</span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 font-mono text-[11px] text-slate-300 space-y-1 border border-slate-800">
                        <div className="text-purple-400 font-bold">--- /historico_clientes/carlos_silva/movimentacoes.txt ---</div>
                        <div>[2026-10-24 14:02:18] COMPRA: Notebook Dell 10x R$ 360,00 [REGISTRADO]</div>
                        <div className="text-emerald-400">[2026-10-24 14:05:40] PAGAMENTO: R$ 360,00 via PIX (Parc 01) [AUTENTICADO]</div>
                        <div className="text-slate-500">[2026-10-24 14:05:41] SALDO DEVEDOR: R$ 3.240,00 | SCORE: 855</div>
                      </div>
                    </div>
                  )}

                  {currentSubStepIndex === 2 && (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/50 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-400 text-sm">cloud_sync</span>
                          Sincronização em Nuvem Firebase + Local
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                          PROTEGIDO
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-2">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                            Backup automático por ID de usuário
                          </span>
                          <span className="font-mono text-emerald-400 font-bold">Ativo</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                            Operação offline e tolerância a falhas
                          </span>
                          <span className="font-mono text-emerald-400 font-bold">Garantido</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TIMELINE PROGRESS BAR (ACTIVE STEP) */}
            <div className="p-3 bg-slate-950/90 border-t border-slate-800/80 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="font-bold text-slate-200">
                  {currentStep.label}: <span className="font-normal text-slate-400">{currentStep.tagline}</span>
                </span>
                <span>{Math.round(stepProgress)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-75 ease-linear"
                  style={{ width: `${stepProgress}%` }}
                />
              </div>

              {/* Sub-step Dots / Buttons */}
              <div className="flex items-center justify-center gap-2 pt-1">
                {currentChapter.steps.map((st, sIdx) => {
                  const isCurrent = sIdx === currentSubStepIndex;
                  return (
                    <button
                      key={st.stepNumber}
                      type="button"
                      onClick={() => handleSelectSubStep(sIdx)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        isCurrent
                          ? 'w-8 bg-blue-500'
                          : sIdx < currentSubStepIndex
                          ? 'w-2 bg-emerald-500/80'
                          : 'w-2 bg-slate-700 hover:bg-slate-600'
                      }`}
                      title={`Passo ${st.stepNumber}: ${st.label}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3 HIGHLIGHT PILLARS OF THIS MODULE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {currentChapter.highlights.map((h, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-300"
              >
                <span className="material-symbols-outlined text-blue-400 text-base shrink-0">check_circle</span>
                <span className="font-medium leading-tight">{h}</span>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM VIDEO CONTROLS & DIRECT SHORTCUT BAR */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Navigation Controls: Prev Step / Next Step */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
            >
              <span className="material-symbols-outlined text-sm">skip_previous</span>
              <span>Anterior</span>
            </button>

            <button
              type="button"
              onClick={handleNextStep}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
            >
              <span>Próximo</span>
              <span className="material-symbols-outlined text-sm">skip_next</span>
            </button>
          </div>

          {/* Action to Jump into the Live Application Screen */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Fechar Vídeo
            </button>

            <button
              type="button"
              onClick={handleActionClick}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95"
            >
              <span>{currentChapter.tabButtonLabel}</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
