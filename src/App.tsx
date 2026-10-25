import { safeToFixed, safeFormatCurrency, safeToNumber } from "./utils/numberUtils";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScreenTab, Debtor, Purchase, Installment, BankInstitution, UserAccount, generateAuthCode, GeminiDistributionItem, TransactionRecord } from './types';
import { registerAuthCode } from './utils/authRegistry';
import {
  INITIAL_DEBTORS,
  INITIAL_PURCHASES,
  INITIAL_INSTALLMENTS,
  INITIAL_INSTITUTIONS,
  INITIAL_TRANSACTIONS,
  APP_IMAGES,
} from './data/mockData';
import { addMonthsToDateStr } from './utils/dateUtils';
import { addAuditLog } from './utils/auditLogger';
import {
  calculateDebtorScore,
  evaluateSpendingAlert,
  calculateInstallmentTotalWithLateFee,
} from './utils/scoreUtils';
import {
  saveUserToFirestore,
  getUserFromFirestore,
  saveDebtorsToFirestore,
  saveSingleDebtorToFirestore,
  getDebtorsFromFirestore,
  deleteDebtorFromFirestore,
  savePurchasesToFirestore,
  saveSinglePurchaseToFirestore,
  deletePurchaseFromFirestore,
  getPurchasesFromFirestore,
  saveInstallmentsToFirestore,
  saveSingleInstallmentToFirestore,
  deleteInstallmentFromFirestore,
  getInstallmentsFromFirestore,
  saveAuthRecordToFirestore,
  clearAllUserDataFromFirestore,
  markWelcomeCompletedInFirestore,
  saveTombstoneToFirestore,
  removeTombstoneFromFirestore,
  getTombstonesFromFirestore,
  TIAGO_DIAS_USER,
  auth,
  isFirestoreQuotaExhausted,
  processFirebaseUserResult,
  initializeGoogleSignInNative,
  isNativeOrAndroidWebView,
  resolveCanonicalUserId,
  subscribeToUserFirestoreRealtime,
} from './lib/firebase';
import { logoutUser } from './lib/authService';
import './utils/appIconHelper';
import { onAuthStateChanged } from 'firebase/auth';

import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { ParcelasView } from './components/ParcelasView';
import { DebtorsMasterSpreadsheet } from './components/DebtorsMasterSpreadsheet';
import { DevedoresView } from './components/DevedoresView';
import { DetalheParcelaView } from './components/DetalheParcelaView';
import { DetalheAtrasoView } from './components/DetalheAtrasoView';
import { RelatoriosView } from './components/RelatoriosView';
import { PerfilView } from './components/PerfilView';
import { ErpLegacySystem } from './components/ErpLegacySystem';
import { AdminDevForumView } from './components/AdminDevForumView';
import { GeminiAutomationView } from './components/GeminiAutomationView';
import { GeminiAutomationResult } from './types';

import { AssetInspectorModal } from './components/AssetInspectorModal';
import { WhatsAppModal } from './components/WhatsAppModal';
import { ProofModal } from './components/ProofModal';
import { NewPurchaseModal } from './components/NewPurchaseModal';
import { NewDebtorModal } from './components/NewDebtorModal';
import { EditDebtorModal } from './components/EditDebtorModal';
import { EditPurchaseModal, EditPurchaseSavePayload } from './components/EditPurchaseModal';
import { DigitalContractModal } from './components/DigitalContractModal';
import { GeminiContractScannerModal } from './components/GeminiContractScannerModal';
import { ExtratoTotalModal } from './components/ExtratoTotalModal';
import { PdfDocumentsHubModal } from './components/PdfDocumentsHubModal';
import { MeuGerenciamentoPessoalModal } from './components/MeuGerenciamentoPessoalModal';
import { WelcomeModal } from './components/WelcomeModal';
import { AuthScreen } from './components/AuthScreen';
import { InitialWelcomeLoginScreen } from './components/InitialWelcomeLoginScreen';
import { UserSettingsModal } from './components/UserSettingsModal';
import { DeleteDebtorConfirmationModal } from './components/DeleteDebtorConfirmationModal';
import { DeleteInstallmentConfirmationModal } from './components/DeleteInstallmentConfirmationModal';
import { PreRegistrationPortalModal } from './components/PreRegistrationPortalModal';
import { AuthLookupModal } from './components/AuthLookupModal';
import { SystemHealthAlertModal } from './components/SystemHealthAlertModal';
import { systemHealthSentinel } from './utils/systemHealthSentinel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FuturisticCosmicBackground } from './components/FuturisticCosmicBackground';
import { CredorScoreModal } from './components/CredorScoreModal';
import { HaspahoAutomatedTourModal } from './components/HaspahoAutomatedTourModal';
import { GeminiParsedContract } from './types';

const GUEST_EMPTY_USER: UserAccount = {
  id: '',
  name: 'Convidado',
  username: 'convidado',
  email: '',
  phoneWhatsapp: '',
  authProvider: 'local',
  companyName: 'HASPAHO Gestão',
  city: '',
  state: '',
  role: 'Usuário',
  pixKey: '',
  createdAt: new Date().toISOString(),
  isFirstLogin: false,
  hasSeenWelcome: true,
  isMasterAdmin: false,
  isFullStackDev: false,
};

const DEFAULT_USER: UserAccount = GUEST_EMPTY_USER;

// =========================================================================
// ISOLAMENTO PERMANENTE DE DADOS DEMONSTRATIVOS E LIXEIRA (REGRA ATUALIZAÇÃO 89)
// Garante que registros de demonstração excluídos JAMAIS reapareçam em novos logins,
// atualizações ou sincronizações de versão.
// =========================================================================
export function getLocalCandidateSuffixes(userId?: string, emailHint?: string): string[] {
  const suffixes = new Set<string>();
  const canonical = resolveCanonicalUserId(userId, emailHint);
  if (canonical) suffixes.add(canonical);
  if (userId && userId.trim()) suffixes.add(userId.trim());
  if (canonical === 'usr_thiago_dias' || emailHint?.toLowerCase() === 'tiagodias8888@gmail.com') {
    suffixes.add('usr_thiago_dias');
    suffixes.add('usr_google_tiagodias8888_gmail_com');
  }
  return Array.from(suffixes).filter(Boolean);
}

export function readMergedLocalRecords<T extends { id?: string }>(
  baseKey: 'haspaho_debtors' | 'haspaho_purchases' | 'haspaho_installments' | 'haspaho_deleted_debtors',
  userId?: string,
  emailHint?: string
): T[] {
  const map = new Map<string, T>();
  const suffixes = getLocalCandidateSuffixes(userId, emailHint);
  const keysToTry = [...suffixes.map((s) => `${baseKey}_${s}`), baseKey];
  for (const key of keysToTry) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: T) => {
            if (item && item.id && !map.has(item.id)) {
              map.set(item.id, item);
            }
          });
        }
      }
    } catch {}
  }
  return Array.from(map.values());
}

export function getPermanentTombstones(userId: string): Set<string> {
  const set = new Set<string>();
  if (!userId) return set;
  const suffixes = getLocalCandidateSuffixes(userId);
  for (const s of suffixes) {
    try {
      const raw = localStorage.getItem(`haspaho_tombstones_${s}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id: string) => typeof id === 'string' && set.add(id));
        }
      }
    } catch {}
  }
  return set;
}

export function addPermanentTombstone(userId: string, debtorId: string): void {
  if (!userId || !debtorId) return;
  const canonicalId = resolveCanonicalUserId(userId);
  try {
    const set = getPermanentTombstones(canonicalId);
    set.add(debtorId);
    const arr = Array.from(set);
    localStorage.setItem(`haspaho_tombstones_${canonicalId}`, JSON.stringify(arr));
    if (userId !== canonicalId) {
      localStorage.setItem(`haspaho_tombstones_${userId}`, JSON.stringify(arr));
    }
  } catch {}
  // Persiste também no Firestore
  saveTombstoneToFirestore(canonicalId, debtorId).catch(() => {});
}

export function removePermanentTombstone(userId: string, debtorId: string): void {
  if (!userId || !debtorId) return;
  const canonicalId = resolveCanonicalUserId(userId);
  try {
    const set = getPermanentTombstones(canonicalId);
    set.delete(debtorId);
    const arr = Array.from(set);
    localStorage.setItem(`haspaho_tombstones_${canonicalId}`, JSON.stringify(arr));
    if (userId !== canonicalId) {
      localStorage.setItem(`haspaho_tombstones_${userId}`, JSON.stringify(arr));
    }
  } catch {}
  // Remove também do Firestore
  removeTombstoneFromFirestore(canonicalId, debtorId).catch(() => {});
}

export const getCleanDebtorAvatar = (name?: string, currentAvatar?: string): string => {
  if (currentAvatar && currentAvatar.trim().length > 10) {
    return currentAvatar.trim();
  }
  try {
    const stored = localStorage.getItem('haspaho_debtors');
    if (stored) {
      const debtorsList = JSON.parse(stored);
      const matched = debtorsList.find((d: any) => 
        d.name && name && d.name.toLowerCase().trim() === name.toLowerCase().trim()
      );
      if (matched && matched.avatar && matched.avatar.trim().length > 10) {
        return matched.avatar.trim();
      }
    }
  } catch (e) {
    // silent
  }

  const n = (name || '').toLowerCase();
  if (n.includes('mariana') || n.includes('maria')) return APP_IMAGES.maria;
  if (n.includes('carlos')) return APP_IMAGES.carlos;
  return APP_IMAGES.carlos;
};

export default function App() {
  const [currentTab, setCurrentTab] = useState<ScreenTab>('dashboard');
  const [targetInstallmentId, setTargetInstallmentId] = useState<string>('inst-1');
  const [targetDebtorId, setTargetDebtorId] = useState<string>('all');
  const [targetPurchaseFilter, setTargetPurchaseFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Theme state: Light Mode and Dark Mode support
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('haspaho_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('haspaho_theme', next);
      } catch {}
      return next;
    });
  };

  // Authentication & Welcome States - restore verified user session if not explicitly logged out
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      if (localStorage.getItem('haspaho_explicit_logout') === 'true') {
        return null;
      }
      const saved = localStorage.getItem('haspaho_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id || parsed.email)) {
          if (parsed.isMasterAdmin && parsed.email?.toLowerCase() !== 'tiagodias8888@gmail.com') {
             parsed.isMasterAdmin = false;
             parsed.isFullStackDev = false;
          }
          parsed.id = resolveCanonicalUserId(parsed.id, parsed.email);
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  // A apresentação inicia sempre como fechada no carregamento para nunca reaparecer em reload
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isCredorScoreOpen, setIsCredorScoreOpen] = useState(false);
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);

  // Deleted Debtors Trash Bin (Lixeira) - LocalStorage Persistence per user
  const [deletedDebtors, setDeletedDebtors] = useState<Debtor[]>(() => {
    try {
      const activeUser = currentUser || DEFAULT_USER;
      return readMergedLocalRecords<Debtor>('haspaho_deleted_debtors', activeUser.id, activeUser.email);
    } catch (e) {
      console.error(e);
    }
    return [];
  });
  const [deletingDebtorTarget, setDeletingDebtorTarget] = useState<Debtor | null>(null);
  const [deletingInstallmentTarget, setDeletingInstallmentTarget] = useState<Installment | null>(null);
  const [userSettingsTab, setUserSettingsTab] = useState<'profile' | 'address' | 'pix' | 'security' | 'backup' | 'suporte' | 'lixeira'>('profile');

  // Domain data in state - with robust LocalStorage persistence and fallback per user ID
  const [debtors, setDebtors] = useState<Debtor[]>(() => {
    try {
      const activeUser = currentUser || DEFAULT_USER;
      if (!activeUser.id) return [];
      const deletedList = readMergedLocalRecords<Debtor>('haspaho_deleted_debtors', activeUser.id, activeUser.email);
      const deletedIds = new Set<string>(deletedList.map((d) => d.id));
      const tombstones = getPermanentTombstones(activeUser.id);
      tombstones.forEach((id) => deletedIds.add(id));

      const localDebtors = readMergedLocalRecords<Debtor>('haspaho_debtors', activeUser.id, activeUser.email);
      return localDebtors
        .filter((d: Debtor) => d && d.id && !deletedIds.has(d.id))
        .map((d: Debtor) => ({
          ...d,
          totalOwed: typeof d.totalOwed === 'number' ? d.totalOwed : (Number(d.totalOwed) || 0),
          totalPaid: typeof d.totalPaid === 'number' ? d.totalPaid : (Number(d.totalPaid) || 0),
          overdueCount: typeof d.overdueCount === 'number' ? d.overdueCount : (Number(d.overdueCount) || 0),
        }));
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [purchases, setPurchases] = useState<Purchase[]>(() => {
    try {
      const activeUser = currentUser || DEFAULT_USER;
      if (!activeUser.id) return [];
      const deletedList = readMergedLocalRecords<Debtor>('haspaho_deleted_debtors', activeUser.id, activeUser.email);
      const deletedIds = new Set<string>(deletedList.map((d) => d.id));
      const tombstones = getPermanentTombstones(activeUser.id);
      tombstones.forEach((id) => deletedIds.add(id));

      const localPurchases = readMergedLocalRecords<Purchase>('haspaho_purchases', activeUser.id, activeUser.email);
      return localPurchases.filter(
        (p: Purchase) =>
          p &&
          p.id &&
          !deletedIds.has(p.id) &&
          (!p.debtorId || !deletedIds.has(p.debtorId))
      );
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [installments, setInstallments] = useState<Installment[]>(() => {
    try {
      const activeUser = currentUser || DEFAULT_USER;
      if (!activeUser.id) return [];
      const deletedList = readMergedLocalRecords<Debtor>('haspaho_deleted_debtors', activeUser.id, activeUser.email);
      const deletedIds = new Set<string>(deletedList.map((d) => d.id));
      const tombstones = getPermanentTombstones(activeUser.id);
      tombstones.forEach((id) => deletedIds.add(id));

      const localInsts = readMergedLocalRecords<Installment>('haspaho_installments', activeUser.id, activeUser.email);
      return localInsts.filter(
        (i: Installment) =>
          i &&
          i.id &&
          !deletedIds.has(i.id) &&
          (!i.purchaseId || !deletedIds.has(i.purchaseId)) &&
          (!i.debtorId || !deletedIds.has(i.debtorId))
      );
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [institutions] = useState<BankInstitution[]>(INITIAL_INSTITUTIONS);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('haspaho_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_TRANSACTIONS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('haspaho_transactions', JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  const isInitialLoadRef = useRef(true);
  const lastSyncSignatureRef = useRef<string>('');
  const isExplicitLogoutRef = useRef(false);

  // Enforce Firebase Auth session listener without wiping valid local user sessions
  useEffect(() => {
    // Inicializa o plugin @capawesome/capacitor-google-sign-in no Android nativo (evita disallowed_useragent e localhost redirect)
    if (isNativeOrAndroidWebView()) {
      initializeGoogleSignInNative().catch(() => {});
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      const isExplicitLoggedOut = localStorage.getItem('haspaho_explicit_logout') === 'true';

      if (fbUser && !isExplicitLoggedOut) {
        isExplicitLogoutRef.current = false;
        const canonicalId = resolveCanonicalUserId(fbUser.uid, fbUser.email || undefined);
        console.log('[Auth:SESSION_ACTIVE] Firebase Auth session detected for canonical UID:', canonicalId, fbUser.email);
        setCurrentUser((prev) => {
          if (!prev || prev.id !== canonicalId) {
            try {
              const saved = localStorage.getItem('haspaho_auth_user');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.email && fbUser.email && parsed.email.toLowerCase() === fbUser.email.toLowerCase()) {
                  const unified = { ...parsed, id: canonicalId, email: fbUser.email };
                  localStorage.setItem('haspaho_auth_user', JSON.stringify(unified));
                  return unified;
                }
              }
            } catch {}
            const isMaster = fbUser.email?.toLowerCase() === 'tiagodias8888@gmail.com';
            const fallbackUser: UserAccount = isMaster
              ? {
                  ...TIAGO_DIAS_USER,
                  id: canonicalId,
                  email: fbUser.email || TIAGO_DIAS_USER.email,
                  authProvider: 'gmail',
                  isMasterAdmin: true,
                  isFullStackDev: true,
                  isFirstLogin: false,
                  hasSeenWelcome: true,
                }
              : {
                  id: canonicalId,
                  name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário',
                  username: fbUser.email?.split('@')[0] || 'usuario',
                  email: fbUser.email || '',
                  phoneWhatsapp: fbUser.phoneNumber || '',
                  companyName: 'HASPAHO Gestão',
                  city: 'Brasil',
                  state: 'BR',
                  role: 'Usuário Gestor',
                  pixKey: fbUser.email || '',
                  authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'gmail' : 'local',
                  createdAt: new Date().toISOString(),
                  isFirstLogin: false,
                  hasSeenWelcome: true,
                };
            localStorage.setItem('haspaho_auth_user', JSON.stringify(fallbackUser));
            return fallbackUser;
          }
          return prev;
        });
      } else {
        // No active Firebase Auth session or explicit logout is active
        if (isExplicitLogoutRef.current || localStorage.getItem('haspaho_explicit_logout') === 'true') {
          console.log('[Auth:LOGOUT] Explicit logout active. Remaining on login screen.');
          setCurrentUser(null);
          return;
        }
        try {
          const saved = localStorage.getItem('haspaho_auth_user');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && (parsed.id || parsed.email)) {
              parsed.id = resolveCanonicalUserId(parsed.id, parsed.email);
              console.log('[Auth:SESSION_RESTORED] Restoring session for:', parsed.name || parsed.email, 'ID:', parsed.id);
              setCurrentUser(parsed);
              return;
            }
          }
        } catch {}
        console.log('[Auth:NO_SESSION] No active user session.');
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Função centralizada de sincronização bidirecional (LocalStorage <-> Firebase Firestore)
  const syncWithCloudDatabase = useCallback(
    async (user: UserAccount, showFeedbackToast = false) => {
      if (!user || !user.id) return;
      const canonicalId = resolveCanonicalUserId(user.id, user.email);
      console.log(`[Firestore:SYNC] Syncing data with Cloud Firestore for "${user.name}" (Canonical ID: ${canonicalId})...`);

      try {
        const remoteUser = await getUserFromFirestore(canonicalId);
        if (remoteUser) {
          const unifiedUser = { ...user, ...remoteUser, id: canonicalId };
          setCurrentUser(unifiedUser);
          localStorage.setItem('haspaho_auth_user', JSON.stringify(unifiedUser));
          if (unifiedUser.hasSeenWelcome === true) {
            localStorage.setItem(`haspaho_welcome_completed_${canonicalId}`, 'true');
            setIsWelcomeOpen(false);
          }
        } else {
          await saveUserToFirestore({ ...user, id: canonicalId });
        }

        const [remoteDebtors, remotePurchases, remoteInstallments, remoteTombstones] = await Promise.all([
          getDebtorsFromFirestore(canonicalId).catch((err) => {
            console.warn('[Firestore:LOAD_DATA] Debtors read warning:', err);
            return [];
          }),
          getPurchasesFromFirestore(canonicalId).catch((err) => {
            console.warn('[Firestore:LOAD_DATA] Purchases read warning:', err);
            return [];
          }),
          getInstallmentsFromFirestore(canonicalId).catch((err) => {
            console.warn('[Firestore:LOAD_DATA] Installments read warning:', err);
            return [];
          }),
          getTombstonesFromFirestore(canonicalId).catch((err) => {
            console.warn('[Firestore:LOAD_DATA] Tombstones read warning:', err);
            return [];
          }),
        ]);

        // Retrieve deleted debtor IDs & Permanent Tombstones
        const deletedIds = new Set<string>();
        const localDeletedList = readMergedLocalRecords<Debtor>('haspaho_deleted_debtors', canonicalId, user.email);
        localDeletedList.forEach((d) => d?.id && deletedIds.add(d.id));

        const tombstones = getPermanentTombstones(canonicalId);
        if (Array.isArray(remoteTombstones) && remoteTombstones.length > 0) {
          remoteTombstones.forEach((tId) => {
            if (tId && typeof tId === 'string') {
              tombstones.add(tId);
            }
          });
          try {
            localStorage.setItem(`haspaho_tombstones_${canonicalId}`, JSON.stringify(Array.from(tombstones)));
          } catch {}
        }
        tombstones.forEach((id) => {
          deletedIds.add(id);
          saveTombstoneToFirestore(canonicalId, id).catch(() => {});
        });

        // 1. SMART MERGE DEBTORS
        const localDebtorsArr = readMergedLocalRecords<Debtor>('haspaho_debtors', canonicalId, user.email).filter(
          (d) => d && d.id && !deletedIds.has(d.id)
        );
        const localDebtorMap = new Map<string, Debtor>();
        localDebtorsArr.forEach((d) => {
          if (d && d.id && !deletedIds.has(d.id)) localDebtorMap.set(d.id, d);
        });

        const mergedDebtorsMap = new Map<string, Debtor>();
        (remoteDebtors || []).forEach((remoteD) => {
          if (!remoteD || !remoteD.id) return;
          if (deletedIds.has(remoteD.id)) {
            deleteDebtorFromFirestore(canonicalId, remoteD.id).catch(() => {});
            return;
          }
          const localD = localDebtorMap.get(remoteD.id);
          if (localD) {
            mergedDebtorsMap.set(remoteD.id, {
              ...remoteD,
              ...localD,
            });
          } else {
            mergedDebtorsMap.set(remoteD.id, remoteD);
          }
        });

        localDebtorsArr.forEach((localD) => {
          if (localD && localD.id && !deletedIds.has(localD.id) && !mergedDebtorsMap.has(localD.id)) {
            mergedDebtorsMap.set(localD.id, localD);
          }
        });

        const cleanedDebtors = Array.from(mergedDebtorsMap.values())
          .filter((d) => !deletedIds.has(d.id))
          .map((d) => ({
            ...d,
            totalOwed: typeof d.totalOwed === 'number' ? d.totalOwed : Number(d.totalOwed) || 0,
            totalPaid: typeof d.totalPaid === 'number' ? d.totalPaid : Number(d.totalPaid) || 0,
            overdueCount: typeof d.overdueCount === 'number' ? d.overdueCount : Number(d.overdueCount) || 0,
            avatar: getCleanDebtorAvatar(d.name, d.avatar),
          }));

        setDebtors(cleanedDebtors);
        try {
          localStorage.setItem(`haspaho_debtors_${canonicalId}`, JSON.stringify(cleanedDebtors));
          localStorage.setItem('haspaho_debtors', JSON.stringify(cleanedDebtors));
        } catch {}

        if (cleanedDebtors.length > 0 && !isFirestoreQuotaExhausted()) {
          await saveDebtorsToFirestore(canonicalId, cleanedDebtors).catch((e) => console.warn('Sync merged debtors note:', e));
        }

        // 2. SMART MERGE PURCHASES
        const localPurchasesArr = readMergedLocalRecords<Purchase>('haspaho_purchases', canonicalId, user.email).filter(
          (p) => p && p.id && !deletedIds.has(p.id) && (!p.debtorId || !deletedIds.has(p.debtorId))
        );
        const localPurchaseMap = new Map<string, Purchase>();
        localPurchasesArr.forEach((p) => {
          localPurchaseMap.set(p.id, p);
        });

        const mergedPurchasesMap = new Map<string, Purchase>();
        (remotePurchases || []).forEach((remoteP) => {
          if (!remoteP || !remoteP.id) return;
          if (deletedIds.has(remoteP.id) || (remoteP.debtorId && deletedIds.has(remoteP.debtorId))) {
            deletePurchaseFromFirestore(canonicalId, remoteP.id).catch(() => {});
            return;
          }
          const localP = localPurchaseMap.get(remoteP.id);
          if (localP) {
            mergedPurchasesMap.set(remoteP.id, {
              ...remoteP,
              ...localP,
            });
          } else {
            mergedPurchasesMap.set(remoteP.id, remoteP);
          }
        });

        localPurchasesArr.forEach((localP) => {
          if (!mergedPurchasesMap.has(localP.id)) {
            mergedPurchasesMap.set(localP.id, localP);
          }
        });

        const finalPurchases = Array.from(mergedPurchasesMap.values()).filter(
          (p) => !deletedIds.has(p.id) && (!p.debtorId || !deletedIds.has(p.debtorId))
        );

        setPurchases(finalPurchases);
        try {
          localStorage.setItem(`haspaho_purchases_${canonicalId}`, JSON.stringify(finalPurchases));
          localStorage.setItem('haspaho_purchases', JSON.stringify(finalPurchases));
        } catch {}

        if (finalPurchases.length > 0 && !isFirestoreQuotaExhausted()) {
          await savePurchasesToFirestore(canonicalId, finalPurchases).catch((e) => console.warn('Sync merged purchases note:', e));
        }

        // 3. SMART MERGE INSTALLMENTS
        const localInstsArr = readMergedLocalRecords<Installment>('haspaho_installments', canonicalId, user.email).filter(
          (i) =>
            i &&
            i.id &&
            !deletedIds.has(i.id) &&
            (!i.purchaseId || !deletedIds.has(i.purchaseId)) &&
            (!i.debtorId || !deletedIds.has(i.debtorId))
        );
        const localInstMap = new Map<string, Installment>();
        localInstsArr.forEach((inst) => {
          localInstMap.set(inst.id, inst);
        });

        const mergedInstsMap = new Map<string, Installment>();
        (remoteInstallments || []).forEach((remoteInst) => {
          if (!remoteInst || !remoteInst.id) return;
          if (
            deletedIds.has(remoteInst.id) ||
            (remoteInst.purchaseId && deletedIds.has(remoteInst.purchaseId)) ||
            (remoteInst.debtorId && deletedIds.has(remoteInst.debtorId))
          ) {
            deleteInstallmentFromFirestore(canonicalId, remoteInst.id).catch(() => {});
            return;
          }
          const localInst = localInstMap.get(remoteInst.id);
          if (localInst) {
            if (localInst.status === 'paid' && remoteInst.status !== 'paid') {
              mergedInstsMap.set(remoteInst.id, localInst);
            } else if (remoteInst.status === 'paid' && localInst.status !== 'paid') {
              mergedInstsMap.set(remoteInst.id, remoteInst);
            } else {
              mergedInstsMap.set(remoteInst.id, {
                ...remoteInst,
                ...localInst,
                authCode: remoteInst.authCode || localInst.authCode,
              });
            }
          } else {
            mergedInstsMap.set(remoteInst.id, remoteInst);
          }
        });

        localInstsArr.forEach((localInst) => {
          if (!mergedInstsMap.has(localInst.id)) {
            mergedInstsMap.set(localInst.id, localInst);
          }
        });

        const finalInsts = Array.from(mergedInstsMap.values()).filter(
          (i) =>
            !deletedIds.has(i.id) &&
            (!i.purchaseId || !deletedIds.has(i.purchaseId)) &&
            (!i.debtorId || !deletedIds.has(i.debtorId))
        );

        const cleanedInsts = finalInsts.map((inst) => {
          const persistentCode = inst.status === 'paid' && !inst.authCode ? generateAuthCode() : inst.authCode;
          if (persistentCode && inst.status === 'paid') {
            registerAuthCode({
              auth: persistentCode,
              type: 'recibo',
              payer: inst.debtorName,
              amount: `R$ ${safeToFixed(inst.paidAmount || inst.amount).replace('.', ',')}`,
              date: inst.paidAt || inst.dueDate,
              bank: inst.paymentMethod || 'Nubank Croma / Asaas IP',
              item: `${inst.product} (Parcela ${inst.installmentNumber}/${inst.totalInstallments})`,
              destination: 'Tiago Dias (Credor)',
              status: 'AUTÊNTICO E LIQUIDADO',
            });
          }
          return {
            ...inst,
            authCode: persistentCode,
            debtorAvatar: getCleanDebtorAvatar(inst.debtorName, inst.debtorAvatar),
          };
        });

        setInstallments(cleanedInsts);
        try {
          localStorage.setItem(`haspaho_installments_${canonicalId}`, JSON.stringify(cleanedInsts));
          localStorage.setItem('haspaho_installments', JSON.stringify(cleanedInsts));
        } catch {}

        if (cleanedInsts.length > 0 && !isFirestoreQuotaExhausted()) {
          await saveInstallmentsToFirestore(canonicalId, cleanedInsts).catch((e) => console.warn('Sync merged installments note:', e));
        }

        if (showFeedbackToast) {
          setToastMessage(
            `☁️ Banco Firebase Sincronizado! (${cleanedDebtors.length} devedores, ${finalPurchases.length} compras e ${cleanedInsts.length} parcelas na nuvem)`
          );
          setTimeout(() => setToastMessage(null), 4500);
        }
      } catch (err) {
        console.warn('[Firestore:LOAD_DATA_OFFLINE]: Operando com cache local enquanto Firestore reconecta:', err);
        if (showFeedbackToast) {
          setToastMessage('⚠️ Operando com cache local. Verifique sua conexão com a internet.');
          setTimeout(() => setToastMessage(null), 4000);
        }
      } finally {
        isInitialLoadRef.current = false;
      }
    },
    []
  );

  // Sync initial user data from Firebase Firestore & attach real-time listeners
  useEffect(() => {
    const activeUser = currentUser;
    if (!activeUser || !activeUser.id) {
      isInitialLoadRef.current = false;
      return;
    }

    const canonicalId = resolveCanonicalUserId(activeUser.id, activeUser.email);
    syncWithCloudDatabase({ ...activeUser, id: canonicalId }, false);

    // Listener em tempo real (onSnapshot) para refletir mudanças feitas em outro aparelho/navegador
    const unsubscribeRealtime = subscribeToUserFirestoreRealtime(canonicalId, {
      onDebtorsSnapshot: (remoteDebtors) => {
        if (isInitialLoadRef.current) return;
        const tombstones = getPermanentTombstones(canonicalId);
        setDebtors((prev) => {
          const map = new Map<string, Debtor>();
          prev.forEach((d) => {
            if (d?.id && !tombstones.has(d.id)) map.set(d.id, d);
          });
          let changed = false;
          remoteDebtors.forEach((rd) => {
            if (!rd?.id || tombstones.has(rd.id)) return;
            const existing = map.get(rd.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(rd)) {
              map.set(rd.id, { ...existing, ...rd, avatar: getCleanDebtorAvatar(rd.name, rd.avatar) });
              changed = true;
            }
          });
          if (!changed) return prev;
          const next = Array.from(map.values());
          try {
            localStorage.setItem(`haspaho_debtors_${canonicalId}`, JSON.stringify(next));
            localStorage.setItem('haspaho_debtors', JSON.stringify(next));
          } catch {}
          return next;
        });
      },
      onPurchasesSnapshot: (remotePurchases) => {
        if (isInitialLoadRef.current) return;
        const tombstones = getPermanentTombstones(canonicalId);
        setPurchases((prev) => {
          const map = new Map<string, Purchase>();
          prev.forEach((p) => {
            if (p?.id && !tombstones.has(p.id) && (!p.debtorId || !tombstones.has(p.debtorId))) map.set(p.id, p);
          });
          let changed = false;
          remotePurchases.forEach((rp) => {
            if (!rp?.id || tombstones.has(rp.id) || (rp.debtorId && tombstones.has(rp.debtorId))) return;
            const existing = map.get(rp.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(rp)) {
              map.set(rp.id, { ...existing, ...rp });
              changed = true;
            }
          });
          if (!changed) return prev;
          const next = Array.from(map.values());
          try {
            localStorage.setItem(`haspaho_purchases_${canonicalId}`, JSON.stringify(next));
            localStorage.setItem('haspaho_purchases', JSON.stringify(next));
          } catch {}
          return next;
        });
      },
      onInstallmentsSnapshot: (remoteInstallments) => {
        if (isInitialLoadRef.current) return;
        const tombstones = getPermanentTombstones(canonicalId);
        setInstallments((prev) => {
          const map = new Map<string, Installment>();
          prev.forEach((i) => {
            if (i?.id && !tombstones.has(i.id) && (!i.purchaseId || !tombstones.has(i.purchaseId)) && (!i.debtorId || !tombstones.has(i.debtorId))) {
              map.set(i.id, i);
            }
          });
          let changed = false;
          remoteInstallments.forEach((ri) => {
            if (!ri?.id || tombstones.has(ri.id) || (ri.purchaseId && tombstones.has(ri.purchaseId)) || (ri.debtorId && tombstones.has(ri.debtorId))) {
              return;
            }
            const existing = map.get(ri.id);
            if (!existing) {
              map.set(ri.id, { ...ri, debtorAvatar: getCleanDebtorAvatar(ri.debtorName, ri.debtorAvatar) });
              changed = true;
            } else if (existing.status !== 'paid' && ri.status === 'paid') {
              map.set(ri.id, { ...existing, ...ri });
              changed = true;
            }
          });
          if (!changed) return prev;
          const next = Array.from(map.values());
          try {
            localStorage.setItem(`haspaho_installments_${canonicalId}`, JSON.stringify(next));
            localStorage.setItem('haspaho_installments', JSON.stringify(next));
          } catch {}
          return next;
        });
      },
    });

    return () => {
      unsubscribeRealtime();
    };
  }, [currentUser?.id, syncWithCloudDatabase]);

  // Auto-sync subsequent changes to LocalStorage and Firestore
  useEffect(() => {
    const activeUserId = currentUser?.id;
    if (!activeUserId) return;

    // Salvar sempre imediatamente no LocalStorage
    try {
      localStorage.setItem('haspaho_debtors', JSON.stringify(debtors));
      localStorage.setItem('haspaho_purchases', JSON.stringify(purchases));
      localStorage.setItem('haspaho_installments', JSON.stringify(installments));
      localStorage.setItem('haspaho_deleted_debtors', JSON.stringify(deletedDebtors));
      localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(debtors));
      localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(purchases));
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(installments));
    } catch (e) {
      console.error('LocalStorage error:', e);
    }

    if (isInitialLoadRef.current) {
      return;
    }

    if (isFirestoreQuotaExhausted()) {
      return;
    }

    const currentSignature = `${activeUserId}_d:${debtors.length}_p:${purchases.length}_i:${installments.length}_${installments.map((i) => i.id + i.status).join(',')}`;
    if (lastSyncSignatureRef.current === currentSignature) {
      return;
    }

    const timer = setTimeout(() => {
      if (isFirestoreQuotaExhausted()) return;
      lastSyncSignatureRef.current = currentSignature;
      console.log(`[Firestore:AUTO_SYNC] Syncing current state to Firestore for user: ${activeUserId}...`);
      saveDebtorsToFirestore(activeUserId, debtors).catch((err) => console.warn('[Firestore:AUTO_SYNC_DEBTORS_NOTE]', err));
      savePurchasesToFirestore(activeUserId, purchases).catch((err) => console.warn('[Firestore:AUTO_SYNC_PURCHASES_NOTE]', err));
      saveInstallmentsToFirestore(activeUserId, installments).catch((err) => console.warn('[Firestore:AUTO_SYNC_INSTALLMENTS_NOTE]', err));
    }, 2500);

    return () => clearTimeout(timer);
  }, [debtors, purchases, installments, deletedDebtors, currentUser?.id]);

  // Handlers para Exclusão e Lixeira (Solicitação 9)
  const handleRequestDeleteDebtor = (debtor: Debtor) => {
    setDeletingDebtorTarget(debtor);
  };

  const handleConfirmDeleteDebtor = async (debtor: Debtor) => {
    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    const nextDebtors = debtors.filter((d) => d.id !== debtor.id);
    const nextDeleted = [debtor, ...deletedDebtors.filter((d) => d.id !== debtor.id)];
    const nextInstallments = installments.filter((i) => i.debtorId !== debtor.id);
    const nextPurchases = purchases.filter((p) => p.debtorId !== debtor.id);

    // Registra tombstone permanente para o devedor e para todas as suas compras e parcelas
    addPermanentTombstone(activeUserId, debtor.id);
    purchases
      .filter((p) => p.debtorId === debtor.id)
      .forEach((p) => addPermanentTombstone(activeUserId, p.id));
    installments
      .filter((i) => i.debtorId === debtor.id)
      .forEach((i) => addPermanentTombstone(activeUserId, i.id));

    setDebtors(nextDebtors);
    setDeletedDebtors(nextDeleted);
    setInstallments(nextInstallments);
    setPurchases(nextPurchases);
    setDeletingDebtorTarget(null);

    if (targetDebtorId === debtor.id) {
      setTargetDebtorId(nextDebtors[0]?.id || 'all');
    }

    try {
      localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(nextDebtors));
      localStorage.setItem(`haspaho_deleted_debtors_${activeUserId}`, JSON.stringify(nextDeleted));
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInstallments));
      localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(nextPurchases));
      if (activeUserId === DEFAULT_USER.id) {
        localStorage.setItem('haspaho_debtors', JSON.stringify(nextDebtors));
        localStorage.setItem('haspaho_deleted_debtors', JSON.stringify(nextDeleted));
        localStorage.setItem('haspaho_installments', JSON.stringify(nextInstallments));
        localStorage.setItem('haspaho_purchases', JSON.stringify(nextPurchases));
      }
    } catch (e) {
      console.error(e);
    }

    try {
      await deleteDebtorFromFirestore(activeUserId, debtor.id);
      await saveDebtorsToFirestore(activeUserId, nextDebtors);
      await savePurchasesToFirestore(activeUserId, nextPurchases);
      await saveInstallmentsToFirestore(activeUserId, nextInstallments);
      addAuditLog(
        'EXCLUSAO_DEVEDOR_DATABASE',
        `Devedor "${debtor.name}" (ID: ${debtor.id}) movido para a lixeira e EXCLUÍDO do banco de dados Firestore.`,
        debtor.name,
        'FIRESTORE_SAVED'
      );
      showToast(`🗑️ "${debtor.name}" excluído do Banco e movido para Lixeira (restaurável em 8 dias).`);
    } catch (err) {
      console.error('Erro ao deletar devedor do Firestore:', err);
      addAuditLog(
        'ERRO_EXCLUSAO_DEVEDOR',
        `Falha ao remover devedor "${debtor.name}" do Firestore: ${err instanceof Error ? err.message : String(err)}`,
        debtor.name,
        'LOCAL_SAVED'
      );
      showToast(`🗑️ "${debtor.name}" removido localmente. Registrado na Trilha.`);
    }
  };

  const handleRestoreDebtor = async (debtorId: string) => {
    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    const target = deletedDebtors.find((d) => d.id === debtorId);
    if (target) {
      // Remove tombstone pois o usuário explicitamente restaurou o devedor
      removePermanentTombstone(activeUserId, debtorId);

      const nextDebtors = [target, ...debtors.filter((d) => d.id !== debtorId)];
      const nextDeleted = deletedDebtors.filter((d) => d.id !== debtorId);
      setDeletedDebtors(nextDeleted);
      setDebtors(nextDebtors);

      try {
        localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(nextDebtors));
        localStorage.setItem(`haspaho_deleted_debtors_${activeUserId}`, JSON.stringify(nextDeleted));
        if (activeUserId === DEFAULT_USER.id) {
          localStorage.setItem('haspaho_debtors', JSON.stringify(nextDebtors));
          localStorage.setItem('haspaho_deleted_debtors', JSON.stringify(nextDeleted));
        }
      } catch (e) {
        console.error(e);
      }

      try {
        await saveDebtorsToFirestore(activeUserId, nextDebtors);
        addAuditLog(
          'RESTAURACAO_DEVEDOR_DATABASE',
          `Devedor "${target.name}" restaurado da lixeira e salvo novamente no banco de dados Firestore.`,
          target.name,
          'FIRESTORE_SAVED'
        );
        showToast(`✨ Devedor "${target.name}" restaurado no Banco de Dados!`);
      } catch (err) {
        console.error('Erro ao restaurar devedor no Firestore:', err);
        addAuditLog(
          'RESTAURACAO_DEVEDOR_LOCAL',
          `Devedor "${target.name}" restaurado localmente.`,
          target.name,
          'LOCAL_SAVED'
        );
        showToast(`✨ Devedor "${target.name}" restaurado com sucesso!`);
      }
    }
  };

  const handlePermanentDeleteDebtor = async (debtorId: string) => {
    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    const target = deletedDebtors.find((d) => d.id === debtorId);
    const nextDeleted = deletedDebtors.filter((d) => d.id !== debtorId);
    setDeletedDebtors(nextDeleted);

    // Registra tombstone permanente para jamais ressuscitar em atualizações
    addPermanentTombstone(activeUserId, debtorId);

    // Filter out purchases and installments associated with the permanently deleted debtor
    const nextPurchases = purchases.filter((p) => p.debtorId !== debtorId);
    const nextInstallments = installments.filter((i) => i.debtorId !== debtorId);
    setPurchases(nextPurchases);
    setInstallments(nextInstallments);

    try {
      localStorage.setItem(`haspaho_deleted_debtors_${activeUserId}`, JSON.stringify(nextDeleted));
      localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(nextPurchases));
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInstallments));
      if (activeUserId === DEFAULT_USER.id) {
        localStorage.setItem('haspaho_deleted_debtors', JSON.stringify(nextDeleted));
        localStorage.setItem('haspaho_purchases', JSON.stringify(nextPurchases));
        localStorage.setItem('haspaho_installments', JSON.stringify(nextInstallments));
      }
    } catch (e) {
      console.error(e);
    }

    if (target) {
      try {
        await deleteDebtorFromFirestore(activeUserId, target.id);
        addAuditLog(
          'EXCLUSAO_PERMANENTE_DATABASE',
          `Devedor "${target.name}" (ID: ${target.id}) EXCLUÍDO PERMANENTEMENTE do banco de dados Firestore.`,
          target.name,
          'FIRESTORE_SAVED'
        );
        showToast(`Removido definitivamente do Banco e Firestore: "${target.name}".`);
      } catch (err) {
        console.error('Erro ao excluir definitivamente do Firestore:', err);
        addAuditLog(
          'EXCLUSAO_PERMANENTE_LOCAL',
          `Devedor "${target.name}" removido permanentemente localmente.`,
          target.name,
          'LOCAL_SAVED'
        );
        showToast(`Removido permanentemente: "${target.name}".`);
      }
    }
  };

  const handleRestoreAllData = async () => {
    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    removePermanentTombstone(activeUserId, 'DEMO-001');
    removePermanentTombstone(activeUserId, 'DEMO-002');
    try {
      localStorage.removeItem(`haspaho_demo_seeded_${activeUserId}`);
    } catch {}

    setDebtors(INITIAL_DEBTORS);
    setPurchases(INITIAL_PURCHASES);
    setInstallments(INITIAL_INSTALLMENTS);
    setDeletedDebtors([]);
    try {
      localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(INITIAL_DEBTORS));
      localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(INITIAL_PURCHASES));
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(INITIAL_INSTALLMENTS));
      localStorage.setItem(`haspaho_deleted_debtors_${activeUserId}`, JSON.stringify([]));
      if (activeUserId === DEFAULT_USER.id) {
        localStorage.setItem('haspaho_debtors', JSON.stringify(INITIAL_DEBTORS));
        localStorage.setItem('haspaho_purchases', JSON.stringify(INITIAL_PURCHASES));
        localStorage.setItem('haspaho_installments', JSON.stringify(INITIAL_INSTALLMENTS));
        localStorage.setItem('haspaho_deleted_debtors', JSON.stringify([]));
      }
      await Promise.all([
        saveDebtorsToFirestore(activeUserId, INITIAL_DEBTORS).catch(() => {}),
        savePurchasesToFirestore(activeUserId, INITIAL_PURCHASES).catch(() => {}),
        saveInstallmentsToFirestore(activeUserId, INITIAL_INSTALLMENTS).catch(() => {}),
      ]);
    } catch (e) {
      console.error(e);
    }
    showToast('✨ Toda a base de dados oficial e compras foram restauradas com sucesso!');
  };

  // Modal states
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isNewPurchaseModalOpen, setIsNewPurchaseModalOpen] = useState(false);
  const [isNewDebtorModalOpen, setIsNewDebtorModalOpen] = useState(false);
  const [isEditDebtorOpen, setIsEditDebtorOpen] = useState(false);
  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);
  const [editingPurchaseContext, setEditingPurchaseContext] = useState<{
    isOpen: boolean;
    purchase: Purchase | null;
    installment: Installment | null;
    debtor: Debtor | null;
  }>({
    isOpen: false,
    purchase: null,
    installment: null,
    debtor: null,
  });
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [contractDebtorId, setContractDebtorId] = useState<string | null>(null);
  const [isGeminiScannerOpen, setIsGeminiScannerOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isAuthLookupOpen, setIsAuthLookupOpen] = useState(false);
  const [isPdfHubOpen, setIsPdfHubOpen] = useState(false);
  const [pdfHubDebtorId, setPdfHubDebtorId] = useState<string>('');
  const [isMeuGerenciamentoOpen, setIsMeuGerenciamentoOpen] = useState(false);

  const handleOpenPdfHub = (debtorId?: string) => {
    const validId = debtorId && debtorId !== 'all' ? debtorId : targetDebtorId !== 'all' ? targetDebtorId : debtors[0]?.id || '';
    if (validId) {
      setPdfHubDebtorId(validId);
      setTargetDebtorId(validId);
    }
    setIsPdfHubOpen(true);
  };

  // Extrato Total Modal State
  const [isExtratoTotalOpen, setIsExtratoTotalOpen] = useState(false);
  const [extratoPurchase, setExtratoPurchase] = useState<Purchase | undefined>(undefined);
  const [extratoDebtor, setExtratoDebtor] = useState<Debtor | undefined>(undefined);
  const [extratoInstallmentsList, setExtratoInstallmentsList] = useState<Installment[]>([]);

  const handleOpenExtratoTotal = (purchaseId?: string, debtorId?: string) => {
    try {
      let matchedPurchase: Purchase | undefined = undefined;
      let matchedDebtor: Debtor | undefined = undefined;
      let matchedInsts: Installment[] = [];

      if (purchaseId && purchaseId !== 'all') {
        matchedPurchase =
          purchases.find((p) => p.id === purchaseId) ||
          purchases.find((p) => (p.product || '').toLowerCase() === purchaseId.toLowerCase());
      }
      if (debtorId && debtorId !== 'all') {
        matchedDebtor = debtors.find((d) => d.id === debtorId);
      }

      if (matchedPurchase) {
        matchedInsts = installments.filter(
          (i) =>
            i.purchaseId === matchedPurchase!.id ||
            (i.debtorId === matchedPurchase!.debtorId &&
              (i.product || '').toLowerCase() === (matchedPurchase!.product || '').toLowerCase())
        );
        if (!matchedDebtor) {
          matchedDebtor = debtors.find((d) => d.id === matchedPurchase!.debtorId);
        }
      }

      // Se não encontrou parcelas pelo purchaseId ou purchaseId não foi passado, busca pelo devedor
      if (matchedInsts.length === 0 && matchedDebtor) {
        const normName = (matchedDebtor.name || '').trim().toLowerCase();
        matchedInsts = installments.filter(
          (i) =>
            i.debtorId === matchedDebtor!.id ||
            (normName.length > 0 && (i.debtorName || '').trim().toLowerCase() === normName)
        );
        if (matchedInsts.length > 0 && !matchedPurchase) {
          const pId = matchedInsts[0].purchaseId;
          matchedPurchase = purchases.find((p) => p.id === pId);
        }
      }

      // Se ainda assim não encontrou e há parcela selecionada
      if (matchedInsts.length === 0 && selectedInstallment) {
        matchedDebtor = debtors.find((d) => d.id === selectedInstallment.debtorId);
        matchedPurchase = purchases.find((p) => p.id === selectedInstallment.purchaseId);
        matchedInsts = installments.filter(
          (i) => (selectedInstallment.purchaseId && i.purchaseId === selectedInstallment.purchaseId) || i.debtorId === selectedInstallment.debtorId
        );
      }

      // Fallback final: primeiro devedor
      if (matchedInsts.length === 0 && debtors.length > 0) {
        matchedDebtor = matchedDebtor || debtors[0];
        const normName = (matchedDebtor.name || '').trim().toLowerCase();
        matchedInsts = installments.filter(
          (i) =>
            i.debtorId === matchedDebtor!.id ||
            (normName.length > 0 && (i.debtorName || '').trim().toLowerCase() === normName)
        );
        if (matchedInsts.length > 0) {
          matchedPurchase = purchases.find((p) => p.id === matchedInsts[0].purchaseId);
        }
      }

      setExtratoPurchase(matchedPurchase);
      setExtratoDebtor(matchedDebtor);
      setExtratoInstallmentsList(matchedInsts.sort((a, b) => a.installmentNumber - b.installmentNumber));
      setIsExtratoTotalOpen(true);
    } catch (err) {
      console.error('Erro ao gerar Extrato Total:', err);
      showToast('Não foi possível gerar o extrato. Verifique os dados do parcelamento e tente novamente.');
    }
  };
  const [isPreRegistrationPortalOpen, setIsPreRegistrationPortalOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const s = window.location.search;
    return s.includes('pre_cadastro=true') || s.includes('portal_comprador=true') || s.includes('login_exclusivo=true') || s.includes('portal=true');
  });

  const handlePreRegistrationSubmit = (data: {
    name: string;
    cpf: string;
    email: string;
    phone: string;
    relation: string;
    pixKey: string;
    optionalMessage: string;
    purchaseProduct: string;
    purchaseInstallments: number;
    purchaseStore: string;
    purchaseDate: string;
    purchaseAmount: number;
  }) => {
    // Normalize phone (strip non-digits for comparison)
    const cleanPhone = (phoneStr: string) => phoneStr.replace(/\D/g, '');
    const incomingPhoneDigits = cleanPhone(data.phone);

    // Check if debtor already exists by phone number
    const existingDebtor = debtors.find((d) => cleanPhone(d.phone) === incomingPhoneDigits);

    let targetDebtorIdStr = '';
    const totalAmount = data.purchaseAmount || 1200.00;
    const instCount = data.purchaseInstallments || 12;
    const instValue = totalAmount / instCount;

    if (existingDebtor) {
      targetDebtorIdStr = existingDebtor.id;
      // Add purchase to existing debtor automatically
      const purchaseId = `p-prereg-${Date.now()}`;
      const newPurchase: Purchase = {
        id: purchaseId,
        debtorId: existingDebtor.id,
        debtorName: existingDebtor.name,
        product: data.purchaseProduct,
        store: data.purchaseStore,
        cardName: data.purchaseStore,
        totalAmount,
        installmentsTotal: instCount,
        installmentValue: instValue,
        paidCount: 0,
        pendingCount: instCount,
        overdueCount: 0,
        nextDueDate: data.purchaseDate,
        attachmentsCount: 1,
      };

      setPurchases((prev) => [newPurchase, ...prev]);

      // Generate installments
      const newInsts: Installment[] = [];
      const baseTimestamp = Date.now();
      for (let i = 1; i <= instCount; i++) {
        const calculatedDueDate = addMonthsToDateStr(data.purchaseDate, i - 1);
        newInsts.push({
          id: `inst-${baseTimestamp}-${i}`,
          purchaseId,
          debtorId: existingDebtor.id,
          debtorName: existingDebtor.name,
          debtorAvatar: existingDebtor.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          product: data.purchaseProduct,
          cardName: data.purchaseStore,
          installmentNumber: i,
          totalInstallments: instCount,
          amount: instValue,
          originalAmount: instValue,
          dueDate: calculatedDueDate,
          status: 'ontime',
        });
      }

      const updatedAllInstallments = [...newInsts, ...installments];
      setInstallments(updatedAllInstallments);

      // Update debtor owed total & active purchases
      const updatedDebtors = debtors.map((d) => {
        if (d.id === existingDebtor.id) {
          const updatedOwed = d.totalOwed + totalAmount;
          const updatedActivePurchases = (d.activePurchases || 0) + 1;
          const tempDebtor = { ...d, totalOwed: updatedOwed, activePurchases: updatedActivePurchases };
          const alert = evaluateSpendingAlert(tempDebtor, [newPurchase, ...purchases], updatedAllInstallments);
          const scoreResult = calculateDebtorScore(tempDebtor, updatedAllInstallments.filter((i) => i.debtorId === d.id));

          return {
            ...tempDebtor,
            spendingAlert: alert.isAlert,
            spendingAlertMessage: alert.message,
            score: scoreResult.score,
            scoreTier: scoreResult.tier,
          };
        }
        return d;
      });
      setDebtors(updatedDebtors);

      // Direct Firestore sync
      const activeUserId = currentUser?.id || DEFAULT_USER.id;
      if (activeUserId) {
        saveDebtorsToFirestore(activeUserId, updatedDebtors).catch(console.warn);
        savePurchasesToFirestore(activeUserId, [newPurchase, ...purchases]).catch(console.warn);
        saveInstallmentsToFirestore(activeUserId, updatedAllInstallments).catch(console.warn);
      }

      setTargetDebtorId(existingDebtor.id);
      setCurrentTab('devedores');
      showToast(`✨ IA Gemini reconheceu o número (${data.phone}): Compra "${data.purchaseProduct}" (${instCount}x) adicionada automaticamente ao devedor existente "${existingDebtor.name}"!`);
    } else {
      // Create new debtor automatically
      targetDebtorIdStr = `deb_${Date.now()}`;
      const newDebtor: Debtor = {
        id: targetDebtorIdStr,
        name: data.name,
        phone: data.phone,
        relation: data.relation,
        pixKey: data.pixKey,
        email: data.email,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        documentNumber: data.cpf,
        totalOwed: totalAmount,
        totalPaid: 0,
        overdueCount: 0,
        score: 850,
        scoreTier: 'excelente',
        onTimePaymentsCount: 3,
        justInTimePaymentsCount: 0,
        latePaymentsCount: 0,
        spendingAlert: false,
        activePurchases: 1,
        contractSigned: true,
        contractSignedDate: new Date().toLocaleDateString('pt-BR'),
      };

      const purchaseId = `p-prereg-${Date.now()}`;
      const newPurchase: Purchase = {
        id: purchaseId,
        debtorId: targetDebtorIdStr,
        debtorName: data.name,
        product: data.purchaseProduct,
        store: data.purchaseStore,
        cardName: data.purchaseStore,
        totalAmount,
        installmentsTotal: instCount,
        installmentValue: instValue,
        paidCount: 0,
        pendingCount: instCount,
        overdueCount: 0,
        nextDueDate: data.purchaseDate,
        attachmentsCount: 1,
      };

      const updatedDebtors = [newDebtor, ...debtors];
      const updatedPurchases = [newPurchase, ...purchases];
      setDebtors(updatedDebtors);
      setPurchases(updatedPurchases);

      const newInsts: Installment[] = [];
      const baseTimestamp = Date.now();
      for (let i = 1; i <= instCount; i++) {
        const calculatedDueDate = addMonthsToDateStr(data.purchaseDate, i - 1);
        newInsts.push({
          id: `inst-${baseTimestamp}-${i}`,
          purchaseId,
          debtorId: targetDebtorIdStr,
          debtorName: data.name,
          debtorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          product: data.purchaseProduct,
          cardName: data.purchaseStore,
          installmentNumber: i,
          totalInstallments: instCount,
          amount: instValue,
          originalAmount: instValue,
          dueDate: calculatedDueDate,
          status: 'ontime',
        });
      }

      const updatedAllInstallments = [...newInsts, ...installments];
      setInstallments(updatedAllInstallments);

      // Direct Firestore sync
      const activeUserId = currentUser?.id || DEFAULT_USER.id;
      if (activeUserId) {
        saveDebtorsToFirestore(activeUserId, updatedDebtors).catch(console.warn);
        savePurchasesToFirestore(activeUserId, updatedPurchases).catch(console.warn);
        saveInstallmentsToFirestore(activeUserId, updatedAllInstallments).catch(console.warn);
      }

      setTargetDebtorId(targetDebtorIdStr);
      setCurrentTab('devedores');
      showToast(`✨ Novo devedor "${data.name}" e compra "${data.purchaseProduct}" cadastrados automaticamente via Portal do Devedor!`);
    }
  };
  const [whatsAppData, setWhatsAppData] = useState<{
    isOpen: boolean;
    debtorName: string;
    phone: string;
    amount: string;
    product: string;
    dueDate: string;
  }>({
    isOpen: false,
    debtorName: '',
    phone: '',
    amount: '',
    product: '',
    dueDate: '',
  });

  const [proofData, setProofData] = useState<{
    isOpen: boolean;
    payer: string;
    amount: string;
    date: string;
    dest: string;
    auth: string;
    item: string;
    debtorId?: string;
  } | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isHealthAlertOpen, setIsHealthAlertOpen] = useState(false);
  const [detectedSentinelError, setDetectedSentinelError] = useState<{ message: string; source?: string; stack?: string } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Sentinela Inteligente: Monitoramento Anônimo e Notificações de Erro
  useEffect(() => {
    const unsubscribe = systemHealthSentinel.subscribe((err) => {
      setDetectedSentinelError(err);
      showToast(`⚠️ Sentinela: Detectada instabilidade no sistema. Contate Tiago Dias no (14) 99733-9863 com print.`);
    });
    return () => unsubscribe();
  }, []);

  // Stack de Histórico de Navegação para retorno à última ação feita
  interface NavigationHistoryEntry {
    tab: ScreenTab;
    targetInstallmentId: string;
    targetDebtorId: string;
    targetPurchaseFilter: string;
  }

  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryEntry[]>([]);

  // Sincronização do Histórico do Navegador (popstate) para evitar fechar a aplicação
  useEffect(() => {
    if (!window.history.state || !window.history.state.isHaspaho) {
      window.history.replaceState({ isHaspaho: true, index: 0 }, '');
    }

    const handlePopState = (e: PopStateEvent) => {
      if (navigationHistory.length > 0) {
        // Evita navegação padrão fora do app
        window.history.pushState({ isHaspaho: true, index: navigationHistory.length }, '');
        handleBack();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigationHistory]);

  // Navigation handler com preservação do histórico
  const handleNavigate = (tab: ScreenTab, targetId?: string, extraId?: string) => {
    // Guarda o estado atual no histórico antes de transitar
    setNavigationHistory((prev) => [
      ...prev,
      {
        tab: currentTab,
        targetInstallmentId,
        targetDebtorId,
        targetPurchaseFilter,
      },
    ]);

    // Push browser history state to enable browser back button
    window.history.pushState({ isHaspaho: true, index: navigationHistory.length + 1 }, '');

    if (targetId) {
      if (tab === 'detalhe-parcela' || tab === 'detalhe-atraso') {
        setTargetInstallmentId(targetId);
      } else if (tab === 'devedores' || tab === 'parcelas' || tab === 'relatorios') {
        if (targetId.includes('::')) {
          const [dId, pId] = targetId.split('::');
          setTargetDebtorId(dId);
          setTargetPurchaseFilter(pId || '');
        } else {
          setTargetDebtorId(targetId);
          setTargetPurchaseFilter(extraId || '');
        }
      }
    } else {
      if (tab === 'parcelas') {
        setTargetPurchaseFilter(extraId || '');
      }
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler para voltar sempre à última ação / tela anterior (sem nunca saltar para o início)
  const handleBack = () => {
    // 1. Se houver modal aberto no nível do App, fecha o modal ativo primeiro (voltando à tela exata anterior)
    if (isContractOpen) {
      setIsContractOpen(false);
      return;
    }
    if (isExtratoTotalOpen) {
      setIsExtratoTotalOpen(false);
      return;
    }
    if (proofData) {
      setProofData(null);
      return;
    }
    if (isPdfHubOpen) {
      setIsPdfHubOpen(false);
      return;
    }
    if (isAssetModalOpen) {
      setIsAssetModalOpen(false);
      return;
    }
    if (isNewPurchaseModalOpen) {
      setIsNewPurchaseModalOpen(false);
      return;
    }
    if (isNewDebtorModalOpen) {
      setIsNewDebtorModalOpen(false);
      return;
    }
    if (isEditDebtorOpen) {
      setIsEditDebtorOpen(false);
      return;
    }
    if (isUserSettingsOpen) {
      setIsUserSettingsOpen(false);
      return;
    }
    if (isAuthLookupOpen) {
      setIsAuthLookupOpen(false);
      return;
    }
    if (isGeminiScannerOpen) {
      setIsGeminiScannerOpen(false);
      return;
    }

    // 2. Se houver histórico de navegação entre telas, volta rigorosamente para a tela anterior
    if (navigationHistory.length > 0) {
      const lastEntry = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory((prev) => prev.slice(0, -1));

      if (lastEntry.targetInstallmentId) {
        setTargetInstallmentId(lastEntry.targetInstallmentId);
      }
      if (lastEntry.targetDebtorId) {
        setTargetDebtorId(lastEntry.targetDebtorId);
      }
      if (lastEntry.targetPurchaseFilter !== undefined) {
        setTargetPurchaseFilter(lastEntry.targetPurchaseFilter);
      }
      setCurrentTab(lastEntry.tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 3. Fallback apenas se o histórico estiver totalmente vazio e não estiver no dashboard
    if (currentTab !== 'dashboard') {
      setCurrentTab('dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Quick Nudge WhatsApp action
  const handleNudgeWhatsApp = (
    name: string,
    amount: string,
    item: string,
    parcel: string,
    phone?: string,
    dueDate?: string
  ) => {
    const debtor = debtors.find((d) => d.name === name);
    setWhatsAppData({
      isOpen: true,
      debtorName: name,
      phone: phone || debtor?.phone || '(14) 99733-9863',
      amount,
      product: `${item} (${parcel})`,
      dueDate: dueDate || '10/09/2026',
    });
  };

  // Open WhatsApp Modal from Debtor screen
  const handleOpenWhatsAppFromDebtor = (debtor: Debtor) => {
    const overdueInst = installments.find(
      (i) => i.debtorId === debtor.id && i.status === 'overdue'
    );
    setWhatsAppData({
      isOpen: true,
      debtorName: debtor.name,
      phone: debtor.phone,
      amount: overdueInst ? `R$ ${safeToFixed(overdueInst.amount, 2)}` : 'R$ 170,00',
      product: overdueInst ? overdueInst.product : 'Smart TV 55 polegadas',
      dueDate: overdueInst ? overdueInst.dueDate : '10/09/2026',
    });
  };

  // Aplica mutações financeiras vindas da Automação Inteligente Gemini
  const handleApplyGeminiMutations = (mutations: NonNullable<GeminiAutomationResult['mutations']>) => {
    const activeUserId = currentUser?.id || DEFAULT_USER.id;

    if (mutations.updatedDebtor) {
      setDebtors((prev) => {
        const next = [...prev];
        const idx = next.findIndex((d) => d.id === mutations.updatedDebtor!.id);
        if (idx >= 0) {
          next[idx] = { ...next[idx], ...mutations.updatedDebtor };
        } else {
          next.unshift(mutations.updatedDebtor!);
        }
        if (activeUserId) {
          saveDebtorsToFirestore(activeUserId, next).catch((e) => console.warn('Save debtors from Gemini note:', e));
        }
        return next;
      });
    }

    if (mutations.updatedInstallments && mutations.updatedInstallments.length > 0) {
      setInstallments((prev) => {
        const next = [...prev];
        for (const updated of mutations.updatedInstallments!) {
          const idx = next.findIndex((i) => i.id === updated.id);
          if (idx >= 0) {
            next[idx] = { ...next[idx], ...updated };
          }
        }
        if (activeUserId) {
          saveInstallmentsToFirestore(activeUserId, next).catch((e) => console.warn('Save installments from Gemini note:', e));
        }
        return next;
      });
    }

    if (mutations.newTransaction) {
      setTransactions((prev) => [mutations.newTransaction!, ...prev]);
    }

    showToast('✨ Operação executada com sucesso pelo Gemini e sincronizada com o banco de dados!');
  };

  // Settle installment handler
  const handleSettleInstallment = (inst: Installment) => {
    handleNavigate('detalhe-parcela', inst.id);
  };

  // Delete individual installment handler
  const handleDeleteInstallment = (id: string) => {
    const inst = installments.find((i) => i.id === id);
    if (inst) {
      setDeletingInstallmentTarget(inst);
    }
  };

  const handleConfirmDeleteInstallment = async (inst: Installment) => {
    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    addPermanentTombstone(activeUserId, inst.id);

    const nextInstallments = installments.filter((i) => i.id !== inst.id);
    const normProd = (inst.product || '').trim().toLowerCase();

    // Verifica se ainda restam parcelas desta mesma compra
    const remainingForPurchase = nextInstallments.filter(
      (i) =>
        (inst.purchaseId && i.purchaseId === inst.purchaseId) ||
        (!inst.purchaseId &&
          i.debtorId === inst.debtorId &&
          (i.product || '').trim().toLowerCase() === normProd)
    );

    let nextPurchases = purchases;
    const removedPurchaseIds: string[] = [];

    if (remainingForPurchase.length === 0) {
      // Se todas as parcelas da compra foram excluídas, remove também a compra pai para nunca ressuscitar!
      nextPurchases = purchases.filter((p) => {
        const isMatch =
          (inst.purchaseId && p.id === inst.purchaseId) ||
          (p.debtorId === inst.debtorId && (p.product || '').trim().toLowerCase() === normProd);
        if (isMatch) {
          removedPurchaseIds.push(p.id);
          addPermanentTombstone(activeUserId, p.id);
        }
        return !isMatch;
      });
      if (inst.purchaseId && !removedPurchaseIds.includes(inst.purchaseId)) {
        removedPurchaseIds.push(inst.purchaseId);
        addPermanentTombstone(activeUserId, inst.purchaseId);
      }
    } else {
      // Atualiza contagem e valor total da compra pai
      nextPurchases = purchases.map((p) => {
        const isMatch =
          (inst.purchaseId && p.id === inst.purchaseId) ||
          (p.debtorId === inst.debtorId && (p.product || '').trim().toLowerCase() === normProd);
        if (isMatch) {
          const newTotal = remainingForPurchase.reduce(
            (acc, item) => acc + safeToNumber(item.originalAmount || item.amount),
            0
          );
          const paidCnt = remainingForPurchase.filter((item) => item.status === 'paid').length;
          return {
            ...p,
            totalAmount: Number(safeToFixed(newTotal, 2)),
            installmentsTotal: remainingForPurchase.length,
            paidCount: paidCnt,
            pendingCount: Math.max(0, remainingForPurchase.length - paidCnt),
          };
        }
        return p;
      });
    }

    // Recalcula saldo devedor (totalOwed) do cliente
    const nextDebtors = debtors.map((d) => {
      if (d.id === inst.debtorId || (d.name && inst.debtorName && d.name.trim().toLowerCase() === inst.debtorName.trim().toLowerCase())) {
        const debtorInsts = nextInstallments.filter(
          (i) => i.debtorId === d.id || (i.debtorName && d.name && i.debtorName.trim().toLowerCase() === d.name.trim().toLowerCase())
        );
        const newOwed = debtorInsts
          .filter((i) => i.status !== 'paid')
          .reduce((acc, i) => acc + safeToNumber(i.amount || i.originalAmount), 0);
        const newPaid = debtorInsts
          .filter((i) => i.status === 'paid')
          .reduce((acc, i) => acc + safeToNumber(i.paidAmount || i.amount || i.originalAmount), 0);
        const newOverdue = debtorInsts.filter(
          (i) => i.status === 'overdue' || (i.delayDays || 0) > 0
        ).length;
        return {
          ...d,
          totalOwed: Number(safeToFixed(newOwed, 2)),
          totalPaid: Number(safeToFixed(newPaid, 2)),
          overdueCount: newOverdue,
          activePurchases: nextPurchases.filter((p) => p.debtorId === d.id).length,
        };
      }
      return d;
    });

    setInstallments(nextInstallments);
    setPurchases(nextPurchases);
    setDebtors(nextDebtors);
    setDeletingInstallmentTarget(null);

    try {
      localStorage.setItem('haspaho_installments', JSON.stringify(nextInstallments));
      localStorage.setItem('haspaho_purchases', JSON.stringify(nextPurchases));
      localStorage.setItem('haspaho_debtors', JSON.stringify(nextDebtors));
      if (activeUserId) {
        localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInstallments));
        localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(nextPurchases));
        localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(nextDebtors));
        deleteInstallmentFromFirestore(activeUserId, inst.id).catch((err) => console.warn('Delete inst firestore note:', err));
        removedPurchaseIds.forEach((pId) => {
          deletePurchaseFromFirestore(activeUserId, pId, inst.product, inst.debtorId).catch(() => {});
        });
        saveInstallmentsToFirestore(activeUserId, nextInstallments).catch((err) => console.warn('Sync insts note:', err));
        savePurchasesToFirestore(activeUserId, nextPurchases).catch((err) => console.warn('Sync purchases note:', err));
        saveDebtorsToFirestore(activeUserId, nextDebtors).catch((err) => console.warn('Sync debtors note:', err));
      }
    } catch (e) {
      console.warn('LocalStorage error on delete installment:', e);
    }

    addAuditLog('EXCLUSAO_PARCELA_DATABASE', `Parcela #${inst.installmentNumber} do produto "${inst.product}" excluída definitivamente do banco.`, inst.debtorName, 'FIRESTORE_SAVED');
    showToast('Parcela excluída definitivamente com sucesso!');
  };

  // Excluir compra inteira (produto + todas as suas parcelas) sem jamais reaparecer ao recarregar
  const handleDeletePurchase = (purchaseId?: string, productName?: string, debtorId?: string) => {
    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    const normProd = (productName || '').trim().toLowerCase();

    const matchedPurchases = purchases.filter((p) => {
      if (purchaseId && p.id === purchaseId) return true;
      if (
        normProd &&
        (p.product || '').trim().toLowerCase() === normProd &&
        (!debtorId || p.debtorId === debtorId)
      ) {
        return true;
      }
      return false;
    });

    const matchedPurchaseIds = new Set<string>(matchedPurchases.map((p) => p.id));
    if (purchaseId) matchedPurchaseIds.add(purchaseId);

    const matchedInstallments = installments.filter((i) => {
      if (i.purchaseId && matchedPurchaseIds.has(i.purchaseId)) return true;
      if (
        normProd &&
        (i.product || '').trim().toLowerCase() === normProd &&
        (!debtorId || i.debtorId === debtorId)
      ) {
        return true;
      }
      return false;
    });

    // Registra tombstones permanentes para a compra e todas as suas parcelas
    matchedPurchaseIds.forEach((id) => addPermanentTombstone(activeUserId, id));
    matchedInstallments.forEach((i) => {
      addPermanentTombstone(activeUserId, i.id);
      if (i.purchaseId) addPermanentTombstone(activeUserId, i.purchaseId);
    });

    const removedInstIds = new Set(matchedInstallments.map((i) => i.id));
    const nextPurchases = purchases.filter((p) => !matchedPurchaseIds.has(p.id));
    const nextInstallments = installments.filter((i) => !removedInstIds.has(i.id));

    const targetDebtorIdForRecalc =
      debtorId || matchedPurchases[0]?.debtorId || matchedInstallments[0]?.debtorId;

    const nextDebtors = debtors.map((d) => {
      if (!targetDebtorIdForRecalc || d.id === targetDebtorIdForRecalc) {
        const debtorInsts = nextInstallments.filter(
          (i) => i.debtorId === d.id || (i.debtorName && d.name && i.debtorName.trim().toLowerCase() === d.name.trim().toLowerCase())
        );
        const newOwed = debtorInsts
          .filter((i) => i.status !== 'paid')
          .reduce((acc, i) => acc + safeToNumber(i.amount || i.originalAmount), 0);
        const newPaid = debtorInsts
          .filter((i) => i.status === 'paid')
          .reduce((acc, i) => acc + safeToNumber(i.paidAmount || i.amount || i.originalAmount), 0);
        const newOverdue = debtorInsts.filter(
          (i) => i.status === 'overdue' || (i.delayDays || 0) > 0
        ).length;
        return {
          ...d,
          totalOwed: Number(safeToFixed(newOwed, 2)),
          totalPaid: Number(safeToFixed(newPaid, 2)),
          overdueCount: newOverdue,
          activePurchases: nextPurchases.filter((p) => p.debtorId === d.id).length,
        };
      }
      return d;
    });

    setPurchases(nextPurchases);
    setInstallments(nextInstallments);
    setDebtors(nextDebtors);
    if (targetPurchaseFilter && (targetPurchaseFilter === purchaseId || targetPurchaseFilter.toLowerCase() === normProd)) {
      setTargetPurchaseFilter('');
    }

    try {
      localStorage.setItem('haspaho_purchases', JSON.stringify(nextPurchases));
      localStorage.setItem('haspaho_installments', JSON.stringify(nextInstallments));
      localStorage.setItem('haspaho_debtors', JSON.stringify(nextDebtors));
      if (activeUserId) {
        localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(nextPurchases));
        localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInstallments));
        localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(nextDebtors));

        deletePurchaseFromFirestore(activeUserId, purchaseId, productName, targetDebtorIdForRecalc).catch((err) =>
          console.warn('Delete purchase firestore note:', err)
        );
        matchedInstallments.forEach((inst) => {
          deleteInstallmentFromFirestore(activeUserId, inst.id).catch(() => {});
        });
        savePurchasesToFirestore(activeUserId, nextPurchases).catch(() => {});
        saveInstallmentsToFirestore(activeUserId, nextInstallments).catch(() => {});
        saveDebtorsToFirestore(activeUserId, nextDebtors).catch(() => {});
      }
    } catch (e) {
      console.warn('LocalStorage error on delete purchase:', e);
    }

    const label = productName || matchedPurchases[0]?.product || 'Compra';
    addAuditLog(
      'EXCLUSAO_COMPRA_COMPLETA',
      `Compra "${label}" e suas ${matchedInstallments.length} parcelas foram excluídas definitivamente.`,
      matchedPurchases[0]?.debtorName || matchedInstallments[0]?.debtorName || 'Devedor',
      'FIRESTORE_SAVED'
    );
    showToast(`🗑️ Compra "${label}" e suas parcelas foram excluídas definitivamente!`);
  };

  // Abrir modal de edição de compra / parcela (data da 1ª parcela, nome do produto, valor, etc.)
  const handleOpenEditPurchase = (target: {
    purchaseId?: string;
    productName?: string;
    debtorId?: string;
    installment?: Installment;
  }) => {
    const inst = target.installment || null;
    const pId = target.purchaseId || inst?.purchaseId;
    const normProd = (target.productName || inst?.product || '').trim().toLowerCase();
    const dId = target.debtorId || inst?.debtorId;

    const foundPurchase =
      purchases.find((p) => pId && p.id === pId) ||
      purchases.find(
        (p) =>
          normProd &&
          (p.product || '').trim().toLowerCase() === normProd &&
          (!dId || p.debtorId === dId)
      ) ||
      null;

    const foundDebtor =
      debtors.find((d) => d.id === (dId || foundPurchase?.debtorId)) ||
      debtors.find(
        (d) =>
          inst?.debtorName &&
          d.name.trim().toLowerCase() === inst.debtorName.trim().toLowerCase()
      ) ||
      null;

    setEditingPurchaseContext({
      isOpen: true,
      purchase: foundPurchase,
      installment: inst,
      debtor: foundDebtor,
    });
  };

  // Salvar edição da compra ou parcela individual (incluindo recálculo da data da 1ª parcela)
  const handleSaveEditedPurchase = (payload: EditPurchaseSavePayload) => {
    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    const normOrigProd = (payload.originalProductName || payload.product || '').trim().toLowerCase();
    const cleanNewProduct = payload.product.trim() || 'Item Parcelado';
    const cleanStore = payload.store.trim() || 'Mercado Livre / Loja';
    const cleanCard = payload.cardName.trim() || 'Nubank Croma';

    let nextInstallments = [...installments];
    let nextPurchases = [...purchases];

    if (payload.mode === 'single_installment' && payload.singleInstallmentId) {
      nextInstallments = installments.map((inst) => {
        if (inst.id === payload.singleInstallmentId) {
          const newAmt = payload.singleInstallmentAmount || inst.amount || inst.originalAmount;
          return {
            ...inst,
            product: cleanNewProduct,
            cardName: cleanCard,
            dueDate: payload.singleInstallmentDueDate || inst.dueDate,
            amount: newAmt,
            originalAmount: newAmt,
          };
        }
        return inst;
      });

      // Atualiza também o nome do produto/cartão na compra vinculada se necessário
      nextPurchases = purchases.map((p) => {
        if (payload.purchaseId && p.id === payload.purchaseId) {
          const pInsts = nextInstallments.filter((i) => i.purchaseId === p.id);
          const sumAmt = pInsts.reduce((acc, i) => acc + safeToNumber(i.originalAmount || i.amount), 0);
          return {
            ...p,
            product: cleanNewProduct,
            store: cleanStore,
            cardName: cleanCard,
            totalAmount: sumAmt > 0 ? Number(safeToFixed(sumAmt, 2)) : p.totalAmount,
          };
        }
        return p;
      });
    } else {
      // Modo 'full_purchase': Atualiza a compra inteira e recalcula as datas de vencimento a partir da 1ª parcela
      const targetPurchase =
        purchases.find((p) => payload.purchaseId && p.id === payload.purchaseId) ||
        purchases.find(
          (p) =>
            normOrigProd &&
            (p.product || '').trim().toLowerCase() === normOrigProd &&
            (!payload.debtorId || p.debtorId === payload.debtorId)
        );

      const resolvedPurchaseId = targetPurchase?.id || payload.purchaseId || `p-${Date.now()}`;
      const existingLinkedInsts = installments
        .filter((inst) => {
          if (targetPurchase && inst.purchaseId === targetPurchase.id) return true;
          if (payload.purchaseId && inst.purchaseId === payload.purchaseId) return true;
          if (
            normOrigProd &&
            (inst.product || '').trim().toLowerCase() === normOrigProd &&
            (!payload.debtorId || inst.debtorId === payload.debtorId)
          ) {
            return true;
          }
          return false;
        })
        .sort((a, b) => (a.installmentNumber || 1) - (b.installmentNumber || 1));

      const debtorObj =
        debtors.find((d) => d.id === (payload.debtorId || targetPurchase?.debtorId)) ||
        debtors[0];
      const realDebtorId = debtorObj?.id || payload.debtorId || targetPurchase?.debtorId || '';
      const realDebtorName =
        debtorObj?.name ||
        targetPurchase?.debtorName ||
        existingLinkedInsts[0]?.debtorName ||
        'Devedor';
      const realDebtorAvatar =
        debtorObj?.avatar ||
        existingLinkedInsts[0]?.debtorAvatar ||
        getCleanDebtorAvatar(realDebtorName);

      const newInstCount = Math.max(1, payload.installmentsTotal || 1);
      const newTotalAmount = Math.max(0.01, payload.totalAmount);
      const newInstValue = Number(safeToFixed(newTotalAmount / newInstCount, 2));
      const baseTimestamp = Date.now();

      const rebuiltInsts: Installment[] = [];
      for (let i = 1; i <= newInstCount; i++) {
        const existing = existingLinkedInsts[i - 1];
        const calculatedDueDate = addMonthsToDateStr(payload.firstDueDate, i - 1);
        if (existing) {
          rebuiltInsts.push({
            ...existing,
            purchaseId: resolvedPurchaseId,
            debtorId: realDebtorId,
            debtorName: realDebtorName,
            debtorAvatar: realDebtorAvatar,
            product: cleanNewProduct,
            cardName: cleanCard,
            installmentNumber: i,
            totalInstallments: newInstCount,
            amount: newInstValue,
            originalAmount: newInstValue,
            dueDate: calculatedDueDate,
          });
        } else {
          rebuiltInsts.push({
            id: `inst-${baseTimestamp}-${i}`,
            purchaseId: resolvedPurchaseId,
            debtorId: realDebtorId,
            debtorName: realDebtorName,
            debtorAvatar: realDebtorAvatar,
            product: cleanNewProduct,
            cardName: cleanCard,
            installmentNumber: i,
            totalInstallments: newInstCount,
            amount: newInstValue,
            originalAmount: newInstValue,
            dueDate: calculatedDueDate,
            status: 'ontime',
          });
        }
      }

      // Se o usuário diminuiu o número de parcelas (ex: de 12x para 10x), adiciona tombstones e remove as excedentes
      if (existingLinkedInsts.length > newInstCount) {
        const removedExtra = existingLinkedInsts.slice(newInstCount);
        removedExtra.forEach((extra) => {
          addPermanentTombstone(activeUserId, extra.id);
          deleteInstallmentFromFirestore(activeUserId, extra.id).catch(() => {});
        });
      }

      const existingIdsSet = new Set(existingLinkedInsts.map((i) => i.id));
      nextInstallments = [
        ...rebuiltInsts,
        ...installments.filter((i) => !existingIdsSet.has(i.id)),
      ];

      const paidCount = rebuiltInsts.filter((i) => i.status === 'paid').length;
      const overdueCount = rebuiltInsts.filter(
        (i) => i.status === 'overdue' || (i.delayDays || 0) > 0
      ).length;
      const nextPending = rebuiltInsts.find((i) => i.status !== 'paid');

      const updatedPurchaseObj: Purchase = {
        ...(targetPurchase || {
          id: resolvedPurchaseId,
          debtorId: realDebtorId,
          debtorName: realDebtorName,
          attachmentsCount: 0,
        }),
        id: resolvedPurchaseId,
        debtorId: realDebtorId,
        debtorName: realDebtorName,
        product: cleanNewProduct,
        store: cleanStore,
        cardName: cleanCard,
        totalAmount: newTotalAmount,
        installmentsTotal: newInstCount,
        installmentValue: newInstValue,
        paidCount,
        pendingCount: Math.max(0, newInstCount - paidCount),
        overdueCount,
        firstDueDate: payload.firstDueDate,
        nextDueDate: nextPending?.dueDate || payload.firstDueDate,
      };

      if (targetPurchase) {
        nextPurchases = purchases.map((p) => (p.id === targetPurchase.id ? updatedPurchaseObj : p));
      } else {
        nextPurchases = [updatedPurchaseObj, ...purchases];
      }
    }

    // Recalcula saldos do devedor
    const nextDebtors = debtors.map((d) => {
      if (!payload.debtorId || d.id === payload.debtorId) {
        const debtorInsts = nextInstallments.filter(
          (i) => i.debtorId === d.id || (i.debtorName && d.name && i.debtorName.trim().toLowerCase() === d.name.trim().toLowerCase())
        );
        const newOwed = debtorInsts
          .filter((i) => i.status !== 'paid')
          .reduce((acc, i) => acc + safeToNumber(i.amount || i.originalAmount), 0);
        const newPaid = debtorInsts
          .filter((i) => i.status === 'paid')
          .reduce((acc, i) => acc + safeToNumber(i.paidAmount || i.amount || i.originalAmount), 0);
        const newOverdue = debtorInsts.filter(
          (i) => i.status === 'overdue' || (i.delayDays || 0) > 0
        ).length;
        const firstPending = debtorInsts.find((i) => i.status !== 'paid');

        return {
          ...d,
          totalOwed: Number(safeToFixed(newOwed, 2)),
          totalPaid: Number(safeToFixed(newPaid, 2)),
          overdueCount: newOverdue,
          nextDueDate: firstPending?.dueDate || d.nextDueDate,
          activePurchases: nextPurchases.filter((p) => p.debtorId === d.id).length,
        };
      }
      return d;
    });

    setPurchases(nextPurchases);
    setInstallments(nextInstallments);
    setDebtors(nextDebtors);

    try {
      localStorage.setItem('haspaho_purchases', JSON.stringify(nextPurchases));
      localStorage.setItem('haspaho_installments', JSON.stringify(nextInstallments));
      localStorage.setItem('haspaho_debtors', JSON.stringify(nextDebtors));
      if (activeUserId) {
        localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(nextPurchases));
        localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInstallments));
        localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(nextDebtors));
        savePurchasesToFirestore(activeUserId, nextPurchases).catch(() => {});
        saveInstallmentsToFirestore(activeUserId, nextInstallments).catch(() => {});
        saveDebtorsToFirestore(activeUserId, nextDebtors).catch(() => {});
      }
    } catch (e) {
      console.warn('LocalStorage error on edit purchase:', e);
    }

    addAuditLog(
      'EDICAO_COMPRA_SISTEMA',
      `Compra "${cleanNewProduct}" atualizada com sucesso (1º vencimento: ${payload.firstDueDate}).`,
      debtors.find((d) => d.id === payload.debtorId)?.name || 'Devedor',
      'FIRESTORE_SAVED'
    );
    showToast(`✨ Compra "${cleanNewProduct}" e datas das parcelas atualizadas com sucesso!`);
  };

  // Confirm payment submission with automatic score, late fee calculations
  const handleConfirmPayment = (
    installmentId: string,
    method: string,
    paidDate: string,
    actualPaidAmount?: number
  ): string => {
    const inst = installments.find((i) => i.id === installmentId);
    if (!inst) return '';

    const isOverdue = inst.status === 'overdue' || (inst.delayDays || 0) > 0;
    const lateFee = isOverdue ? 5.0 : 0;
    const requiredTotal = inst.originalAmount + lateFee;
    const paidAmount = actualPaidAmount !== undefined ? actualPaidAmount : requiredTotal;

    // Determine punctuality
    const punctuality = isOverdue ? 'late' : paidDate === inst.dueDate ? 'just_in_time' : 'ontime';
    // Garante que cada baixa gere uma chave criptográfica única e exclusiva
    const persistentAuthCode = (inst.status === 'paid' && inst.authCode) ? inst.authCode : generateAuthCode();
    const activeUserId = currentUser?.id || DEFAULT_USER.id;

    // 1. Update installments state
    const updatedInstallments = installments.map((item) =>
      item.id === installmentId
        ? {
            ...item,
            status: 'paid' as const,
            delayDays: 0,
            paidAt: paidDate,
            paymentMethod: method,
            paidAmount: paidAmount,
            lateFee: lateFee > 0 ? lateFee : undefined,
            punctuality: punctuality as 'ontime' | 'just_in_time' | 'late',
            authCode: persistentAuthCode,
          }
        : item
    );
    setInstallments(updatedInstallments);
    setTargetInstallmentId(installmentId);

    const updatedInst = updatedInstallments.find((i) => i.id === installmentId);

    // Atualiza a contagem de parcelas pagas na Compra
    const nextPurchases = purchases.map((p) => {
      const prodA = (p.product || '').toLowerCase().trim();
      const prodB = (inst.product || '').toLowerCase().trim();
      const matchDebtor = (p.debtorId && p.debtorId === inst.debtorId) || (p.debtorName && inst.debtorName && p.debtorName.trim().toLowerCase() === inst.debtorName.trim().toLowerCase());
      if (p.id === inst.purchaseId || (matchDebtor && prodA === prodB)) {
        const newPaidCount = (p.paidCount || 0) + 1;
        const newPendingCount = Math.max(0, (p.pendingCount || p.installmentsTotal) - 1);
        return {
          ...p,
          paidCount: newPaidCount,
          pendingCount: newPendingCount,
        };
      }
      return p;
    });
    setPurchases(nextPurchases);

    // Registra o código de autenticação gerado no Registro Oficial e no Firestore
    const authRecord = {
      auth: persistentAuthCode,
      type: 'recibo' as const,
      payer: inst.debtorName || 'Devedor',
      amount: `R$ ${safeToFixed(paidAmount).replace('.', ',')}`,
      date: paidDate,
      bank: method || 'Nubank Croma / Asaas IP',
      pixKey: '(14) 99712-0484',
      item: `${inst.product || 'Item'} (Parcela ${inst.installmentNumber || 1}/${inst.totalInstallments || 1})`,
      destination: 'Tiago Dias (Credor)',
      status: 'AUTÊNTICO E LIQUIDADO',
    };
    registerAuthCode(authRecord);
    if (activeUserId) {
      saveAuthRecordToFirestore(activeUserId, authRecord).catch(console.warn);
    }

    // 2. Update debtor in state (score recalculation, cashback balance, balances)
    const nextDebtors = debtors.map((d) => {
      const isTargetDebtor = (d.id && d.id === inst.debtorId) || (d.name && inst.debtorName && d.name.trim().toLowerCase() === inst.debtorName.trim().toLowerCase());
      if (isTargetDebtor) {
        const newTotalOwed = Math.max(0, (d.totalOwed || 0) - (inst.amount || inst.originalAmount || 0));
        const newTotalPaid = (d.totalPaid || 0) + paidAmount;
        const newOverdueCount = isOverdue ? Math.max(0, (d.overdueCount || 0) - 1) : (d.overdueCount || 0);

        const debtorInsts = updatedInstallments.filter((i) => i.debtorId === d.id || (i.debtorName && d.name && i.debtorName.trim().toLowerCase() === d.name.trim().toLowerCase()));
        const scoreResult = calculateDebtorScore(d, debtorInsts);
        const alertResult = evaluateSpendingAlert(d, nextPurchases, debtorInsts);

        return {
          ...d,
          totalOwed: newTotalOwed,
          totalPaid: newTotalPaid,
          overdueCount: newOverdueCount,
          score: scoreResult.score,
          scoreTier: scoreResult.tier,
          spendingAlert: alertResult.isAlert,
          spendingAlertMessage: alertResult.message,
          statusLabel: newOverdueCount > 0 ? 'Em atraso' : 'Em dia',
        };
      }
      return d;
    });
    setDebtors(nextDebtors);

    // Salva imediatamente no localStorage e sincroniza no Firestore
    try {
      localStorage.setItem('haspaho_installments', JSON.stringify(updatedInstallments));
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(updatedInstallments));
      localStorage.setItem('haspaho_purchases', JSON.stringify(nextPurchases));
      localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(nextPurchases));
      localStorage.setItem('haspaho_debtors', JSON.stringify(nextDebtors));
      localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(nextDebtors));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    if (activeUserId) {
      if (updatedInst) {
        saveSingleInstallmentToFirestore(activeUserId, updatedInst).catch(console.warn);
      }
      saveInstallmentsToFirestore(activeUserId, updatedInstallments).catch(console.warn);
      savePurchasesToFirestore(activeUserId, nextPurchases).catch(console.warn);
      saveDebtorsToFirestore(activeUserId, nextDebtors).catch(console.warn);
    }

    let toastMsg = `🎉 Tudo certo! Pagamento registrado com sucesso. Parcela #${inst.installmentNumber} (R$ ${safeToFixed(paidAmount).replace('.', ',')}) liquidada via ${method}! Autenticação: ${persistentAuthCode}`;

    addAuditLog('PAGAMENTO_CONFIRMADO', `Pagamento de R$ ${safeToFixed(paidAmount, 2)} confirmado (${method}). Autenticação ${persistentAuthCode}.`, inst.debtorName, 'FIRESTORE_SAVED');
    showToast(toastMsg);

    return persistentAuthCode;
  };

  const handleUpdateInstallment = (updatedInst: Installment) => {
    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    const nextInstallments = installments.map((item) => (item.id === updatedInst.id ? updatedInst : item));
    setInstallments(nextInstallments);

    try {
      localStorage.setItem('haspaho_installments', JSON.stringify(nextInstallments));
      if (activeUserId) {
        localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInstallments));
        saveSingleInstallmentToFirestore(activeUserId, updatedInst).catch((err) => console.warn('Update inst note:', err));
        saveInstallmentsToFirestore(activeUserId, nextInstallments).catch((err) => console.warn('Sync insts note:', err));
      }
    } catch (e) {
      console.warn('LocalStorage error on update installment:', e);
    }

    showToast(`Encargos da parcela #${updatedInst.installmentNumber} recalculados com sucesso!`);
  };

  // Add new purchase
  const handleAddPurchase = (data: {
    debtorId: string;
    product: string;
    store: string;
    cardName: string;
    totalAmount: number;
    installmentsTotal: number;
    firstDueDate: string;
    notes?: string;
  }) => {
    const newId = `p-${Date.now()}`;
    const targetDebtorIdToMatch = (data.debtorId || '').trim();

    // 1. Localizar devedor por ID exato ou por nome
    const safeDebtors = Array.isArray(debtors) ? debtors : [];
    let debtor = safeDebtors.find(
      (d) => d && (d.id === targetDebtorIdToMatch || (d.name && d.name.trim().toLowerCase() === targetDebtorIdToMatch.toLowerCase()))
    );

    // 2. Tentar match parcial se não encontrado diretamente
    if (!debtor && targetDebtorIdToMatch) {
      debtor = safeDebtors.find(
        (d) => d && d.name && (targetDebtorIdToMatch.toLowerCase().includes(d.name.trim().toLowerCase()) || d.name.trim().toLowerCase().includes(targetDebtorIdToMatch.toLowerCase()))
      );
    }

    // 3. Fallback se houver devedores cadastrados
    if (!debtor && safeDebtors.length > 0) {
      debtor = safeDebtors[0];
    }

    const realDebtorId = debtor?.id || targetDebtorIdToMatch || `d-${Date.now()}`;
    const realDebtorName = debtor?.name || (targetDebtorIdToMatch ? targetDebtorIdToMatch : 'Devedor');
    const realDebtorAvatar = debtor?.avatar || getCleanDebtorAvatar(realDebtorName);
    const instValue = Number(safeToFixed(data.totalAmount / data.installmentsTotal));

    const newPurchase: Purchase = {
      id: newId,
      debtorId: realDebtorId,
      debtorName: realDebtorName,
      product: data.product.trim(),
      store: data.store.trim() || 'Mercado Livre / Loja',
      cardName: data.cardName || 'Nubank Croma',
      totalAmount: data.totalAmount,
      installmentsTotal: data.installmentsTotal,
      installmentValue: instValue,
      paidCount: 0,
      pendingCount: data.installmentsTotal,
      overdueCount: 0,
      nextDueDate: data.firstDueDate,
      attachmentsCount: 1,
      notes: data.notes?.trim(),
    };

    // Create all installment items sequentially from 1 to installmentsTotal
    const newInsts: Installment[] = [];
    const baseTimestamp = Date.now();
    for (let i = 1; i <= data.installmentsTotal; i++) {
      const calculatedDueDate = addMonthsToDateStr(data.firstDueDate, i - 1);
      newInsts.push({
        id: `inst-${baseTimestamp}-${i}`,
        purchaseId: newId,
        debtorId: realDebtorId,
        debtorName: realDebtorName,
        debtorAvatar: realDebtorAvatar,
        product: data.product.trim(),
        cardName: data.cardName || 'Nubank Croma',
        installmentNumber: i,
        totalInstallments: data.installmentsTotal,
        amount: instValue,
        originalAmount: instValue,
        dueDate: calculatedDueDate,
        status: 'ontime',
      });
    }

    // Calcular as coleções atualizadas de forma síncrona e imediata
    const nextPurchases = [newPurchase, ...purchases.filter((p) => p.id !== newId)];
    const nextInstallments = [...newInsts, ...installments.filter((inst) => inst.purchaseId !== newId)];

    let nextDebtors: Debtor[] = [];
    const debtorExists = debtors.some((d) => d.id === realDebtorId);
    if (debtorExists) {
      nextDebtors = debtors.map((d) => {
        if (d.id === realDebtorId) {
          const updatedOwed = (d.totalOwed || 0) + data.totalAmount;
          const updatedActivePurchases = (d.activePurchases || 0) + 1;
          const tempDebtor = { ...d, totalOwed: updatedOwed, activePurchases: updatedActivePurchases };
          const alert = evaluateSpendingAlert(tempDebtor, nextPurchases, nextInstallments);
          const scoreResult = calculateDebtorScore(
            tempDebtor,
            nextInstallments.filter((i) => i.debtorId === d.id)
          );

          return {
            ...tempDebtor,
            spendingAlert: alert.isAlert,
            spendingAlertMessage: alert.message,
            score: scoreResult.score,
            scoreTier: scoreResult.tier,
          };
        }
        return d;
      });
    } else {
      const newlyCreatedDebtor: Debtor = {
        id: realDebtorId,
        name: realDebtorName,
        avatar: realDebtorAvatar,
        phone: '(14) 99755-8865',
        relation: 'Amigo',
        totalOwed: data.totalAmount,
        totalPaid: 0,
        overdueCount: 0,
        nextDueDate: data.firstDueDate,
        statusLabel: 'Em dia',
        score: 820,
        scoreTier: 'excelente',
        onTimePaymentsCount: 0,
        justInTimePaymentsCount: 0,
        latePaymentsCount: 0,
        spendingAlert: false,
        activePurchases: 1,
      };
      nextDebtors = [newlyCreatedDebtor, ...debtors];
    }

    // 1. Atualizar os estados do React
    setPurchases(nextPurchases);
    setInstallments(nextInstallments);
    setDebtors(nextDebtors);
    setTargetDebtorId(realDebtorId);

    // 2. Persistência imediata no LocalStorage
    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    try {
      localStorage.setItem('haspaho_purchases', JSON.stringify(nextPurchases));
      localStorage.setItem('haspaho_installments', JSON.stringify(nextInstallments));
      localStorage.setItem('haspaho_debtors', JSON.stringify(nextDebtors));
      if (activeUserId) {
        localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(nextPurchases));
        localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInstallments));
        localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(nextDebtors));
      }
    } catch (e) {
      console.error('LocalStorage write error in handleAddPurchase:', e);
    }

    // 3. Sincronização direta e segura com o Firestore
    if (activeUserId) {
      savePurchasesToFirestore(activeUserId, nextPurchases).catch((err) => {
        console.warn('[Firestore] Note saving purchases:', err);
      });
      saveInstallmentsToFirestore(activeUserId, nextInstallments).catch((err) => {
        console.warn('[Firestore] Note saving installments:', err);
      });
      saveDebtorsToFirestore(activeUserId, nextDebtors).catch((err) => {
        console.warn('[Firestore] Note saving debtors:', err);
      });
    }

    addAuditLog('CADASTRO_COMPRA', `Nova compra "${data.product}" (${data.installmentsTotal}x R$ ${safeToFixed(instValue, 2)}) cadastrada no banco.`, realDebtorName, 'FIRESTORE_SAVED');
    showToast(`Compra "${data.product}" (${data.installmentsTotal}x de R$ ${safeToFixed(instValue).replace('.', ',')}) cadastrada com sucesso para ${realDebtorName}!`);
  };

  // Add new debtor (with optional integrated initial purchase)
  const handleAddDebtor = (newD: {
    name: string;
    phone: string;
    relation: string;
    pixKey: string;
    email: string;
    avatar: string;
    documentNumber?: string;
    cpfCnpj?: string;
    username?: string;
    password?: string;
    authMethod?: 'local' | 'gmail' | 'facebook' | 'whatsapp';
    portalToken?: string;
    initialPurchase?: {
      product: string;
      store?: string;
      cardName?: string;
      totalAmount: number;
      installmentsTotal: number;
      firstDueDate: string;
    };
  }) => {
    const newDebtorId = `d-${Date.now()}`;
    const newDebtor: Debtor = {
      id: newDebtorId,
      name: newD.name,
      avatar: newD.avatar,
      phone: newD.phone,
      relation: newD.relation,
      pixKey: newD.pixKey,
      email: newD.email,
      documentNumber: newD.documentNumber || newD.cpfCnpj,
      cpfCnpj: newD.cpfCnpj || newD.documentNumber,
      username: newD.username,
      password: newD.password,
      authMethod: newD.authMethod || 'local',
      portalToken: newD.portalToken,
      totalOwed: 0,
      totalPaid: 0,
      overdueCount: 0,
      nextDueDate: 'Sem pendências',
      statusLabel: 'Em dia',
      score: 750,
      scoreTier: 'bom',
      onTimePaymentsCount: 0,
      justInTimePaymentsCount: 0,
      latePaymentsCount: 0,
      spendingAlert: false,
      activePurchases: 0,
    };

    // Se houver compra inicial informada dentro do formulário do novo comprador
    if (newD.initialPurchase && newD.initialPurchase.product && newD.initialPurchase.totalAmount > 0) {
      const p = newD.initialPurchase;
      const newPurchaseId = `p-${Date.now()}`;
      const instCount = p.installmentsTotal || 1;
      const instValue = Number(safeToFixed(p.totalAmount / instCount));

      const newPurchase: Purchase = {
        id: newPurchaseId,
        debtorId: newDebtor.id,
        debtorName: newDebtor.name,
        product: p.product.trim(),
        store: p.store || 'Loja Parceira',
        cardName: p.cardName || 'Nubank Croma',
        totalAmount: p.totalAmount,
        installmentsTotal: instCount,
        installmentValue: instValue,
        paidCount: 0,
        pendingCount: instCount,
        overdueCount: 0,
        nextDueDate: p.firstDueDate || new Date().toISOString().split('T')[0],
        attachmentsCount: 0,
        firstDueDate: p.firstDueDate || new Date().toISOString().split('T')[0],
        purchaseDate: new Date().toISOString().split('T')[0],
      };

      const newInsts: Installment[] = [];
      for (let i = 1; i <= instCount; i++) {
        newInsts.push({
          id: `inst-${Date.now()}-${i}`,
          purchaseId: newPurchaseId,
          debtorId: newDebtor.id,
          debtorName: newDebtor.name,
          debtorAvatar: newDebtor.avatar,
          product: p.product.trim(),
          cardName: p.cardName || 'Nubank Croma',
          installmentNumber: i,
          totalInstallments: instCount,
          amount: instValue,
          originalAmount: instValue,
          dueDate: addMonthsToDateStr(p.firstDueDate || new Date().toISOString().split('T')[0], i - 1),
          status: 'ontime',
        });
      }

      newDebtor.totalOwed = p.totalAmount;
      newDebtor.activePurchases = 1;
      newDebtor.nextDueDate = p.firstDueDate || new Date().toISOString().split('T')[0];

      const nextPurchases = [newPurchase, ...purchases];
      const nextInsts = [...newInsts, ...installments];
      const nextDebtors = [newDebtor, ...debtors];

      setPurchases(nextPurchases);
      setInstallments(nextInsts);
      setDebtors(nextDebtors);

      // Direct Firestore sync
      const activeUserId = currentUser?.id || DEFAULT_USER.id;
      if (activeUserId) {
        saveDebtorsToFirestore(activeUserId, nextDebtors).catch(console.warn);
        savePurchasesToFirestore(activeUserId, nextPurchases).catch(console.warn);
        saveInstallmentsToFirestore(activeUserId, nextInsts).catch(console.warn);
      }

      addAuditLog('CADASTRO_DEVEDOR_E_COMPRA', `Comprador "${newD.name}" e compra "${p.product}" safeToFixed(${instCount}x de R$ ${safeToFixed(instValue).replace('.', ',')}) cadastrados simultaneamente.`, newD.name, 'FIRESTORE_SAVED');
      showToast(`✨ Comprador "${newD.name}" e compra "${p.product}" cadastrados juntos com sucesso!`);
    } else {
      const nextDebtors = [newDebtor, ...debtors];
      setDebtors(nextDebtors);

      // Direct Firestore sync
      const activeUserId = currentUser?.id || DEFAULT_USER.id;
      if (activeUserId) {
        saveSingleDebtorToFirestore(activeUserId, newDebtor).catch(console.warn);
        saveDebtorsToFirestore(activeUserId, nextDebtors).catch(console.warn);
      }

      addAuditLog('CADASTRO_DEVEDOR_SISTEMA', `Novo devedor "${newD.name}" (CPF/CNPJ: ${newDebtor.cpfCnpj || 'N/A'}) cadastrado e salvo no banco Firestore.`, newD.name, 'FIRESTORE_SAVED');
      showToast(`✨ Comprador ${newD.name} cadastrado com sucesso!`);
    }
  };

  // Handler para abrir edição do devedor (lápis)
  const handleOpenEditDebtor = (debtor: Debtor) => {
    setEditingDebtor(debtor);
    setIsEditDebtorOpen(true);
  };

  // Salvar alterações do devedor editado
  const handleSaveEditedDebtor = (updated: Debtor) => {
    const nextDebtors = debtors.map((d) => (d.id === updated.id ? updated : d));
    const nextInsts = installments.map((i) =>
      i.debtorId === updated.id || (i.debtorName && i.debtorName.trim().toLowerCase() === updated.name.trim().toLowerCase())
        ? { ...i, debtorName: updated.name, debtorAvatar: updated.avatar }
        : i
    );
    const nextPurchases = purchases.map((p) =>
      p.debtorId === updated.id || (p.debtorName && p.debtorName.trim().toLowerCase() === updated.name.trim().toLowerCase())
        ? { ...p, debtorName: updated.name, debtorAvatar: updated.avatar, avatar: updated.avatar }
        : p
    );

    setDebtors(nextDebtors);
    setInstallments(nextInsts);
    setPurchases(nextPurchases);

    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    try {
      localStorage.setItem('haspaho_debtors', JSON.stringify(nextDebtors));
      localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(nextDebtors));
      localStorage.setItem('haspaho_installments', JSON.stringify(nextInsts));
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInsts));
      localStorage.setItem('haspaho_purchases', JSON.stringify(nextPurchases));
      localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(nextPurchases));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // Direct Firestore sync
    if (activeUserId) {
      saveSingleDebtorToFirestore(activeUserId, updated).catch(console.warn);
      saveDebtorsToFirestore(activeUserId, nextDebtors).catch(console.warn);
      saveInstallmentsToFirestore(activeUserId, nextInsts).catch(console.warn);
      savePurchasesToFirestore(activeUserId, nextPurchases).catch(console.warn);
    }

    addAuditLog('EDICAO_DEVEDOR_SISTEMA', `Dados cadastrais e foto do devedor "${updated.name}" atualizados no Firestore.`, updated.name, 'FIRESTORE_SAVED');
    showToast(`Devedor ${updated.name} atualizado com sucesso!`);
  };

  // Handler para abrir contrato digital
  const handleOpenContract = (debtorId: string) => {
    setContractDebtorId(debtorId);
    setIsContractOpen(true);
  };

  // Handler para assinar o contrato digital
  const handleSignContract = (debtorId: string, signatureUrl: string, signDate: string) => {
    const nextDebtors = debtors.map((d) =>
      d.id === debtorId
        ? {
            ...d,
            contractSigned: true,
            contractSignedDate: signDate,
            contractSignatureUrl: signatureUrl,
          }
        : d
    );
    setDebtors(nextDebtors);

    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    if (activeUserId) {
      const updated = nextDebtors.find((d) => d.id === debtorId);
      if (updated) saveSingleDebtorToFirestore(activeUserId, updated).catch(console.warn);
      saveDebtorsToFirestore(activeUserId, nextDebtors).catch(console.warn);
    }

    showToast('Contrato digital assinado e registrado com sucesso!');
  };

  // Handler para atualizar dados do devedor (ex: pré-preenchimento para usuário leigo)
  const handleUpdateDebtorData = (debtorId: string, updatedData: Partial<Debtor>) => {
    const nextDebtors = debtors.map((d) => (d.id === debtorId ? { ...d, ...updatedData } : d));
    setDebtors(nextDebtors);

    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    if (activeUserId) {
      const updated = nextDebtors.find((d) => d.id === debtorId);
      if (updated) saveSingleDebtorToFirestore(activeUserId, updated).catch(console.warn);
      saveDebtorsToFirestore(activeUserId, nextDebtors).catch(console.warn);
    }

    if (updatedData.name || updatedData.avatar) {
      const updatedDebtorObj = nextDebtors.find((d) => d.id === debtorId);
      const debtorName = updatedData.name || updatedDebtorObj?.name;
      const nextInsts = installments.map((i) =>
        i.debtorId === debtorId || (i.debtorName && debtorName && i.debtorName.trim().toLowerCase() === debtorName.trim().toLowerCase())
          ? {
              ...i,
              ...(debtorName ? { debtorName } : {}),
              ...(updatedData.avatar ? { debtorAvatar: updatedData.avatar } : {}),
            }
          : i
      );
      const nextPurchases = purchases.map((p) =>
        p.debtorId === debtorId || (p.debtorName && debtorName && p.debtorName.trim().toLowerCase() === debtorName.trim().toLowerCase())
          ? {
              ...p,
              ...(debtorName ? { debtorName } : {}),
              ...(updatedData.avatar ? { debtorAvatar: updatedData.avatar, avatar: updatedData.avatar } : {}),
            }
          : p
      );
      setInstallments(nextInsts);
      setPurchases(nextPurchases);
      try {
        localStorage.setItem('haspaho_installments', JSON.stringify(nextInsts));
        localStorage.setItem('haspaho_purchases', JSON.stringify(nextPurchases));
        if (activeUserId) {
          localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInsts));
          localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(nextPurchases));
        }
      } catch (e) {
        console.warn('LocalStorage write error:', e);
      }
      if (activeUserId) {
        saveInstallmentsToFirestore(activeUserId, nextInsts).catch(console.warn);
        savePurchasesToFirestore(activeUserId, nextPurchases).catch(console.warn);
      }
    }
  };

  // Handler autônomo para recepção de contrato assinado via Gemini IA
  const handleApplyParsedContract = (parsed: GeminiParsedContract) => {
    const cleanParsedName = (parsed.debtor.name || 'Cliente Novo').trim().toLowerCase();
    const existingDebtor = debtors.find(
      (d) =>
        d.name.trim().toLowerCase() === cleanParsedName ||
        (parsed.debtor.cpf &&
          d.documentNumber &&
          d.documentNumber.replace(/\D/g, '') === parsed.debtor.cpf.replace(/\D/g, ''))
    );

    const activeDebtorId = existingDebtor ? existingDebtor.id : `d-${Date.now()}`;
    const totalAmount = Number(parsed.purchase.totalAmount) || 0;
    const installmentsTotal = Number(parsed.purchase.installmentsTotal) || 1;
    const instValue =
      Number(parsed.purchase.installmentValue) ||
      Number(safeToFixed(totalAmount / installmentsTotal));
    const firstDueDate = parsed.purchase.firstDueDate || '10/10/2026';

    // 1. Criar Compra registrada de forma autônoma
    const newPurchaseId = `p-${Date.now()}`;
    const newPurchase: Purchase = {
      id: newPurchaseId,
      debtorId: activeDebtorId,
      debtorName: parsed.debtor.name || 'Cliente',
      product: parsed.purchase.product || 'Produto Contratado',
      store: parsed.purchase.store || 'HASPAHO Tecnologia',
      cardName: parsed.purchase.cardName || 'Nubank Croma',
      totalAmount: totalAmount,
      installmentsTotal: installmentsTotal,
      installmentValue: instValue,
      paidCount: 0,
      pendingCount: installmentsTotal,
      overdueCount: 0,
      nextDueDate: firstDueDate,
      attachmentsCount: 1,
    };

    // 2. Gerar cronograma de parcelas sequenciais
    const baseTimestamp = Date.now();
    const newInsts: Installment[] = [];
    for (let i = 1; i <= installmentsTotal; i++) {
      const calculatedDueDate = addMonthsToDateStr(firstDueDate, i - 1);
      newInsts.push({
        id: `inst-${baseTimestamp}-${i}`,
        purchaseId: newPurchaseId,
        debtorId: activeDebtorId,
        debtorName: parsed.debtor.name || 'Cliente',
        debtorAvatar:
          existingDebtor?.avatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        product: parsed.purchase.product || 'Produto Contratado',
        cardName: parsed.purchase.cardName || 'Nubank Croma',
        installmentNumber: i,
        totalInstallments: installmentsTotal,
        amount: instValue,
        originalAmount: instValue,
        dueDate: calculatedDueDate,
        status: 'ontime',
      });
    }

    const updatedAllInstallments = [...newInsts, ...installments];
    setInstallments(updatedAllInstallments);
    setPurchases((prev) => [newPurchase, ...prev]);

    // 3. Atualizar devedor existente ou cadastrar novo devedor
    if (existingDebtor) {
      const updatedDebtors = debtors.map((d) => {
        if (d.id === existingDebtor.id) {
          const updatedOwed = d.totalOwed + totalAmount;
          const updatedActive = (d.activePurchases || 0) + 1;
          const tempDebtor = {
            ...d,
            totalOwed: updatedOwed,
            activePurchases: updatedActive,
            contractSigned: true,
            contractSignedDate: parsed.contract.signDate || new Date().toLocaleDateString('pt-BR'),
            contractHash: parsed.contract.authHash,
            contractPreFilled: false,
            documentNumber: parsed.debtor.cpf || d.documentNumber,
            phone: parsed.debtor.phone || d.phone,
            email: parsed.debtor.email || d.email,
          };
          const scoreRes = calculateDebtorScore(
            tempDebtor,
            updatedAllInstallments.filter((i) => i.debtorId === d.id)
          );
          return {
            ...tempDebtor,
            score: scoreRes.score,
            scoreTier: scoreRes.tier,
          };
        }
        return d;
      });
      setDebtors(updatedDebtors);

      // Direct Firestore sync
      const activeUserId = currentUser?.id || DEFAULT_USER.id;
      if (activeUserId) {
        saveDebtorsToFirestore(activeUserId, updatedDebtors).catch(console.warn);
        savePurchasesToFirestore(activeUserId, [newPurchase, ...purchases]).catch(console.warn);
        saveInstallmentsToFirestore(activeUserId, updatedAllInstallments).catch(console.warn);
      }
    } else {
      const newDebtor: Debtor = {
        id: activeDebtorId,
        name: parsed.debtor.name || 'Cliente Novo',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        phone: parsed.debtor.phone || '(14) 99733-9863',
        relation: parsed.debtor.relation || 'Cliente / Amigo',
        documentNumber: parsed.debtor.cpf,
        email: parsed.debtor.email,
        totalOwed: totalAmount,
        totalPaid: 0,
        overdueCount: 0,
        nextDueDate: firstDueDate,
        statusLabel: 'Em dia',
        score: 850,
        scoreTier: 'excelente',
        onTimePaymentsCount: 0,
        justInTimePaymentsCount: 0,
        latePaymentsCount: 0,
        spendingAlert: false,
        activePurchases: 1,
        contractSigned: true,
        contractSignedDate: parsed.contract.signDate || new Date().toLocaleDateString('pt-BR'),
        contractHash: parsed.contract.authHash,
        contractPreFilled: false,
      };
      const updatedDebtors = [newDebtor, ...debtors];
      setDebtors(updatedDebtors);

      // Direct Firestore sync
      const activeUserId = currentUser?.id || DEFAULT_USER.id;
      if (activeUserId) {
        saveDebtorsToFirestore(activeUserId, updatedDebtors).catch(console.warn);
        savePurchasesToFirestore(activeUserId, [newPurchase, ...purchases]).catch(console.warn);
        saveInstallmentsToFirestore(activeUserId, updatedAllInstallments).catch(console.warn);
      }
    }

    setTargetDebtorId(activeDebtorId);
    setCurrentTab('devedores');
    showToast(
      `✨ Contrato reconhecido pela IA Gemini! Devedor "${parsed.debtor.name}" registrado com a compra "${parsed.purchase.product}" safeToFixed(${installmentsTotal}x de R$ ${safeToFixed(instValue).replace('.', ',')})!`
    );
  };

  // Handler autônomo para liquidação e rateio de compras identificado pelo Gemini
  const handleSettleDistributedPayments = (
    debtorId: string,
    settledItems: GeminiDistributionItem[],
    proofMeta: {
      payerName: string;
      totalPaid: number;
      paymentDate: string;
      paymentMethod?: string;
      authCode?: string;
      bankName?: string;
      excessAmount: number;
    }
  ) => {
    const activeUserId = currentUser?.id || DEFAULT_USER.id;
    const settledMap = new Map(settledItems.map((s) => [s.installmentId, s]));

    // 1. Atualiza as parcelas contempladas
    const updatedInstallments = installments.map((inst) => {
      const match = settledMap.get(inst.id);
      if (match) {
        const auth = proofMeta.authCode || generateAuthCode();
        registerAuthCode({
          auth,
          type: 'recibo',
          payer: proofMeta.payerName,
          amount: `R$ ${safeToFixed(match.allocatedAmount).replace('.', ',')}`,
          date: proofMeta.paymentDate || new Date().toLocaleDateString('pt-BR'),
          bank: proofMeta.bankName || 'PIX / Nubank',
          item: `${match.product} (Parcela ${match.installmentNumber}/${match.totalInstallments})`,
          destination: 'Tiago Dias (Credor)',
          status: 'AUTÊNTICO E LIQUIDADO',
        });
        return {
          ...inst,
          status: 'paid' as const,
          delayDays: 0,
          paidAt: proofMeta.paymentDate || new Date().toLocaleDateString('pt-BR'),
          paymentMethod: proofMeta.paymentMethod || 'PIX',
          paidAmount: match.allocatedAmount,
          punctuality: 'ontime' as const,
          authCode: auth,
        };
      }
      return inst;
    });

    setInstallments(updatedInstallments);

    // 2. Atualiza compras (paidCount / pendingCount)
    const nextPurchases = purchases.map((p) => {
      const settledCountForPurchase = settledItems.filter((s) => s.purchaseId === p.id).length;
      if (settledCountForPurchase > 0) {
        const newPaidCount = (p.paidCount || 0) + settledCountForPurchase;
        const newPendingCount = Math.max(0, (p.pendingCount || p.installmentsTotal) - settledCountForPurchase);
        return {
          ...p,
          paidCount: newPaidCount,
          pendingCount: newPendingCount,
        };
      }
      return p;
    });
    setPurchases(nextPurchases);

    // 3. Atualiza o devedor (totalPaid e totalOwed)
    const nextDebtors = debtors.map((d) => {
      if (d.id === debtorId) {
        const newPaid = Number(safeToFixed((d.totalPaid || 0) + proofMeta.totalPaid));
        const newOwed = Math.max(0, Math.max(0, Number(safeToFixed((d.totalOwed || 0) - proofMeta.totalPaid))));
        const tempD = {
          ...d,
          totalPaid: newPaid,
          totalOwed: newOwed,
        };
        const scoreRes = calculateDebtorScore(
          tempD,
          updatedInstallments.filter((i) => i.debtorId === d.id)
        );
        return {
          ...tempD,
          score: scoreRes.score,
          scoreTier: scoreRes.tier,
        };
      }
      return d;
    });
    setDebtors(nextDebtors);

    // 4. Salva no LocalStorage e Firestore
    try {
      localStorage.setItem('haspaho_installments', JSON.stringify(updatedInstallments));
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(updatedInstallments));
      localStorage.setItem('haspaho_purchases', JSON.stringify(nextPurchases));
      localStorage.setItem('haspaho_debtors', JSON.stringify(nextDebtors));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    if (activeUserId) {
      saveInstallmentsToFirestore(activeUserId, updatedInstallments).catch(console.warn);
      saveDebtorsToFirestore(activeUserId, nextDebtors).catch(console.warn);
      savePurchasesToFirestore(activeUserId, nextPurchases).catch(console.warn);

      // Salva registros de autenticação no Firestore para cada recibo emitido
      settledItems.forEach((item) => {
        saveAuthRecordToFirestore(activeUserId, {
          auth: proofMeta.authCode || generateAuthCode(),
          type: 'recibo',
          payer: proofMeta.payerName,
          amount: `R$ ${safeToFixed(item.allocatedAmount).replace('.', ',')}`,
          date: proofMeta.paymentDate,
          bank: proofMeta.bankName || 'Nubank Croma',
          pixKey: '(14) 99712-0484',
          item: `${item.product} (Parcela ${item.installmentNumber}/${item.totalInstallments})`,
          destination: 'Tiago Dias (Credor)',
          status: 'AUTÊNTICO E LIQUIDADO',
        }).catch(console.warn);
      });
    }

    addAuditLog(
      'BAIXA_RATEIO_GEMINI',
      `Liquidação autônoma via Gemini: ${settledItems.length} compras de "${proofMeta.payerName}" quitadas. Total: R$ ${safeToFixed(proofMeta.totalPaid).replace('.', ',')}.`,
      proofMeta.payerName,
      'FIRESTORE_SAVED'
    );

    showToast(
      `✨ ${settledItems.length} compras de ${proofMeta.payerName} quitadas com sucesso via Gemini safeToFixed(Total: R$ ${safeToFixed(proofMeta.totalPaid).replace('.', ',')})!`
    );
  };

  // Open proof voucher & auto-download individual receipt
  const handleShowProof = (
    payer: string,
    amount: string,
    date: string,
    dest: string,
    auth: string,
    item: string
  ) => {
    try {
      // Registra imediatamente no Registro Central Oficial
      registerAuthCode({
        auth: auth || generateAuthCode(),
        type: 'recibo',
        payer: payer || 'Devedor',
        amount: amount || 'R$ 0,00',
        date: date || 'Hoje',
        bank: 'Nubank Croma / Asaas IP',
        pixKey: '(14) 99712-0484',
        item: item || 'Parcela Individual',
        destination: dest || 'PIX / Asaas',
        status: 'AUTÊNTICO E LIQUIDADO',
      });

      const cleanPayer = (payer || '').toLowerCase().trim();
      const numMatch = (item || '').match(/(?:Parcela\s*#?|\s*#?)\s*(\d+)\s*(?:\/|\s+de\s+)\s*(\d+)/i);
      const targetParcelNum = numMatch ? Number(numMatch[1]) : 0;

      // Sincroniza a parcela específica se necessário (sem matching falso em strings vazias)
      const updated = installments.map((inst) => {
        const instName = (inst.debtorName || '').toLowerCase().trim();
        const isDebtorMatch = (cleanPayer && instName)
          ? (instName === cleanPayer || cleanPayer.includes(instName) || instName.includes(cleanPayer))
          : false;
        const isParcelMatch = targetParcelNum > 0
          ? inst.installmentNumber === targetParcelNum
          : item ? item.toLowerCase().includes((inst.product || '').toLowerCase()) : false;

        if (isDebtorMatch && isParcelMatch && inst.status !== 'paid') {
          return {
            ...inst,
            status: 'paid' as const,
            authCode: auth || inst.authCode || generateAuthCode(),
            paidAt: inst.paidAt || date,
            paidAmount: inst.paidAmount || inst.originalAmount || inst.amount,
          };
        }
        return inst;
      });

      setInstallments(updated);

      const activeUserId = currentUser?.id || DEFAULT_USER.id;
      try {
        localStorage.setItem('haspaho_installments', JSON.stringify(updated));
        localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }

      if (activeUserId) {
        saveInstallmentsToFirestore(activeUserId, updated).catch(console.warn);
        saveAuthRecordToFirestore(activeUserId, {
          auth: auth || generateAuthCode(),
          type: 'recibo',
          payer: payer || 'Devedor',
          amount: amount || 'R$ 0,00',
          date: date || 'Hoje',
          bank: 'Nubank Croma / Asaas IP',
          pixKey: '(14) 99712-0484',
          item: item || 'Parcela Individual',
          destination: dest || 'PIX / Asaas',
          status: 'AUTÊNTICO E LIQUIDADO',
        }).catch(console.warn);
      }

      // Busca devedor para obter telefone e dados cadastrais
      const foundDebtor = debtors.find((d) => {
        if (!d || !d.name) return false;
        const dName = String(d.name).toLowerCase().trim();
        return cleanPayer && dName && (dName === cleanPayer || cleanPayer.includes(dName) || dName.includes(cleanPayer));
      });

      // Abre a tela do Recibo Individual garantidamente
      setProofData({
        isOpen: true,
        payer: payer || 'Devedor',
        amount: amount || 'R$ 0,00',
        date: date || 'Hoje',
        dest: dest || 'PIX / Asaas',
        auth: auth || generateAuthCode(),
        item: item || 'Parcela Individual',
        debtorId: foundDebtor?.id,
      });
    } catch (err) {
      console.error('Erro ao processar exibição de recibo:', err);
      setProofData({
        isOpen: true,
        payer: payer || 'Devedor',
        amount: amount || 'R$ 0,00',
        date: date || 'Hoje',
        dest: dest || 'PIX / Asaas',
        auth: auth || generateAuthCode(),
        item: item || 'Parcela Individual',
      });
    }
  };

  const isStackScreen = currentTab === 'detalhe-parcela' || currentTab === 'detalhe-atraso';
  const selectedInstallment = installments.find((i) => i.id === targetInstallmentId) || installments[0];

  // User Authentication Handlers
  const handleLoginSuccess = async (user: UserAccount, isNewAccount = false) => {
    isExplicitLogoutRef.current = false;
    try {
      localStorage.removeItem('haspaho_explicit_logout');
    } catch {}
    const canonicalId = resolveCanonicalUserId(user.id, user.email);
    const normalizedUser: UserAccount = { ...user, id: canonicalId };
    setCurrentUser(normalizedUser);
    localStorage.setItem('haspaho_auth_user', JSON.stringify(normalizedUser));
    setIsAuthOpen(false);
    setCurrentTab('dashboard');

    // Controle estrito de apresentação: exibida APENAS no primeiro acesso de cada usuário
    const completedLocally = localStorage.getItem(`haspaho_welcome_completed_${canonicalId}`) === 'true';
    const completedRemotely = normalizedUser.hasSeenWelcome === true;
    const isFirstAccess = (isNewAccount || normalizedUser.isFirstLogin === true) && !completedLocally && !completedRemotely;

    if (isFirstAccess) {
      setIsWelcomeOpen(true);
    } else {
      setIsWelcomeOpen(false);
    }

    try {
      await saveUserToFirestore(normalizedUser);
      await syncWithCloudDatabase(normalizedUser, false);
    } catch (err) {
      console.error('Failed to sync user to Firestore:', err);
    }
    showToast(`Bem-vindo, ${normalizedUser.name}! Dados sincronizados com o Firebase.`);
  };

  const handleManualCloudSync = async () => {
    if (!currentUser) return;
    const canonicalId = resolveCanonicalUserId(currentUser.id, currentUser.email);
    const normalizedUser = { ...currentUser, id: canonicalId };
    try {
      await Promise.all([
        saveUserToFirestore(normalizedUser),
        saveDebtorsToFirestore(canonicalId, debtors),
        savePurchasesToFirestore(canonicalId, purchases),
        saveInstallmentsToFirestore(canonicalId, installments),
      ]);
      await syncWithCloudDatabase(normalizedUser, true);
    } catch (err) {
      console.error('[Firestore:MANUAL_SYNC] Error:', err);
      showToast('⚠️ Erro ao sincronizar com o Firebase. Verifique sua conexão.');
    }
  };

  const handleImportBackupData = async (imported: {
    debtors?: Debtor[];
    purchases?: Purchase[];
    installments?: Installment[];
  }) => {
    if (!currentUser) return;
    const canonicalId = resolveCanonicalUserId(currentUser.id, currentUser.email);

    const inDebtors = Array.isArray(imported.debtors) ? imported.debtors : [];
    const inPurchases = Array.isArray(imported.purchases) ? imported.purchases : [];
    const inInstallments = Array.isArray(imported.installments) ? imported.installments : [];

    // Remove imported IDs from tombstones so they are restored cleanly
    inDebtors.forEach((d) => d?.id && removePermanentTombstone(canonicalId, d.id));
    inPurchases.forEach((p) => p?.id && removePermanentTombstone(canonicalId, p.id));
    inInstallments.forEach((i) => i?.id && removePermanentTombstone(canonicalId, i.id));

    const debtorMap = new Map<string, Debtor>();
    debtors.forEach((d) => d?.id && debtorMap.set(d.id, d));
    inDebtors.forEach((d) => d?.id && debtorMap.set(d.id, { ...debtorMap.get(d.id), ...d }));
    const mergedDebtors = Array.from(debtorMap.values());

    const purchaseMap = new Map<string, Purchase>();
    purchases.forEach((p) => p?.id && purchaseMap.set(p.id, p));
    inPurchases.forEach((p) => p?.id && purchaseMap.set(p.id, { ...purchaseMap.get(p.id), ...p }));
    const mergedPurchases = Array.from(purchaseMap.values());

    const instMap = new Map<string, Installment>();
    installments.forEach((i) => i?.id && instMap.set(i.id, i));
    inInstallments.forEach((i) => i?.id && instMap.set(i.id, { ...instMap.get(i.id), ...i }));
    const mergedInstallments = Array.from(instMap.values());

    setDebtors(mergedDebtors);
    setPurchases(mergedPurchases);
    setInstallments(mergedInstallments);

    try {
      localStorage.setItem(`haspaho_debtors_${canonicalId}`, JSON.stringify(mergedDebtors));
      localStorage.setItem(`haspaho_purchases_${canonicalId}`, JSON.stringify(mergedPurchases));
      localStorage.setItem(`haspaho_installments_${canonicalId}`, JSON.stringify(mergedInstallments));
      localStorage.setItem('haspaho_debtors', JSON.stringify(mergedDebtors));
      localStorage.setItem('haspaho_purchases', JSON.stringify(mergedPurchases));
      localStorage.setItem('haspaho_installments', JSON.stringify(mergedInstallments));
    } catch {}

    try {
      await Promise.all([
        saveDebtorsToFirestore(canonicalId, mergedDebtors),
        savePurchasesToFirestore(canonicalId, mergedPurchases),
        saveInstallmentsToFirestore(canonicalId, mergedInstallments),
      ]);
      showToast(
        `✅ Backup restaurado e salvo no Firebase (${mergedDebtors.length} clientes, ${mergedPurchases.length} compras, ${mergedInstallments.length} parcelas)!`
      );
    } catch (err) {
      console.error('Erro ao salvar backup importado no Firestore:', err);
      showToast('✅ Backup restaurado localmente. Sincronizando com o Firebase...');
    }
  };

  const handleLogout = async () => {
    console.log('[App:LOGOUT] Starting logout process...');
    isExplicitLogoutRef.current = true;
    try {
      localStorage.setItem('haspaho_explicit_logout', 'true');
      localStorage.removeItem('haspaho_auth_user');
      setCurrentUser(null);
      setDebtors([]);
      setPurchases([]);
      setInstallments([]);
      setCurrentTab('inicio');
      setIsAuthOpen(true);
      setIsUserSettingsOpen(false);
      await logoutUser();
      console.log('[App:LOGOUT] Session cleared successfully.');
    } catch (e) {
      console.warn('Logout session error:', e);
    }
    showToast('Você encerrou a sessão com segurança.');
  };

  const handleClearAllData = async () => {
    if (!currentUser?.id) return;
    try {
      await clearAllUserDataFromFirestore(currentUser.id);
      setDebtors([]);
      setPurchases([]);
      setInstallments([]);
      setTargetDebtorId('');
      showToast('Ambiente reiniciado com sucesso! Todos os dados foram limpos.');
    } catch (err) {
      console.error('Failed to clear user data:', err);
      showToast('Erro ao limpar dados do Firestore.');
    }
  };

  const handleSaveUserSettings = async (updatedUser: UserAccount) => {
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('haspaho_auth_user', JSON.stringify(updatedUser));
      await saveUserToFirestore(updatedUser);
    } catch (e) {
      console.error('Failed to update user in Firestore:', e);
    }
    showToast('Perfil e dados sincronizados com o banco seguro!');
  };

  const handleDismissWelcome = async () => {
    setIsWelcomeOpen(false);
    if (!currentUser) return;

    const userId = currentUser.id;
    const updatedUser: UserAccount = {
      ...currentUser,
      isFirstLogin: false,
      hasSeenWelcome: true,
      welcomeCompletedAt: new Date().toISOString(),
    };

    setCurrentUser(updatedUser);

    try {
      localStorage.setItem('haspaho_auth_user', JSON.stringify(updatedUser));
      localStorage.setItem(`haspaho_welcome_completed_${userId}`, 'true');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // Grava de forma permanente no Firebase Firestore vinculado ao UID
    try {
      await markWelcomeCompletedInFirestore(userId);
      await saveUserToFirestore(updatedUser);
      console.log(`[Firestore:WELCOME] Apresentação concluída para UID: ${userId}`);
    } catch (err) {
      console.error('[Firestore:WELCOME] Erro ao salvar status de apresentação:', err);
    }
  };

  // Trava de Autenticação Segura: Se não houver usuário autenticado, exibe a tela oficial de login/cadastro
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-y-auto">
        <div className="w-full max-w-4xl relative z-10 py-4 sm:py-8">
          <InitialWelcomeLoginScreen
            currentUser={null}
            debtors={[]}
            installments={[]}
            onLoginSuccess={(user, isNew) => {
              handleLoginSuccess(user, isNew);
              handleNavigate('dashboard');
            }}
            onEnterDashboard={() => handleNavigate('dashboard')}
            onOpenGeminiScanner={() => setIsGeminiScannerOpen(true)}
            onLogout={handleLogout}
          />
        </div>

        {/* Global Toast Notification */}
        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      theme === 'dark'
        ? 'bg-slate-900 text-slate-100 selection:bg-cyan-900 selection:text-cyan-100'
        : 'bg-slate-100 text-slate-900 selection:bg-blue-100 selection:text-blue-900'
    } font-sans antialiased flex flex-col justify-between relative overflow-x-hidden transition-colors duration-200`}>
      {/* Living Futuristic Cosmic Background (Tela de Descanso Ativa em Segundo Plano com IA) */}
      <FuturisticCosmicBackground />

      {/* Header */}
      <Header
        currentTab={currentTab}
        onNavigate={handleNavigate}
        onBack={handleBack}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenAssetInspector={() => setIsAssetModalOpen(true)}
        onOpenNewPurchase={() => setIsNewPurchaseModalOpen(true)}
        onOpenGeminiScanner={() => setIsGeminiScannerOpen(true)}
        isStackScreen={isStackScreen}
        currentUser={currentUser}
        debtors={debtors}
        installments={installments}
        onToast={showToast}
        onSettleInstallment={handleSettleInstallment}
        onOpenCredorScore={() => setIsCredorScoreOpen(true)}
        onOpenPresentation={() => setIsTourModalOpen(true)}
        onNudgeWhatsApp={handleNudgeWhatsApp}
        onOpenNewDebtor={() => setIsNewDebtorModalOpen(true)}
        onEditDebtor={handleOpenEditDebtor}
        onOpenContract={handleOpenContract}
        onOpenLogin={() => setIsAuthOpen(true)}
        onOpenWelcome={() => setIsWelcomeOpen(true)}
        onOpenUserSettings={() => setIsUserSettingsOpen(true)}
        onOpenAuthLookup={() => setIsAuthLookupOpen(true)}
        onLogout={handleLogout}
        onRestoreAllData={handleRestoreAllData}
        onSyncFirebase={handleManualCloudSync}
        isDarkMode={theme === 'dark'}
        onToggleTheme={handleToggleTheme}
        titleOverride={
          currentTab === 'detalhe-parcela'
            ? 'Dar Baixa em Parcela'
            : currentTab === 'detalhe-atraso'
            ? 'Detalhes do Atraso'
            : undefined
        }
        subtitleOverride={
          currentTab === 'detalhe-parcela'
            ? 'Auditoria e Liquidação Nubank'
            : currentTab === 'detalhe-atraso'
            ? '1 parcela vencida há 9 dias'
            : undefined
        }
      />

      {/* Main Screen Container - Fluid Full Width Design (No empty side margins) */}
      <main
        className={`flex-1 w-full relative ${
          currentTab === 'erp-legacy'
            ? 'px-0 sm:px-2 lg:px-3 pt-20 sm:pt-20 md:pt-16 pb-6 sm:pb-8'
            : currentTab === 'admin-forum'
            ? 'px-1 sm:px-3 lg:px-4 pt-24 md:pt-20 pb-6'
            : currentTab === 'gemini-automacao'
            ? 'px-1.5 sm:px-4 lg:px-6 pt-20 md:pt-16 pb-[4.25rem] sm:pb-20'
            : isStackScreen
            ? 'px-1 sm:px-4 lg:px-8 xl:px-10 2xl:px-12 pt-[6.75rem] md:pt-20 pb-36 sm:pb-28'
            : 'px-1 sm:px-4 lg:px-8 xl:px-10 2xl:px-12 pt-[7.75rem] sm:pt-32 md:pt-20 pb-36 sm:pb-28'
        }`}
      >
        <ErrorBoundary fallbackTitle="Visualização em Recuperação" onReset={() => handleNavigate('dashboard')}>
          {/* Render Active View */}
          {currentTab === 'inicio' && (
          <InitialWelcomeLoginScreen
            currentUser={currentUser}
            debtors={debtors}
            installments={installments}
            onLoginSuccess={(user, isNew) => {
              handleLoginSuccess(user, isNew);
              handleNavigate('dashboard');
            }}
            onEnterDashboard={() => handleNavigate('dashboard')}
            onOpenGeminiScanner={() => setIsGeminiScannerOpen(true)}
            onOpenPresentation={() => setIsTourModalOpen(true)}
            onLogout={handleLogout}
          />
        )}

        {(currentTab === 'dashboard' || currentTab === 'parcelas') && (
          <DashboardView
            debtors={debtors}
            purchases={purchases}
            installments={installments}
            onNavigate={handleNavigate}
            onOpenNewPurchase={() => setIsNewPurchaseModalOpen(true)}
            onOpenNewDebtor={() => setIsNewDebtorModalOpen(true)}
            onOpenGeminiScanner={() => setIsGeminiScannerOpen(true)}
            onNudgeWhatsApp={handleNudgeWhatsApp}
            onSettleInstallment={handleSettleInstallment}
            onDeleteInstallment={handleDeleteInstallment}
            onShowProof={handleShowProof}
            onOpenNewPurchaseForDebtor={(debtorId) => {
              setTargetDebtorId(debtorId);
              setIsNewPurchaseModalOpen(true);
            }}
            onEditDebtor={handleOpenEditDebtor}
            onRequestDeleteDebtor={handleRequestDeleteDebtor}
            onEditPurchase={handleOpenEditPurchase}
            onDeletePurchase={handleDeletePurchase}
            onOpenContract={handleOpenContract}
            onOpenExtratoTotal={handleOpenExtratoTotal}
            onOpenPdfHub={handleOpenPdfHub}
            searchQuery={searchQuery}
            initialDebtorId={targetDebtorId}
            initialPurchaseFilter={targetPurchaseFilter}
            onSelectDebtor={setTargetDebtorId}
            onToast={showToast}
            onUpdateInstallment={handleUpdateInstallment}
            userPixKey={currentUser?.pixKey}
            initialSection={currentTab === 'parcelas' ? 'parcelas' : 'visao_geral'}
            onRestoreAllData={handleRestoreAllData}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}

        {currentTab === 'devedores' && (
          <DevedoresView
            debtors={debtors}
            purchases={purchases}
            installments={installments}
            onNavigate={handleNavigate}
            onOpenNewPurchaseForDebtor={(debtorId) => {
              setTargetDebtorId(debtorId);
              setIsNewPurchaseModalOpen(true);
            }}
            onOpenNewDebtor={() => setIsNewDebtorModalOpen(true)}
            onEditDebtor={handleOpenEditDebtor}
            onRequestDeleteDebtor={handleRequestDeleteDebtor}
            onEditPurchase={handleOpenEditPurchase}
            onDeletePurchase={handleDeletePurchase}
            onOpenContract={handleOpenContract}
            onOpenExtratoTotal={handleOpenExtratoTotal}
            onOpenGeminiScanner={() => setIsGeminiScannerOpen(true)}
            onNudgeWhatsApp={handleNudgeWhatsApp}
            onSettleInstallment={handleSettleInstallment}
            onDeleteInstallment={handleDeleteInstallment}
            onShowProof={handleShowProof}
            onToast={showToast}
            searchQuery={searchQuery}
            theme={theme}
          />
        )}

        {currentTab === 'detalhe-parcela' && (
          <DetalheParcelaView
            installment={selectedInstallment}
            debtor={debtors.find((d) => d.id === selectedInstallment?.debtorId)}
            onNavigate={handleNavigate}
            onBack={handleBack}
            onConfirmPayment={handleConfirmPayment}
            onToast={showToast}
            onOpenExtratoTotal={handleOpenExtratoTotal}
            onShowProof={handleShowProof}
            isDarkMode={theme === 'dark'}
            onToggleTheme={handleToggleTheme}
          />
        )}

        {currentTab === 'detalhe-atraso' && (
          <DetalheAtrasoView
            installment={selectedInstallment}
            onNavigate={handleNavigate}
            onBack={handleBack}
            onNudgeWhatsApp={handleNudgeWhatsApp}
            onEditDebtor={(id) => {
              const d = debtors.find((deb) => deb.id === id);
              if (d) handleOpenEditDebtor(d);
            }}
            onOpenContract={handleOpenContract}
            onOpenExtratoTotal={handleOpenExtratoTotal}
            onToast={showToast}
          />
        )}

        {currentTab === 'relatorios' && (
          <RelatoriosView
            debtors={debtors}
            purchases={purchases}
            installments={installments}
            initialDebtorId={targetDebtorId}
            onNavigate={handleNavigate}
            onToast={showToast}
          />
        )}

        {currentTab === 'perfil' && (
          <PerfilView
            currentUser={currentUser}
            debtors={debtors}
            purchases={purchases}
            installments={installments}
            deletedDebtors={deletedDebtors}
            onNavigate={handleNavigate}
            onOpenAssetInspector={() => setIsAssetModalOpen(true)}
            onOpenLogin={() => setIsAuthOpen(true)}
            onOpenWelcome={() => setIsWelcomeOpen(true)}
            onOpenUserSettings={() => setIsUserSettingsOpen(true)}
            onSaveUser={handleSaveUserSettings}
            onLogout={handleLogout}
            onToast={showToast}
            onClearAllData={handleClearAllData}
          />
        )}

        {currentTab === 'erp-legacy' && (
          <ErpLegacySystem
            debtors={debtors}
            purchases={purchases}
            installments={installments}
            institutions={institutions}
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onUpdateDebtors={setDebtors}
            onUpdatePurchases={setPurchases}
            onUpdateInstallments={setInstallments}
            onToast={showToast}
            onRequestDeleteDebtor={handleRequestDeleteDebtor}
            onDeleteInstallment={handleDeleteInstallment}
          />
        )}

        {currentTab === 'admin-forum' && (
          <AdminDevForumView
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onToast={showToast}
            onUpdateCurrentUser={setCurrentUser}
          />
        )}

        {currentTab === 'gemini-automacao' && (
          <GeminiAutomationView
            currentUser={currentUser}
            debtors={debtors}
            purchases={purchases}
            installments={installments}
            transactions={transactions}
            onApplyMutations={handleApplyGeminiMutations}
            onNavigateToDebtor={(debtorId) => handleNavigate('devedores', debtorId)}
            onClose={() => handleNavigate('dashboard')}
          />
        )}
        </ErrorBoundary>
      </main>

      {/* Bottom Navigation Bar */}
      {!isStackScreen && currentTab !== 'erp-legacy' && (
        <BottomNav
          currentTab={currentTab}
          onNavigate={handleNavigate}
          onOpenNewPurchase={() => setIsNewPurchaseModalOpen(true)}
          onOpenNewDebtor={() => setIsNewDebtorModalOpen(true)}
          onOpenGeminiScanner={() => setIsGeminiScannerOpen(true)}
          onOpenExtratoTotal={() => handleOpenExtratoTotal()}
          onOpenAuthLookup={() => setIsAuthLookupOpen(true)}
          onOpenNovoRecibo={() => handleOpenExtratoTotal()}
          onOpenPdfHub={() => handleOpenPdfHub(targetDebtorId !== 'all' ? targetDebtorId : debtors[0]?.id)}
          onOpenMeuGerenciamento={() => setIsMeuGerenciamentoOpen(true)}
          onOpenUserSettings={(tab) => {
            if (tab) setUserSettingsTab(tab);
            setIsUserSettingsOpen(true);
          }}
          onLogout={handleLogout}
          onOpenLogin={() => setIsAuthOpen(true)}
        />
      )}

      {/* Asset Inspector Modal (Answer to "É possível adicionar links diretos para as imagens do HTML") */}
      <AssetInspectorModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
      />

      {/* WhatsApp Nudge Modal */}
      <WhatsAppModal
        isOpen={whatsAppData.isOpen}
        onClose={() => setWhatsAppData((prev) => ({ ...prev, isOpen: false }))}
        debtorName={whatsAppData.debtorName}
        phone={whatsAppData.phone}
        amount={whatsAppData.amount}
        product={whatsAppData.product}
        dueDate={whatsAppData.dueDate}
        onToast={showToast}
      />

      {/* Digital Liquidation Proof Modal (Recibo Individual da Parcela) */}
      <ErrorBoundary fallbackTitle="Erro ao exibir Recibo do Pagamento" onReset={() => setProofData(null)}>
        <ProofModal
          isOpen={proofData?.isOpen || false}
          onClose={() => setProofData(null)}
          data={proofData}
          installments={installments}
          onToast={showToast}
          currentUser={currentUser}
          debtors={debtors}
          onSettleInstallment={handleSettleInstallment}
          onConfirmPayment={handleConfirmPayment}
          onOpenExtratoTotal={handleOpenExtratoTotal}
        />
      </ErrorBoundary>

      {/* New Purchase Modal */}
      <ErrorBoundary fallbackTitle="Erro ao abrir formulário de compra" onReset={() => setIsNewPurchaseModalOpen(false)}>
        <NewPurchaseModal
          isOpen={isNewPurchaseModalOpen}
          onClose={() => setIsNewPurchaseModalOpen(false)}
          debtors={debtors}
          selectedDebtorId={targetDebtorId}
          onAddPurchase={handleAddPurchase}
          onOpenNewDebtor={() => {
            setIsNewPurchaseModalOpen(false);
            setIsNewDebtorModalOpen(true);
          }}
        />
      </ErrorBoundary>

      {/* New Debtor Modal */}
      <ErrorBoundary fallbackTitle="Erro ao abrir formulário de devedor" onReset={() => setIsNewDebtorModalOpen(false)}>
        <NewDebtorModal
          isOpen={isNewDebtorModalOpen}
          onClose={() => setIsNewDebtorModalOpen(false)}
          onAddDebtor={handleAddDebtor}
        />
      </ErrorBoundary>

      {/* Edit Debtor Modal (Lápis para editar devedor) */}
      <ErrorBoundary fallbackTitle="Erro ao editar devedor" onReset={() => setIsEditDebtorOpen(false)}>
        <EditDebtorModal
          isOpen={isEditDebtorOpen}
          onClose={() => {
            setIsEditDebtorOpen(false);
            setEditingDebtor(null);
          }}
          debtor={editingDebtor}
          onSave={handleSaveEditedDebtor}
          onOpenContract={(debtorId) => {
            setIsEditDebtorOpen(false);
            handleOpenContract(debtorId);
          }}
        />
      </ErrorBoundary>

      {/* Edit Purchase / Installment Modal (Editar compra, data da 1ª parcela, valor ou excluir compra inteira) */}
      <ErrorBoundary
        fallbackTitle="Erro ao editar compra"
        onReset={() => setEditingPurchaseContext((prev) => ({ ...prev, isOpen: false }))}
      >
        <EditPurchaseModal
          isOpen={editingPurchaseContext.isOpen}
          onClose={() =>
            setEditingPurchaseContext({
              isOpen: false,
              purchase: null,
              installment: null,
              debtor: null,
            })
          }
          purchase={editingPurchaseContext.purchase}
          installment={editingPurchaseContext.installment}
          debtor={editingPurchaseContext.debtor}
          allInstallments={installments}
          onSave={handleSaveEditedPurchase}
          onDeletePurchase={handleDeletePurchase}
          onDeleteInstallment={handleDeleteInstallment}
        />
      </ErrorBoundary>

      {/* Digital Contract Modal (Contrato para assinar digitalmente e com valor por extenso) */}
      {isContractOpen && (
        <ErrorBoundary fallbackTitle="Erro ao carregar contrato digital" onReset={() => setIsContractOpen(false)}>
          <DigitalContractModal
            isOpen={isContractOpen}
            onClose={() => {
              setIsContractOpen(false);
              setContractDebtorId(null);
            }}
            debtor={debtors.find((d) => d.id === (contractDebtorId || targetDebtorId)) || debtors[0]}
            purchases={purchases.filter((p) => p.debtorId === (contractDebtorId || targetDebtorId || debtors[0]?.id))}
            installments={installments.filter((i) => i.debtorId === (contractDebtorId || targetDebtorId || debtors[0]?.id))}
            onSignContract={handleSignContract}
            onToast={showToast}
            onOpenGeminiScanner={() => {
              setIsContractOpen(false);
              setIsGeminiScannerOpen(true);
            }}
            onUpdateDebtorData={handleUpdateDebtorData}
          />
        </ErrorBoundary>
      )}

      {/* Gemini AI Contract Scanner Modal (Identificação autônoma de comprovantes e rateio) */}
      <GeminiContractScannerModal
        isOpen={isGeminiScannerOpen}
        debtors={debtors}
        purchases={purchases}
        installments={installments}
        institutions={institutions}
        onClose={() => setIsGeminiScannerOpen(false)}
        onApplyContract={handleApplyParsedContract}
        onSettleDistributedPayments={handleSettleDistributedPayments}
        onToast={showToast}
      />

      {/* Auth Screen (Login / Criar Novo Usuário / Gmail / Facebook / WhatsApp) */}
      <AuthScreen
        isOpen={isAuthOpen}
        canClose={currentUser !== null}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* User Settings Modal (Thiago Dias: Foto, E-mail, PIX, CEP, Endereço, Senha, Backup JSON, Lixeira) */}
      {currentUser && (
        <UserSettingsModal
          isOpen={isUserSettingsOpen}
          onClose={() => {
            setIsUserSettingsOpen(false);
            setUserSettingsTab('profile');
          }}
          currentUser={currentUser}
          onSaveUser={handleSaveUserSettings}
          onLogout={() => {
            setIsUserSettingsOpen(false);
            handleLogout();
          }}
          onToast={showToast}
          debtors={debtors}
          purchases={purchases}
          installments={installments}
          deletedDebtors={deletedDebtors}
          onRestoreDebtor={handleRestoreDebtor}
          onPermanentDeleteDebtor={handlePermanentDeleteDebtor}
          onSyncFirebase={handleManualCloudSync}
          onImportBackup={handleImportBackupData}
          initialTab={userSettingsTab}
        />
      )}

      {/* Delete Debtor Confirmation Modal (Alerta Triplo de Confirmação e Lixeira) */}
      <DeleteDebtorConfirmationModal
        isOpen={Boolean(deletingDebtorTarget)}
        debtor={deletingDebtorTarget}
        onClose={() => setDeletingDebtorTarget(null)}
        onConfirmDelete={handleConfirmDeleteDebtor}
      />
      <DeleteInstallmentConfirmationModal
        isOpen={Boolean(deletingInstallmentTarget)}
        installment={deletingInstallmentTarget}
        onClose={() => setDeletingInstallmentTarget(null)}
        onConfirmDelete={handleConfirmDeleteInstallment}
      />

      {/* Welcome Modal (Boas-vindas primeiro login HASPAHO TIAGO DIAS) */}
      {currentUser && (
        <WelcomeModal
          isOpen={isWelcomeOpen}
          onClose={handleDismissWelcome}
          user={currentUser}
        />
      )}

      {/* Botão Mágico — Score do Credor Modal */}
      <CredorScoreModal
        isOpen={isCredorScoreOpen}
        onClose={() => setIsCredorScoreOpen(false)}
        debtors={debtors}
        installments={installments}
        purchases={purchases}
        isDarkMode={theme === 'dark'}
        onToast={showToast}
      />

      {/* Pre-Registration Portal Modal for clients clicking WhatsApp link */}
      <PreRegistrationPortalModal
        isOpen={isPreRegistrationPortalOpen}
        onClose={() => {
          setIsPreRegistrationPortalOpen(false);
          // Clean URL params if needed
          window.history.replaceState({}, '', window.location.pathname);
        }}
        onSubmitPreReg={handlePreRegistrationSubmit}
      />

      {/* Auth Lookup Modal (Consulta de Autenticação de Comprovante de Pagamento) */}
      <AuthLookupModal
        isOpen={isAuthLookupOpen}
        onClose={() => setIsAuthLookupOpen(false)}
        installments={installments}
        transactions={transactions}
        onOpenProof={(payer, amount, date, dest, auth, item) => {
          setProofData({
            isOpen: true,
            payer,
            amount,
            date,
            dest,
            auth,
            item,
          });
        }}
      />

      {/* Extrato Total do Parcelamento Modal */}
      <ExtratoTotalModal
        isOpen={isExtratoTotalOpen}
        onClose={() => setIsExtratoTotalOpen(false)}
        debtor={extratoDebtor}
        purchase={extratoPurchase}
        installments={
          extratoPurchase
            ? installments.filter((i) => i.purchaseId === extratoPurchase.id)
            : extratoDebtor
            ? installments.filter((i) => i.debtorId === extratoDebtor.id)
            : extratoInstallmentsList.length > 0
            ? installments.filter((i) => extratoInstallmentsList.some((e) => e.id === i.id))
            : installments
        }
        onToast={showToast}
        onSettleInstallment={(inst) => {
          setIsExtratoTotalOpen(false);
          handleSettleInstallment(inst);
        }}
      />

      {/* Central de Documentos & PDFs Hub Modal */}
      <PdfDocumentsHubModal
        isOpen={isPdfHubOpen}
        onClose={() => setIsPdfHubOpen(false)}
        debtors={debtors}
        purchases={purchases}
        installments={installments}
        onOpenExtratoTotal={handleOpenExtratoTotal}
        onOpenContract={(debtorId) => {
          setIsPdfHubOpen(false);
          handleOpenContract(debtorId);
        }}
        onShowProof={handleShowProof}
        onToast={showToast}
        initialDebtorId={pdfHubDebtorId}
      />

      {/* Meu Gerenciamento Pessoal Modal (Exclusivo Tiago Dias) */}
      <MeuGerenciamentoPessoalModal
        isOpen={isMeuGerenciamentoOpen}
        onClose={() => setIsMeuGerenciamentoOpen(false)}
        currentUser={currentUser}
        onToast={showToast}
      />

      {/* Sentinela Inteligente & Alerta de Suporte Técnico Tiago Dias */}
      <SystemHealthAlertModal
        isOpen={isHealthAlertOpen}
        onClose={() => setIsHealthAlertOpen(false)}
        onToast={showToast}
        detectedError={detectedSentinelError}
      />

      {/* Apresentação Automatizada do Sistema (Slides Interativos HASPAHO) */}
      <HaspahoAutomatedTourModal
        isOpen={isTourModalOpen}
        onClose={() => setIsTourModalOpen(false)}
        currentUser={currentUser}
        onNavigateToTab={handleNavigate}
        isDarkMode={theme === 'dark'}
      />



      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
