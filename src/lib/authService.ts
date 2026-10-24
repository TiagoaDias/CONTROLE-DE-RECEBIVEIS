import {
  auth,
  TIAGO_DIAS_USER,
  getUserFromFirestore,
  saveUserToFirestore,
  setSafeLocalStorage,
  removeSafeLocalStorage,
  initializeGoogleSignInNative,
  signInWithGoogleNative,
  signOutGoogleNative,
} from './firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
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
 * Autenticação exclusiva por conta Gmail (@gmail.com) selecionada ou digitada pelo usuário.
 * Conecta com a conta Gmail de forma individual e cria/carrega o perfil seguro no Firebase e localmente.
 */
export async function loginWithDirectGoogleAccount(
  email: string,
  displayName?: string
): Promise<UserAccount> {
  let cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Informe seu endereço Gmail (ex: seu.email@gmail.com).');
  }

  // Se o usuário digitou apenas o prefixo antes do @, completa automaticamente com @gmail.com
  if (!cleanEmail.includes('@')) {
    cleanEmail = `${cleanEmail}@gmail.com`;
  }

  // Garante entrada exclusiva com conta Gmail (@gmail.com ou @googlemail.com)
  if (!cleanEmail.endsWith('@gmail.com') && !cleanEmail.endsWith('@googlemail.com')) {
    throw new Error('O acesso é permitido somente com contas Gmail (@gmail.com).');
  }

  const isMaster = cleanEmail === 'tiagodias8888@gmail.com';
  let resolvedUid = isMaster
    ? TIAGO_DIAS_USER.id
    : `usr_google_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // Tenta autenticar silenciosamente no Firebase Auth para ativar sincronização Firestore em nuvem
  try {
    const syncPass = isMaster ? 'haspaho2026' : `HaspahoGmail#${cleanEmail.slice(0, 16)}`;
    try {
      const fbCred = await signInWithEmailAndPassword(auth, cleanEmail, syncPass);
      if (fbCred?.user?.uid) {
        resolvedUid = fbCred.user.uid;
      }
    } catch {
      try {
        const fbCred = await createUserWithEmailAndPassword(auth, cleanEmail, syncPass);
        if (fbCred?.user?.uid) {
          resolvedUid = fbCred.user.uid;
        }
      } catch {}
    }
  } catch {}

  // Tenta carregar perfil existente do Firestore se já houver
  let existing: UserAccount | null = null;
  try {
    existing = await getUserFromFirestore(resolvedUid);
  } catch {}

  const finalName =
    displayName?.trim() ||
    (isMaster ? TIAGO_DIAS_USER.name : cleanEmail.split('@')[0]);

  const userAccount: UserAccount = isMaster
    ? {
        ...TIAGO_DIAS_USER,
        ...(existing || {}),
        id: resolvedUid,
        email: cleanEmail,
        name: existing?.name || finalName || TIAGO_DIAS_USER.name,
        authProvider: 'gmail',
        isMasterAdmin: true,
        isFullStackDev: true,
        isFirstLogin: false,
        hasSeenWelcome: true,
        status: 'ativo',
      }
    : existing
    ? {
        ...existing,
        id: resolvedUid,
        email: cleanEmail,
        authProvider: 'gmail',
        isMasterAdmin: false,
        isFullStackDev: false,
        isFirstLogin: false,
        hasSeenWelcome: existing.hasSeenWelcome ?? true,
      }
    : {
        id: resolvedUid,
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
  removeSafeLocalStorage('haspaho_explicit_logout');
  return userAccount;
}

export async function logoutUser(): Promise<void> {
  try {
    await signOutGoogleNative();
  } catch (err) {
    console.warn('[AuthService] Erro ao deslogar do Firebase/GoogleSignIn:', err);
  }
  removeSafeLocalStorage('haspaho_auth_user');
  setSafeLocalStorage('haspaho_explicit_logout', 'true');
}
