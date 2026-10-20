import { 
  signInWithPopup, 
  signInWithCredential,
  GoogleAuthProvider, 
  signOut, 
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { 
  auth, 
  processFirebaseUserResult, 
  getUserFromFirestore, 
  saveUserToFirestore, 
  setSafeLocalStorage,
  initializeGoogleSignInNative
} from './firebase';
import { UserAccount } from '../types';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Autenticação Google oficial
 * No Android/iOS empacotado nativamente com Capacitor usa o plugin nativo.
 * No navegador Web (celular ou desktop) utiliza o popup oficial do Firebase com seletor de contas.
 */
export async function loginWithGoogle(): Promise<UserAccount> {
  // Se for aplicativo nativo instalado (Capacitor Android APK / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      await initializeGoogleSignInNative();
      const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
      const result: any = await GoogleSignIn.signIn();
      console.log('[AuthService] Native Google Sign-In result received:', result);

      const userEmail = (
        result?.email ||
        result?.user?.email ||
        result?.profile?.email ||
        ''
      ).toLowerCase();

      const userId =
        result?.userId ||
        result?.user?.id ||
        result?.id ||
        result?.uid ||
        (userEmail ? `usr_google_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : '');

      const displayName =
        result?.displayName ||
        result?.user?.displayName ||
        result?.user?.givenName ||
        result?.givenName ||
        (userEmail ? userEmail.split('@')[0] : '');

      const photoURL =
        result?.imageUrl ||
        result?.user?.imageUrl ||
        result?.photoUrl ||
        '';

      const idToken = result?.idToken || result?.user?.idToken || result?.authentication?.idToken;

      // 1. Tenta autenticar no Firebase Auth via Credential nativo se idToken estiver presente
      if (idToken) {
        try {
          const credential = GoogleAuthProvider.credential(idToken);
          const userCredential = await signInWithCredential(auth, credential);
          const userAccount = await processFirebaseUserResult(userCredential.user);
          setSafeLocalStorage('haspaho_auth_user', JSON.stringify(userAccount));
          localStorage.removeItem('haspaho_explicit_logout');
          return userAccount;
        } catch (credErr) {
          console.warn('[AuthService] AVISO ao autenticar credential Firebase com idToken:', credErr);
        }
      }

      // 2. Login direto com o perfil de usuário retornado pelo Google Play Services nativo
      if (userEmail || userId) {
        const userAccount = await processFirebaseUserResult({
          uid: userId || `usr_google_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: userEmail,
          displayName,
          photoURL,
        });
        setSafeLocalStorage('haspaho_auth_user', JSON.stringify(userAccount));
        localStorage.removeItem('haspaho_explicit_logout');
        return userAccount;
      }

      throw new Error('Nenhuma conta foi selecionada no seletor nativo.');
    } catch (err: any) {
      console.warn('[AuthService] AVISO / Erro no plugin nativo Google:', err);
      const errMsg = err?.message || String(err || '');
      const errCode = String(err?.code || '');

      if (
        errCode === '12501' ||
        errCode === '10' ||
        errMsg.includes('cancel') ||
        errMsg.includes('closed') ||
        errMsg.includes('12501')
      ) {
        console.info('[AuthService] Seleção de conta Google cancelada pelo usuário.');
        throw new Error('A seleção de conta do Google foi cancelada.');
      }

      // CRÍTICO: No aplicativo nativo, NUNCA abre a página web externa de digitar e-mail (isentropic-tangent-sdtd0.firebaseapp.com)
      throw new Error(
        'Falha ao conectar com a conta Google nativa selecionada. Por favor, tente novamente.'
      );
    }
  }

  // Fluxo padrão para navegadores Web (Desktop, Smartphone Chrome, Safari, etc.)
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const userAccount = await processFirebaseUserResult(result.user);
    setSafeLocalStorage('haspaho_auth_user', JSON.stringify(userAccount));
    localStorage.removeItem('haspaho_explicit_logout');
    return userAccount;
  } catch (popupError: any) {
    if (popupError?.code === 'auth/popup-closed-by-user' || popupError?.code === 'auth/cancelled-popup-request') {
      console.info('[AuthService] Janela de login do Google fechada ou cancelada pelo usuário.');
    } else {
      console.error('[AuthService] Erro no popup do Google:', popupError);
    }
    if (popupError?.code === 'auth/popup-blocked') {
      throw new Error('O navegador bloqueou a janela de autenticação. Por favor, permita pop-ups para este site e tente novamente.');
    }
    if (popupError?.code === 'auth/popup-closed-by-user') {
      throw new Error('A janela de seleção de conta do Google foi fechada antes de concluir o login.');
    }
    if (popupError?.code === 'auth/cancelled-popup-request') {
      throw new Error('Operação de login cancelada. Tente novamente.');
    }
    throw popupError;
  }
}

/**
 * Autenticação por conta Google selecionada ou digitada pelo usuário
 * Conecta com a conta Google de forma individual e cria/carrega o perfil seguro
 */
export async function loginWithDirectGoogleAccount(
  email: string, 
  displayName?: string
): Promise<UserAccount> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Informe um e-mail do Google válido (ex: seu.email@gmail.com).');
  }

  const generatedUid = `usr_google_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  // Tenta carregar perfil existente do Firestore se já houver
  let existing: UserAccount | null = null;
  try {
    existing = await getUserFromFirestore(generatedUid);
  } catch {}

  const finalName = displayName?.trim() || cleanEmail.split('@')[0];
  const userAccount: UserAccount = existing ? {
    ...existing,
    id: generatedUid,
    email: cleanEmail,
    authProvider: 'gmail',
    isMasterAdmin: cleanEmail === 'tiagodias8888@gmail.com',
    isFullStackDev: cleanEmail === 'tiagodias8888@gmail.com',
    isFirstLogin: false,
    hasSeenWelcome: existing.hasSeenWelcome ?? true,
  } : {
    id: generatedUid,
    name: finalName,
    username: cleanEmail.split('@')[0],
    email: cleanEmail,
    phoneWhatsapp: '',
    authProvider: 'gmail',
    companyName: 'Gestão Financeira Google',
    city: 'Brasil',
    state: 'BR',
    role: cleanEmail === 'tiagodias8888@gmail.com' ? 'Administrador' : 'Usuário Gestor',
    pixKey: cleanEmail,
    createdAt: new Date().toISOString(),
    isFirstLogin: false,
    hasSeenWelcome: true,
    isMasterAdmin: cleanEmail === 'tiagodias8888@gmail.com',
    isFullStackDev: cleanEmail === 'tiagodias8888@gmail.com',
    status: 'ativo',
  };

  try {
    await saveUserToFirestore(userAccount);
  } catch {}

  setSafeLocalStorage('haspaho_auth_user', JSON.stringify(userAccount));
  localStorage.removeItem('haspaho_explicit_logout');
  return userAccount;
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('[AuthService] Erro ao deslogar do Firebase:', err);
  }
  localStorage.removeItem('haspaho_auth_user');
  localStorage.setItem('haspaho_explicit_logout', 'true');
}
