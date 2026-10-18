import { 
  signInWithPopup, 
  signInWithRedirect, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export async function loginWithGoogle(): Promise<User> {
  try {
    // 1. Limpa qualquer sessão pendente localmente antes de iniciar
    await signOut(auth);
    
    // 2. Tenta popup (padrão)
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (popupError: any) {
      console.warn('[AuthService] Popup falhou, tentando redirect:', popupError);
      // 3. Fallback para redirect se popup for bloqueado (comum em Android WebView)
      await signInWithRedirect(auth, googleProvider);
      // O fluxo de redirect recarrega a página, a continuação é feita no onAuthStateChanged
      throw new Error('REDIRECT_INITIATED');
    }
  } catch (err: any) {
    if (err.message === 'REDIRECT_INITIATED') throw err;
    console.error('[AuthService] Erro crítico no login Google:', err);
    throw err;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
    // Limpeza de cache local específica do app e marcação de logout explícito
    localStorage.removeItem('haspaho_auth_user');
    localStorage.setItem('haspaho_explicit_logout', 'true');
  } catch (err) {
    console.error('[AuthService] Erro ao deslogar:', err);
  }
}
