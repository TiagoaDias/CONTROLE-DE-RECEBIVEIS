import confetti from 'canvas-confetti';
import { playAppSound } from './soundUtils';

/**
 * Helper para alternar e aplicar temas do Ícone do Aplicativo no Celular e Navegador
 * Suporta:
 * - 'white': Fundo Branco PRO com Ícone Grande 3D (Destaque absoluto no celular)
 * - 'red': Fundo Vermelho Vibrante (Divertido, chamativo e enérgico)
 * - 'dark': Fundo Azul Noturno (Clássico Cósmico)
 */

export type AppIconTheme = 'white' | 'red' | 'dark';

export const APP_ICON_OPTIONS: {
  id: AppIconTheme;
  title: string;
  badge: string;
  subtitle: string;
  iconSrc: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    id: 'white',
    title: 'Fundo Branco PRO',
    badge: 'Recomendado',
    subtitle: 'Destaque nítido e vibrante em qualquer tela de celular com ícone gigante 3D',
    iconSrc: '/icon.svg',
    bgColor: 'bg-white',
    borderColor: 'border-blue-500',
  },
  {
    id: 'red',
    title: 'Fundo Vermelho Vibrante',
    badge: 'Divertido & Enérgico',
    subtitle: 'Alto contraste chamativo, estilo moderno, esportivo e marcante',
    iconSrc: '/icon-red.svg',
    bgColor: 'bg-rose-600',
    borderColor: 'border-rose-500',
  },
  {
    id: 'dark',
    title: 'Fundo Azul Noturno',
    badge: 'Clássico',
    subtitle: 'Visual imersivo profundo azul escuro',
    iconSrc: '/icon-512.png',
    bgColor: 'bg-slate-900',
    borderColor: 'border-cyan-500',
  },
];

export function getStoredAppIconTheme(): AppIconTheme {
  try {
    const saved = localStorage.getItem('haspaho_app_icon_theme');
    if (saved === 'red' || saved === 'dark' || saved === 'white') {
      return saved;
    }
  } catch {}
  return 'white'; // Default recomendado pelo usuário
}

export function applyAppIconTheme(theme: AppIconTheme): void {
  try {
    localStorage.setItem('haspaho_app_icon_theme', theme);
    if (typeof document === 'undefined') return;

    const linkIcon = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    const appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
    const metaThemeColor = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;

    if (theme === 'red') {
      if (linkIcon) linkIcon.href = '/icon-red.svg';
      if (appleIcon) appleIcon.href = '/icon-red-192.png';
      if (metaThemeColor) metaThemeColor.content = '#e11d48';
    } else if (theme === 'dark') {
      if (linkIcon) linkIcon.href = '/icon-512.png';
      if (appleIcon) appleIcon.href = '/icon-192.png';
      if (metaThemeColor) metaThemeColor.content = '#081b33';
    } else {
      // Default: white
      if (linkIcon) linkIcon.href = '/icon.svg';
      if (appleIcon) appleIcon.href = '/icon-192.png';
      if (metaThemeColor) metaThemeColor.content = '#ffffff';
    }
  } catch (e) {
    console.warn('[AppIconHelper] Erro ao alternar ícone:', e);
  }
}

/**
 * Aplica o ícone exibindo de forma intuitiva e divertida com confetes e som agradável
 */
export function applyAppIconThemeWithFeedback(
  theme: AppIconTheme,
  onNotify?: (msg: string) => void
): void {
  applyAppIconTheme(theme);
  try {
    playAppSound('cheerful');
    confetti({
      particleCount: 50,
      spread: 75,
      origin: { y: 0.65 },
      colors:
        theme === 'red'
          ? ['#f43f5e', '#e11d48', '#fda4af', '#fbbf24', '#ffffff']
          : ['#0284c7', '#10b981', '#38bdf8', '#a7f3d0', '#ffffff'],
    });
  } catch {}

  const opt = APP_ICON_OPTIONS.find((o) => o.id === theme);
  const msg = `🎉 Ícone ${opt?.title || theme} aplicado com sucesso!`;
  if (onNotify) {
    onNotify(msg);
  }
}

// Inicializa no carregamento do script e remove lixo acumulado de caches/logs antigos
if (typeof window !== 'undefined') {
  try {
    const current = getStoredAppIconTheme();
    applyAppIconTheme(current);

    // Limpeza automática de lixo de armazenamento (logs excessivos e caches obsoletos de versões anteriores)
    const rawLogs = localStorage.getItem('haspaho_audit_logs');
    if (rawLogs && rawLogs.length > 8000) {
      try {
        const parsed = JSON.parse(rawLogs);
        if (Array.isArray(parsed) && parsed.length > 25) {
          localStorage.setItem('haspaho_audit_logs', JSON.stringify(parsed.slice(0, 25)));
        }
      } catch {
        localStorage.removeItem('haspaho_audit_logs');
      }
    }

    if ('caches' in window) {
      window.caches.keys().then((keys) => {
        keys.forEach((key) => {
          window.caches.delete(key).catch(() => {});
        });
      }).catch(() => {});
    }
  } catch {}
}

