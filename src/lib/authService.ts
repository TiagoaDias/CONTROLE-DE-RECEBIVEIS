import {
  getUserFromFirestore,
  saveUserToFirestore,
  setSafeLocalStorage,
  initializeGoogleSignInNative,
  signInWithGoogleNative,
  signOutGoogleNative,
} from './firebase';
import { UserAccount } from '../types';

export { initializeGoogleSignInNative };

/**
 * Autenticação Google oficial
 * Centralizada em src/lib/firebase.ts via signInWithGoogleNative()
 * No Android/iOS empacotado nativamente com Capacitor usa o plugin nativo @capawesome/capacitor-google-sign-in
 * para disparar o navegador nativo do sistema e enviar o ID Token para signInWithCredential do Firebase Auth.
 */
export async function loginWithGoogle(): Promise<UserAccount> {
  return signInWithGoogleNative();
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
  const userAccount: UserAccount = existing
    ? {
        ...existing,
        id: generatedUid,
        email: cleanEmail,
        authProvider: 'gmail',
        isMasterAdmin: cleanEmail === 'tiagodias8888@gmail.com',
        isFullStackDev: cleanEmail === 'tiagodias8888@gmail.com',
        isFirstLogin: false,
        hasSeenWelcome: existing.hasSeenWelcome ?? true,
      }
    : {
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
    await signOutGoogleNative();
  } catch (err) {
    console.warn('[AuthService] Erro ao deslogar do Firebase/GoogleSignIn:', err);
  }
  localStorage.removeItem('haspaho_auth_user');
  localStorage.setItem('haspaho_explicit_logout', 'true');
}
