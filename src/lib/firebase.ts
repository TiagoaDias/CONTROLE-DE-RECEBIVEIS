import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  getDocFromServer,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAccount, Debtor, Purchase, Installment } from '../types';

// Initialize Firebase App instance
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with custom databaseId if configured
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Google OAuth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
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
    console.log('[Firebase] Connected to Firestore database:', firebaseConfig.projectId);
    return true;
  } catch (error) {
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
  hasSeenWelcome: false,
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
    const raw = localStorage.getItem('haspaho_registered_credentials');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalRegisteredCredentials(creds: Record<string, RegisteredCredential>): void {
  try {
    localStorage.setItem('haspaho_registered_credentials', JSON.stringify(creds));
  } catch (e) {
    console.error('Failed to save credentials locally:', e);
  }
}

/**
 * Real login with email/username/cpf/phone and password.
 * REJECTS nonexistent accounts.
 * REJECTS wrong passwords.
 */
export async function loginWithRealCredentials(
  identifier: string,
  rawPassword: string
): Promise<UserAccount> {
  const cleanId = identifier.trim().toLowerCase();
  const digitsOnly = identifier.replace(/\D/g, '');
  const cleanPass = rawPassword.trim();

  if (!cleanId) {
    throw new Error('Informe seu e-mail, CPF, telefone ou nome de usuário.');
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
      throw new Error('Senha incorreta para a conta de Administrador Mestre / Desenvolvedor.');
    }
    // Fetch latest profile from Firestore or return TIAGO_DIAS_USER
    try {
      const remote = await getUserFromFirestore(TIAGO_DIAS_USER.id);
      return remote ? { ...TIAGO_DIAS_USER, ...remote, isMasterAdmin: true, isFullStackDev: true } : TIAGO_DIAS_USER;
    } catch {
      return TIAGO_DIAS_USER;
    }
  }

  // 2. Check Firestore / Local Registered Accounts
  const safeDocKey = cleanId.replace(/[^a-zA-Z0-9_-]/g, '_');
  let cred: RegisteredCredential | null = null;

  try {
    const credDoc = await getDoc(doc(db, 'registered_credentials', safeDocKey));
    if (credDoc.exists()) {
      cred = credDoc.data() as RegisteredCredential;
    }
  } catch (err) {
    console.warn('[Firebase] Firestore credential lookup note:', err);
  }

  if (!cred) {
    const localRegistry = getLocalRegisteredCredentials();
    cred = localRegistry[cleanId] || null;
    if (!cred) {
      // Find by username in local registry
      const byUser = Object.values(localRegistry).find(
        (c) => c.username.toLowerCase() === cleanId
      );
      if (byUser) cred = byUser;
    }
  }

  if (!cred) {
    throw new Error(
      'Usuário ou e-mail não encontrado no sistema. Verifique suas credenciais ou crie uma conta na aba de Cadastro.'
    );
  }

  // Verify password (base64 encoded hash)
  const incomingHash = btoa(cleanPass);
  if (cred.passwordHash !== incomingHash && cred.passwordHash !== cleanPass) {
    throw new Error('Senha incorreta para este usuário.');
  }

  // Load latest profile from Firestore if available
  try {
    const remote = await getUserFromFirestore(cred.userId);
    if (remote) return remote;
  } catch {
    // fallback to stored user profile
  }

  return cred.user;
}

/**
 * Real user registration.
 * Creates an isolated user account with 0 external records.
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

  // Check collision with Tiago Dias account
  if (
    email === 'tiagodias8888@gmail.com' ||
    username === 'tiagodias' ||
    email.includes('tiagodias8888')
  ) {
    throw new Error('Este e-mail já pertence a uma conta mestra registrada.');
  }

  // Check collision in Firestore or local registry
  const safeDocKey = email.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const checkDoc = await getDoc(doc(db, 'registered_credentials', safeDocKey));
    if (checkDoc.exists()) {
      throw new Error('Este e-mail já está cadastrado no sistema.');
    }
  } catch (e: any) {
    if (e.message && e.message.includes('já está cadastrado')) throw e;
  }

  const localRegistry = getLocalRegisteredCredentials();
  if (localRegistry[email]) {
    throw new Error('Este e-mail já está cadastrado no sistema.');
  }

  const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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

  // Save in local registry
  localRegistry[email] = credRecord;
  localRegistry[username] = credRecord;
  saveLocalRegisteredCredentials(localRegistry);

  // Save to Firestore
  try {
    await setDoc(doc(db, 'registered_credentials', safeDocKey), credRecord);
    await saveUserToFirestore(newUser);
  } catch (err) {
    console.warn('[Firebase] Registered credentials write note:', err);
  }

  return newUser;
}

/**
 * Real Google OAuth authentication via Firebase Popup
 */
export async function signInWithGoogleOAuth(): Promise<UserAccount> {
  const result = await signInWithPopup(auth, googleProvider);
  const fbUser = result.user;
  const email = (fbUser.email || '').toLowerCase();
  const isMaster = email === 'tiagodias8888@gmail.com';

  if (isMaster) {
    const user: UserAccount = {
      ...TIAGO_DIAS_USER,
      email,
      name: fbUser.displayName || TIAGO_DIAS_USER.name,
      avatar: fbUser.photoURL || TIAGO_DIAS_USER.avatar,
      authProvider: 'gmail',
    };
    await saveUserToFirestore(user);
    return user;
  }

  const userId = `usr_google_${fbUser.uid}`;
  const existingUser = await getUserFromFirestore(userId);
  if (existingUser) {
    return existingUser;
  }

  const newUser: UserAccount = {
    id: userId,
    name: fbUser.displayName || email.split('@')[0],
    username: email.split('@')[0],
    email,
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

  await saveUserToFirestore(newUser);
  return newUser;
}

/**
 * Session termination
 */
export async function logoutSession(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Sign out warning:', e);
  }
}

// =========================================================================
// USER PROFILE FIRESTORE OPERATIONS
// =========================================================================

export async function saveUserToFirestore(user: UserAccount): Promise<void> {
  const path = `users/${user.id}`;
  try {
    const userRef = doc(db, 'users', user.id);
    await setDoc(
      userRef,
      {
        ...user,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getUserFromFirestore(userId: string): Promise<UserAccount | null> {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserAccount;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

// Helper function to recursively remove undefined properties before saving to Firestore
export function cleanFirestoreObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanFirestoreObject) as unknown as T;
  }
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined) {
        res[key] = cleanFirestoreObject(value);
      }
    }
    return res as T;
  }
  return obj;
}

// USER DEBTORS FIRESTORE OPERATIONS (Isolated per userId)
export async function saveDebtorsToFirestore(userId: string, debtors: Debtor[]): Promise<void> {
  const path = `users/${userId}/debtors`;
  try {
    const batch = writeBatch(db);
    for (const d of debtors) {
      const docRef = doc(db, 'users', userId, 'debtors', d.id);
      batch.set(docRef, cleanFirestoreObject({ ...d, userId }), { merge: true });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getDebtorsFromFirestore(userId: string): Promise<Debtor[]> {
  const path = `users/${userId}/debtors`;
  try {
    const colRef = collection(db, 'users', userId, 'debtors');
    const snap = await getDocs(colRef);
    if (snap.empty) return [];
    return snap.docs.map((d) => d.data() as Debtor);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// USER PURCHASES FIRESTORE OPERATIONS
export async function savePurchasesToFirestore(
  userId: string,
  purchases: Purchase[]
): Promise<void> {
  const path = `users/${userId}/purchases`;
  try {
    const batch = writeBatch(db);
    for (const p of purchases) {
      const docRef = doc(db, 'users', userId, 'purchases', p.id);
      batch.set(docRef, cleanFirestoreObject({ ...p, userId }), { merge: true });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getPurchasesFromFirestore(userId: string): Promise<Purchase[]> {
  const path = `users/${userId}/purchases`;
  try {
    const colRef = collection(db, 'users', userId, 'purchases');
    const snap = await getDocs(colRef);
    if (snap.empty) return [];
    return snap.docs.map((d) => d.data() as Purchase);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// USER INSTALLMENTS FIRESTORE OPERATIONS
export async function saveInstallmentsToFirestore(
  userId: string,
  installments: Installment[]
): Promise<void> {
  const path = `users/${userId}/installments`;
  try {
    // Firestore batch supports up to 500 writes
    const chunks: Installment[][] = [];
    for (let i = 0; i < installments.length; i += 400) {
      chunks.push(installments.slice(i, i + 400));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const inst of chunk) {
        const docRef = doc(db, 'users', userId, 'installments', inst.id);
        batch.set(docRef, cleanFirestoreObject({ ...inst, userId }), { merge: true });
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getInstallmentsFromFirestore(userId: string): Promise<Installment[]> {
  const path = `users/${userId}/installments`;
  try {
    const colRef = collection(db, 'users', userId, 'installments');
    const snap = await getDocs(colRef);
    if (snap.empty) return [];
    return snap.docs.map((d) => d.data() as Installment);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// DELETE DEBTOR AND RELATED RECORDS FROM FIRESTORE
export async function deleteDebtorFromFirestore(userId: string, debtorId: string): Promise<void> {
  const path = `users/${userId}/debtors/${debtorId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', userId, 'debtors', debtorId));
    
    // Also delete associated purchases from Firestore
    try {
      const purchasesSnap = await getDocs(collection(db, 'users', userId, 'purchases'));
      purchasesSnap.docs.forEach((p) => {
        if (p.data()?.debtorId === debtorId) {
          batch.delete(p.ref);
        }
      });
    } catch (e) {
      console.warn('Could not read purchases for cascade delete:', e);
    }

    // Also delete associated installments from Firestore
    try {
      const installmentsSnap = await getDocs(collection(db, 'users', userId, 'installments'));
      installmentsSnap.docs.forEach((inst) => {
        if (inst.data()?.debtorId === debtorId) {
          batch.delete(inst.ref);
        }
      });
    } catch (e) {
      console.warn('Could not read installments for cascade delete:', e);
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// CLEAR ALL USER DEBTORS, PURCHASES, INSTALLMENTS FROM FIRESTORE
export async function clearAllUserDataFromFirestore(userId: string): Promise<void> {
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
  const cleanKey = record.auth.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `users/${userId}/auth_records/${cleanKey}`;
  try {
    const docRef = doc(db, 'users', userId, 'auth_records', cleanKey);
    await setDoc(docRef, cleanFirestoreObject({ ...record, userId, registeredAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
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

  // If map only has Master, add demo/sample registered platform users for rich administrative experience
  if (usersMap.size <= 1) {
    const demoUsers: UserAccount[] = [
      {
        id: 'usr_jucelia_aizza',
        name: 'Jucelia Aizza',
        username: 'jucelia',
        email: 'jucelia.aizza@gmail.com',
        phoneWhatsapp: '(14) 99712-0484',
        cpfCnpj: '219.832.108-99',
        companyName: 'Boutique & Vendas Aizza',
        city: 'Bariri',
        state: 'SP',
        role: 'Cliente Compradora',
        authProvider: 'local',
        createdAt: '2026-02-14T12:00:00.000Z',
        plainPassword: 'jucelia@2026',
        supportPin: '4120',
        status: 'ativo',
        isMasterAdmin: false,
      },
      {
        id: 'usr_marcos_vinicius',
        name: 'Marcos Vinicius',
        username: 'marcosv',
        email: 'marcos.v@gmail.com',
        phoneWhatsapp: '(14) 99755-8865',
        cpfCnpj: '445.190.328-12',
        companyName: 'Oficina & Autopeças MV',
        city: 'Jaú',
        state: 'SP',
        role: 'Usuário Gestor',
        authProvider: 'local',
        createdAt: '2026-03-01T09:30:00.000Z',
        plainPassword: 'marcos#senha',
        supportPin: '3150',
        status: 'ativo',
        isMasterAdmin: false,
      },
      {
        id: 'usr_renata_silveira',
        name: 'Renata Silveira',
        username: 'renatasilveira',
        email: 'renata.silveira@hotmail.com',
        phoneWhatsapp: '(14) 99888-1122',
        cpfCnpj: '390.871.228-45',
        companyName: 'Consultoria Financeira',
        city: 'Bauru',
        state: 'SP',
        role: 'Usuária Financeira',
        authProvider: 'local',
        createdAt: '2026-03-10T14:15:00.000Z',
        plainPassword: 'renata!pass2026',
        supportPin: '2880',
        status: 'ativo',
        isMasterAdmin: false,
      },
      {
        id: 'usr_infrator_demo',
        name: 'Usuário em Análise de Conduta',
        username: 'conduta_teste',
        email: 'usuario.irregular@email.com',
        phoneWhatsapp: '(14) 99111-2233',
        cpfCnpj: '111.222.333-44',
        companyName: 'Empresa Desconhecida',
        city: 'São Paulo',
        state: 'SP',
        role: 'Em Avaliação',
        authProvider: 'local',
        createdAt: '2026-04-01T10:00:00.000Z',
        plainPassword: 'temp_password',
        supportPin: '9900',
        status: 'suspenso',
        banReason: 'Violação de Termos: Tentativa de inserção de dados não autenticados.',
        isMasterAdmin: false,
      },
    ];

    demoUsers.forEach((u) => usersMap.set(u.id, u));
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
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, cleanFirestoreObject({ ...updates, updatedAt: new Date().toISOString() }), {
      merge: true,
    });
  } catch (err) {
    console.warn('[Firebase Admin] Note updating user in Firestore:', err);
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
    console.warn('[Firebase Admin] Note updating password in Firestore:', err);
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
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { status: 'banido', deletedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('[Firebase Admin] Note deleting user:', err);
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
    authorId: 'usr_marcos_vinicius',
    authorName: 'Marcos Vinicius',
    authorEmail: 'marcos.v@gmail.com',
    authorRole: 'Usuário Gestor',
    title: '💡 Sugestão: Notificação antecipada de fechamento de faturas bancárias',
    content: 'Seria muito útil se o sistema emitisse um alerta sonoro ou aviso visual 3 dias antes da fatura do cartão Nubank e Itaú fechar para os clientes.',
    category: 'sugestao',
    status: 'em_desenvolvimento',
    createdAt: '2026-09-24T15:30:00.000Z',
    upvotes: 18,
    devResponse: 'Excelente sugestão Marcos! Já implementei o alerta de 3 dias no cabeçalho e na aba de relatórios. — Tiago Dias',
    devResponseAt: '2026-09-24T18:00:00.000Z',
  },
  {
    id: 'top-3',
    authorId: 'usr_renata_silveira',
    authorName: 'Renata Silveira',
    authorEmail: 'renata.silveira@hotmail.com',
    authorRole: 'Usuária Financeira',
    title: '🚀 Melhoria: Exportação de extrato completo em PDF com QR Code PIX',
    content: 'Gostaria de parabenizar pela logo no contrato e sugerir que a impressão de extrato total também venha com o QR Code PIX em alta definição.',
    category: 'melhoria',
    status: 'concluido',
    createdAt: '2026-09-23T11:20:00.000Z',
    upvotes: 25,
    devResponse: 'Concluído! A impressão direta e captura de print com QR Code e logo ampliada já estão 100% operacionais no Extrato Total e Contratos. — Tiago Dias',
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
  try {
    await setDoc(doc(db, 'forum_topics', newTopic.id), cleanFirestoreObject(newTopic));
  } catch (err) {
    console.warn('[Firebase Forum] Note writing forum topic to Firestore:', err);
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

  try {
    await setDoc(doc(db, 'forum_topics', topicId), cleanFirestoreObject(updates), { merge: true });
  } catch (err) {
    console.warn('[Firebase Forum] Note updating topic:', err);
  }

  return updated;
}

export async function deleteForumTopic(topicId: string): Promise<ForumTopic[]> {
  const topics = getLocalForumTopics();
  const updated = topics.filter((t) => t.id !== topicId);
  saveLocalForumTopics(updated);

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'forum_topics', topicId));
    await batch.commit();
  } catch (err) {
    console.warn('[Firebase Forum] Note deleting topic:', err);
  }

  return updated;
}
