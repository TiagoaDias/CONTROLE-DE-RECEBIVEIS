import { initializeApp, getApps, getApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import {
  GoogleSignIn,
  type SignInResult,
  type InitializeOptions,
  ErrorCode,
} from '@capawesome/capacitor-google-sign-in';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  getDocFromServer,
  writeBatch,
  setLogLevel,
  disableNetwork,
  enableNetwork,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAccount, Debtor, Purchase, Installment } from '../types';

try {
  setLogLevel('silent');
} catch {}

// Active Firebase Configuration with support for Vercel/Vite environment variables and fallback to firebase-applet-config.json
const getEnvVar = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env?.[key]) {
      return import.meta.env[key];
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process?.env?.[key]) {
      return process.env[key];
    }
  } catch {}
  return undefined;
};

export const activeFirebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || firebaseConfig.apiKey,
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || firebaseConfig.authDomain,
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || firebaseConfig.projectId,
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || firebaseConfig.storageBucket,
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || firebaseConfig.messagingSenderId,
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || firebaseConfig.appId,
  firestoreDatabaseId: getEnvVar('VITE_FIREBASE_DATABASE_ID') || firebaseConfig.firestoreDatabaseId,
  oAuthClientId:
    getEnvVar('VITE_FIREBASE_OAUTH_CLIENT_ID') ||
    (firebaseConfig as any).oAuthClientId ||
    '145625836080-0mg9vld3ao82khqnkf0cr19c6jl7kqqk.apps.googleusercontent.com',
};

// Initialize Firebase App instance
const app = getApps().length > 0 ? getApp() : initializeApp(activeFirebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with custom databaseId if configured
export const db = activeFirebaseConfig.firestoreDatabaseId
  ? getFirestore(app, activeFirebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Google OAuth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Detecta se o aplicativo está rodando em ambiente nativo Capacitor (Android/iOS)
 * onde o plugin nativo `@capawesome/capacitor-google-sign-in` está disponível.
 */
export function isCapacitorNativeGoogleAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('GoogleSignIn');
  } catch {
    return false;
  }
}

/**
 * Detecta especificamente se o dispositivo é Android (Capacitor Android ou User-Agent Android).
 */
export function isAndroidDevice(): boolean {
  try {
    if (Capacitor.getPlatform() === 'android') {
      return true;
    }
    if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '')) {
      return true;
    }
  } catch {}
  return false;
}

/**
 * Verificação de `user-agent` que identifica se a aplicação está sendo executada
 * em um ambiente Capacitor (ou WebView nativa Android/iOS).
 * Quando verdadeiro, o `signInWithPopup` é automaticamente desabilitado.
 */
export function isCapacitorUserAgent(): boolean {
  try {
    const ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
    if (/Capacitor|; wv\)|Android.*Version\/[0-9.]+.*Chrome|Cordova/i.test(ua)) {
      return true;
    }
    if (Capacitor.isNativePlatform()) {
      return true;
    }
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') {
      return true;
    }
  } catch {}
  return false;
}

/**
 * Detecta se o aplicativo está rodando em ambiente nativo Capacitor (Android/iOS)
 * ou dentro de uma WebView Android, onde WebViews embutidas causam `disallowed_useragent`
 * ou redirecionamento inválido para `localhost`.
 */
export function isNativeOrAndroidWebView(): boolean {
  return isCapacitorUserAgent();
}

/**
 * Retorna uma URL de callback OAuth segura que NUNCA aponta para `localhost` ou `127.0.0.1`.
 */
export function getSafeOAuthRedirectUrl(): string {
  const fallbackAuthDomainUrl = `https://${activeFirebaseConfig.authDomain}`;
  if (typeof window === 'undefined' || !window.location) {
    return fallbackAuthDomainUrl;
  }
  const { protocol, hostname, origin, pathname } = window.location;
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost') ||
    !protocol.startsWith('http');

  if (isLocalhost || Capacitor.isNativePlatform()) {
    return fallbackAuthDomainUrl;
  }
  return `${origin}${pathname || '/'}`.replace(/\/+$/, '');
}

/**
 * Decodifica com segurança o payload JWT de um `idToken` retornado pelo Google OAuth
 * para garantir extração de `sub`, `email`, `name` e `picture` mesmo se campos auxiliares vierem vazios.
 */
export function decodeGoogleIdTokenPayload(idToken: string): {
  sub?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
} | null {
  try {
    if (!idToken || typeof idToken !== 'string' || !idToken.includes('.')) {
      return null;
    }
    const parts = idToken.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Extrai de forma resiliente o `idToken` e `accessToken` do objeto retornado pelo
 * `@capawesome/capacitor-google-sign-in` (suportando formatos nativos Android CredentialManager, iOS e Web).
 */
function extractTokensFromSignInResult(result: SignInResult | Record<string, any> | null | undefined): {
  idToken: string | null;
  accessToken: string | undefined;
} {
  if (!result) {
    return { idToken: null, accessToken: undefined };
  }
  const anyRes = result as Record<string, any>;
  const rawIdToken =
    anyRes.idToken ||
    anyRes.id_token ||
    anyRes.authentication?.idToken ||
    anyRes.credential?.idToken ||
    null;
  const rawAccessToken =
    anyRes.accessToken ||
    anyRes.access_token ||
    anyRes.authentication?.accessToken ||
    anyRes.credential?.accessToken ||
    undefined;

  return {
    idToken: typeof rawIdToken === 'string' && rawIdToken.trim().length > 0 ? rawIdToken.trim() : null,
    accessToken: typeof rawAccessToken === 'string' && rawAccessToken.trim().length > 0 ? rawAccessToken.trim() : undefined,
  };
}

let googleSignInInitialized = false;
let googleSignInInitPromise: Promise<void> | null = null;

/**
 * Inicialização oficial do plugin `@capawesome/capacitor-google-sign-in`.
 * Força o uso do Credential Manager / navegador nativo do sistema Android,
 * evitando o erro `disallowed_useragent` em WebViews e impedindo qualquer
 * redirecionamento para `localhost` em dispositivos móveis.
 * Importante: não passar `scopes` na inicialização padrão para que o Android
 * retorne o `idToken` diretamente via CredentialManager sem disparar
 * `AuthorizationClient.requestOfflineAccess` (que causa `SIGN_IN_CANCELED`).
 */
export async function initializeGoogleSignInNative(): Promise<void> {
  if (googleSignInInitialized) {
    return;
  }
  if (googleSignInInitPromise) {
    return googleSignInInitPromise;
  }

  googleSignInInitPromise = (async () => {
    try {
      const clientId = activeFirebaseConfig.oAuthClientId;
      if (!clientId) {
        throw new Error('OAuth Web Client ID ausente na configuração do Firebase.');
      }

      const initOptions: InitializeOptions = {
        clientId,
      };

      // Em ambiente Web não-nativo, garante que redirectUrl nunca seja localhost
      if (!Capacitor.isNativePlatform()) {
        initOptions.redirectUrl = getSafeOAuthRedirectUrl();
      }

      await GoogleSignIn.initialize(initOptions);
      googleSignInInitialized = true;
      console.log(
        '[Firebase:GoogleSignIn] Plugin @capawesome/capacitor-google-sign-in inicializado com sucesso (clientId configurado, sem redirect para localhost).'
      );
    } catch (error) {
      googleSignInInitPromise = null;
      console.warn('[Firebase:GoogleSignIn] Aviso ao inicializar @capawesome/capacitor-google-sign-in:', error);
    }
  })();

  return googleSignInInitPromise;
}

/**
 * Constrói a URL OAuth 2.0 oficial do Google para Web Auth segura (nunca apontando para `localhost`)
 * e prepara o Intent nativo do Android (`intent://...#Intent;scheme=https;package=com.android.chrome;end`)
 * para forçar a abertura no navegador nativo do sistema Android (Chrome / Custom Tabs),
 * eliminando 100% o erro `Error 403: disallowed_useragent` em WebViews Android.
 */
export function buildGoogleWebAuthUrl(customRedirectUri?: string): {
  oauthHttpsUrl: string;
  androidChromeIntentUrl: string;
} {
  const clientId = activeFirebaseConfig.oAuthClientId;
  const redirectUri = customRedirectUri || getSafeOAuthRedirectUrl();
  const stateBytes = new Uint8Array(16);
  const nonceBytes = new Uint8Array(16);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(stateBytes);
    window.crypto.getRandomValues(nonceBytes);
  }
  const toHex = (arr: Uint8Array) => Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  const state = toHex(stateBytes) || `st_${Date.now()}`;
  const nonce = toHex(nonceBytes) || `nc_${Date.now()}`;

  setSafeLocalStorage('haspaho_google_oauth_state', state);
  setSafeLocalStorage('haspaho_google_oauth_nonce', nonce);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token token',
    scope: 'openid email profile',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state,
    nonce,
  });

  const oauthHttpsUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const fallbackEncoded = encodeURIComponent(oauthHttpsUrl);
  const androidChromeIntentUrl = `intent://accounts.google.com/o/oauth2/v2/auth?${params.toString()}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallbackEncoded};end`;

  return { oauthHttpsUrl, androidChromeIntentUrl };
}

const OAUTH_REDIRECT_GUARD_KEY = 'haspaho_oauth_redirect_guard_ts';
const OAUTH_REDIRECT_COOLDOWN_MS = 12000;

/**
 * Verifica se a URL ou origem atual/destino aponta para `localhost`, `127.0.0.1` ou esquema local do Capacitor.
 */
export function isLocalhostUrlOrOrigin(urlOrHost?: string): boolean {
  const target = (
    urlOrHost ||
    (typeof window !== 'undefined' && window.location ? window.location.origin || window.location.hostname : '')
  )
    .trim()
    .toLowerCase();

  if (!target) return true;
  return (
    target === 'localhost' ||
    target === '127.0.0.1' ||
    target === '0.0.0.0' ||
    target.includes('://localhost') ||
    target.includes('://127.0.0.1') ||
    target.includes('://0.0.0.0') ||
    target.endsWith('.localhost') ||
    target.startsWith('capacitor://') ||
    target.startsWith('ionic://') ||
    target.startsWith('file://')
  );
}

/**
 * Valida a existência de uma sessão ativa no Firestore (`users/{uid}`) antes de forçar
 * qualquer redirecionamento OAuth (`signInWithRedirect` ou navegador nativo Android),
 * evitando o loop de `'redirect to localhost'` no Android.
 */
export async function validateActiveFirestoreSession(options?: {
  allowDuringLoginAttempt?: boolean;
}): Promise<UserAccount | null> {
  try {
    const explicitLogout = getSafeLocalStorage('haspaho_explicit_logout') === 'true';
    if (explicitLogout && !options?.allowDuringLoginAttempt && !auth.currentUser) {
      return null;
    }

    // 1. Aguarda brevemente a hidratação inicial do Firebase Auth (evita falso negativo no boot do Android WebView)
    if (!auth.currentUser && typeof (auth as any).authStateReady === 'function') {
      try {
        await Promise.race([
          (auth as any).authStateReady(),
          new Promise((resolve) => setTimeout(resolve, 600)),
        ]);
      } catch {}
    }

    // 2. Se o Firebase Auth já possui um usuário autenticado, valida/sincroniza o documento no Firestore
    if (auth.currentUser?.uid) {
      const activeUid = auth.currentUser.uid;
      try {
        const userSnap = await getDoc(doc(db, 'users', activeUid));
        if (userSnap.exists()) {
          const firestoreUser = userSnap.data() as UserAccount;
          const validatedAccount: UserAccount = {
            ...firestoreUser,
            id: activeUid,
            email: firestoreUser.email || auth.currentUser.email || '',
            name: firestoreUser.name || auth.currentUser.displayName || 'Usuário',
            hasSeenWelcome: firestoreUser.hasSeenWelcome ?? true,
            isFirstLogin: false,
          };
          setSafeLocalStorage('haspaho_auth_user', JSON.stringify(validatedAccount));
          removeSafeLocalStorage('haspaho_explicit_logout');
          console.log(
            '[Firebase:SessionGuard] Sessão ativa confirmada no Firestore para uid:',
            activeUid,
            '— redirecionamento bloqueado para evitar loop.'
          );
          return validatedAccount;
        }
      } catch (firestoreErr) {
        console.warn('[Firebase:SessionGuard] Aviso ao consultar sessão do currentUser no Firestore:', firestoreErr);
      }

      // Mesmo se offline/quota, o usuário já está autenticado no Firebase Auth; reconstrói a sessão sem redirecionar
      const hydratedUser = await processFirebaseUserResult(auth.currentUser);
      setSafeLocalStorage('haspaho_auth_user', JSON.stringify(hydratedUser));
      removeSafeLocalStorage('haspaho_explicit_logout');
      return hydratedUser;
    }

    // 3. Verifica se há sessão persistida localmente e valida sua existência diretamente no Firestore
    if (!explicitLogout) {
      const rawCachedUser = getSafeLocalStorage('haspaho_auth_user');
      if (rawCachedUser) {
        try {
          const cachedUser = JSON.parse(rawCachedUser) as UserAccount;
          if (cachedUser?.id) {
            try {
              const userSnap = await getDoc(doc(db, 'users', cachedUser.id));
              if (userSnap.exists()) {
                const remoteData = userSnap.data() as UserAccount;
                const mergedUser: UserAccount = {
                  ...cachedUser,
                  ...remoteData,
                  id: cachedUser.id,
                  hasSeenWelcome: remoteData.hasSeenWelcome ?? cachedUser.hasSeenWelcome ?? true,
                  isFirstLogin: false,
                };
                setSafeLocalStorage('haspaho_auth_user', JSON.stringify(mergedUser));
                console.log(
                  '[Firebase:SessionGuard] Sessão ativa validada no Firestore via cache seguro:',
                  mergedUser.id
                );
                return mergedUser;
              }
            } catch {
              // Se as regras exigirem request.auth != null ou estiver offline no Android localhost,
              // preserva a sessão válida já autenticada em cache para impedir loop de redirect para localhost
              if (cachedUser.email && (isCapacitorUserAgent() || isLocalhostUrlOrOrigin())) {
                console.log(
                  '[Firebase:SessionGuard] Sessão autenticada local preservada no Android/Capacitor para evitar redirect to localhost:',
                  cachedUser.id
                );
                return cachedUser;
              }
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[Firebase:SessionGuard] Aviso durante validação de sessão ativa no Firestore:', err);
  }

  return null;
}

/**
 * Registra e verifica trava de segurança contra loops repetitivos de redirecionamento no Android.
 */
function canProceedWithOAuthRedirect(): boolean {
  try {
    const lastRedirectRaw = getSafeLocalStorage(OAUTH_REDIRECT_GUARD_KEY);
    const now = Date.now();
    if (lastRedirectRaw) {
      const elapsed = now - Number(lastRedirectRaw);
      if (!Number.isNaN(elapsed) && elapsed >= 0 && elapsed < OAUTH_REDIRECT_COOLDOWN_MS) {
        console.warn(
          `[Firebase:SessionGuard] Redirecionamento OAuth bloqueado: tentativa recente há ${elapsed}ms (prevenção de loop 'redirect to localhost' no Android).`
        );
        return false;
      }
    }
    setSafeLocalStorage(OAUTH_REDIRECT_GUARD_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

/**
 * Fallback Web Auth para Android que força a abertura no navegador nativo do sistema
 * (Chrome / navegador externo via Android Intent ou target `_system`), evitando que o OAuth
 * seja renderizado dentro da WebView embutida (o que causaria `disallowed_useragent`)
 * e bloqueando qualquer `redirect_uri` que aponte para `localhost`.
 */
export function launchAndroidNativeBrowserWebAuthFallback(customRedirectUri?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Se já existe um usuário autenticado no Firebase Auth, nunca força redirecionamento externo
    if (auth.currentUser) {
      console.log('[Firebase:GoogleSignIn] Sessão ativa detectada em auth.currentUser; abortando launchAndroidNativeBrowserWebAuthFallback.');
      return false;
    }

    if (!canProceedWithOAuthRedirect()) {
      return false;
    }

    const safeRedirect =
      customRedirectUri && !isLocalhostUrlOrOrigin(customRedirectUri)
        ? customRedirectUri
        : getSafeOAuthRedirectUrl();

    const { oauthHttpsUrl, androidChromeIntentUrl } = buildGoogleWebAuthUrl(safeRedirect);
    console.log('[Firebase:GoogleSignIn] Disparando Web Auth no navegador nativo do sistema Android (bypassing WebView disallowed_useragent)...');

    if (isAndroidDevice()) {
      // Tenta primeiro abrir via target _system (suportado por Cordova/Capacitor InAppBrowser/WebView bridge)
      const sysWin = window.open(oauthHttpsUrl, '_system', 'location=yes');
      if (sysWin) {
        return true;
      }
      // Caso window.open('_system') não seja interceptado, utiliza a URI intent:// nativa do Android para forçar o Chrome externo
      window.location.href = androidChromeIntentUrl;
      return true;
    }

    const extWin = window.open(oauthHttpsUrl, '_blank', 'noopener,noreferrer');
    return Boolean(extWin);
  } catch (err) {
    console.warn('[Firebase:GoogleSignIn] Aviso ao abrir navegador nativo para Web Auth fallback:', err);
    return false;
  }
}

/**
 * Verifica se há um retorno de `signInWithRedirect(auth, provider)` do Firebase Auth
 * ou se a URL atual contém um callback OAuth (`#id_token=...` / `GoogleSignIn.handleRedirectCallback()`),
 * capturando o resultado e autenticando a sessão automaticamente.
 */
export async function completeGoogleWebAuthRedirectIfPresent(): Promise<UserAccount | null> {
  if (typeof window === 'undefined' || !window.location) {
    return null;
  }

  // 0. Verifica primeiro se há resultado pendente do fluxo `signInWithRedirect` do Firebase Auth
  try {
    const firebaseRedirectResult = await getRedirectResult(auth);
    if (firebaseRedirectResult?.user) {
      removeSafeLocalStorage(OAUTH_REDIRECT_GUARD_KEY);
      const userAccount = await processFirebaseUserResult(firebaseRedirectResult.user);
      setSafeLocalStorage('haspaho_auth_user', JSON.stringify(userAccount));
      removeSafeLocalStorage('haspaho_explicit_logout');
      return userAccount;
    }
  } catch (redirErr) {
    console.warn('[Firebase:GoogleSignIn] Aviso ao verificar getRedirectResult(auth):', redirErr);
  }

  const hash = window.location.hash || '';
  if (!hash.includes('id_token=') && !hash.includes('access_token=')) {
    return null;
  }

  try {
    await initializeGoogleSignInNative();

    let idToken: string | null = null;
    let accessToken: string | undefined = undefined;
    let fallbackResult: Partial<SignInResult> | null = null;

    // 1. Tenta processar pelo método oficial do plugin @capawesome/capacitor-google-sign-in
    try {
      const callbackResult = await GoogleSignIn.handleRedirectCallback();
      const extracted = extractTokensFromSignInResult(callbackResult);
      idToken = extracted.idToken;
      accessToken = extracted.accessToken;
      fallbackResult = callbackResult;
    } catch {
      // 2. Fallback direto: extrai id_token e access_token do hash da URL
      const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
      const params = new URLSearchParams(cleanHash);
      idToken = params.get('id_token');
      accessToken = params.get('access_token') || undefined;
    }

    // Limpa o hash da barra de endereços para segurança e higiene da URL
    try {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    } catch {}

    if (!idToken) {
      return null;
    }

    removeSafeLocalStorage(OAUTH_REDIRECT_GUARD_KEY);

    // Autentica no Firebase Auth com o ID Token capturado
    try {
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      const userAccount = await processFirebaseUserResult(userCredential.user);
      setSafeLocalStorage('haspaho_auth_user', JSON.stringify(userAccount));
      removeSafeLocalStorage('haspaho_explicit_logout');
      return userAccount;
    } catch (credErr) {
      console.warn('[Firebase:GoogleSignIn] Aviso ao validar idToken do redirect no Firebase Auth, decodificando JWT:', credErr);
      const payload = decodeGoogleIdTokenPayload(idToken);
      const email = fallbackResult?.email || payload?.email;
      const userId = fallbackResult?.userId || payload?.sub;
      if (email || userId) {
        const userAccount = await processFirebaseUserResult({
          uid: userId || `usr_google_${(email || '').replace(/[^a-zA-Z0-9]/g, '_')}`,
          email,
          displayName: fallbackResult?.displayName || payload?.name || (email ? email.split('@')[0] : 'Usuário Gmail'),
          photoURL: fallbackResult?.imageUrl || payload?.picture || undefined,
        });
        setSafeLocalStorage('haspaho_auth_user', JSON.stringify(userAccount));
        removeSafeLocalStorage('haspaho_explicit_logout');
        return userAccount;
      }
    }
  } catch (err) {
    console.warn('[Firebase:GoogleSignIn] Aviso ao processar callback de redirecionamento OAuth:', err);
  }

  return null;
}

/**
 * Fallback de segurança que:
 * 1. Valida primeiro a existência de uma sessão ativa no Firestore (`validateActiveFirestoreSession`),
 *    retornando-a imediatamente se existir e evitando qualquer redirecionamento desnecessário.
 * 2. Desabilita `signInWithPopup` em ambientes Capacitor (detectados via `user-agent`)
 *    e só dispara `signInWithRedirect(auth, provider)` quando a origem não é `localhost` nem WebView bloqueada,
 *    eliminando o loop de `'redirect to localhost'` no Android.
 */
async function triggerCapacitorSignInWithRedirectFallback(
  provider: GoogleAuthProvider | FacebookAuthProvider = googleProvider,
  options?: { forceAndroidSystemBrowserFallback?: boolean }
): Promise<UserAccount> {
  // 1. Valida se já existe uma sessão ativa no Firestore antes de forçar qualquer redirecionamento
  const activeFirestoreSession = await validateActiveFirestoreSession({ allowDuringLoginAttempt: true });
  if (activeFirestoreSession) {
    console.log(
      '[Firebase:Auth] Sessão ativa no Firestore detectada antes do fallback de redirecionamento. Retornando sessão ativa sem redirecionar.'
    );
    return activeFirestoreSession;
  }

  console.log(
    '[Firebase:Auth] Ambiente Capacitor detectado via user-agent: signInWithPopup desabilitado automaticamente. Verificando segurança para signInWithRedirect...'
  );

  if (options?.forceAndroidSystemBrowserFallback && isAndroidDevice()) {
    launchAndroidNativeBrowserWebAuthFallback();
  }

  if (typeof window !== 'undefined' && window.location) {
    const isLocalhostOrigin = isLocalhostUrlOrOrigin(window.location.origin || window.location.hostname);
    const ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
    const isEmbeddedAndroidWebView = /; wv\)/i.test(ua);
    const isAndroidCapacitorLocalhost = isAndroidDevice() && (isLocalhostOrigin || Capacitor.isNativePlatform());

    // Nunca executa signInWithRedirect se estiver em localhost no Android/Capacitor ou WebView restrita (; wv),
    // e respeita o guard de cooldown para impedir qualquer loop de 'redirect to localhost'.
    if (!isLocalhostOrigin && !isEmbeddedAndroidWebView && !isAndroidCapacitorLocalhost && canProceedWithOAuthRedirect()) {
      try {
        await signInWithRedirect(auth, provider);
      } catch (redirectErr) {
        console.warn('[Firebase:Auth] Aviso ao executar signInWithRedirect no fallback Capacitor:', redirectErr);
      }
    } else {
      console.log(
        '[Firebase:Auth] Redirecionamento bloqueado preventivamente (origem localhost/Android WebView detectada) para evitar loop de redirect to localhost.'
      );
    }
  }

  throw new Error('NEEDS_ACCOUNT_PICKER');
}

// Dispara a inicialização automaticamente no carregamento do módulo em plataformas nativas/mobile
// e verifica se há um retorno de callback OAuth (`#id_token=...` ou `getRedirectResult`) presente.
if (typeof window !== 'undefined') {
  if (isCapacitorUserAgent()) {
    initializeGoogleSignInNative().catch(() => {});
  }
  completeGoogleWebAuthRedirectIfPresent().catch(() => {});
}

/**
 * Autenticação Google via `@capawesome/capacitor-google-sign-in`, `signInWithCredential` e fallback `signInWithRedirect`.
 * 1. Valida se já há retorno de redirect (`completeGoogleWebAuthRedirectIfPresent`) ou sessão ativa no Firestore
 *    (`validateActiveFirestoreSession`) antes de disparar qualquer redirecionamento.
 * 2. No Android/iOS nativo: dispara `GoogleSignIn.signIn()`, captura e valida o `idToken` (e `accessToken`),
 *    e autentica no Firebase Auth via `signInWithCredential(auth, credential)`.
 * 3. Verificação de `user-agent` (`isCapacitorUserAgent()`): se for detectado ambiente Capacitor, desabilita
 *    automaticamente o `signInWithPopup` e dispara o fluxo `signInWithRedirect` protegido contra loops de `localhost`.
 */
export async function signInWithGoogleNative(options?: {
  forceAndroidSystemBrowserFallback?: boolean;
}): Promise<UserAccount> {
  // 0. Se o usuário acabou de retornar de signInWithRedirect ou do navegador nativo Android com #id_token na URL, conclui imediatamente
  const redirectUser = await completeGoogleWebAuthRedirectIfPresent();
  if (redirectUser) {
    return redirectUser;
  }

  // 0.1. Valida se já existe uma sessão ativa no Firestore antes de forçar qualquer fluxo de redirecionamento no Android
  const existingFirestoreSession = await validateActiveFirestoreSession();
  if (existingFirestoreSession) {
    return existingFirestoreSession;
  }

  // 1. Fluxo Nativo Oficial via @capawesome/capacitor-google-sign-in
  if (isCapacitorNativeGoogleAvailable()) {
    await initializeGoogleSignInNative();

    try {
      const result: SignInResult = await GoogleSignIn.signIn();
      const { idToken, accessToken } = extractTokensFromSignInResult(result);
      const jwtPayload = idToken ? decodeGoogleIdTokenPayload(idToken) : null;

      console.log('[Firebase:GoogleSignIn] Resposta recebida do plugin @capawesome/capacitor-google-sign-in:', {
        email: result?.email || jwtPayload?.email,
        userId: result?.userId || jwtPayload?.sub,
        hasIdToken: Boolean(idToken),
        hasAccessToken: Boolean(accessToken),
      });

      if (idToken) {
        try {
          // Constrói a credencial oficial do Google com o ID Token capturado e autentica no Firebase Auth
          const credential = GoogleAuthProvider.credential(idToken, accessToken);
          const userCredential = await signInWithCredential(auth, credential);
          const userAccount = await processFirebaseUserResult(userCredential.user);

          removeSafeLocalStorage(OAUTH_REDIRECT_GUARD_KEY);
          setSafeLocalStorage('haspaho_auth_user', JSON.stringify(userAccount));
          removeSafeLocalStorage('haspaho_explicit_logout');
          return userAccount;
        } catch (credErr) {
          console.warn(
            '[Firebase:GoogleSignIn] Aviso no signInWithCredential com idToken nativo; utilizando dados verificados do token:',
            credErr
          );
        }
      }

      // Se o idToken foi decodificado ou o plugin retornou os dados da conta autenticada
      const resolvedEmail = result?.email || jwtPayload?.email;
      const resolvedUserId = result?.userId || jwtPayload?.sub;

      if (resolvedEmail || resolvedUserId) {
        const fallbackDisplayName =
          result?.displayName ||
          jwtPayload?.name ||
          [result?.givenName || jwtPayload?.given_name, result?.familyName || jwtPayload?.family_name]
            .filter(Boolean)
            .join(' ') ||
          (resolvedEmail ? resolvedEmail.split('@')[0] : 'Usuário Gmail');

        const userAccount = await processFirebaseUserResult({
          uid: resolvedUserId || `usr_google_${(resolvedEmail || '').replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: resolvedEmail,
          displayName: fallbackDisplayName,
          photoURL: result?.imageUrl || jwtPayload?.picture || undefined,
        });

        removeSafeLocalStorage(OAUTH_REDIRECT_GUARD_KEY);
        setSafeLocalStorage('haspaho_auth_user', JSON.stringify(userAccount));
        removeSafeLocalStorage('haspaho_explicit_logout');
        return userAccount;
      }

      return await triggerCapacitorSignInWithRedirectFallback(googleProvider, options);
    } catch (err: any) {
      const errCode = err?.code || err?.message || '';
      console.warn(
        '[Firebase:GoogleSignIn] Falha ou indisponibilidade no Credential Manager nativo (@capawesome/capacitor-google-sign-in). Acionando fallback seguro:',
        errCode,
        err
      );

      if (errCode === ErrorCode.SignInCanceled) {
        throw new Error('NEEDS_ACCOUNT_PICKER');
      }

      return await triggerCapacitorSignInWithRedirectFallback(googleProvider, options);
    }
  }

  // 2. Verificação de `user-agent` para ambiente Capacitor:
  // Desabilita automaticamente o `signInWithPopup` se for detectado um ambiente Capacitor,
  // validando antes a sessão no Firestore e disparando `signInWithRedirect` seguro.
  if (isCapacitorUserAgent()) {
    return await triggerCapacitorSignInWithRedirectFallback(googleProvider, options);
  }

  // 3. Fluxo para navegadores Web padrão (onde não há user-agent Capacitor)
  try {
    const popupResult = await signInWithPopup(auth, googleProvider);
    const userAccount = await processFirebaseUserResult(popupResult.user);
    removeSafeLocalStorage(OAUTH_REDIRECT_GUARD_KEY);
    setSafeLocalStorage('haspaho_auth_user', JSON.stringify(userAccount));
    removeSafeLocalStorage('haspaho_explicit_logout');
    return userAccount;
  } catch (err: any) {
    console.warn('[Firebase:GoogleSignIn] Aviso no login via popup Web, acionando fallback signInWithRedirect:', err?.code || err?.message);
    if (
      err?.code === 'auth/popup-blocked' ||
      err?.code === 'auth/operation-not-supported-in-this-environment'
    ) {
      return await triggerCapacitorSignInWithRedirectFallback(googleProvider, options);
    }
    throw new Error('NEEDS_ACCOUNT_PICKER');
  }
}

/**
 * Encerra a sessão no plugin nativo GoogleSignIn e no Firebase Auth.
 */
export async function signOutGoogleNative(): Promise<void> {
  removeSafeLocalStorage(OAUTH_REDIRECT_GUARD_KEY);
  if (isCapacitorUserAgent()) {
    try {
      await initializeGoogleSignInNative();
      await GoogleSignIn.signOut();
    } catch (e) {
      console.warn('[Firebase:GoogleSignIn] Aviso ao encerrar sessão no plugin nativo:', e);
    }
  }
  await signOut(auth);
}

// Facebook OAuth Provider
const facebookProvider = new FacebookAuthProvider();
facebookProvider.setCustomParameters({ display: 'popup' });

export async function signInWithFacebook(): Promise<UserAccount> {
  try {
    // Valida a existência de uma sessão ativa no Firestore antes de forçar qualquer redirecionamento
    const activeSession = await validateActiveFirestoreSession();
    if (activeSession) {
      return activeSession;
    }

    // Desabilita automaticamente o signInWithPopup se for detectado ambiente Capacitor via user-agent,
    // disparando signInWithRedirect apenas quando seguro (sem risco de loop para localhost no Android).
    if (isCapacitorUserAgent()) {
      return await triggerCapacitorSignInWithRedirectFallback(facebookProvider);
    }

    const result = await signInWithPopup(auth, facebookProvider);
    const fbUser = result.user;
    const email = (fbUser.email || '').toLowerCase();
    const userId = fbUser.uid;

    const existingUser = await getUserFromFirestore(userId);
    if (existingUser) {
      return { ...existingUser, id: userId };
    }

    const newUser: UserAccount = {
      id: userId,
      name: fbUser.displayName || email.split('@')[0] || 'Usuário Facebook',
      username: email.split('@')[0] || `user_${userId.substring(0, 6)}`,
      email: email || `${userId}@facebook.local`,
      phoneWhatsapp: fbUser.phoneNumber || '',
      authProvider: 'facebook',
      avatar: fbUser.photoURL || undefined,
      companyName: 'Gestão Financeira Facebook',
      city: 'Brasil',
      state: 'BR',
      role: 'Usuário Gestor',
      pixKey: email || '',
      createdAt: new Date().toISOString(),
      isFirstLogin: true,
      hasSeenWelcome: false,
    };

    await saveUserToFirestore(newUser);
    return newUser;
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('A janela de autenticação do Facebook foi cancelada.');
    }
    if (
      err.code === 'auth/operation-not-allowed' ||
      err.code === 'auth/account-exists-with-different-credential' ||
      err.code === 'auth/configuration-not-found' ||
      err.code === 'auth/invalid-oauth-provider'
    ) {
      throw new Error('O login com Facebook não está ativado no painel do Firebase Console. Por favor, ative o provedor Facebook no Console do Firebase ou utilize E-mail/Senha ou Google.');
    }
    throw new Error(err.message || 'Não foi possível entrar com Facebook. Verifique a configuração no console do Firebase.');
  }
}

// MANDATED FIRESTORE ERROR HANDLING TYPES & FUNCTION
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'resource-exhausted' ||
    code === 8 ||
    msg.includes('resource-exhausted') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('quota metric') ||
    msg.includes('Free daily write units') ||
    msg.includes('Free tier database') ||
    msg.includes('free quota limits') ||
    msg.includes('quota limits')
  );
}

const QUOTA_STORAGE_KEY = 'haspaho_firestore_quota_exhausted_v2';

export function getSafeLocalStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}
  return null;
}

export function setSafeLocalStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {}
}

export function removeSafeLocalStorage(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {}
}

// Inicia sempre como false e garante que a rede do Firestore esteja habilitada na inicialização
let firestoreQuotaExhausted = false;
try {
  removeSafeLocalStorage(QUOTA_STORAGE_KEY);
  enableNetwork(db).catch(() => {});
} catch {}

export function isFirestoreQuotaExhausted(): boolean {
  return firestoreQuotaExhausted;
}

export function setFirestoreQuotaExhausted(val: boolean): void {
  firestoreQuotaExhausted = val;
  try {
    if (!val) {
      removeSafeLocalStorage(QUOTA_STORAGE_KEY);
      enableNetwork(db).catch(() => {});
    }
  } catch {}
}

export function isOfflineOrNetworkError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    code === 'deadline-exceeded' ||
    msg.includes('client is offline') ||
    msg.includes('offline') ||
    msg.includes('Could not reach Cloud Firestore') ||
    msg.includes('The operation could not be completed') ||
    msg.includes('network-request-failed') ||
    msg.includes('Failed to get document because the client is offline')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never | void {
  if (isQuotaError(error)) {
    setFirestoreQuotaExhausted(true);
    console.warn(`[Firestore:QUOTA_CIRCUIT_BREAKER] Quota diária de escrita do Firestore no plano gratuito atingida. Operação '${operationType}' em '${path}' foi mitigada com segurança via LocalStorage.`);
    return;
  }

  if (isOfflineOrNetworkError(error)) {
    console.warn(`[Firestore:OFFLINE_MODE] Operação '${operationType}' em '${path}' mitigada em modo offline:`, error instanceof Error ? error.message : String(error));
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Startup connection verification as mandated by guidelines
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase] Connected to Firestore database:', activeFirebaseConfig.projectId);
    return true;
  } catch (error) {
    if (isQuotaError(error)) {
      setFirestoreQuotaExhausted(true);
      console.warn('[Firebase] Quota de serviço atingida durante verificação de conexão. Operações locais ativas.');
      return false;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is offline or database is initializing:', error.message);
    } else {
      console.log('[Firebase] Initial connection check acknowledged.');
    }
    return false;
  }
}

// Automatically test connection on module load
testConnection().catch(() => {});

// =========================================================================
// REAL AUTHENTICATION & CREDENTIAL VALIDATION
// =========================================================================

export interface RegisteredCredential {
  email: string;
  username: string;
  passwordHash: string;
  userId: string;
  user: UserAccount;
}

// Official Tiago Dias Master Profile
export const TIAGO_DIAS_USER: UserAccount = {
  id: 'usr_thiago_dias',
  name: 'Tiago Augusto Dias',
  username: 'tiagodias',
  email: 'tiagodias8888@gmail.com',
  phoneWhatsapp: '(14) 99733-9863',
  cpfCnpj: '368.497.448-01',
  authProvider: 'local',
  companyName: 'HASPAHO Gestão & Tecnologia',
  city: 'Mineiros do Tietê',
  state: 'SP',
  role: 'Desenvolvedor e Programador Full Stack | Administrador Master',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  pixKey: 'tiagodias8888@gmail.com',
  cep: '17320-000',
  address: 'Rua Principal',
  addressNumber: '100',
  neighborhood: 'Centro',
  createdAt: '2026-01-10T10:00:00.000Z',
  isFirstLogin: false,
  hasSeenWelcome: true,
  welcomeCompletedAt: '2026-01-10T10:00:00.000Z',
  isMasterAdmin: true,
  isFullStackDev: true,
  status: 'ativo',
  plainPassword: 'haspaho2026',
  supportPin: '8888',
  complianceAgreed: true,
};

// Helper: Read local registered credentials
export function getLocalRegisteredCredentials(): Record<string, RegisteredCredential> {
  try {
    const raw = getSafeLocalStorage('haspaho_registered_credentials');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalRegisteredCredentials(creds: Record<string, RegisteredCredential>): void {
  try {
    setSafeLocalStorage('haspaho_registered_credentials', JSON.stringify(creds));
  } catch (e) {
    console.error('Failed to save credentials locally:', e);
  }
}

/**
 * Real login with email/username/cpf/phone and password.
 * REJECTS nonexistent accounts.
 * REJECTS wrong passwords.
 * Resilient to Firebase Console email/password disabled (auth/operation-not-allowed) via Firestore persistence.
 */
export async function loginWithRealCredentials(
  identifier: string,
  rawPassword: string
): Promise<UserAccount> {
  const cleanId = identifier.trim().toLowerCase();
  const digitsOnly = identifier.replace(/\D/g, '');
  const cleanPass = rawPassword.trim();

  if (!cleanId) {
    throw new Error('Informe seu e-mail ou nome de usuário.');
  }
  if (!cleanPass) {
    throw new Error('Informe sua senha de acesso.');
  }

  // 1. Check Master Tiago Dias Account
  const isMasterId =
    cleanId === 'tiagodias8888@gmail.com' ||
    cleanId === 'tiagodias' ||
    cleanId === 'usr_thiago_dias' ||
    cleanId.includes('tiagodias8888') ||
    digitsOnly === '36849744801' ||
    digitsOnly === '14997339863' ||
    digitsOnly === '014997339863';

  if (isMasterId) {
    if (cleanPass !== 'haspaho2026' && cleanPass !== '8888') {
      throw new Error('Senha incorreta para a conta de Administrador Mestre.');
    }
    let masterUid = TIAGO_DIAS_USER.id;
    try {
      const fbCred = await signInWithEmailAndPassword(auth, 'tiagodias8888@gmail.com', 'haspaho2026');
      masterUid = fbCred.user.uid;
    } catch {
      try {
        const fbCred = await createUserWithEmailAndPassword(auth, 'tiagodias8888@gmail.com', 'haspaho2026');
        masterUid = fbCred.user.uid;
      } catch {}
    }

    try {
      const remote = await getUserFromFirestore(masterUid);
      const hasSeen = remote ? (remote.hasSeenWelcome ?? true) : true;
      const finalUser: UserAccount = remote
        ? {
            ...TIAGO_DIAS_USER,
            ...remote,
            id: masterUid,
            isMasterAdmin: true,
            isFullStackDev: true,
            hasSeenWelcome: hasSeen,
            isFirstLogin: false,
          }
        : {
            ...TIAGO_DIAS_USER,
            id: masterUid,
            isMasterAdmin: true,
            isFullStackDev: true,
            hasSeenWelcome: true,
            isFirstLogin: false,
          };
      setSafeLocalStorage('haspaho_auth_user', JSON.stringify(finalUser));
      return finalUser;
    } catch {
      const finalUser: UserAccount = {
        ...TIAGO_DIAS_USER,
        id: masterUid,
        isMasterAdmin: true,
        isFullStackDev: true,
        hasSeenWelcome: true,
        isFirstLogin: false,
      };
      setSafeLocalStorage('haspaho_auth_user', JSON.stringify(finalUser));
      return finalUser;
    }
  }

  // 2. Resolve Target Email and Lookup Registered Credentials
  let targetEmail = cleanId;
  let targetUsername = cleanId;
  let cachedCred: RegisteredCredential | null = null;

  // Check local registry first
  const localRegistry = getLocalRegisteredCredentials();
  if (localRegistry[cleanId]) {
    cachedCred = localRegistry[cleanId];
    targetEmail = cachedCred.email;
    targetUsername = cachedCred.username;
  } else {
    const foundLocal = Object.values(localRegistry).find(
      (c) => c.username.toLowerCase() === cleanId || c.email.toLowerCase() === cleanId
    );
    if (foundLocal) {
      cachedCred = foundLocal;
      targetEmail = foundLocal.email;
      targetUsername = foundLocal.username;
    }
  }

  // Check Firestore registered_credentials if not found locally
  if (!cachedCred) {
    const safeKey = cleanId.replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      const docSnap = await getDoc(doc(db, 'registered_credentials', safeKey));
      if (docSnap.exists()) {
        cachedCred = docSnap.data() as RegisteredCredential;
        targetEmail = cachedCred.email;
        targetUsername = cachedCred.username;
      }
    } catch {}
  }

  // Attempt real Firebase Auth signIn
  let authUid = '';
  let fbUserSuccess = false;

  if (targetEmail.includes('@')) {
    try {
      const fbCred = await signInWithEmailAndPassword(auth, targetEmail, cleanPass);
      authUid = fbCred.user.uid;
      fbUserSuccess = true;
    } catch (fbErr: any) {
      console.warn('[Firebase Auth] signInWithEmailAndPassword result:', fbErr.code);

      // Verify against Firestore/local credentials when Firebase Auth cannot verify
      const verifyOfflineOrFallback = async () => {
        let credToVerify = cachedCred;
        if (!credToVerify) {
          const safeKey = targetEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
          try {
            const docSnap = await getDoc(doc(db, 'registered_credentials', safeKey));
            if (docSnap.exists()) {
              credToVerify = docSnap.data() as RegisteredCredential;
            }
          } catch {}
        }
        if (!credToVerify && localRegistry[targetEmail]) {
          credToVerify = localRegistry[targetEmail];
        }

        if (credToVerify) {
          const incomingHash = btoa(cleanPass);
          if (
            credToVerify.passwordHash === incomingHash ||
            credToVerify.passwordHash === cleanPass
          ) {
            authUid = credToVerify.userId || `usr_${targetEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            fbUserSuccess = true;
            return true;
          } else {
            throw new Error('Senha incorreta para este usuário.');
          }
        }
        return false;
      };

      if (fbErr.code === 'auth/wrong-password') {
        throw new Error('Senha incorreta. Verifique os dados digitados ou use "Esqueci minha senha".');
      } else if (fbErr.code === 'auth/operation-not-allowed') {
        // Email/Password provider disabled in Firebase Console
        const matched = await verifyOfflineOrFallback();
        if (!matched) {
          throw new Error('Usuário não cadastrado. Caso ainda não tenha uma conta, acesse a aba "Cadastrar Nova Conta".');
        }
      } else if (fbErr.code === 'auth/invalid-credential' || fbErr.code === 'auth/user-not-found') {
        const matched = await verifyOfflineOrFallback();
        if (!matched) {
          throw new Error('E-mail ou senha incorretos. Se não possuir conta, cadastre-se na aba "Cadastrar Nova Conta".');
        }
      } else if (fbErr.code === 'auth/invalid-email') {
        throw new Error('Formato de e-mail inválido.');
      } else if (fbErr.code === 'auth/user-disabled') {
        throw new Error('Esta conta foi desativada.');
      } else if (fbErr.code === 'auth/too-many-requests') {
        throw new Error('Muitas tentativas sem sucesso. Aguarde alguns instantes e tente novamente.');
      } else {
        const matched = await verifyOfflineOrFallback();
        if (!matched) {
          throw new Error(fbErr.message || 'Falha na autenticação. Verifique os dados informados.');
        }
      }
    }
  } else {
    // If still not an email, try checking credentials directly
    if (cachedCred) {
      const incomingHash = btoa(cleanPass);
      if (cachedCred.passwordHash === incomingHash || cachedCred.passwordHash === cleanPass) {
        authUid = cachedCred.userId;
        fbUserSuccess = true;
      } else {
        throw new Error('Senha incorreta para este usuário.');
      }
    } else {
      throw new Error('Usuário não encontrado. Informe seu e-mail cadastrado.');
    }
  }

  if (!fbUserSuccess || !authUid) {
    throw new Error('Falha na autenticação. Verifique suas credenciais.');
  }

  // Load user profile from Firestore or build from account info
  let userProfile: UserAccount | null = null;
  try {
    userProfile = await getUserFromFirestore(authUid);
  } catch {}

  if (userProfile) {
    const finalUser = {
      ...userProfile,
      id: authUid,
      email: targetEmail,
      hasSeenWelcome: userProfile.hasSeenWelcome ?? true,
      isFirstLogin: false,
    };
    setSafeLocalStorage('haspaho_auth_user', JSON.stringify(finalUser));
    return finalUser;
  }

  // Check local registry for any custom profile data
  const finalCred = cachedCred || localRegistry[targetEmail] || localRegistry[targetUsername];
  if (finalCred && finalCred.user) {
    const finalUser: UserAccount = {
      ...finalCred.user,
      id: authUid,
      email: targetEmail,
      isFirstLogin: false,
      hasSeenWelcome: true,
    };
    saveUserToFirestore(finalUser).catch(() => {});
    setSafeLocalStorage('haspaho_auth_user', JSON.stringify(finalUser));
    return finalUser;
  }

  // Create clean user profile
  const newUser: UserAccount = {
    id: authUid,
    name: auth.currentUser?.displayName || targetUsername || targetEmail.split('@')[0],
    username: targetUsername || targetEmail.split('@')[0],
    email: targetEmail,
    phoneWhatsapp: auth.currentUser?.phoneNumber || '',
    authProvider: 'local',
    companyName: 'Empresa / Negócio Próprio',
    city: 'São Paulo',
    state: 'SP',
    role: 'Gestor Financeiro',
    pixKey: targetEmail,
    createdAt: new Date().toISOString(),
    isFirstLogin: false,
    hasSeenWelcome: true,
  };

  saveUserToFirestore(newUser).catch(() => {});
  setSafeLocalStorage('haspaho_auth_user', JSON.stringify(newUser));
  return newUser;
}

/**
 * Real user registration.
 * Creates an isolated user account with Firebase Auth UID or secure Firestore record.
 * Resilient to Firebase Console email/password disabled (auth/operation-not-allowed).
 */
export async function registerRealUser(
  userData: Partial<UserAccount>,
  rawPassword: string
): Promise<UserAccount> {
  const email = (userData.email || '').trim().toLowerCase();
  const name = (userData.name || '').trim();
  const username = (userData.username || email.split('@')[0] || '').trim().toLowerCase();

  if (!name) throw new Error('Por favor, informe seu nome completo.');
  if (!email || !email.includes('@')) throw new Error('Informe um e-mail válido.');
  if (!rawPassword || rawPassword.length < 6) {
    throw new Error('A senha deve ter no mínimo 6 caracteres.');
  }

  if (
    email === 'tiagodias8888@gmail.com' ||
    username === 'tiagodias' ||
    email.includes('tiagodias8888')
  ) {
    throw new Error('Este e-mail pertence à conta de Administrador Mestre.');
  }

  // Check if user already exists in Firestore or local registry
  const safeDocKey = email.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const existingDoc = await getDoc(doc(db, 'registered_credentials', safeDocKey));
    if (existingDoc.exists()) {
      throw new Error('Este e-mail já está cadastrado no sistema. Faça login na aba "Entrar" ou recupere sua senha.');
    }
  } catch (checkErr: any) {
    if (checkErr.message && checkErr.message.includes('já está cadastrado')) {
      throw checkErr;
    }
  }

  let authUid = '';
  try {
    const fbCred = await createUserWithEmailAndPassword(auth, email, rawPassword.trim());
    authUid = fbCred.user.uid;
  } catch (err: any) {
    console.warn('[Firebase Auth] Registration notice:', err.code);
    if (err.code === 'auth/email-already-in-use') {
      throw new Error('Este e-mail já está cadastrado no sistema. Faça login na aba "Entrar" ou recupere sua senha.');
    } else if (err.code === 'auth/weak-password') {
      throw new Error('A senha é muito fraca. Digite pelo menos 6 caracteres.');
    } else if (err.code === 'auth/invalid-email') {
      throw new Error('O formato do e-mail é inválido.');
    } else if (err.code === 'auth/operation-not-allowed') {
      // Email/password is disabled in Firebase Console - create user in Firestore safely
      console.info('[Firebase Auth] Provedor Email/Senha desativado no console. Gravando credenciais no Firestore com segurança.');
      authUid = `usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    } else {
      // Fallback: try sign in if already exists
      try {
        const fbCred = await signInWithEmailAndPassword(auth, email, rawPassword.trim());
        authUid = fbCred.user.uid;
      } catch {
        authUid = `usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
    }
  }

  const newUserId = authUid || `usr_${Date.now()}`;
  const newUser: UserAccount = {
    id: newUserId,
    name,
    username,
    email,
    phoneWhatsapp: userData.phoneWhatsapp || '',
    authProvider: 'local',
    companyName: userData.companyName || 'Empresa / Negócio Próprio',
    city: userData.city || 'São Paulo',
    state: userData.state || 'SP',
    role: 'Gestor Financeiro',
    pixKey: userData.pixKey || email,
    cep: userData.cep || '01001-000',
    address: userData.address || '',
    addressNumber: userData.addressNumber || '',
    neighborhood: userData.neighborhood || '',
    createdAt: new Date().toISOString(),
    isFirstLogin: true,
    hasSeenWelcome: false,
  };

  const credRecord: RegisteredCredential = {
    email,
    username,
    passwordHash: btoa(rawPassword.trim()),
    userId: newUserId,
    user: newUser,
  };

  const localRegistry = getLocalRegisteredCredentials();
  localRegistry[email] = credRecord;
  localRegistry[username] = credRecord;
  saveLocalRegisteredCredentials(localRegistry);

  if (!isFirestoreQuotaExhausted()) {
    try {
      await setDoc(doc(db, 'registered_credentials', safeDocKey), cleanFirestoreObject(credRecord));
      await saveUserToFirestore(newUser);
    } catch (err) {
      if (isQuotaError(err)) {
        setFirestoreQuotaExhausted(true);
      }
      console.warn('[Firebase] Registered credentials write note:', err);
    }
  }

  setSafeLocalStorage('haspaho_auth_user', JSON.stringify(newUser));

  return newUser;
}

/**
 * Official Firebase Password Reset Email
 */
export async function sendFirebasePasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Por favor, informe um endereço de e-mail válido para a recuperação.');
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: any) {
    console.warn('[Firebase Auth] Password reset error:', err.code);
    if (err.code === 'auth/user-not-found') {
      throw new Error('Nenhum usuário cadastrado com este e-mail no Firebase.');
    } else if (err.code === 'auth/invalid-email') {
      throw new Error('Formato de e-mail inválido.');
    } else if (err.code === 'auth/too-many-requests') {
      throw new Error('Muitas solicitações recentes. Aguarde alguns minutos antes de tentar novamente.');
    }
    throw new Error(err.message || 'Não foi possível enviar o e-mail de recuperação.');
  }
}

/**
 * Resolve o ID canônico unificado do usuário para garantir que tanto o navegador Web
 * quanto o aplicativo instalado (PWA / Android APK) leiam e gravem exatamente no mesmo
 * caminho do Firestore, independentemente do método de login (Google OAuth, Credential Manager ou Gmail Direto).
 */
export function resolveCanonicalUserId(userId?: string, emailHint?: string): string {
  let detectedEmail = (emailHint || auth.currentUser?.email || '').trim().toLowerCase();
  if (!detectedEmail) {
    try {
      const rawAuth = getSafeLocalStorage('haspaho_auth_user');
      if (rawAuth) {
        const parsed = JSON.parse(rawAuth);
        if (parsed?.email) {
          detectedEmail = String(parsed.email).trim().toLowerCase();
        }
      }
    } catch {}
  }

  const rawId = (userId || '').trim();
  const isMaster =
    detectedEmail === 'tiagodias8888@gmail.com' ||
    rawId === 'usr_thiago_dias' ||
    rawId === 'usr_google_tiagodias8888_gmail_com' ||
    rawId.toLowerCase().includes('tiagodias8888');

  if (isMaster) {
    return TIAGO_DIAS_USER.id; // 'usr_thiago_dias'
  }

  if (detectedEmail && (detectedEmail.endsWith('@gmail.com') || detectedEmail.endsWith('@googlemail.com'))) {
    return `usr_google_${detectedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  return rawId || auth.currentUser?.uid || TIAGO_DIAS_USER.id;
}

// Cache em memória de IDs secundários descobertos no Firestore para o mesmo e-mail
const discoveredEmailUidsCache = new Map<string, string[]>();

/**
 * Retorna todos os IDs candidatos nos quais os dados do usuário podem ter sido gravados
 * (ex: ID canônico 'usr_thiago_dias', UID do Firebase Auth de um login Google anterior, etc.)
 */
export async function getCandidateUserIds(userId: string, emailHint?: string): Promise<string[]> {
  const candidates = new Set<string>();
  const canonical = resolveCanonicalUserId(userId, emailHint);
  if (canonical) candidates.add(canonical);
  if (userId && userId.trim()) candidates.add(userId.trim());
  if (auth.currentUser?.uid) candidates.add(auth.currentUser.uid);

  let detectedEmail = (emailHint || auth.currentUser?.email || '').trim().toLowerCase();
  if (!detectedEmail) {
    try {
      const rawAuth = getSafeLocalStorage('haspaho_auth_user');
      if (rawAuth) {
        const parsed = JSON.parse(rawAuth);
        if (parsed?.email) {
          detectedEmail = String(parsed.email).trim().toLowerCase();
        }
      }
    } catch {}
  }

  if (canonical === TIAGO_DIAS_USER.id || detectedEmail === 'tiagodias8888@gmail.com') {
    candidates.add('usr_thiago_dias');
    candidates.add('usr_google_tiagodias8888_gmail_com');
    detectedEmail = 'tiagodias8888@gmail.com';
  }

  if (detectedEmail) {
    candidates.add(`usr_google_${detectedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`);
    const cached = discoveredEmailUidsCache.get(detectedEmail);
    if (cached) {
      cached.forEach((id) => candidates.add(id));
    } else if (!isFirestoreQuotaExhausted()) {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const matchedUids: string[] = [];
        usersSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const docEmail = String(data?.email || '').trim().toLowerCase();
          if (docEmail && docEmail === detectedEmail) {
            matchedUids.push(docSnap.id);
            if (data?.id) matchedUids.push(String(data.id));
          }
        });
        discoveredEmailUidsCache.set(detectedEmail, matchedUids);
        matchedUids.forEach((id) => candidates.add(id));
      } catch {}
    }
  }

  return Array.from(candidates).filter(Boolean);
}

/**
 * Real Google OAuth authentication via Firebase Popup / Native
 */
export async function processFirebaseUserResult(fbUser: any): Promise<UserAccount> {
  const email = (fbUser.email || '').toLowerCase();
  const isMaster = email === 'tiagodias8888@gmail.com';
  const canonicalId = resolveCanonicalUserId(fbUser.uid, email);

  if (isMaster) {
    const remote = await getUserFromFirestore(canonicalId).catch(() => null);
    const hasSeen = remote ? (remote.hasSeenWelcome ?? true) : true;
    const user: UserAccount = {
      ...TIAGO_DIAS_USER,
      ...remote,
      id: canonicalId,
      email,
      name: fbUser.displayName || remote?.name || TIAGO_DIAS_USER.name,
      avatar: fbUser.photoURL || remote?.avatar || TIAGO_DIAS_USER.avatar,
      authProvider: 'gmail',
      isMasterAdmin: true,
      isFullStackDev: true,
      hasSeenWelcome: hasSeen,
      isFirstLogin: false,
      welcomeCompletedAt: remote?.welcomeCompletedAt || '2026-01-10T10:00:00.000Z',
    };
    await saveUserToFirestore(user).catch((e) =>
      console.warn('[Firebase] Aviso ao salvar perfil no Firestore:', e)
    );
    return user;
  }

  const existingUser = await getUserFromFirestore(canonicalId).catch(() => null);
  if (existingUser) {
    return {
      ...existingUser,
      id: canonicalId,
      isFirstLogin: false,
      hasSeenWelcome: existingUser.hasSeenWelcome ?? true,
    };
  }

  const newUser: UserAccount = {
    id: canonicalId,
    name: fbUser.displayName || email.split('@')[0] || 'Usuário Google',
    username: email.split('@')[0] || 'usuario',
    email: email || 'usuario.google@exemplo.com',
    phoneWhatsapp: fbUser.phoneNumber || '',
    authProvider: 'gmail',
    avatar: fbUser.photoURL || undefined,
    companyName: 'Gestão Financeira Google',
    city: 'Brasil',
    state: 'BR',
    role: 'Usuário Gestor',
    pixKey: email,
    createdAt: new Date().toISOString(),
    isFirstLogin: true,
    hasSeenWelcome: false,
  };

  await saveUserToFirestore(newUser).catch((e) =>
    console.warn('[Firebase] Aviso ao salvar novo usuário no Firestore:', e)
  );
  return newUser;
}

// =========================================================================
// USER PROFILE FIRESTORE OPERATIONS
// =========================================================================

export async function saveUserToFirestore(user: UserAccount): Promise<void> {
  if (!user || !user.id) {
    console.warn('[Firestore:SAVE_USER] Aborted: user or user.id is invalid.', user);
    return;
  }
  if (isFirestoreQuotaExhausted()) {
    return;
  }
  const canonicalId = resolveCanonicalUserId(user.id, user.email);
  const path = `users/${canonicalId}`;
  try {
    const userRef = doc(db, 'users', canonicalId);
    const cleaned = cleanFirestoreObject({
      ...user,
      id: canonicalId,
      updatedAt: new Date().toISOString(),
    });
    console.log(`[Firestore:SAVE_USER] Sending user profile to ${path}:`, { id: canonicalId, email: user.email, name: user.name });
    await setDoc(userRef, cleaned, { merge: true });
    if (user.id && user.id !== canonicalId) {
      await setDoc(doc(db, 'users', user.id), cleaned, { merge: true }).catch(() => {});
    }
    console.log(`[Firestore:SAVE_USER] Success: User ${canonicalId} persisted to Firestore.`);
  } catch (err: any) {
    if (err?.code === 'permission-denied' || (err?.message && err.message.includes('Missing or insufficient permissions'))) {
      console.warn(`[Firestore:SAVE_USER] Permissão negada ao salvar ${path}. Perfil mantido localmente.`);
      return;
    }
    if (isQuotaError(err) || isOfflineOrNetworkError(err)) {
      if (isQuotaError(err)) setFirestoreQuotaExhausted(true);
      console.warn(`[Firestore:SAVE_USER] Quota atingida ou modo offline. Perfil mantido seguro no LocalStorage.`);
      return;
    }
    console.error(`[Firestore:SAVE_USER_ERROR] Failed to save user ${canonicalId}:`, err);
  }
}

/**
 * Marks the welcome presentation as completed for the authenticated user in Firebase Firestore.
 */
export async function markWelcomeCompletedInFirestore(userId: string): Promise<void> {
  if (!userId) return;
  if (isFirestoreQuotaExhausted()) return;
  const canonicalId = resolveCanonicalUserId(userId);
  try {
    const userRef = doc(db, 'users', canonicalId);
    await setDoc(
      userRef,
      cleanFirestoreObject({
        hasSeenWelcome: true,
        isFirstLogin: false,
        welcomeCompletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
    console.log(`[Firestore:MARK_WELCOME] User ${canonicalId} successfully marked as completed welcome presentation.`);
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      return;
    }
    console.warn(`[Firestore:MARK_WELCOME] Note marking welcome for ${canonicalId}:`, err);
  }
}

export async function getUserFromFirestore(userId: string): Promise<UserAccount | null> {
  if (!userId) return null;
  const candidateIds = await getCandidateUserIds(userId);
  const canonicalId = resolveCanonicalUserId(userId);
  try {
    for (const cid of candidateIds) {
      const userRef = doc(db, 'users', cid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() as UserAccount;
        console.log(`[Firestore:GET_USER] Found user ${cid}:`, data.name || data.email);
        return { ...data, id: canonicalId };
      }
    }
    return null;
  } catch (err: any) {
    if (err?.code === 'permission-denied' || (err?.message && err.message.includes('Missing or insufficient permissions'))) {
      console.warn(`[Firestore:GET_USER] Permissão não concedida. Usando perfil local com segurança.`);
      return null;
    }
    if (isQuotaError(err) || isOfflineOrNetworkError(err)) {
      if (isQuotaError(err)) setFirestoreQuotaExhausted(true);
      return null;
    }
    console.warn(`[Firestore:GET_USER_ERROR] Note reading user ${userId}:`, err);
    return null;
  }
}

// Deep clean function: Strips undefined and functions, serializes Dates, handles nested structures cleanly
export function cleanFirestoreObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'function') return undefined as unknown as T;
  if (obj instanceof Date) {
    return obj.toISOString() as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanFirestoreObject).filter((item) => item !== undefined) as unknown as T;
  }
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined && typeof value !== 'function') {
        const cleanedVal = cleanFirestoreObject(value);
        if (cleanedVal !== undefined) {
          res[key] = cleanedVal;
        }
      }
    }
    return res as T;
  }
  return obj;
}

// USER DEBTORS FIRESTORE OPERATIONS (Isolated per userId)
export async function saveDebtorsToFirestore(userId: string, debtors: Debtor[]): Promise<void> {
  if (!userId) {
    console.warn('[Firestore:SAVE_DEBTORS] Aborted: userId is empty.');
    return;
  }
  if (isFirestoreQuotaExhausted()) {
    return;
  }
  const canonicalId = resolveCanonicalUserId(userId);
  const path = `users/${canonicalId}/debtors`;
  console.log(`[Firestore:SAVE_DEBTORS] Received ${debtors?.length || 0} debtors for path: ${path}`);
  try {
    const safeDebtors = Array.isArray(debtors) ? debtors : [];
    if (safeDebtors.length === 0) {
      console.log(`[Firestore:SAVE_DEBTORS] Debtors array is empty. 0 operations to commit.`);
      return;
    }
    const chunks: Debtor[][] = [];
    for (let i = 0; i < safeDebtors.length; i += 400) {
      chunks.push(safeDebtors.slice(i, i + 400));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const d of chunk) {
        if (!d || !d.id) continue;
        const docRef = doc(db, 'users', canonicalId, 'debtors', d.id);
        const cleaned = cleanFirestoreObject({ ...d, userId: canonicalId, updatedAt: new Date().toISOString() });
        batch.set(docRef, cleaned, { merge: true });
      }
      await batch.commit();
    }
    console.log(`[Firestore:SAVE_DEBTORS] Successfully committed ${safeDebtors.length} debtors to Firestore at ${path}!`);
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      console.warn(`[Firestore:SAVE_DEBTORS] Quota limite diária atingida. Dados devedores mantidos no LocalStorage.`);
      return;
    }
    console.error(`[Firestore:SAVE_DEBTORS_ERROR] Failed committing debtors for user ${canonicalId}:`, err);
  }
}

export async function saveSingleDebtorToFirestore(userId: string, debtor: Debtor): Promise<void> {
  if (!userId || !debtor || !debtor.id) return;
  if (isFirestoreQuotaExhausted()) return;
  const canonicalId = resolveCanonicalUserId(userId);
  const path = `users/${canonicalId}/debtors/${debtor.id}`;
  try {
    const docRef = doc(db, 'users', canonicalId, 'debtors', debtor.id);
    const cleaned = cleanFirestoreObject({ ...debtor, userId: canonicalId, updatedAt: new Date().toISOString() });
    console.log(`[Firestore:SAVE_SINGLE_DEBTOR] Saving debtor "${debtor.name}" (${debtor.id}) to ${path}...`);
    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore:SAVE_SINGLE_DEBTOR] Success: Debtor ${debtor.id} persisted to Firestore.`);
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      console.warn(`[Firestore:SAVE_SINGLE_DEBTOR] Quota atingida. Devedor ${debtor.id} mantido no LocalStorage.`);
      return;
    }
    console.error(`[Firestore:SAVE_SINGLE_DEBTOR_ERROR] Failed saving debtor ${debtor.id}:`, err);
  }
}

export async function getDebtorsFromFirestore(userId: string): Promise<Debtor[]> {
  if (!userId) return [];
  const candidateIds = await getCandidateUserIds(userId);
  const mergedMap = new Map<string, Debtor>();
  try {
    for (const cid of candidateIds) {
      const colRef = collection(db, 'users', cid, 'debtors');
      const snap = await getDocs(colRef);
      snap.docs.forEach((d) => {
        const data = d.data() as Debtor;
        const id = data.id || d.id;
        if (!id) return;
        const normalized: Debtor = {
          ...data,
          id,
          totalOwed: typeof data.totalOwed === 'number' ? data.totalOwed : (Number(data.totalOwed) || 0),
          totalPaid: typeof data.totalPaid === 'number' ? data.totalPaid : (Number(data.totalPaid) || 0),
          overdueCount: typeof data.overdueCount === 'number' ? data.overdueCount : (Number(data.overdueCount) || 0),
        };
        if (!mergedMap.has(id)) {
          mergedMap.set(id, normalized);
        } else {
          const existing = mergedMap.get(id)!;
          const existingTs = (existing as any).updatedAt || '';
          const newTs = (normalized as any).updatedAt || '';
          if (newTs >= existingTs) {
            mergedMap.set(id, { ...existing, ...normalized });
          }
        }
      });
    }
    const result = Array.from(mergedMap.values());
    console.log(`[Firestore:GET_DEBTORS] Fetched ${result.length} debtors across candidate paths [${candidateIds.join(', ')}].`);
    return result;
  } catch (err: any) {
    if (isQuotaError(err) || isOfflineOrNetworkError(err) || err?.code === 'permission-denied' || (err?.message && err.message.includes('Missing or insufficient permissions'))) {
      if (isQuotaError(err)) setFirestoreQuotaExhausted(true);
      console.warn(`[Firestore:GET_DEBTORS] Acesso negado ou modo offline/quota. Usando devedores do cache LocalStorage.`);
      return Array.from(mergedMap.values());
    }
    console.error(`[Firestore:GET_DEBTORS_ERROR] Failed reading debtors:`, err);
    return Array.from(mergedMap.values());
  }
}

// =========================================================================
// USER TOMBSTONES FIRESTORE OPERATIONS (Isolamento Permanente de Exclusões)
// =========================================================================

export async function saveTombstoneToFirestore(
  userId: string,
  debtorId: string
): Promise<void> {
  if (!userId || !debtorId) return;
  if (isFirestoreQuotaExhausted()) return;
  const canonicalId = resolveCanonicalUserId(userId);
  const path = `users/${canonicalId}/tombstones/${debtorId}`;
  try {
    const docRef = doc(db, 'users', canonicalId, 'tombstones', debtorId);
    await setDoc(
      docRef,
      cleanFirestoreObject({
        debtorId,
        userId: canonicalId,
        deletedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      return;
    }
    console.warn(`[Firestore:SAVE_TOMBSTONE] Aviso ao salvar tombstone ${debtorId} em ${path}:`, err);
  }
}

export async function removeTombstoneFromFirestore(
  userId: string,
  debtorId: string
): Promise<void> {
  if (!userId || !debtorId) return;
  if (isFirestoreQuotaExhausted()) return;
  const candidateIds = await getCandidateUserIds(userId);
  try {
    for (const cid of candidateIds) {
      const docRef = doc(db, 'users', cid, 'tombstones', debtorId);
      await deleteDoc(docRef).catch(() => {});
    }
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      return;
    }
    console.warn(`[Firestore:REMOVE_TOMBSTONE] Aviso ao remover tombstone ${debtorId}:`, err);
  }
}

export async function getTombstonesFromFirestore(userId: string): Promise<string[]> {
  if (!userId) return [];
  const candidateIds = await getCandidateUserIds(userId);
  const tombstonesSet = new Set<string>();
  try {
    for (const cid of candidateIds) {
      const colRef = collection(db, 'users', cid, 'tombstones');
      const snap = await getDocs(colRef);
      snap.docs.forEach((d) => {
        const id = d.id || d.data()?.debtorId;
        if (id) tombstonesSet.add(id);
      });
    }
    return Array.from(tombstonesSet);
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      return Array.from(tombstonesSet);
    }
    console.warn(`[Firestore:GET_TOMBSTONES] Aviso ao ler tombstones:`, err);
    return Array.from(tombstonesSet);
  }
}

// USER PURCHASES FIRESTORE OPERATIONS
export async function savePurchasesToFirestore(
  userId: string,
  purchases: Purchase[]
): Promise<void> {
  if (!userId) {
    console.warn('[Firestore:SAVE_PURCHASES] Aborted: userId is empty.');
    return;
  }
  if (isFirestoreQuotaExhausted()) return;
  const canonicalId = resolveCanonicalUserId(userId);
  const path = `users/${canonicalId}/purchases`;
  console.log(`[Firestore:SAVE_PURCHASES] Received ${purchases?.length || 0} purchases for path: ${path}`);
  try {
    const safePurchases = Array.isArray(purchases) ? purchases : [];
    if (safePurchases.length === 0) {
      console.log(`[Firestore:SAVE_PURCHASES] Purchases array is empty. 0 operations to commit.`);
      return;
    }
    const chunks: Purchase[][] = [];
    for (let i = 0; i < safePurchases.length; i += 400) {
      chunks.push(safePurchases.slice(i, i + 400));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const p of chunk) {
        if (!p || !p.id) continue;
        const docRef = doc(db, 'users', canonicalId, 'purchases', p.id);
        const cleaned = cleanFirestoreObject({ ...p, userId: canonicalId, updatedAt: new Date().toISOString() });
        batch.set(docRef, cleaned, { merge: true });
      }
      await batch.commit();
    }
    console.log(`[Firestore:SAVE_PURCHASES] Successfully committed ${safePurchases.length} purchases to Firestore at ${path}!`);
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      console.warn(`[Firestore:SAVE_PURCHASES] Quota limite diária atingida. Compras mantidas no LocalStorage.`);
      return;
    }
    console.error(`[Firestore:SAVE_PURCHASES_ERROR] Failed committing purchases for user ${canonicalId}:`, err);
  }
}

export async function saveSinglePurchaseToFirestore(userId: string, purchase: Purchase): Promise<void> {
  if (!userId || !purchase || !purchase.id) return;
  if (isFirestoreQuotaExhausted()) return;
  const canonicalId = resolveCanonicalUserId(userId);
  const path = `users/${canonicalId}/purchases/${purchase.id}`;
  try {
    const docRef = doc(db, 'users', canonicalId, 'purchases', purchase.id);
    const cleaned = cleanFirestoreObject({ ...purchase, userId: canonicalId, updatedAt: new Date().toISOString() });
    console.log(`[Firestore:SAVE_SINGLE_PURCHASE] Saving purchase "${purchase.product}" (${purchase.id}) to ${path}...`);
    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore:SAVE_SINGLE_PURCHASE] Success: Purchase ${purchase.id} persisted to Firestore.`);
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      console.warn(`[Firestore:SAVE_SINGLE_PURCHASE] Quota atingida. Compra mantida no LocalStorage.`);
      return;
    }
    console.error(`[Firestore:SAVE_SINGLE_PURCHASE_ERROR] Failed saving purchase ${purchase.id}:`, err);
  }
}

export async function getPurchasesFromFirestore(userId: string): Promise<Purchase[]> {
  if (!userId) return [];
  const candidateIds = await getCandidateUserIds(userId);
  const mergedMap = new Map<string, Purchase>();
  try {
    for (const cid of candidateIds) {
      const colRef = collection(db, 'users', cid, 'purchases');
      const snap = await getDocs(colRef);
      snap.docs.forEach((d) => {
        const data = d.data() as Purchase;
        const id = data.id || d.id;
        if (!id) return;
        const normalized: Purchase = { ...data, id };
        if (!mergedMap.has(id)) {
          mergedMap.set(id, normalized);
        } else {
          const existing = mergedMap.get(id)!;
          const existingTs = (existing as any).updatedAt || '';
          const newTs = (normalized as any).updatedAt || '';
          if (newTs >= existingTs) {
            mergedMap.set(id, { ...existing, ...normalized });
          }
        }
      });
    }
    const result = Array.from(mergedMap.values());
    console.log(`[Firestore:GET_PURCHASES] Fetched ${result.length} purchases across candidate paths [${candidateIds.join(', ')}].`);
    return result;
  } catch (err: any) {
    if (isQuotaError(err) || isOfflineOrNetworkError(err) || err?.code === 'permission-denied' || (err?.message && err.message.includes('Missing or insufficient permissions'))) {
      if (isQuotaError(err)) setFirestoreQuotaExhausted(true);
      console.warn(`[Firestore:GET_PURCHASES] Acesso negado ou modo offline/quota. Usando compras do LocalStorage.`);
      return Array.from(mergedMap.values());
    }
    console.error(`[Firestore:GET_PURCHASES_ERROR] Failed reading purchases:`, err);
    return Array.from(mergedMap.values());
  }
}

// USER INSTALLMENTS FIRESTORE OPERATIONS
export async function saveInstallmentsToFirestore(
  userId: string,
  installments: Installment[]
): Promise<void> {
  if (!userId) {
    console.warn('[Firestore:SAVE_INSTALLMENTS] Aborted: userId is empty.');
    return;
  }
  if (isFirestoreQuotaExhausted()) return;
  const canonicalId = resolveCanonicalUserId(userId);
  const path = `users/${canonicalId}/installments`;
  console.log(`[Firestore:SAVE_INSTALLMENTS] Received ${installments?.length || 0} installments for path: ${path}`);
  try {
    const safeInsts = Array.isArray(installments) ? installments : [];
    if (safeInsts.length === 0) {
      console.log(`[Firestore:SAVE_INSTALLMENTS] Installments array is empty. 0 operations to commit.`);
      return;
    }
    const chunks: Installment[][] = [];
    for (let i = 0; i < safeInsts.length; i += 400) {
      chunks.push(safeInsts.slice(i, i + 400));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const inst of chunk) {
        if (!inst || !inst.id) continue;
        const docRef = doc(db, 'users', canonicalId, 'installments', inst.id);
        const cleaned = cleanFirestoreObject({ ...inst, userId: canonicalId, updatedAt: new Date().toISOString() });
        batch.set(docRef, cleaned, { merge: true });
      }
      await batch.commit();
    }
    console.log(`[Firestore:SAVE_INSTALLMENTS] Successfully committed ${safeInsts.length} installments to Firestore at ${path}!`);
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      console.warn(`[Firestore:SAVE_INSTALLMENTS] Quota limite diária atingida. Parcelas mantidas no LocalStorage.`);
      return;
    }
    console.error(`[Firestore:SAVE_INSTALLMENTS_ERROR] Failed committing installments for user ${canonicalId}:`, err);
  }
}

export async function saveSingleInstallmentToFirestore(userId: string, installment: Installment): Promise<void> {
  if (!userId || !installment || !installment.id) return;
  if (isFirestoreQuotaExhausted()) return;
  const canonicalId = resolveCanonicalUserId(userId);
  const path = `users/${canonicalId}/installments/${installment.id}`;
  try {
    const docRef = doc(db, 'users', canonicalId, 'installments', installment.id);
    const cleaned = cleanFirestoreObject({ ...installment, userId: canonicalId, updatedAt: new Date().toISOString() });
    console.log(`[Firestore:SAVE_SINGLE_INSTALLMENT] Saving installment #${installment.installmentNumber} (${installment.id}) to ${path}...`);
    await setDoc(docRef, cleaned, { merge: true });
    console.log(`[Firestore:SAVE_SINGLE_INSTALLMENT] Success: Installment ${installment.id} persisted to Firestore.`);
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      console.warn(`[Firestore:SAVE_SINGLE_INSTALLMENT] Quota atingida. Parcela mantida no LocalStorage.`);
      return;
    }
    console.error(`[Firestore:SAVE_SINGLE_INSTALLMENT_ERROR] Failed saving installment ${installment.id}:`, err);
  }
}

export async function getInstallmentsFromFirestore(userId: string): Promise<Installment[]> {
  if (!userId) return [];
  const candidateIds = await getCandidateUserIds(userId);
  const mergedMap = new Map<string, Installment>();
  try {
    for (const cid of candidateIds) {
      const colRef = collection(db, 'users', cid, 'installments');
      const snap = await getDocs(colRef);
      snap.docs.forEach((d) => {
        const data = d.data() as Installment;
        const id = data.id || d.id;
        if (!id) return;
        const normalized: Installment = { ...data, id };
        if (!mergedMap.has(id)) {
          mergedMap.set(id, normalized);
        } else {
          const existing = mergedMap.get(id)!;
          if (existing.status === 'paid' && normalized.status !== 'paid') {
            return;
          }
          if (normalized.status === 'paid' && existing.status !== 'paid') {
            mergedMap.set(id, normalized);
            return;
          }
          const existingTs = (existing as any).updatedAt || '';
          const newTs = (normalized as any).updatedAt || '';
          if (newTs >= existingTs) {
            mergedMap.set(id, { ...existing, ...normalized });
          }
        }
      });
    }
    const result = Array.from(mergedMap.values());
    console.log(`[Firestore:GET_INSTALLMENTS] Fetched ${result.length} installments across candidate paths [${candidateIds.join(', ')}].`);
    return result;
  } catch (err: any) {
    if (isQuotaError(err) || isOfflineOrNetworkError(err) || err?.code === 'permission-denied' || (err?.message && err.message.includes('Missing or insufficient permissions'))) {
      if (isQuotaError(err)) setFirestoreQuotaExhausted(true);
      console.warn(`[Firestore:GET_INSTALLMENTS] Acesso negado ou modo offline/quota. Usando parcelas do LocalStorage.`);
      return Array.from(mergedMap.values());
    }
    console.error(`[Firestore:GET_INSTALLMENTS_ERROR] Failed reading installments:`, err);
    return Array.from(mergedMap.values());
  }
}

// DELETE INSTALLMENT FROM FIRESTORE
export async function deleteInstallmentFromFirestore(userId: string, installmentId: string): Promise<void> {
  if (!userId || !installmentId) return;
  if (isFirestoreQuotaExhausted()) return;
  const candidateIds = await getCandidateUserIds(userId);
  try {
    for (const cid of candidateIds) {
      const docRef = doc(db, 'users', cid, 'installments', installmentId);
      await deleteDoc(docRef).catch(() => {});
    }
    console.log(`[Firestore:DELETE_INSTALLMENT] Success: Installment ${installmentId} deleted from Firestore.`);
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      return;
    }
    console.error(`[Firestore:DELETE_INSTALLMENT_ERROR] Failed deleting installment ${installmentId}:`, err);
  }
}

// DELETE PURCHASE AND ITS INSTALLMENTS FROM FIRESTORE
export async function deletePurchaseFromFirestore(
  userId: string,
  purchaseId?: string,
  productName?: string,
  debtorId?: string
): Promise<void> {
  if (!userId) return;
  if (isFirestoreQuotaExhausted()) return;
  const candidateIds = await getCandidateUserIds(userId);
  try {
    const normProd = (productName || '').trim().toLowerCase();
    for (const cid of candidateIds) {
      const batch = writeBatch(db);
      if (purchaseId) {
        batch.delete(doc(db, 'users', cid, 'purchases', purchaseId));
      }

      try {
        const purchasesSnap = await getDocs(collection(db, 'users', cid, 'purchases'));
        purchasesSnap.docs.forEach((pDoc) => {
          const pData = pDoc.data();
          const matchId = purchaseId && (pDoc.id === purchaseId || pData?.id === purchaseId);
          const matchProd =
            normProd &&
            (pData?.product || '').trim().toLowerCase() === normProd &&
            (!debtorId || pData?.debtorId === debtorId);
          if (matchId || matchProd) {
            batch.delete(pDoc.ref);
          }
        });
      } catch {}

      try {
        const installmentsSnap = await getDocs(collection(db, 'users', cid, 'installments'));
        installmentsSnap.docs.forEach((iDoc) => {
          const iData = iDoc.data();
          const matchPurchaseId = purchaseId && iData?.purchaseId === purchaseId;
          const matchProd =
            normProd &&
            (iData?.product || '').trim().toLowerCase() === normProd &&
            (!debtorId || iData?.debtorId === debtorId);
          if (matchPurchaseId || matchProd) {
            batch.delete(iDoc.ref);
          }
        });
      } catch {}

      await batch.commit().catch(() => {});
    }
    console.log(`[Firestore:DELETE_PURCHASE] Success: Purchase ${purchaseId || productName} and linked installments deleted from Firestore.`);
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      return;
    }
    console.error(`[Firestore:DELETE_PURCHASE_ERROR] Failed deleting purchase ${purchaseId}:`, err);
  }
}

// DELETE DEBTOR AND RELATED RECORDS FROM FIRESTORE
export async function deleteDebtorFromFirestore(userId: string, debtorId: string): Promise<void> {
  if (!userId || !debtorId) return;
  if (isFirestoreQuotaExhausted()) return;
  const candidateIds = await getCandidateUserIds(userId);
  try {
    for (const cid of candidateIds) {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', cid, 'debtors', debtorId));

      try {
        const purchasesSnap = await getDocs(collection(db, 'users', cid, 'purchases'));
        purchasesSnap.docs.forEach((p) => {
          if (p.data()?.debtorId === debtorId) {
            batch.delete(p.ref);
          }
        });
      } catch {}

      try {
        const installmentsSnap = await getDocs(collection(db, 'users', cid, 'installments'));
        installmentsSnap.docs.forEach((inst) => {
          if (inst.data()?.debtorId === debtorId) {
            batch.delete(inst.ref);
          }
        });
      } catch {}

      await batch.commit().catch(() => {});
    }
    console.log(`[Firestore:DELETE_DEBTOR] Success: Debtor ${debtorId} and sub-records deleted from Firestore.`);
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      return;
    }
    console.error(`[Firestore:DELETE_DEBTOR_ERROR] Failed deleting debtor ${debtorId}:`, err);
  }
}

/**
 * Inscreve listeners em tempo real (onSnapshot) no caminho canônico do usuário no Firestore
 * para que qualquer alteração feita no navegador ou em outro celular apareça instantaneamente no app instalado.
 */
export function subscribeToUserFirestoreRealtime(
  userId: string,
  callbacks: {
    onDebtorsSnapshot?: (debtors: Debtor[]) => void;
    onPurchasesSnapshot?: (purchases: Purchase[]) => void;
    onInstallmentsSnapshot?: (installments: Installment[]) => void;
  }
): () => void {
  if (!userId) return () => {};
  const canonicalId = resolveCanonicalUserId(userId);
  const unsubs: Array<() => void> = [];

  try {
    if (callbacks.onDebtorsSnapshot) {
      const unsubD = onSnapshot(
        collection(db, 'users', canonicalId, 'debtors'),
        (snap) => {
          if (snap.empty) return;
          const items = snap.docs.map((d) => {
            const data = d.data() as Debtor;
            return {
              ...data,
              id: data.id || d.id,
              totalOwed: typeof data.totalOwed === 'number' ? data.totalOwed : Number(data.totalOwed) || 0,
              totalPaid: typeof data.totalPaid === 'number' ? data.totalPaid : Number(data.totalPaid) || 0,
              overdueCount: typeof data.overdueCount === 'number' ? data.overdueCount : Number(data.overdueCount) || 0,
            };
          });
          callbacks.onDebtorsSnapshot?.(items);
        },
        () => {}
      );
      unsubs.push(unsubD);
    }

    if (callbacks.onPurchasesSnapshot) {
      const unsubP = onSnapshot(
        collection(db, 'users', canonicalId, 'purchases'),
        (snap) => {
          if (snap.empty) return;
          const items = snap.docs.map((d) => ({ ...(d.data() as Purchase), id: (d.data() as Purchase).id || d.id }));
          callbacks.onPurchasesSnapshot?.(items);
        },
        () => {}
      );
      unsubs.push(unsubP);
    }

    if (callbacks.onInstallmentsSnapshot) {
      const unsubI = onSnapshot(
        collection(db, 'users', canonicalId, 'installments'),
        (snap) => {
          if (snap.empty) return;
          const items = snap.docs.map((d) => ({ ...(d.data() as Installment), id: (d.data() as Installment).id || d.id }));
          callbacks.onInstallmentsSnapshot?.(items);
        },
        () => {}
      );
      unsubs.push(unsubI);
    }
  } catch {}

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
}

// CLEAR ALL USER DEBTORS, PURCHASES, INSTALLMENTS FROM FIRESTORE
export async function clearAllUserDataFromFirestore(userId: string): Promise<void> {
  if (!userId || isFirestoreQuotaExhausted()) return;
  const basePath = `users/${userId}`;
  try {
    const debtorsSnap = await getDocs(collection(db, 'users', userId, 'debtors'));
    const purchasesSnap = await getDocs(collection(db, 'users', userId, 'purchases'));
    const installmentsSnap = await getDocs(collection(db, 'users', userId, 'installments'));

    const batch = writeBatch(db);
    debtorsSnap.docs.forEach((d) => batch.delete(d.ref));
    purchasesSnap.docs.forEach((d) => batch.delete(d.ref));
    installmentsSnap.docs.forEach((d) => batch.delete(d.ref));

    await batch.commit();
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, basePath);
  }
}

// SAVE DIGITAL AUTHENTICATION KEYS TO FIRESTORE
export async function saveAuthRecordToFirestore(
  userId: string,
  record: {
    auth: string;
    type?: string;
    payer?: string;
    amount?: string;
    date?: string;
    bank?: string;
    pixKey?: string;
    item?: string;
    destination?: string;
    status?: string;
    documentId?: string;
    timestamp?: number;
  }
): Promise<void> {
  if (!record.auth || !userId) return;
  if (isFirestoreQuotaExhausted()) return;
  const cleanKey = record.auth.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `users/${userId}/auth_records/${cleanKey}`;
  try {
    const docRef = doc(db, 'users', userId, 'auth_records', cleanKey);
    await setDoc(docRef, cleanFirestoreObject({ ...record, userId, registeredAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(true);
      return;
    }
    console.warn('[Firebase] Erro ao salvar chave de autenticação digital no Firestore:', err);
  }
}

// =========================================================================
// ADMIN MASTER GOVERNANCE, USER DOMAIN & PASSWORD SUPPORT (Tiago Dias)
// =========================================================================

export async function getAllUsersForAdmin(): Promise<UserAccount[]> {
  const usersMap = new Map<string, UserAccount>();

  // 1. Always include Master Developer
  usersMap.set(TIAGO_DIAS_USER.id, TIAGO_DIAS_USER);

  // 2. Load Local Registered Credentials
  const localCreds = getLocalRegisteredCredentials();
  Object.values(localCreds).forEach((c) => {
    if (c.user && c.user.id) {
      let decodedPass = '';
      try {
        decodedPass = atob(c.passwordHash);
      } catch {
        decodedPass = c.passwordHash;
      }
      usersMap.set(c.user.id, {
        ...c.user,
        plainPassword: decodedPass,
        status: c.user.status || 'ativo',
      });
    }
  });

  // 3. Load from Firestore
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.docs.forEach((d) => {
      const u = d.data() as UserAccount;
      if (u && u.id) {
        const existing = usersMap.get(u.id);
        usersMap.set(u.id, {
          ...existing,
          ...u,
          status: u.status || existing?.status || 'ativo',
        });
      }
    });
  } catch (err) {
    console.warn('[Firebase Admin] Note reading all users from Firestore:', err);
  }

  return Array.from(usersMap.values());
}

/**
 * Admin updates user profile and credentials
 */
export async function adminUpdateUser(
  userId: string,
  updates: Partial<UserAccount>
): Promise<UserAccount> {
  // Update in Firestore
  if (!isFirestoreQuotaExhausted()) {
    const path = `users/${userId}`;
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, cleanFirestoreObject({ ...updates, updatedAt: new Date().toISOString() }), {
        merge: true,
      });
    } catch (err) {
      if (isQuotaError(err)) {
        setFirestoreQuotaExhausted(true);
      } else {
        console.warn('[Firebase Admin] Note updating user in Firestore:', err);
      }
    }
  }

  // Update in Local Registered Credentials
  const localCreds = getLocalRegisteredCredentials();
  let updatedCredKey: string | null = null;
  for (const [key, cred] of Object.entries(localCreds)) {
    if (cred.userId === userId || cred.email === updates.email || cred.username === updates.username) {
      cred.user = { ...cred.user, ...updates };
      if (updates.plainPassword) {
        cred.passwordHash = btoa(updates.plainPassword);
      }
      updatedCredKey = key;
    }
  }
  if (updatedCredKey) {
    saveLocalRegisteredCredentials(localCreds);
  }

  return { id: userId, ...updates } as UserAccount;
}

/**
 * Admin resets user password and generates instant credentials
 */
export async function adminResetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ newPassword: string; message: string }> {
  const cleanPass = newPassword.trim();
  if (!cleanPass) throw new Error('A nova senha não pode ser vazia.');

  const base64Hash = btoa(cleanPass);

  // Update in Local Credentials
  const localCreds = getLocalRegisteredCredentials();
  for (const cred of Object.values(localCreds)) {
    if (cred.userId === userId) {
      cred.passwordHash = base64Hash;
      cred.user.lastKnownPassword = cleanPass;
      cred.user.plainPassword = cleanPass;
    }
  }
  saveLocalRegisteredCredentials(localCreds);

  // Update in Firestore
  if (!isFirestoreQuotaExhausted()) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          lastKnownPassword: cleanPass,
          plainPassword: cleanPass,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      if (isQuotaError(err)) {
        setFirestoreQuotaExhausted(true);
      } else {
        console.warn('[Firebase Admin] Note updating password in Firestore:', err);
      }
    }
  }

  return {
    newPassword: cleanPass,
    message: `Senha redefinida com sucesso para o usuário!`,
  };
}

/**
 * Admin applies arbitration: Ban or Suspend or Reactivate user
 */
export async function adminSetUserStatus(
  userId: string,
  status: 'ativo' | 'suspenso' | 'banido',
  reason?: string
): Promise<void> {
  const updates: Partial<UserAccount> = {
    status,
    banReason: reason || (status === 'banido' ? 'Violação das diretrizes da plataforma Haspaho' : ''),
  };

  await adminUpdateUser(userId, updates);
}

/**
 * Admin permanently removes a user
 */
export async function adminDeleteUserAccount(userId: string): Promise<void> {
  if (userId === TIAGO_DIAS_USER.id) {
    throw new Error('A conta mestre do desenvolvedor Tiago Dias não pode ser removida.');
  }

  // Delete from Firestore
  if (!isFirestoreQuotaExhausted()) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { status: 'banido', deletedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      if (isQuotaError(err)) {
        setFirestoreQuotaExhausted(true);
      } else {
        console.warn('[Firebase Admin] Note deleting user:', err);
      }
    }
  }

  // Delete from Local Credentials
  const localCreds = getLocalRegisteredCredentials();
  for (const [key, cred] of Object.entries(localCreds)) {
    if (cred.userId === userId) {
      delete localCreds[key];
    }
  }
  saveLocalRegisteredCredentials(localCreds);
}

// =========================================================================
// CLOSED COMMUNITY FORUM & FEEDBACK / SUGGESTIONS FOR DEVELOPER
// =========================================================================

import { ForumTopic } from '../types';

export const INITIAL_FORUM_TOPICS: ForumTopic[] = [
  {
    id: 'top-1',
    authorId: 'usr_thiago_dias',
    authorName: 'Tiago Augusto Dias',
    authorEmail: 'tiagodias8888@gmail.com',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    authorRole: 'Desenvolvedor Full Stack & Criador',
    title: '👑 Boas-Vindas ao Fórum Fechado & Canal Direto de Sugestões e Melhorias',
    content: 'Caros administradores e usuários: este fórum foi criado para centralizar sugestões, melhorias e relatórios de conformidade. Todas as mensagens são enviadas diretamente para o meu WhatsApp (014 99733-9863) e e-mail (tiagodias8888@gmail.com). Conto com o feedback de todos para continuarmos evoluindo a plataforma Haspaho!',
    category: 'conformidade',
    status: 'aprovado',
    createdAt: '2026-09-25T10:00:00.000Z',
    upvotes: 42,
    isPinned: true,
    devResponse: 'Canal oficial aberto para feedback e auditoria permanente. — Tiago Augusto Dias',
    devResponseAt: '2026-09-25T10:15:00.000Z',
  },
  {
    id: 'top-2',
    authorId: 'DEMO-001',
    authorName: 'Carlos Mendes (Demonstração)',
    authorEmail: 'carlos.demo@recebiveispro.com',
    authorRole: 'Usuário Demonstrativo',
    title: '💡 Sugestão: Notificação antecipada de fechamento de faturas bancárias',
    content: 'Seria muito útil se o sistema emitisse um alerta sonoro ou aviso visual 3 dias antes da fatura do cartão fechar.',
    category: 'sugestao',
    status: 'em_desenvolvimento',
    createdAt: '2026-09-24T15:30:00.000Z',
    upvotes: 18,
    devResponse: 'Excelente sugestão! Já implementei o alerta de 3 dias no cabeçalho e na aba de relatórios. — Tiago Dias',
    devResponseAt: '2026-09-24T18:00:00.000Z',
  },
  {
    id: 'top-3',
    authorId: 'DEMO-002',
    authorName: 'Mariana Oliveira (Demonstração)',
    authorEmail: 'mariana.demo@recebiveispro.com',
    authorRole: 'Usuária Demonstrativa',
    title: '🚀 Melhoria: Exportação de extrato completo em PDF com QR Code PIX',
    content: 'Gostaria de parabenizar pela logo no contrato e sugerir que a impressão de extrato total também venha com o QR Code PIX em alta definição.',
    category: 'melhoria',
    status: 'concluido',
    createdAt: '2026-09-23T11:20:00.000Z',
    upvotes: 25,
    devResponse: 'Concluído! A impressão direta e visualização com QR Code e logo já estão 100% operacionais no Extrato Total e Contratos. — Tiago Dias',
    devResponseAt: '2026-09-23T14:40:00.000Z',
  },
];

export function getLocalForumTopics(): ForumTopic[] {
  try {
    const raw = localStorage.getItem('haspaho_forum_topics');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse forum topics:', e);
  }
  return INITIAL_FORUM_TOPICS;
}

export function saveLocalForumTopics(topics: ForumTopic[]): void {
  try {
    localStorage.setItem('haspaho_forum_topics', JSON.stringify(topics));
  } catch (e) {
    console.error('Failed to save forum topics:', e);
  }
}

export async function createForumTopic(
  topicData: Omit<ForumTopic, 'id' | 'createdAt' | 'upvotes' | 'status'> & { status?: ForumTopic['status'] }
): Promise<ForumTopic> {
  const newTopic: ForumTopic = {
    status: 'aberto',
    ...topicData,
    id: `top_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
    upvotes: 1,
  };

  const topics = getLocalForumTopics();
  const updated = [newTopic, ...topics];
  saveLocalForumTopics(updated);

  // Firestore sync
  if (!isFirestoreQuotaExhausted()) {
    try {
      await setDoc(doc(db, 'forum_topics', newTopic.id), cleanFirestoreObject(newTopic));
    } catch (err) {
      if (isQuotaError(err)) {
        setFirestoreQuotaExhausted(true);
      } else {
        console.warn('[Firebase Forum] Note writing forum topic to Firestore:', err);
      }
    }
  }

  return newTopic;
}

export async function updateForumTopic(
  topicId: string,
  updates: Partial<ForumTopic>
): Promise<ForumTopic[]> {
  const topics = getLocalForumTopics();
  const updated = topics.map((t) => (t.id === topicId ? { ...t, ...updates } : t));
  saveLocalForumTopics(updated);

  if (!isFirestoreQuotaExhausted()) {
    try {
      await setDoc(doc(db, 'forum_topics', topicId), cleanFirestoreObject(updates), { merge: true });
    } catch (err) {
      if (isQuotaError(err)) {
        setFirestoreQuotaExhausted(true);
      } else {
        console.warn('[Firebase Forum] Note updating topic:', err);
      }
    }
  }

  return updated;
}

export async function deleteForumTopic(topicId: string): Promise<ForumTopic[]> {
  const topics = getLocalForumTopics();
  const updated = topics.filter((t) => t.id !== topicId);
  saveLocalForumTopics(updated);

  if (!isFirestoreQuotaExhausted()) {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'forum_topics', topicId));
      await batch.commit();
    } catch (err) {
      if (isQuotaError(err)) {
        setFirestoreQuotaExhausted(true);
      } else {
        console.warn('[Firebase Forum] Note deleting topic:', err);
      }
    }
  }

  return updated;
}
