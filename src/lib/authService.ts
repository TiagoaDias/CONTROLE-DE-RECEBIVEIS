import { 
  signInWithPopup, 
  signInWithRedirect, 
  GoogleAuthProvider, 
  signOut, 
  User
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export async function loginWithGoogle(): Promise<User> {
  try {
    // Tenta popup imediatamente com prompt select_account
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (popupError: any) {
    console.warn('[AuthService] Popup falhou, tentando redirect:', popupError);
    try {
      await signInWithRedirect(auth, googleProvider);
      throw new Error('REDIRECT_INITIATED');
    } catch (redirectError: any) {
      console.warn('[AuthService] Redirect falhou ou ambiente APK/WebView:', redirectError);
      if (auth.currentUser) {
        return auth.currentUser;
      }
      if (popupError.message === 'REDIRECT_INITIATED') {
        throw popupError;
      }
      throw popupError;
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
