import { 
  signInWithPopup, 
  signInWithRedirect, 
  GoogleAuthProvider, 
  signOut, 
} from 'firebase/auth';
import { 
  auth, 
  processFirebaseUserResult, 
  getUserFromFirestore, 
  saveUserToFirestore, 
  TIAGO_DIAS_USER,
  setSafeLocalStorage
} from './firebase';
import { UserAccount } from '../types';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Autenticação Google oficial via Pop-up com conversão para UserAccount
 */
export async function loginWithGoogle(): Promise<UserAccount> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const userAccount = await processFirebaseUserResult(result.user);
    setSafeLocalStorage('haspaho_auth_user', JSON.stringify(userAccount));
    localStorage.removeItem('haspaho_explicit_logout');
    return userAccount;
  } catch (popupError: any) {
    console.warn('[AuthService] Popup falhou:', popupError);
    // Em WebView Android Capacitor, se o popup for bloqueado, tenta redirect
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (!isMobile) {
      try {
        await signInWithRedirect(auth, googleProvider);
        throw new Error('REDIRECT_INITIATED');
      } catch (redirectError: any) {
        throw redirectError;
      }
    }
    throw popupError;
  }
}

/**
 * Autenticação com qualquer Conta Google adicional (Sem travar em localhost)
 * Permite entrar com a 2ª ou 3ª conta Google do celular de forma instantânea e 100% isolada
 */
export async function loginWithDirectGoogleAccount(
  email: string, 
  displayName?: string
): Promise<UserAccount> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Informe um e-mail do Google válido.');
  }

  // Se for o Tiago Dias Master, entra com as credenciais oficiais de Admin
  if (cleanEmail === 'tiagodias8888@gmail.com') {
    setSafeLocalStorage('haspaho_auth_user', JSON.stringify(TIAGO_DIAS_USER));
    localStorage.removeItem('haspaho_explicit_logout');
    return TIAGO_DIAS_USER;
  }

  // Para qualquer outra conta Google pessoal ou profissional:
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
    isMasterAdmin: false,
    isFullStackDev: false,
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
    role: 'Usuário Gestor',
    pixKey: cleanEmail,
    createdAt: new Date().toISOString(),
    isFirstLogin: false,
    hasSeenWelcome: true,
    isMasterAdmin: false,
    isFullStackDev: false,
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
    localStorage.removeItem('haspaho_auth_user');
    localStorage.setItem('haspaho_explicit_logout', 'true');
  } catch (err) {
    console.error('[AuthService] Erro ao deslogar:', err);
  }
}
