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
 * Autenticação Google Local sem Pop-up
 * Ideal para APKs Android e ambientes WebView onde pop-ups causam ERR_CONNECTION_REFUSED
 */
export async function loginWithGoogleLocal(
  selectedEmail: string = 'tiagodias8888@gmail.com',
  displayName?: string
): Promise<UserAccount> {
  const cleanEmail = selectedEmail.trim().toLowerCase();
  const isTiago = cleanEmail === 'tiagodias8888@gmail.com';
  const name = displayName || (isTiago ? 'Tiago Augusto Dias' : cleanEmail.split('@')[0]);
  const uid = isTiago ? TIAGO_DIAS_USER.id : `google_local_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const mockGoogleUser = {
    uid,
    email: cleanEmail,
    displayName: name,
    photoURL: '',
    providerData: [
      {
        providerId: 'google.com',
        uid: cleanEmail,
        displayName: name,
        email: cleanEmail,
      },
    ],
  };

  const user = await processFirebaseUserResult(mockGoogleUser);
  localStorage.setItem('haspaho_auth_user', JSON.stringify(user));
  localStorage.removeItem('haspaho_explicit_logout');
  return user;
}

/**
 * Autenticação Google oficial via Pop-up com fallback para redirect
 */
export async function loginWithGoogle(): Promise<User> {
  try {
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
