import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

interface HaspahoNativeInterface {
  hasRecordAudioPermission?: () => boolean;
  requestRecordAudioPermission?: () => void;
  startNativeVoiceRecognition?: () => void;
  openAppPermissionSettings?: () => void;
}

declare global {
  interface Window {
    HaspahoNative?: HaspahoNativeInterface;
  }
}

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
      text: 'Olá! Toque no microfone 🎤 para falar, escolha um atalho acima ou digite abaixo para registrar baixas, promessas e consultar saldos.',
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

  // Modal de Histórico TXT
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
  const meterStreamRef = useRef<MediaStream | null>(null);
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

  const isMobileDevice = useMemo(() => {
    try {
      if (Capacitor.isNativePlatform()) return true;
      if (typeof window !== 'undefined' && window.HaspahoNative) return true;
      if (typeof navigator !== 'undefined') {
        return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
      }
    } catch {}
    return false;
  }, []);

  // KPIs rápidos para aproveitar o espaço superior com utilidade real
  const stats = useMemo(() => {
    const totalReceivable = debtors.reduce((acc, d) => acc + (d.totalOwed || 0), 0);
    const totalPaid = debtors.reduce((acc, d) => acc + (d.totalPaid || 0), 0);
    const overdueCount = installments.filter((i) => i.status === 'overdue').length;
    return { totalReceivable, totalPaid, overdueCount };
  }, [debtors, installments]);

  // Auto-scroll para a mensagem mais recente
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing, isListening]);

  // Carrega vozes nativas do navegador
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
  const handleSendCommand = useCallback(
    async (commandText?: string, forceConfirmed: boolean = false, fromVoice: boolean = false) => {
      const textToSend = (commandText ?? inputCommand).trim();
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
          text: `Erro ao processar instrução: ${err?.message || 'Verifique sua conexão.'}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsProcessing(false);
      }
    },
    [inputCommand, isProcessing, debtors, purchases, installments, transactions, currentUser, onApplyMutations, voiceOutputEnabled, speakGeminiResponse]
  );

  // Escuta eventos nativos enviados pelo MainActivity.java do APK Android Haspaho
  useEffect(() => {
    const onNativePermissionResult = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.granted) {
        setIsMicBlocked(false);
        setVoiceError(null);
        setPermissionTestStatus('granted');
        setShowMicPermissionGuide(false);
        setTimeout(() => {
          startVoiceCaptureFlow(true);
        }, 120);
      } else {
        setPermissionTestStatus('denied');
        setIsMicBlocked(true);
        if (detail?.permanentlyDenied && window.HaspahoNative?.startNativeVoiceRecognition) {
          // Abre direto o reconhecedor de voz nativo do sistema Android como contingência imediata
          window.HaspahoNative.startNativeVoiceRecognition();
        } else {
          setShowMicPermissionGuide(true);
          setVoiceError('Permissão negada no Android. Toque em "Liberar no Android" ou use a Voz Nativa.');
        }
      }
    };

    const onNativeSpeechResult = (e: Event) => {
      const text = (e as CustomEvent)?.detail?.text;
      if (text && typeof text === 'string' && text.trim()) {
        setIsListening(false);
        setInterimTranscript('');
        setVoiceError(null);
        setShowMicPermissionGuide(false);
        handleSendCommand(text.trim(), false, true);
      }
    };

    const onNativeSpeechError = (e: Event) => {
      const errText = (e as CustomEvent)?.detail?.error;
      setIsListening(false);
      setInterimTranscript('');
      if (errText) {
        setVoiceError(errText);
      }
    };

    window.addEventListener('haspaho-mic-permission-result', onNativePermissionResult);
    window.addEventListener('haspaho-native-speech-result', onNativeSpeechResult);
    window.addEventListener('haspaho-native-speech-error', onNativeSpeechError);

    return () => {
      window.removeEventListener('haspaho-mic-permission-result', onNativePermissionResult);
      window.removeEventListener('haspaho-native-speech-result', onNativeSpeechResult);
      window.removeEventListener('haspaho-native-speech-error', onNativeSpeechError);
    };
  }, [handleSendCommand]);

  // Analisador Acústico em Tempo Real
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

  // Reconhecimento de Voz em Tempo Real (WebSpeech API - funciona sem limite de cota 429)
  const startWebSpeechRecognition = (): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRec) {
          resolve(false);
          return;
        }

        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
          recognitionRef.current = null;
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
        let settled = false;
        const safeResolve = (val: boolean) => {
          if (!settled) {
            settled = true;
            resolve(val);
          }
        };

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

          safeResolve(true);
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
          const errCode = String(e?.error || '').toLowerCase();
          console.warn('[WebSpeech:ERROR]', errCode);
          if (
            !startedSuccessfully ||
            errCode.includes('not-allowed') ||
            errCode.includes('service-not-allowed') ||
            errCode.includes('audio-capture')
          ) {
            if (recordingTimerRef.current) {
              clearInterval(recordingTimerRef.current);
              recordingTimerRef.current = null;
            }
            setIsListening(false);
            safeResolve(false);
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
        console.warn('Falha ao iniciar WebSpeech:', err);
        resolve(false);
      }
    });
  };

  // Fluxo Principal de Captura de Voz (Compatível com APK Android, Mobile Web e Desktop)
  const startVoiceCaptureFlow = async (skipNativeBridgeCheck: boolean = false) => {
    setVoiceError(null);
    setIsMicBlocked(false);
    speechLiveTextRef.current = '';
    isCancellingRef.current = false;
    stopGeminiSpeaking();

    // 1. Se estiver no APK Android Haspaho com ponte nativa, solicita a permissão do Android ANTES do WebView bloquear
    if (!skipNativeBridgeCheck && typeof window !== 'undefined' && window.HaspahoNative) {
      try {
        const hasPerm = window.HaspahoNative.hasRecordAudioPermission?.();
        if (hasPerm === false && window.HaspahoNative.requestRecordAudioPermission) {
          setInterimTranscript('Solicitando permissão do microfone no Android...');
          window.HaspahoNative.requestRecordAudioPermission();
          return;
        }
      } catch (e) {
        console.warn('Aviso HaspahoNative:', e);
      }
    }

    setInterimTranscript('Ativando microfone...');

    // 2. Abre getUserMedia para garantir o diálogo de permissão do navegador/WebView
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
      console.warn('getUserMedia bloqueado ou falhou, tentando alternativas:', err);

      // Tenta WebSpeech diretamente
      const webSpeechOk = await startWebSpeechRecognition();
      if (webSpeechOk) return;

      // Se estiver no APK Android e possui reconhecedor de voz nativo do sistema Android, abre imediatamente!
      if (typeof window !== 'undefined' && window.HaspahoNative?.startNativeVoiceRecognition) {
        setInterimTranscript('');
        window.HaspahoNative.startNativeVoiceRecognition();
        return;
      }

      setIsListening(false);
      setInterimTranscript('');
      setIsMicBlocked(true);
      setShowMicPermissionGuide(true);
      setVoiceError(
        isMobileDevice
          ? 'Permissão do microfone bloqueada. Toque em "Desbloquear Microfone" para liberar.'
          : 'Permissão do microfone negada no navegador. Clique no cadeado da barra de endereço para permitir.'
      );
      return;
    }

    if (!stream) return;
    setPermissionTestStatus('granted');

    // 3. No Mobile: após confirmar/desbloquear a permissão com getUserMedia, liberamos a trilha bruta e usamos
    // prioritariamente o WebSpeech em tempo real (não consome cota da API Gemini e transcreve na hora!).
    // Se o WebView não suportar WebSpeech, reabrimos o MediaRecorder automaticamente.
    if (isMobileDevice) {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        stream.getTracks().forEach((t) => t.stop());
        const startedMobileSpeech = await startWebSpeechRecognition();
        if (startedMobileSpeech) {
          return;
        }
        // Se WebSpeech falhou no WebView, tenta o Reconhecedor Nativo do Android (se no APK)
        if (typeof window !== 'undefined' && window.HaspahoNative?.startNativeVoiceRecognition) {
          setInterimTranscript('');
          window.HaspahoNative.startNativeVoiceRecognition();
          return;
        }
        // Caso contrário, reabre o stream para gravar com MediaRecorder
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          setIsListening(false);
          setInterimTranscript('');
          setShowMicPermissionGuide(true);
          return;
        }
      }
    }

    streamRef.current = stream;
    setupAudioVolumeMeter(stream);

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

        // 1. Usa texto capturado ao vivo pelo WebSpeech (se disponível)
        const liveSpoken = speechLiveTextRef.current?.trim();
        if (
          liveSpoken &&
          liveSpoken !== 'Ouvindo fala... Fale seu comando e toque em Concluir.' &&
          liveSpoken !== 'Ouvindo sua voz... Fale seu comando agora.'
        ) {
          setInterimTranscript('');
          speechLiveTextRef.current = '';
          handleSendCommand(liveSpoken, false, true);
          return;
        }

        // 2. Transcreve áudio via Gemini
        const effectiveMime = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0].trim();
        const audioBlob = new Blob(audioChunksRef.current, { type: effectiveMime });

        if (audioBlob.size < 100) {
          setInterimTranscript('');
          setVoiceError('Áudio muito curto. Toque no microfone, fale e toque em Concluir.');
          return;
        }

        setInterimTranscript('Transcrevendo fala...');
        try {
          const transcript = await transcribeAudioWithGemini(audioBlob);
          if (transcript && transcript.trim()) {
            setInterimTranscript('');
            handleSendCommand(transcript.trim(), false, true);
          } else {
            setVoiceError('Não foi possível ouvir. Tente novamente ou use o Microfone do Teclado.');
            setInterimTranscript('');
          }
        } catch (err: any) {
          console.warn('Transcrição áudio aviso:', err);
          setInterimTranscript('');
          // Se estiver no APK Android, oferece/abre o reconhecedor nativo do Android que não depende de cota da API
          if (typeof window !== 'undefined' && window.HaspahoNative?.startNativeVoiceRecognition) {
            window.HaspahoNative.startNativeVoiceRecognition();
            return;
          }
          setVoiceError('Limite da API atingido na transcrição. Use o Microfone 🎤 do Teclado abaixo!');
          textInputRef.current?.focus();
        }
      };

      try {
        recorder.start(250);
      } catch {
        recorder.start();
      }
      setIsListening(true);

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
    } catch (recorderErr) {
      console.error('Erro MediaRecorder:', recorderErr);
      if (meterStreamRef.current) {
        meterStreamRef.current.getTracks().forEach((t) => t.stop());
        meterStreamRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const fallbackStarted = await startWebSpeechRecognition();
      if (!fallbackStarted) {
        setIsListening(false);
        setShowMicPermissionGuide(true);
        setVoiceError('Use o botão "Desbloquear Microfone" ou o teclado de voz.');
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
      startVoiceCaptureFlow(false);
    }
  };

  // Testa e solicita permissão do microfone diretamente (Nativo Android + WebView)
  const handleTestAndRequestMicPermission = async () => {
    setPermissionTestStatus('testing');

    // Se estiver dentro do APK Android Haspaho, dispara o popup oficial de permissão do Android
    if (typeof window !== 'undefined' && window.HaspahoNative?.requestRecordAudioPermission) {
      window.HaspahoNative.requestRecordAudioPermission();
      return;
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        testStream.getTracks().forEach((t) => t.stop());
        setPermissionTestStatus('granted');
        setIsMicBlocked(false);
        setVoiceError(null);
        setShowMicPermissionGuide(false);
        setTimeout(() => {
          startVoiceCaptureFlow(true);
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
    setInterimTranscript('Transcrevendo áudio...');
    try {
      const transcript = await transcribeAudioWithGemini(file);
      if (transcript && transcript.trim()) {
        setInterimTranscript('');
        handleSendCommand(transcript.trim(), false, true);
      } else {
        setVoiceError('Nenhum comando audível detectado.');
        setInterimTranscript('');
      }
    } catch {
      setVoiceError('Use o Microfone do Teclado para ditar seu comando.');
      setInterimTranscript('');
    } finally {
      if (audioFileInputRef.current) audioFileInputRef.current.value = '';
      if (nativeMicCaptureInputRef.current) nativeMicCaptureInputRef.current.value = '';
    }
  };

  // Histórico TXT
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
        text: 'Conversa reiniciada. Toque num cliente acima, fale no microfone ou digite abaixo.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const firstDebtorName = debtors[0]?.name || 'Fábio Dias';

  const quickActions = [
    {
      icon: 'payments',
      label: 'Dar Baixa',
      color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
      cmd: `${firstDebtorName} pagou R$ 150,00 confirmado`,
    },
    {
      icon: 'analytics',
      label: 'Resumo Geral',
      color: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30',
      cmd: 'Gere um resumo geral de todos os recebíveis e atrasados do sistema.',
    },
    {
      icon: 'warning',
      label: 'Em Atraso',
      color: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
      cmd: `Quanto ${firstDebtorName} ainda deve no aplicativo?`,
    },
    {
      icon: 'event_upcoming',
      label: 'Promessa',
      color: 'text-purple-300 bg-purple-500/15 border-purple-500/30',
      cmd: `${firstDebtorName} prometeu pagar amanhã via PIX`,
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto pt-1 pb-0.5 flex flex-col h-[calc(100dvh-8.1rem)] md:h-[calc(100dvh-8.75rem)] overflow-hidden animate-in fade-in duration-150">
      {/* 1. Barra Superior Compacta & Proporcional */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md rounded-xl border border-slate-800 text-white shadow-sm shrink-0 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={() => {
                stopGeminiSpeaking();
                stopListening();
                onClose();
              }}
              className="w-7 h-7 rounded-lg hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
              title="Voltar ao Dashboard"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
          )}

          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-2xs shrink-0">
            <span className="material-symbols-outlined text-[14px]">smart_toy</span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-xs font-black text-white truncate leading-none">
              Automação IA
            </h1>
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Voz Ativa
            </span>
          </div>
        </div>

        {/* Botões de Controle Compactos */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Botão Direto para Desbloquear/Ativar Voz Mobile */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.HaspahoNative?.startNativeVoiceRecognition) {
                window.HaspahoNative.startNativeVoiceRecognition();
              } else {
                setShowMicPermissionGuide(true);
              }
            }}
            className="h-7 px-2 rounded-lg bg-blue-600/25 hover:bg-blue-600/40 text-cyan-200 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
            title="Ativar Permissão ou Microfone Nativo do Celular"
          >
            <span className="material-symbols-outlined text-[14px]">settings_voice</span>
            <span className="hidden xs:inline">Permissão</span>
          </button>

          {/* Alternar Resposta Falada */}
          <button
            type="button"
            onClick={() => {
              if (isGeminiSpeaking) stopGeminiSpeaking();
              setVoiceOutputEnabled(!voiceOutputEnabled);
            }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              voiceOutputEnabled
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                : 'bg-white/5 text-slate-400 border border-white/10'
            }`}
            title={voiceOutputEnabled ? 'Voz do Gemini Ativa' : 'Voz no Mudo'}
          >
            <span className="material-symbols-outlined text-[15px]">
              {voiceOutputEnabled ? 'volume_up' : 'volume_off'}
            </span>
          </button>

          {/* Histórico TXT */}
          <button
            type="button"
            onClick={handleOpenTxtModal}
            className="w-7 h-7 sm:w-auto sm:px-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
            title="Histórico em Arquivos TXT"
          >
            <span className="material-symbols-outlined text-[14px]">description</span>
            <span className="hidden sm:inline">TXT</span>
          </button>

          {/* Limpar Conversa */}
          <button
            type="button"
            onClick={clearChatHistory}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-red-400 border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
            title="Limpar Conversa"
          >
            <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
          </button>
        </div>
      </div>

      {/* 2. Card Principal Integrado (Aproveitamento Total do Espaço) */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden relative min-h-0">
        {/* Faixa Superior de Resumo & Atalhos Rápidos (Aproveita o espaço de forma produtiva) */}
        <div className="px-2.5 py-1.5 bg-slate-50/90 dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-800/90 shrink-0 space-y-1.5">
          {/* Linha 1: Mini KPIs + Pílulas de Clientes */}
          <div className="flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                A Receber: R$ {stats.totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              {stats.overdueCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                  {stats.overdueCount} atraso(s)
                </span>
              )}
            </div>

            {/* Pílulas de acesso 1-toque aos clientes */}
            <div className="flex items-center gap-1 shrink-0">
              {debtors.slice(0, 4).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleSendCommand(`Quanto ${d.name} ainda deve no aplicativo?`)}
                  className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shrink-0 flex items-center gap-0.5"
                  title={`Consultar saldo de ${d.name}`}
                >
                  <span className="material-symbols-outlined text-[11px]">person</span>
                  <span className="max-w-[72px] truncate">{d.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Linha 2: 4 Botões de Ação Rápida Compactos */}
          <div className="grid grid-cols-4 gap-1">
            {quickActions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendCommand(act.cmd)}
                disabled={isProcessing}
                className={`px-1.5 py-1 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer truncate ${act.color}`}
              >
                <span className="material-symbols-outlined text-[13px] shrink-0">{act.icon}</span>
                <span className="truncate">{act.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Banner Falando: Se o Gemini estiver emitindo áudio */}
        {isGeminiSpeaking && (
          <div className="px-2.5 py-1 bg-gradient-to-r from-purple-900/70 to-indigo-900/70 border-b border-purple-500/30 text-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-purple-300 text-sm animate-pulse">
                record_voice_over
              </span>
              <span className="text-[10.5px] font-bold text-purple-100">
                Respondendo por voz...
              </span>
            </div>
            <button
              type="button"
              onClick={stopGeminiSpeaking}
              className="px-2 py-0.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">stop</span>
              <span>Parar</span>
            </button>
          </div>
        )}

        {/* Banner de Transcrição em Andamento */}
        {!isListening && interimTranscript && (
          <div className="px-2.5 py-1 bg-cyan-950/90 border-b border-cyan-500/30 text-cyan-200 text-[10.5px] font-bold flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-cyan-400 text-sm animate-spin">sync</span>
            <span className="truncate">{interimTranscript}</span>
          </div>
        )}

        {/* 3. Fluxo de Mensagens Compacto e Proporcional */}
        <div className="flex-1 p-2 sm:p-3 overflow-y-auto space-y-2 min-h-0">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-1.5 sm:gap-2 max-w-xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Avatar Compacto */}
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold shadow-2xs ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white'
                }`}
              >
                {msg.sender === 'user' ? (
                  (currentUser?.name || 'U').charAt(0).toUpperCase()
                ) : (
                  <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                )}
              </div>

              {/* Balão da Mensagem Compacto */}
              <div className={`space-y-1 max-w-[88%] ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                <div
                  className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11.5px] sm:text-xs leading-snug shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-slate-100 dark:bg-slate-800/95 text-slate-900 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  <p className="whitespace-pre-line font-medium">{msg.text}</p>

                  <div className="flex items-center justify-between gap-2 mt-1 pt-0.5 border-t border-black/5 dark:border-white/5 text-[9.5px] opacity-70">
                    <span>{msg.timestamp}</span>

                    {msg.sender === 'gemini' && (
                      <button
                        type="button"
                        onClick={() => speakGeminiResponse(msg.text)}
                        className="hover:underline flex items-center gap-0.5 cursor-pointer"
                        title="Ouvir mensagem"
                      >
                        <span className="material-symbols-outlined text-[11px]">volume_up</span>
                        <span>Ouvir</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Compacto de Operação Financeira */}
                {msg.result?.clientIdentified && (
                  <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left text-[11px] flex items-center justify-between gap-2 shadow-2xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 truncate">
                        <span className="material-symbols-outlined text-xs text-blue-500">person</span>
                        <span className="truncate">{msg.result.clientIdentified.name}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        Saldo: R$ {msg.result.clientIdentified.totalOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {msg.result.intentLabel && (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {msg.result.intentLabel}
                        </span>
                      )}
                      {onNavigateToDebtor && (
                        <button
                          type="button"
                          onClick={() => onNavigateToDebtor(msg.result!.clientIdentified!.id)}
                          className="px-2 py-1 rounded-lg bg-blue-600/15 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-600/25 cursor-pointer flex items-center gap-0.5"
                        >
                          <span>Ficha</span>
                          <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Indicador de Processamento Compacto */}
          {isProcessing && (
            <div className="flex gap-2 max-w-xs mr-auto animate-in fade-in">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined animate-spin text-[13px]">sync</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                <span>Processando comando...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 4. Painel de Voz em Tempo Real Compacto (Overlay) */}
        {isListening && (
          <div className="absolute inset-x-2 bottom-12 z-20 p-2.5 sm:p-3 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-cyan-400/50 shadow-2xl flex flex-col items-center gap-2 animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2.5 w-full justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center border border-white/30 shrink-0">
                  <span className="material-symbols-outlined text-white text-base animate-pulse">mic</span>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10.5px] font-black text-cyan-300 uppercase">
                      Ouvindo Voz
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-200 font-bold">
                      00:{recordingSeconds.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-200 font-medium line-clamp-1">
                    {interimTranscript || 'Fale agora (ex: "Fábio pagou 150 reais")'}
                  </p>
                </div>
              </div>

              {/* Equalizador Compacto */}
              <div className="flex items-center gap-0.5 h-4 px-2 py-0.5 rounded-full bg-black/40 border border-white/10 shrink-0">
                <span className="w-0.5 bg-cyan-400 rounded-full" style={{ height: `${Math.max(4, audioVolumeLevel * 0.18)}px` }} />
                <span className="w-0.5 bg-blue-400 rounded-full" style={{ height: `${Math.max(4, audioVolumeLevel * 0.32)}px` }} />
                <span className="w-0.5 bg-purple-400 rounded-full" style={{ height: `${Math.max(4, audioVolumeLevel * 0.45)}px` }} />
                <span className="w-0.5 bg-blue-400 rounded-full" style={{ height: `${Math.max(4, audioVolumeLevel * 0.32)}px` }} />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={stopListening}
                className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>Concluir &amp; Executar</span>
              </button>
              <button
                type="button"
                onClick={cancelListening}
                className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                <span>Cancelar</span>
              </button>
            </div>
          </div>
        )}

        {/* Alerta Compacto de Permissão/Erro com Botão Direto */}
        {voiceError && (
          <div className="px-2.5 py-1 bg-amber-500/15 border-t border-amber-500/30 text-amber-900 dark:text-amber-200 text-[10.5px] flex items-center justify-between gap-1.5 shrink-0">
            <div className="flex items-center gap-1 min-w-0">
              <span className="material-symbols-outlined text-amber-500 text-sm shrink-0">warning</span>
              <span className="truncate">{voiceError}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.HaspahoNative?.requestRecordAudioPermission) {
                    window.HaspahoNative.requestRecordAudioPermission();
                  } else {
                    setShowMicPermissionGuide(true);
                  }
                }}
                className="px-2 py-0.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] cursor-pointer"
              >
                Desbloquear Microfone
              </button>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                className="p-0.5 rounded hover:bg-black/10 text-slate-400 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          </div>
        )}

        {/* 5. Barra Inferior de Entrada Compacta e Sempre Visível */}
        <div className="p-1.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <input
            type="file"
            ref={audioFileInputRef}
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm,.aac"
            onChange={handleAudioFileUpload}
            className="hidden"
          />
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
            className="flex items-center gap-1.5"
          >
            {/* Botão Principal de Microfone */}
            <button
              type="button"
              onClick={toggleListening}
              disabled={isProcessing}
              title={isListening ? 'Toque para concluir fala' : 'Falar comando por voz'}
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-sm ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white active:scale-95'
              }`}
            >
              <span className="material-symbols-outlined text-[19px]">
                {isListening ? 'mic_off' : 'mic'}
              </span>
            </button>

            {/* Botão de Áudio / Voz Nativa Android */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.HaspahoNative?.startNativeVoiceRecognition) {
                  window.HaspahoNative.startNativeVoiceRecognition();
                } else {
                  audioFileInputRef.current?.click();
                }
              }}
              disabled={isProcessing}
              title="Voz Nativa do Sistema / Enviar arquivo de áudio"
              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-500 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[17px]">graphic_eq</span>
            </button>

            {/* Campo de Texto Compacto */}
            <input
              ref={textInputRef}
              type="text"
              value={inputCommand}
              onChange={(e) => setInputCommand(e.target.value)}
              placeholder="Fale no 🎤 ou digite seu comando..."
              disabled={isProcessing}
              className="flex-1 h-9 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 outline-hidden focus:border-blue-500 font-medium min-w-0"
            />

            {/* Botão Enviar */}
            <button
              type="submit"
              disabled={!inputCommand.trim() || isProcessing}
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-sm cursor-pointer transition-all active:scale-95"
              title="Enviar comando"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Modal de Histórico TXT */}
      {showTxtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 w-full max-w-xl max-h-[82vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400 text-lg">folder_shared</span>
                <div>
                  <h3 className="font-bold text-xs text-white">Histórico de Arquivos TXT</h3>
                  <span className="text-[10px] text-slate-400">/historico_clientes/</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSyncAllTxt}
                  disabled={isSyncingAllTxt}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-xs ${isSyncingAllTxt ? 'animate-spin' : ''}`}>sync</span>
                  <span>{isSyncingAllTxt ? 'Sincronizando...' : 'Sincronizar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTxtModal(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            <div className="p-3 overflow-y-auto flex-1 space-y-2">
              {isLoadingTxt ? (
                <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <span className="material-symbols-outlined animate-spin text-2xl">sync</span>
                  <span className="text-xs">Carregando arquivos TXT...</span>
                </div>
              ) : txtHistories.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-1">
                  <span className="material-symbols-outlined text-2xl">folder_off</span>
                  <p className="text-xs">Nenhum arquivo TXT gerado ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {txtHistories.map((folder) => (
                    <div key={folder.folderName} className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 space-y-1.5">
                      <div className="font-bold text-xs text-white truncate flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-blue-400">folder</span>
                        <span>{folder.clientName}</span>
                      </div>
                      <div className="space-y-1">
                        {folder.files.map((file) => (
                          <div
                            key={file.name}
                            onClick={() => handleOpenTxtFile(folder.folderName, file.name, folder.clientName)}
                            className="px-2 py-1 rounded-lg bg-slate-750 hover:bg-slate-700 text-[11px] text-slate-200 flex items-center justify-between cursor-pointer"
                          >
                            <span className="truncate">{file.name}</span>
                            <span className="text-[9.5px] text-slate-400">{Math.max(1, Math.round(file.size / 1024))}KB</span>
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

      {/* Visualizador TXT */}
      {selectedTxtContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-950 text-slate-100 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <span className="font-bold text-xs text-white truncate">{selectedTxtContent.fileName}</span>
              <button
                type="button"
                onClick={() => setSelectedTxtContent(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-3 overflow-y-auto font-mono text-[11px] whitespace-pre-wrap leading-relaxed text-slate-300">
              {selectedTxtContent.content}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Desbloqueio de Permissão & Voz Mobile */}
      {showMicPermissionGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 w-full max-w-sm p-3.5 space-y-2.5 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined text-base">mic</span>
                </div>
                <div>
                  <h3 className="font-black text-xs text-white leading-tight">
                    Ativar Microfone no App Haspaho
                  </h3>
                  <span className="text-[10px] text-cyan-400 font-semibold">
                    Desbloqueio direto de permissão Android &amp; Web
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMicPermissionGuide(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* AÇÃO 1: SOLICITAR PERMISSÃO NATIVA OU ABRIR CONFIGURAÇÕES DO APP ANDROID */}
            <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-500/40 space-y-2">
              <span className="text-[11px] font-black text-cyan-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-cyan-400">verified_user</span>
                <span>1. Abrir Permissão do Microfone no Celular</span>
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={handleTestAndRequestMicPermission}
                  disabled={permissionTestStatus === 'testing'}
                  className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">
                    {permissionTestStatus === 'testing' ? 'sync' : 'mic'}
                  </span>
                  <span>
                    {permissionTestStatus === 'testing'
                      ? 'Solicitando Permissão...'
                      : 'Solicitar Permissão do Microfone Agora'}
                  </span>
                </button>

                {typeof window !== 'undefined' && window.HaspahoNative?.startNativeVoiceRecognition && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMicPermissionGuide(false);
                      window.HaspahoNative?.startNativeVoiceRecognition?.();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">record_voice_over</span>
                    <span>Abrir Microfone Nativo do Android</span>
                  </button>
                )}

                {typeof window !== 'undefined' && window.HaspahoNative?.openAppPermissionSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      window.HaspahoNative?.openAppPermissionSettings?.();
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">settings</span>
                    <span>Abrir Permissões do App no Android</span>
                  </button>
                )}
              </div>
              {permissionTestStatus === 'denied' && (
                <p className="text-[10px] text-amber-300 leading-snug">
                  Se o Android marcou &quot;Não perguntar novamente&quot;, toque em <strong>Configurações → Aplicativos → Haspaho → Permissões → Microfone → Permitir</strong> ou use o ditado abaixo.
                </p>
              )}
            </div>

            {/* AÇÃO 2: DITADO IMEDIATO PELO MICROFONE DO TECLADO */}
            <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700 space-y-1.5">
              <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-emerald-400">keyboard_voice</span>
                <span>2. Falar pelo Microfone 🎤 do Teclado</span>
              </span>
              <textarea
                ref={mobileDictationInputRef}
                rows={2}
                value={mobileVoiceDictationText}
                onChange={(e) => setMobileVoiceDictationText(e.target.value)}
                placeholder='Toque aqui e aperte o microfone 🎤 do teclado do celular...'
                className="w-full p-2 rounded-lg bg-slate-950/90 border border-slate-600 focus:border-cyan-400 text-xs text-white placeholder-slate-400 outline-hidden resize-none"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => mobileDictationInputRef.current?.focus()}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-cyan-200 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">keyboard</span>
                  <span>Focar Teclado</span>
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
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">send</span>
                  <span>Executar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
