import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Debtor,
  Purchase,
  Installment,
  TransactionRecord,
  UserAccount,
  GeminiAutomationMessage,
  GeminiAutomationResult,
  GeminiTxtFileInfo,
} from '../types';
import {
  sendGeminiAutomationCommand,
  fetchAllClientHistories,
  fetchClientTxtContent,
  syncAllTxtHistories,
  transcribeAudioWithGemini,
} from '../lib/geminiAutomationClient';

interface GeminiAutomationViewProps {
  currentUser: UserAccount | null;
  debtors: Debtor[];
  purchases: Purchase[];
  installments: Installment[];
  transactions: TransactionRecord[];
  onApplyMutations: (mutations: NonNullable<GeminiAutomationResult['mutations']>) => void;
  onNavigateToDebtor?: (debtorId: string) => void;
  onClose?: () => void;
}

export const GeminiAutomationView: React.FC<GeminiAutomationViewProps> = ({
  currentUser,
  debtors,
  purchases,
  installments,
  transactions,
  onApplyMutations,
  onNavigateToDebtor,
  onClose,
}) => {
  const [messages, setMessages] = useState<GeminiAutomationMessage[]>([
    {
      id: 'welcome',
      sender: 'gemini',
      text: 'Olá! Sou a Automação Inteligente do HASPAHO. Toque no microfone para falar seu comando em tempo real ou digite abaixo para registrar pagamentos, promessas, consultar saldos e atualizar históricos.',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputCommand, setInputCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados de Voz em Tempo Real
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioVolumeLevel, setAudioVolumeLevel] = useState(0);
  const [isGeminiSpeaking, setIsGeminiSpeaking] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isMicBlocked, setIsMicBlocked] = useState(false);
  const [showMicPermissionGuide, setShowMicPermissionGuide] = useState(false);
  const [permissionTestStatus, setPermissionTestStatus] = useState<'idle' | 'testing' | 'granted' | 'denied'>('idle');
  const [mobileVoiceDictationText, setMobileVoiceDictationText] = useState('');

  // Modal de Histórico TXT (Acesso sob demanda sem poluir a tela principal)
  const [showTxtModal, setShowTxtModal] = useState(false);
  const [txtHistories, setTxtHistories] = useState<GeminiTxtFileInfo[]>([]);
  const [selectedTxtContent, setSelectedTxtContent] = useState<{
    clientName: string;
    fileName: string;
    content: string;
  } | null>(null);
  const [isLoadingTxt, setIsLoadingTxt] = useState(false);
  const [isSyncingAllTxt, setIsSyncingAllTxt] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const nativeMicCaptureInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const mobileDictationInputRef = useRef<HTMLTextAreaElement>(null);
  const audioContextRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const speechLiveTextRef = useRef<string>('');
  const isCancellingRef = useRef<boolean>(false);
  const recordingTimerRef = useRef<any>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const isMobileDevice = (() => {
    try {
      if (Capacitor.isNativePlatform()) return true;
      if (typeof navigator !== 'undefined') {
        return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
      }
    } catch {}
    return false;
  })();

  // Auto-scroll para a mensagem mais recente
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing, isListening]);

  // Carrega e atualiza vozes nativas do navegador para fala contínua
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Síntese de Voz: Gemini fala a resposta em tempo real
  const speakGeminiResponse = useCallback(
    (text: string) => {
      if (!voiceOutputEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

      try {
        window.speechSynthesis.cancel();

        const cleanText = text
          .replace(/[*_#`~]/g, '')
          .replace(/\[.*?\]\(.*?\)/g, '')
          .replace(/https?:\/\/\S+/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const ptVoice =
          voices.find(
            (v) =>
              v.lang === 'pt-BR' &&
              (v.name.includes('Google') ||
                v.name.includes('Natural') ||
                v.name.includes('Luciana') ||
                v.name.includes('Felipe'))
          ) ||
          voices.find((v) => v.lang === 'pt-BR') ||
          voices.find((v) => v.lang.startsWith('pt'));

        if (ptVoice) {
          utterance.voice = ptVoice;
        }

        utterance.onstart = () => setIsGeminiSpeaking(true);
        utterance.onend = () => setIsGeminiSpeaking(false);
        utterance.onerror = () => setIsGeminiSpeaking(false);

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Erro ao falar resposta:', err);
        setIsGeminiSpeaking(false);
      }
    },
    [voiceOutputEnabled]
  );

  const stopGeminiSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsGeminiSpeaking(false);
  };

  // Envio de comando ao Gemini e execução
  const handleSendCommand = async (commandText?: string, forceConfirmed: boolean = false, fromVoice: boolean = false) => {
    const textToSend = (commandText || inputCommand).trim();
    if (!textToSend || isProcessing) return;

    setInputCommand('');
    setInterimTranscript('');
    stopGeminiSpeaking();

    const userMsgId = `msg_u_${Date.now()}`;
    const userMsg: GeminiAutomationMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const result = await sendGeminiAutomationCommand({
        command: textToSend,
        debtors,
        purchases,
        installments,
        transactions,
        currentUser,
        forceConfirmed,
      });

      if (result.mutations) {
        onApplyMutations(result.mutations);
      }

      const geminiMsg: GeminiAutomationMessage = {
        id: `msg_g_${Date.now()}`,
        sender: 'gemini',
        text: result.reply,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        result,
      };

      setMessages((prev) => [...prev, geminiMsg]);

      if (result.reply && (fromVoice || voiceOutputEnabled)) {
        speakGeminiResponse(result.reply);
      }
    } catch (err: any) {
      const errorMsg: GeminiAutomationMessage = {
        id: `msg_err_${Date.now()}`,
        sender: 'gemini',
        text: `Ocorreu um erro ao processar sua instrução: ${err?.message || 'Verifique sua conexão.'}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. Inicia Analisador Acústico em Tempo Real (usando clone do stream para nunca silenciar o MediaRecorder no Android)
  const meterStreamRef = useRef<MediaStream | null>(null);
  const setupAudioVolumeMeter = async (originalStream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const clonedStream = originalStream.clone ? originalStream.clone() : originalStream;
      if (clonedStream !== originalStream) {
        meterStreamRef.current = clonedStream;
      }
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const source = audioCtx.createMediaStreamSource(clonedStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyser || !streamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const computed = Math.min(100, Math.round((avg / 110) * 100));
        setAudioVolumeLevel(computed > 5 ? computed : Math.floor(15 + Math.random() * 25));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (e) {
      console.warn('AudioContext aviso:', e);
    }
  };

  // Fallback Inteligente: Reconhecimento de Voz via WebSpeech (quando getUserMedia falha no WebView)
  const startWebSpeechFallbackListening = (): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRec) {
          resolve(false);
          return;
        }

        const recognition = new SpeechRec();
        recognition.lang = 'pt-BR';
        recognition.continuous = !isMobileDevice;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognitionRef.current = recognition;
        speechLiveTextRef.current = '';
        isCancellingRef.current = false;

        let startedSuccessfully = false;

        recognition.onstart = () => {
          startedSuccessfully = true;
          setIsListening(true);
          setIsMicBlocked(false);
          setVoiceError(null);
          setRecordingSeconds(0);
          setInterimTranscript('Ouvindo sua voz... Fale seu comando agora.');

          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = setInterval(() => {
            setRecordingSeconds((prev) => prev + 1);
            setAudioVolumeLevel(Math.floor(25 + Math.random() * 55));
          }, 500);

          resolve(true);
        };

        recognition.onresult = (event: any) => {
          let fullText = '';
          for (let i = 0; i < event.results.length; ++i) {
            fullText += event.results[i][0].transcript;
          }
          if (fullText) {
            speechLiveTextRef.current = fullText;
            setInterimTranscript(fullText);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('[WebSpeechFallback:ERROR]', e?.error);
          if (!startedSuccessfully) {
            resolve(false);
          }
        };

        recognition.onend = () => {
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          setIsListening(false);
          setAudioVolumeLevel(0);
          setRecordingSeconds(0);

          if (isCancellingRef.current) {
            isCancellingRef.current = false;
            setInterimTranscript('');
            return;
          }

          const finalSpoken = speechLiveTextRef.current?.trim();
          if (finalSpoken && finalSpoken !== 'Ouvindo sua voz... Fale seu comando agora.') {
            setInterimTranscript('');
            speechLiveTextRef.current = '';
            handleSendCommand(finalSpoken, false, true);
          } else {
            setInterimTranscript('');
          }
        };

        recognition.start();
      } catch (err) {
        console.warn('Falha ao iniciar WebSpeech fallback:', err);
        resolve(false);
      }
    });
  };

  // 2. Gravador Principal de Hardware (getUserMedia + MediaRecorder + IA Gemini + Fallback Mobile)
  const startMediaRecorderListening = async () => {
    setVoiceError(null);
    setIsMicBlocked(false);
    setInterimTranscript('Conectando microfone...');
    speechLiveTextRef.current = '';
    isCancellingRef.current = false;
    stopGeminiSpeaking();

    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia indisponível');
      }

      if (isMobileDevice) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      }
    } catch (err: any) {
      console.warn('Erro ao acessar getUserMedia, tentando fallback de voz:', err);

      // Tenta fallback automático via SpeechRecognition antes de exibir erro!
      const fallbackStarted = await startWebSpeechFallbackListening();
      if (fallbackStarted) {
        return;
      }

      setIsListening(false);
      setInterimTranscript('');
      const isNotAllowed =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        String(err?.message || '').toLowerCase().includes('permission') ||
        String(err?.message || '').toLowerCase().includes('denied') ||
        String(err?.message || '').toLowerCase().includes('not allowed');

      if (isNotAllowed || isMobileDevice) {
        setIsMicBlocked(true);
        setShowMicPermissionGuide(true);
        setVoiceError(
          isMobileDevice
            ? 'Microfone direto bloqueado no aparelho. Use o Modo Voz Mobile ou ative a permissão do app Haspaho.'
            : 'Permissão do microfone negada. Clique em "Ativar Voz" para usar ou desbloquear.'
        );
      } else {
        setVoiceError(`Não foi possível acessar o microfone: ${err?.message || 'Verifique o hardware'}`);
      }
      return;
    }

    if (!stream) return;

    streamRef.current = stream;
    setPermissionTestStatus('granted');
    setupAudioVolumeMeter(stream);

    // Determinar MIME Type suportado pelo MediaRecorder (incluindo Android WebView mp4/webm/aac)
    let mimeType = '';
    if (typeof MediaRecorder !== 'undefined') {
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/aac',
      ];
      for (const t of preferredTypes) {
        try {
          if (MediaRecorder.isTypeSupported(t)) {
            mimeType = t;
            break;
          }
        } catch {}
      }
    }

    try {
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setIsListening(true);
        setRecordingSeconds(0);
        setInterimTranscript('Ouvindo fala... Fale seu comando e toque em Concluir.');

        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      };

      recorder.onstop = async () => {
        setIsListening(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioContextRef.current) {
          try {
            audioContextRef.current.close();
          } catch {}
          audioContextRef.current = null;
        }
        setAudioVolumeLevel(0);
        setRecordingSeconds(0);

        if (meterStreamRef.current) {
          meterStreamRef.current.getTracks().forEach((t) => t.stop());
          meterStreamRef.current = null;
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        if (isCancellingRef.current) {
          isCancellingRef.current = false;
          setInterimTranscript('');
          return;
        }

        // 1. Tenta usar texto capturado ao vivo pelo WebSpeech (se houver em desktop)
        const liveSpoken = speechLiveTextRef.current?.trim();
        if (
          liveSpoken &&
          liveSpoken !== 'Ouvindo fala... Fale seu comando e toque em Concluir.' &&
          liveSpoken !== 'Ouvindo fala... Fale seu comando agora.'
        ) {
          setInterimTranscript('');
          speechLiveTextRef.current = '';
          handleSendCommand(liveSpoken, false, true);
          return;
        }

        // 2. Usa áudio gravado e envia ao Gemini para transcrição
        const effectiveMime = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0].trim();
        const audioBlob = new Blob(audioChunksRef.current, { type: effectiveMime });

        if (audioBlob.size < 100) {
          setInterimTranscript('');
          setVoiceError('Áudio muito curto. Toque no microfone, fale seu comando e depois toque em Concluir.');
          return;
        }

        setInterimTranscript('Transcrevendo sua fala com IA Gemini...');
        try {
          const transcript = await transcribeAudioWithGemini(audioBlob);
          if (transcript && transcript.trim()) {
            const spoken = transcript.trim();
            setInterimTranscript('');
            handleSendCommand(spoken, false, true);
          } else {
            setVoiceError('Nenhum comando audível detectado. Fale próximo ao microfone ou use a Voz do Teclado.');
            setInterimTranscript('');
          }
        } catch (err: any) {
          console.warn('Transcrição áudio Gemini aviso:', err);
          setVoiceError(`Não foi possível transcrever o áudio: ${err?.message || 'Verifique sua conexão.'}`);
          setInterimTranscript('');
        }
      };

      try {
        recorder.start(250);
      } catch {
        recorder.start();
      }
      setIsListening(true);

      // IMPORTANTE: No Android/Mobile NÃO iniciamos SpeechRecognition simultaneamente com MediaRecorder
      // pois o Android bloqueia duas capturas de hardware simultâneas no mesmo microfone.
      if (!isMobileDevice) {
        try {
          const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (SpeechRec) {
            const recognition = new SpeechRec();
            recognition.lang = 'pt-BR';
            recognition.continuous = true;
            recognition.interimResults = true;
            recognitionRef.current = recognition;

            recognition.onresult = (event: any) => {
              let fullText = '';
              for (let i = 0; i < event.results.length; ++i) {
                fullText += event.results[i][0].transcript;
              }
              if (fullText) {
                speechLiveTextRef.current = fullText;
                setInterimTranscript(fullText);
              }
            };

            recognition.onerror = () => {};
            recognition.start();
          }
        } catch {}
      }
    } catch (recorderErr: any) {
      console.error('Erro ao iniciar MediaRecorder:', recorderErr);
      if (meterStreamRef.current) {
        meterStreamRef.current.getTracks().forEach((t) => t.stop());
        meterStreamRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      // Se MediaRecorder falhar, tenta o WebSpeech sozinho
      const fallbackStarted = await startWebSpeechFallbackListening();
      if (!fallbackStarted) {
        setIsListening(false);
        setShowMicPermissionGuide(true);
        setVoiceError('Não foi possível iniciar o gravador direto. Use o Modo Voz Mobile.');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.requestData();
      } catch {}
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    } else {
      if (meterStreamRef.current) {
        meterStreamRef.current.getTracks().forEach((t) => t.stop());
        meterStreamRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setIsListening(false);
    setAudioVolumeLevel(0);
    setRecordingSeconds(0);
  };

  const cancelListening = () => {
    isCancellingRef.current = true;
    stopListening();
    setInterimTranscript('');
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startMediaRecorderListening();
    }
  };

  // Testa e solicita permissão do microfone diretamente dentro do Modal de Ajuda
  const handleTestAndRequestMicPermission = async () => {
    setPermissionTestStatus('testing');
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        testStream.getTracks().forEach((t) => t.stop());
        setPermissionTestStatus('granted');
        setIsMicBlocked(false);
        setVoiceError(null);
        setShowMicPermissionGuide(false);
        setTimeout(() => {
          startMediaRecorderListening();
        }, 150);
        return;
      }
      setPermissionTestStatus('denied');
    } catch {
      setPermissionTestStatus('denied');
    }
  };

  const handleAudioFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setShowMicPermissionGuide(false);
    setVoiceError(null);
    setInterimTranscript('Transcrevendo áudio via Gemini...');
    try {
      const transcript = await transcribeAudioWithGemini(file);
      if (transcript && transcript.trim()) {
        const spoken = transcript.trim();
        setInterimTranscript('');
        handleSendCommand(spoken, false, true);
      } else {
        setVoiceError('Nenhum comando audível detectado no áudio.');
        setInterimTranscript('');
      }
    } catch (err) {
      console.warn('Erro ao transcrever arquivo:', err);
      setVoiceError('Não foi possível processar o áudio gravado.');
      setInterimTranscript('');
    } finally {
      if (audioFileInputRef.current) {
        audioFileInputRef.current.value = '';
      }
      if (nativeMicCaptureInputRef.current) {
        nativeMicCaptureInputRef.current.value = '';
      }
    }
  };

  // Carregamento de TXT no Modal Sob Demanda
  const handleOpenTxtModal = async () => {
    setShowTxtModal(true);
    setIsLoadingTxt(true);
    try {
      const list = await fetchAllClientHistories();
      setTxtHistories(list);
    } catch (err) {
      console.warn('Erro TXT:', err);
    } finally {
      setIsLoadingTxt(false);
    }
  };

  const handleSyncAllTxt = async () => {
    setIsSyncingAllTxt(true);
    try {
      await syncAllTxtHistories(debtors, installments);
      const list = await fetchAllClientHistories();
      setTxtHistories(list);
    } catch (err) {
      console.warn('Erro sincronização:', err);
    } finally {
      setIsSyncingAllTxt(false);
    }
  };

  const handleOpenTxtFile = async (folderName: string, fileName: string, clientName: string) => {
    try {
      const content = await fetchClientTxtContent(folderName, fileName);
      setSelectedTxtContent({ clientName, fileName, content });
    } catch {
      setVoiceError('Não foi possível ler o arquivo TXT.');
    }
  };

  const clearChatHistory = () => {
    stopGeminiSpeaking();
    stopListening();
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'gemini',
        text: 'Conversa reiniciada. Fale ou digite o comando que deseja executar.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const quickChips = [
    { label: 'Fábio pagou R$ 150', cmd: 'Gemini, Fábio Dias efetuou um pagamento de R$ 150,00. Salve essa informação.' },
    { label: 'Quanto Fábio deve?', cmd: 'Quanto Fábio Dias ainda deve no aplicativo?' },
    { label: 'Resumo geral', cmd: 'Gere um resumo geral de todos os recebíveis e atrasados do sistema.' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto p-1.5 sm:p-3 flex flex-col h-[calc(100dvh-4.25rem)] sm:h-[calc(100dvh-5rem)] min-h-[440px] max-h-[100dvh] animate-in fade-in duration-200">
      {/* 1. Barra Superior Otimizada & Limpa (Zero Poluição Visual) */}
      <div className="flex items-center justify-between px-2.5 sm:px-4 py-1.5 sm:py-2.5 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md rounded-xl sm:rounded-2xl border border-slate-800 text-white shadow-md shrink-0 mb-1.5 sm:mb-2.5">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={() => {
                stopGeminiSpeaking();
                stopListening();
                onClose();
              }}
              className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
              title="Voltar ao Sistema"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span className="hidden sm:inline">Voltar</span>
            </button>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-tr from-blue-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[17px] sm:text-[18px]">smart_toy</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5 leading-tight truncate">
                <span className="truncate">Automação Gemini</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/30 text-blue-300 border border-blue-400/30 font-bold shrink-0">
                  Tempo Real
                </span>
              </h1>
              <span className="text-[10px] text-slate-400 hidden sm:block truncate">
                Controle financeiro por voz e texto
              </span>
            </div>
          </div>
        </div>

        {/* Controles Rápidos: Resposta Falada, TXT Histórico e Limpar */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Alternar Resposta Falada em Áudio */}
          <button
            type="button"
            onClick={() => {
              if (isGeminiSpeaking) stopGeminiSpeaking();
              setVoiceOutputEnabled(!voiceOutputEnabled);
            }}
            className={`px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
              voiceOutputEnabled
                ? 'bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10'
            }`}
            title={voiceOutputEnabled ? 'Voz do Gemini Ativa (Falar respostas)' : 'Voz do Gemini no Mudo (Somente texto)'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {voiceOutputEnabled ? 'volume_up' : 'volume_off'}
            </span>
            <span className="text-[11px] hidden md:inline">
              {voiceOutputEnabled ? 'Voz Ativa' : 'Mudo'}
            </span>
          </button>

          {/* Botão para Histórico TXT (Abre Modal sem ocupar espaço) */}
          <button
            type="button"
            onClick={handleOpenTxtModal}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
            title="Abrir Histórico em Arquivos TXT"
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            <span className="text-[11px] hidden sm:inline">Arquivos TXT</span>
          </button>

          {/* Limpar Conversa */}
          <button
            type="button"
            onClick={clearChatHistory}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-red-400 border border-white/10 transition-colors cursor-pointer"
            title="Limpar Conversa"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
          </button>
        </div>
      </div>

      {/* 2. Área Central de Conversa (Chat Otimizado) */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden relative">
        {/* Banner Falando: Se o Gemini estiver emitindo áudio em tempo real */}
        {isGeminiSpeaking && (
          <div className="px-4 py-2 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 border-b border-purple-500/30 text-white flex items-center justify-between gap-3 animate-fade-in shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-300 text-lg animate-pulse">
                record_voice_over
              </span>
              <span className="text-xs font-bold text-purple-100">
                Gemini respondendo por voz...
              </span>
            </div>
            <button
              type="button"
              onClick={stopGeminiSpeaking}
              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-sm">stop</span>
              <span>Parar Fala</span>
            </button>
          </div>
        )}

        {/* Banner de Transcrição em Andamento */}
        {!isListening && interimTranscript && (
          <div className="px-4 py-2 bg-cyan-950/90 border-b border-cyan-500/30 text-cyan-200 text-xs font-bold flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-cyan-400 text-base animate-spin">sync</span>
            <span>{interimTranscript}</span>
          </div>
        )}

        {/* Fluxo de Mensagens */}
        <div className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-3.5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 sm:gap-3 max-w-2xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white'
                }`}
              >
                {msg.sender === 'user' ? (
                  (currentUser?.name || 'U').charAt(0).toUpperCase()
                ) : (
                  <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                )}
              </div>

              {/* Balão da Mensagem */}
              <div className={`space-y-1.5 max-w-[85%] ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                <div
                  className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  <p className="whitespace-pre-line font-medium">{msg.text}</p>

                  <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-black/5 dark:border-white/5 text-[10px] opacity-70">
                    <span>{msg.timestamp}</span>

                    {msg.sender === 'gemini' && (
                      <button
                        type="button"
                        onClick={() => speakGeminiResponse(msg.text)}
                        className="hover:underline flex items-center gap-1 cursor-pointer"
                        title="Ouvir esta mensagem novamente"
                      >
                        <span className="material-symbols-outlined text-[13px]">volume_up</span>
                        <span>Ouvir</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Card de Operação Financeira Realizada (Se houver mutação ou cliente) */}
                {msg.result?.clientIdentified && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left text-xs space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-blue-500">person</span>
                        <span>{msg.result.clientIdentified.name}</span>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Saldo: R$ {msg.result.clientIdentified.totalOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {msg.result.intentLabel && (
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        {msg.result.intentLabel}
                      </span>
                    )}

                    {onNavigateToDebtor && (
                      <button
                        type="button"
                        onClick={() => onNavigateToDebtor(msg.result!.clientIdentified!.id)}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        <span>Ver devedor no aplicativo</span>
                        <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Indicador de Processamento */}
          {isProcessing && (
            <div className="flex gap-2.5 max-w-sm mr-auto animate-in fade-in">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-2">
                <span>Gemini interpretando e consultando...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Painel de Conversação por Voz em Tempo Real (Overlay Dinâmico estilo Gemini Live) */}
        {isListening && (
          <div className="absolute inset-x-2 bottom-14 sm:bottom-16 z-20 p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-950/95 backdrop-blur-2xl border border-cyan-400/50 shadow-[0_12px_36px_rgba(0,0,0,0.7),0_0_24px_rgba(6,182,212,0.3)] flex flex-col items-center justify-center gap-2 sm:gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
            {/* Orb Cósmico Gemini Live com Pulso Reativo ao Volume */}
            <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-600 blur-lg sm:blur-xl opacity-75 transition-transform duration-75"
                style={{
                  transform: `scale(${1 + (audioVolumeLevel / 100) * 0.4})`,
                }}
              />
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 shadow-lg flex items-center justify-center border-2 border-white/40">
                <span className="material-symbols-outlined text-white text-xl sm:text-2xl animate-pulse">
                  mic
                </span>
              </div>
            </div>

            {/* Equalizador de Ondas Sonoras */}
            <div className="flex items-center gap-1 h-4 sm:h-5 px-2.5 py-0.5 sm:py-1 rounded-full bg-black/40 border border-white/10">
              <span className="w-1 bg-cyan-400 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, audioVolumeLevel * 0.25)}px` }} />
              <span className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, audioVolumeLevel * 0.5)}px` }} />
              <span className="w-1 bg-purple-400 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, audioVolumeLevel * 0.8)}px` }} />
              <span className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, audioVolumeLevel * 0.5)}px` }} />
              <span className="w-1 bg-cyan-400 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, audioVolumeLevel * 0.25)}px` }} />
            </div>

            {/* Transcrição em Tempo Real da Fala & Tempo Decorrido */}
            <div className="text-center max-w-md w-full px-1">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[11px] sm:text-xs font-black text-cyan-300 uppercase tracking-wider">
                  Gravando Voz em Tempo Real
                </span>
                <span className="font-mono text-[10px] sm:text-xs px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-bold">
                  00:{recordingSeconds.toString().padStart(2, '0')}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-100 font-medium italic min-h-[1.25rem] max-h-16 overflow-y-auto break-words">
                {interimTranscript || 'Fale seu comando agora... (ex: "Fábio pagou 150 reais")'}
              </p>
            </div>

            {/* Botões de Ação na Conversa por Voz */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={stopListening}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>Concluir &amp; Executar</span>
              </button>
              <button
                type="button"
                onClick={cancelListening}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Cancelar</span>
              </button>
            </div>
          </div>
        )}

        {/* Alerta de Permissão ou Erro com Ações Rápidas Mobile */}
        {voiceError && (
          <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-amber-500 text-base shrink-0">warning</span>
              <span className="truncate">{voiceError}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowMicPermissionGuide(true)}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] cursor-pointer"
              >
                Usar Voz Mobile
              </button>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                className="p-1 rounded-md hover:bg-black/10 text-slate-400 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Barra de Envio Otimizada com Microfone em Destaque */}
        <div className="p-1.5 sm:p-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 shrink-0">
          {/* Chips sutis quando a conversa está no início */}
          {messages.length <= 1 && (
            <div className="mb-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[10px] text-slate-400 font-bold shrink-0">Exemplos:</span>
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendCommand(chip.cmd)}
                  className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-blue-500 transition-colors shrink-0 shadow-2xs cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Input para enviar arquivo de áudio salvo */}
          <input
            type="file"
            ref={audioFileInputRef}
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm,.aac"
            onChange={handleAudioFileUpload}
            className="hidden"
          />

          {/* Input com captura direta pelo gravador nativo do Android/iOS */}
          <input
            type="file"
            ref={nativeMicCaptureInputRef}
            accept="audio/*"
            capture="user"
            onChange={handleAudioFileUpload}
            className="hidden"
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendCommand();
            }}
            className="flex items-center gap-1.5 sm:gap-2"
          >
            {/* BOTÃO HERÓI: MICROFONE CONVERSAÇÃO TEMPO REAL GEMINI */}
            <button
              type="button"
              onClick={toggleListening}
              disabled={isProcessing}
              title={isListening ? 'Toque para concluir fala' : 'Falar com Gemini por voz em tempo real'}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-md ${
                isListening
                  ? 'bg-red-600 text-white scale-105 shadow-red-500/50 shadow-lg animate-pulse'
                  : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-indigo-600/30 hover:scale-105 active:scale-95'
              }`}
            >
              <span className="material-symbols-outlined text-xl sm:text-2xl">
                {isListening ? 'mic_off' : 'mic'}
              </span>
            </button>

            {/* Botão de Enviar Áudio do WhatsApp / Gravador Nativo */}
            <button
              type="button"
              onClick={() => audioFileInputRef.current?.click()}
              disabled={isProcessing}
              title="Enviar áudio do WhatsApp ou gravar pelo celular"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 flex items-center justify-center shrink-0 cursor-pointer transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">audio_file</span>
            </button>

            {/* Campo de Entrada de Texto (Compatível com Ditado de Voz do Teclado Mobile) */}
            <input
              ref={textInputRef}
              type="text"
              value={inputCommand}
              onChange={(e) => setInputCommand(e.target.value)}
              placeholder="Fale no microfone ou digite..."
              disabled={isProcessing}
              className="flex-1 px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 font-medium shadow-2xs min-w-0"
            />

            {/* Botão Enviar */}
            <button
              type="submit"
              disabled={!inputCommand.trim() || isProcessing}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-md cursor-pointer transition-all active:scale-95"
              title="Enviar comando"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">send</span>
            </button>
          </form>
        </div>
      </div>

      {/* 5. Modal de Histórico TXT (Acessado sem poluir a tela principal) */}
      {showTxtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Modal TXT */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400 text-xl">folder_shared</span>
                <div>
                  <h3 className="font-bold text-sm text-white">Histórico de Arquivos TXT</h3>
                  <span className="text-[11px] text-slate-400">/historico_clientes/</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncAllTxt}
                  disabled={isSyncingAllTxt}
                  className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-sm ${isSyncingAllTxt ? 'animate-spin' : ''}`}>sync</span>
                  <span>{isSyncingAllTxt ? 'Sincronizando...' : 'Sincronizar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTxtModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            {/* Conteúdo TXT */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {isLoadingTxt ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
                  <span className="text-xs">Carregando arquivos TXT...</span>
                </div>
              ) : txtHistories.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <span className="material-symbols-outlined text-3xl">folder_off</span>
                  <p className="text-xs">Nenhum arquivo TXT gerado ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {txtHistories.map((folder) => (
                    <div key={folder.folderName} className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2">
                      <div className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-blue-400">folder</span>
                        <span>{folder.clientName}</span>
                      </div>
                      <div className="space-y-1">
                        {folder.files.map((file) => (
                          <div
                            key={file.name}
                            onClick={() => handleOpenTxtFile(folder.folderName, file.name, folder.clientName)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-750 hover:bg-slate-700 text-xs text-slate-200 flex items-center justify-between cursor-pointer"
                          >
                            <span className="truncate">{file.name}</span>
                            <span className="text-[10px] text-slate-400">{Math.max(1, Math.round(file.size / 1024))}KB</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visualizador do Conteúdo do Arquivo TXT */}
      {selectedTxtContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-950 text-slate-100 rounded-3xl shadow-2xl border border-slate-800 w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <span className="font-bold text-xs text-white truncate">{selectedTxtContent.fileName}</span>
              <button
                type="button"
                onClick={() => setSelectedTxtContent(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-300">
              {selectedTxtContent.content}
            </div>
          </div>
        </div>
      )}

      {/* Modal Inteligente: Central de Voz Mobile & Ativação do Microfone no App Haspaho */}
      {showMicPermissionGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-700/80 w-full max-w-md p-4 sm:p-5 space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined text-lg">mic</span>
                </div>
                <div>
                  <h3 className="font-black text-sm text-white leading-tight">
                    Comando de Voz Mobile — Haspaho
                  </h3>
                  <span className="text-[10px] text-cyan-400 font-semibold">
                    3 formas de falar com o Gemini no celular
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMicPermissionGuide(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* OPÇÃO 1: DITADO IMEDIATO PELO MICROFONE DO TECLADO ANDROID (100% COMPATÍVEL) */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-950/80 to-indigo-950/60 border border-blue-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-blue-400">keyboard_voice</span>
                  <span>1. Falar Agora pelo Microfone do Teclado</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  Recomendado
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Toque no campo abaixo para abrir o teclado do seu celular e aperte o ícone de <strong>Microfone 🎤 do teclado</strong> (Samsung / Gboard) para ditar seu comando:
              </p>
              <textarea
                ref={mobileDictationInputRef}
                rows={2}
                value={mobileVoiceDictationText}
                onChange={(e) => setMobileVoiceDictationText(e.target.value)}
                placeholder='Toque aqui e use o microfone 🎤 do teclado (ex: "Fábio pagou 150 reais")...'
                className="w-full p-2.5 rounded-xl bg-slate-950/90 border border-blue-400/40 focus:border-cyan-400 text-xs text-white placeholder-slate-400 outline-hidden resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    mobileDictationInputRef.current?.focus();
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-cyan-500/30 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">keyboard</span>
                  <span>Abrir Teclado de Voz</span>
                </button>
                <button
                  type="button"
                  disabled={!mobileVoiceDictationText.trim()}
                  onClick={() => {
                    const spoken = mobileVoiceDictationText.trim();
                    if (!spoken) return;
                    setMobileVoiceDictationText('');
                    setShowMicPermissionGuide(false);
                    setVoiceError(null);
                    handleSendCommand(spoken, false, true);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>Enviar ao Gemini</span>
                </button>
              </div>
            </div>

            {/* OPÇÃO 2: GRAVADOR NATIVO DO CELULAR */}
            <div className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700 space-y-2">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-purple-400">graphic_eq</span>
                <span>2. Usar Gravador de Voz do Sistema Android</span>
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Abre o gravador nativo do seu aparelho ou permite anexar um áudio salvo e o Gemini transcreve automaticamente:
              </p>
              <button
                type="button"
                onClick={() => nativeMicCaptureInputRef.current?.click()}
                className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-base">mic_external_on</span>
                <span>Abrir Gravador de Voz do Celular</span>
              </button>
            </div>

            {/* OPÇÃO 3: LIBERAR PERMISSÃO DO APP HASPAHO NO ANDROID */}
            <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/80 space-y-2">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-amber-400">settings_applications</span>
                <span>3. Liberar Permissão no App Haspaho</span>
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                No celular Android: abra <strong>Configurações → Aplicativos → Haspaho → Permissões → Microfone</strong> e marque <strong>Permitir durante o uso do app</strong>.
              </p>
              <button
                type="button"
                onClick={handleTestAndRequestMicPermission}
                disabled={permissionTestStatus === 'testing'}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">
                  {permissionTestStatus === 'testing' ? 'sync' : 'verified_user'}
                </span>
                <span>
                  {permissionTestStatus === 'testing'
                    ? 'Testando Microfone...'
                    : 'Testar / Solicitar Microfone Agora'}
                </span>
              </button>
              {permissionTestStatus === 'denied' && (
                <p className="text-[10.5px] text-amber-300 font-medium text-center">
                  O sistema Android ainda bloqueou o acesso direto. Use a Opção 1 (Teclado de Voz) ou Opção 2 acima!
                </p>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowMicPermissionGuide(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
