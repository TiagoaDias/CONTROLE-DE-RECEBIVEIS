import { 
  signInWithPopup, 
  signInWithRedirect, 
  GoogleAuthProvider, 
  signOut, 
  User
} from 'firebase/auth';
import { auth, processFirebaseUserResult, TIAGO_DIAS_USER } from './firebase';
import { UserAccount } from '../types';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});


/**
 * Autenticação Google oficial via Pop-up com fallback para redirect
 */
export async function loginWithGoogle(): Promise<User> {
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

  if (isMobile) {
    try {
      await signInWithRedirect(auth, googleProvider);
      throw new Error('REDIRECT_INITIATED');
    } catch (err: any) {
      console.warn('[AuthService] Redirect falhou:', err);
      throw err;
    }
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (popupError: any) {
    console.warn('[AuthService] Popup falhou, tentando fallback redirect:', popupError);
    try {
      await signInWithRedirect(auth, googleProvider);
      throw new Error('REDIRECT_INITIATED');
    } catch (redirectError: any) {
      console.warn('[AuthService] Redirect fallback falhou:', redirectError);
      throw redirectError;
    }
  }
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
