import { safeToFixed, safeFormatCurrency, safeToNumber } from "./utils/numberUtils";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScreenTab, Debtor, Purchase, Installment, BankInstitution, UserAccount, generateAuthCode, GeminiDistributionItem } from './types';
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
  getPurchasesFromFirestore,
  saveInstallmentsToFirestore,
  saveSingleInstallmentToFirestore,
  deleteInstallmentFromFirestore,
  getInstallmentsFromFirestore,
  saveAuthRecordToFirestore,
  clearAllUserDataFromFirestore,
  markWelcomeCompletedInFirestore,
  logoutSession,
  saveTombstoneToFirestore,
  removeTombstoneFromFirestore,
  getTombstonesFromFirestore,
  TIAGO_DIAS_USER,
  auth,
  isFirestoreQuotaExhausted,
} from './lib/firebase';
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

import { AssetInspectorModal } from './components/AssetInspectorModal';
import { WhatsAppModal } from './components/WhatsAppModal';
import { ProofModal } from './components/ProofModal';
import { NewPurchaseModal } from './components/NewPurchaseModal';
import { NewDebtorModal } from './components/NewDebtorModal';
import { EditDebtorModal } from './components/EditDebtorModal';
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
import { GeminiParsedContract } from './types';

const DEFAULT_USER: UserAccount = TIAGO_DIAS_USER;

// =========================================================================
// ISOLAMENTO PERMANENTE DE DADOS DEMONSTRATIVOS E LIXEIRA (REGRA ATUALIZAÇÃO 89)
// Garante que registros de demonstração excluídos JAMAIS reapareçam em novos logins,
// atualizações ou sincronizações de versão.
// =========================================================================
export function getPermanentTombstones(userId: string): Set<string> {
  const set = new Set<string>();
  if (!userId) return set;
  try {
    const raw = localStorage.getItem(`haspaho_tombstones_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id: string) => typeof id === 'string' && set.add(id));
      }
    }
  } catch {}
  return set;
}

export function addPermanentTombstone(userId: string, debtorId: string): void {
  if (!userId || !debtorId) return;
  try {
    const set = getPermanentTombstones(userId);
    set.add(debtorId);
    localStorage.setItem(`haspaho_tombstones_${userId}`, JSON.stringify(Array.from(set)));
  } catch {}
  saveTombstoneToFirestore(userId, debtorId).catch(() => {});
}

export function removePermanentTombstone(userId: string, debtorId: string): void {
  if (!userId || !debtorId) return;
  try {
    const set = getPermanentTombstones(userId);
    set.delete(debtorId);
    localStorage.setItem(`haspaho_tombstones_${userId}`, JSON.stringify(Array.from(set)));
  } catch {}
  removeTombstoneFromFirestore(userId, debtorId).catch(() => {});
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

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem('haspaho_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id || parsed.email)) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isCredorScoreOpen, setIsCredorScoreOpen] = useState(false);

  const [deletedDebtors, setDeletedDebtors] = useState<Debtor[]>(() => {
    try {
      const activeUser = currentUser || DEFAULT_USER;
      const saved = localStorage.getItem(`haspaho_deleted_debtors_${activeUser.id}`) || localStorage.getItem('haspaho_deleted_debtors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });
  const [deletingDebtorTarget, setDeletingDebtorTarget] = useState<Debtor | null>(null);
  const [deletingInstallmentTarget, setDeletingInstallmentTarget] = useState<Installment | null>(null);
  const [userSettingsTab, setUserSettingsTab] = useState<'profile' | 'address' | 'pix' | 'security' | 'lixeira'>('profile');

  const [debtors, setDebtors] = useState<Debtor[]>(() => {
    try {
      const activeUser = currentUser || DEFAULT_USER;
      const isMaster = activeUser.id === 'usr_thiago_dias' || activeUser.email === 'tiagodias8888@gmail.com';
      const deletedSaved = localStorage.getItem(`haspaho_deleted_debtors_${activeUser.id}`);
      const deletedIds = new Set<string>();
      if (deletedSaved) {
        try {
          const parsedDel = JSON.parse(deletedSaved);
          if (Array.isArray(parsedDel)) {
            parsedDel.forEach((d: any) => d?.id && deletedIds.add(d.id));
          }
        } catch {}
      }
      const tombstones = getPermanentTombstones(activeUser.id);
      tombstones.forEach((id) => deletedIds.add(id));

      const saved = localStorage.getItem(`haspaho_debtors_${activeUser.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((d: Debtor) => d && d.id && !deletedIds.has(d.id))
            .map((d: Debtor) => ({
              ...d,
              totalOwed: typeof d.totalOwed === 'number' ? d.totalOwed : (Number(d.totalOwed) || 0),
              totalPaid: typeof d.totalPaid === 'number' ? d.totalPaid : (Number(d.totalPaid) || 0),
              overdueCount: typeof d.overdueCount === 'number' ? d.overdueCount : (Number(d.overdueCount) || 0),
            }));
        }
      }
      if (isMaster) {
        return INITIAL_DEBTORS.filter((d) => !deletedIds.has(d.id));
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [purchases, setPurchases] = useState<Purchase[]>(() => {
    try {
      const activeUser = currentUser || DEFAULT_USER;
      const isMaster = activeUser.id === 'usr_thiago_dias' || activeUser.email === 'tiagodias8888@gmail.com';
      const tombstones = getPermanentTombstones(activeUser.id);
      const saved = localStorage.getItem(`haspaho_purchases_${activeUser.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((p: Purchase) => p && p.debtorId && !tombstones.has(p.debtorId));
        }
      }
      if (isMaster) {
        return INITIAL_PURCHASES.filter((p) => !tombstones.has(p.debtorId));
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [installments, setInstallments] = useState<Installment[]>(() => {
    try {
      const activeUser = currentUser || DEFAULT_USER;
      const isMaster = activeUser.id === 'usr_thiago_dias' || activeUser.email === 'tiagodias8888@gmail.com';
      const tombstones = getPermanentTombstones(activeUser.id);
      const saved = localStorage.getItem(`haspaho_installments_${activeUser.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((inst: Installment) => inst && inst.debtorId && !tombstones.has(inst.debtorId))
            .map((inst: Installment) => ({
              ...inst,
              amount: typeof inst.amount === 'number' ? inst.amount : (Number(inst.amount) || 0),
            }));
        }
      }
      if (isMaster) {
        return INITIAL_INSTALLMENTS.filter((inst) => !tombstones.has(inst.debtorId));
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [institutions] = useState<BankInstitution[]>(() => {
    try {
      const saved = localStorage.getItem('haspaho_institutions');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_INSTITUTIONS;
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedAssetKey, setSelectedAssetKey] = useState<string | null>(null);
  const [whatsappModalData, setWhatsappModalData] = useState<{
    isOpen: boolean;
    debtorName: string;
    debtorPhone?: string;
    debtorAvatar?: string;
    installmentNumber?: number;
    totalInstallments?: number;
    amount?: number;
    dueDate?: string;
    authCode?: string;
    pixKey?: string;
    productName?: string;
  }>({ isOpen: false, debtorName: '' });

  const [proofModalData, setProofModalData] = useState<{
    isOpen: boolean;
    installment?: Installment;
    debtor?: Debtor;
  }>({ isOpen: false });

  const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(false);
  const [isNewDebtorOpen, setIsNewDebtorOpen] = useState(false);
  const [isExtratoTotalOpen, setIsExtratoTotalOpen] = useState(false);
  const [isPdfDocumentsHubOpen, setIsPdfDocumentsHubOpen] = useState(false);
  const [isMeuGerenciamentoOpen, setIsMeuGerenciamentoOpen] = useState(false);

  const [editingDebtor, setEditingDebtor] = useState<Debtor | null>(null);
  const [contractDebtor, setContractDebtor] = useState<Debtor | null>(null);
  const [isGeminiScannerOpen, setIsGeminiScannerOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isPreRegistrationOpen, setIsPreRegistrationOpen] = useState(false);

  const [preFilledDebtorData, setPreFilledDebtorData] = useState<{
    name?: string;
    cpfCnpj?: string;
    phone?: string;
    email?: string;
    notes?: string;
    initialProduct?: string;
    initialAmount?: number;
    initialInstallmentsCount?: number;
    initialDueDate?: string;
  } | null>(null);

  const [isAuthLookupOpen, setIsAuthLookupOpen] = useState(false);
  const [isHealthAlertOpen, setIsHealthAlertOpen] = useState(false);
  const [healthAlertInfo, setHealthAlertInfo] = useState<{
    systemHealthScore: number;
    lastInspectionDate: string;
    detectedAnomaliesCount: number;
    remediationSteps: string[];
    riskLevel: 'baixo' | 'medio' | 'critico';
  } | null>(null);

  const isExplicitLogoutRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  const handleNavigate = useCallback((tab: ScreenTab, debtorId?: string, installmentId?: string, purchaseFilter?: string) => {
    setCurrentTab(tab);
    if (debtorId !== undefined) setTargetDebtorId(debtorId);
    if (installmentId !== undefined) setTargetInstallmentId(installmentId);
    if (purchaseFilter !== undefined) setTargetPurchaseFilter(purchaseFilter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const activeUser = currentUser || DEFAULT_USER;
    try {
      localStorage.setItem(`haspaho_debtors_${activeUser.id}`, JSON.stringify(debtors));
      localStorage.setItem('haspaho_debtors', JSON.stringify(debtors));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }
  }, [debtors, currentUser]);

  useEffect(() => {
    const activeUser = currentUser || DEFAULT_USER;
    try {
      localStorage.setItem(`haspaho_purchases_${activeUser.id}`, JSON.stringify(purchases));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }
  }, [purchases, currentUser]);

  useEffect(() => {
    const activeUser = currentUser || DEFAULT_USER;
    try {
      localStorage.setItem(`haspaho_installments_${activeUser.id}`, JSON.stringify(installments));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }
  }, [installments, currentUser]);

  useEffect(() => {
    const activeUser = currentUser || DEFAULT_USER;
    try {
      localStorage.setItem(`haspaho_deleted_debtors_${activeUser.id}`, JSON.stringify(deletedDebtors));
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }
  }, [deletedDebtors, currentUser]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;

    console.log(`[Firestore:SYNC_PULL] Sincronizando dados em nuvem para UID: ${userId}...`);

    getDebtorsFromFirestore(userId)
      .then((remoteDebtors) => {
        if (remoteDebtors && remoteDebtors.length > 0) {
          const tombstones = getPermanentTombstones(userId);
          const cleanRemote = remoteDebtors.filter((d) => d && d.id && !tombstones.has(d.id));
          if (cleanRemote.length > 0) {
            setDebtors(cleanRemote);
          }
        } else if (debtors.length > 0) {
          saveDebtorsToFirestore(userId, debtors).catch(() => {});
        }
      })
      .catch((err) => console.warn('[Firestore:SYNC_DEBTORS_NOTE]', err));

    getPurchasesFromFirestore(userId)
      .then((remotePurchases) => {
        if (remotePurchases && remotePurchases.length > 0) {
          const tombstones = getPermanentTombstones(userId);
          const cleanRemote = remotePurchases.filter((p) => p && p.debtorId && !tombstones.has(p.debtorId));
          if (cleanRemote.length > 0) {
            setPurchases(cleanRemote);
          }
        } else if (purchases.length > 0) {
          savePurchasesToFirestore(userId, purchases).catch(() => {});
        }
      })
      .catch((err) => console.warn('[Firestore:SYNC_PURCHASES_NOTE]', err));

    getInstallmentsFromFirestore(userId)
      .then((remoteInsts) => {
        if (remoteInsts && remoteInsts.length > 0) {
          const tombstones = getPermanentTombstones(userId);
          const cleanRemote = remoteInsts.filter((i) => i && i.debtorId && !tombstones.has(i.debtorId));
          if (cleanRemote.length > 0) {
            setInstallments(cleanRemote);
          }
        } else if (installments.length > 0) {
          saveInstallmentsToFirestore(userId, installments).catch(() => {});
        }
      })
      .catch((err) => console.warn('[Firestore:SYNC_INSTALLMENTS_NOTE]', err));

    getTombstonesFromFirestore(userId)
      .then((remoteTombstones) => {
        if (remoteTombstones && remoteTombstones.length > 0) {
          remoteTombstones.forEach((tid) => addPermanentTombstone(userId, tid));
        }
      })
      .catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (isExplicitLogoutRef.current) {
        return;
      }
      if (fbUser) {
        try {
          const remoteUser = await getUserFromFirestore(fbUser.uid);
          const activeUser: UserAccount = remoteUser || {
            id: fbUser.uid,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário',
            username: fbUser.email?.split('@')[0] || 'usuario',
            email: fbUser.email || '',
            phoneWhatsapp: fbUser.phoneNumber || '',
            authProvider: 'gmail',
            companyName: 'Gestão Financeira em Nuvem',
            city: 'Brasil',
            state: 'BR',
            role: 'Usuário Gestor',
            pixKey: fbUser.email || '',
            createdAt: new Date().toISOString(),
            isFirstLogin: false,
            hasSeenWelcome: true,
          };
          setCurrentUser(activeUser);
          localStorage.setItem('haspaho_auth_user', JSON.stringify(activeUser));
        } catch (e) {
          console.warn('[Firebase Auth] Note fetching profile:', e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const calculateDebtorTotals = useCallback((debtorId: string, currentInsts: Installment[]) => {
    const debtorInsts = currentInsts.filter((inst) => inst.debtorId === debtorId);
    const totalOwed = debtorInsts.reduce((acc, inst) => acc + (inst.amount || 0), 0);
    const totalPaid = debtorInsts
      .filter((inst) => inst.status === 'pago')
      .reduce((acc, inst) => acc + (inst.amount || 0), 0);
    const overdueCount = debtorInsts.filter((inst) => inst.status === 'atrasado').length;
    return { totalOwed, totalPaid, overdueCount };
  }, []);

  const handleCreatePurchase = (
    newPurchaseData: Omit<Purchase, 'id'>,
    installmentsData: Array<Omit<Installment, 'id' | 'purchaseId' | 'status'>>
  ) => {
    const activeUser = currentUser || DEFAULT_USER;
    const purchaseId = `pur-${Date.now()}`;
    const newPurchase: Purchase = {
      ...newPurchaseData,
      id: purchaseId,
    };

    const newInstallments: Installment[] = installmentsData.map((inst, idx) => {
      const authCode = generateAuthCode(newPurchase.debtorName, idx + 1, inst.dueDate, inst.amount);
      registerAuthCode(authCode, {
        debtorName: newPurchase.debtorName,
        installmentNumber: idx + 1,
        totalInstallments: installmentsData.length,
        dueDate: inst.dueDate,
        amount: inst.amount,
        productName: newPurchase.product,
      });

      return {
        ...inst,
        id: `inst-${Date.now()}-${idx}`,
        purchaseId: purchaseId,
        status: 'pendente',
        authCode: authCode,
      };
    });

    const updatedPurchases = [newPurchase, ...purchases];
    const updatedInstallments = [...newInstallments, ...installments];

    setPurchases(updatedPurchases);
    setInstallments(updatedInstallments);

    saveSinglePurchaseToFirestore(activeUser.id, newPurchase).catch(() => {});
    saveInstallmentsToFirestore(activeUser.id, newInstallments).catch(() => {});

    const debtorId = newPurchase.debtorId;
    const { totalOwed, totalPaid, overdueCount } = calculateDebtorTotals(debtorId, updatedInstallments);

    setDebtors((prevDebtors) =>
      prevDebtors.map((d) => {
        if (d.id === debtorId) {
          const updated = {
            ...d,
            totalOwed,
            totalPaid,
            overdueCount,
          };
          saveSingleDebtorToFirestore(activeUser.id, updated).catch(() => {});
          return updated;
        }
        return d;
      })
    );

    addAuditLog({
      action: 'Criação de Compra e Parcelamento',
      performedBy: activeUser.name,
      targetDebtor: newPurchase.debtorName,
      amount: newPurchase.totalAmount,
      details: `${newPurchase.product} (${newPurchase.installmentsCount}x de R$ ${safeToFixed(newPurchase.installmentValue, 2)})`,
    });

    showToast(`Compra "${newPurchase.product}" cadastrada com ${newInstallments.length} parcelas!`);
  };

  const handleToggleInstallmentStatus = (installmentId: string) => {
    const activeUser = currentUser || DEFAULT_USER;
    let targetDebtorId = '';
    let updatedStatus: 'pago' | 'pendente' = 'pago';
    let targetAmount = 0;
    let targetDebtorName = '';

    const updatedInstallments = installments.map((inst) => {
      if (inst.id === installmentId) {
        targetDebtorId = inst.debtorId;
        updatedStatus = inst.status === 'pago' ? 'pendente' : 'pago';
        targetAmount = inst.amount;
        targetDebtorName = inst.debtorName;
        const updatedInst: Installment = {
          ...inst,
          status: updatedStatus,
          paymentDate: updatedStatus === 'pago' ? new Date().toISOString().slice(0, 10) : undefined,
        };
        saveSingleInstallmentToFirestore(activeUser.id, updatedInst).catch(() => {});
        return updatedInst;
      }
      return inst;
    });

    setInstallments(updatedInstallments);

    if (targetDebtorId) {
      const { totalOwed, totalPaid, overdueCount } = calculateDebtorTotals(targetDebtorId, updatedInstallments);
      setDebtors((prevDebtors) =>
        prevDebtors.map((d) => {
          if (d.id === targetDebtorId) {
            const updated = {
              ...d,
              totalOwed,
              totalPaid,
              overdueCount,
            };
            saveSingleDebtorToFirestore(activeUser.id, updated).catch(() => {});
            return updated;
          }
          return d;
        })
      );
    }

    addAuditLog({
      action: updatedStatus === 'pago' ? 'Baixa de Parcela' : 'Estorno de Parcela',
      performedBy: activeUser.name,
      targetDebtor: targetDebtorName,
      amount: targetAmount,
      details: `Status alterado para ${updatedStatus.toUpperCase()}`,
    });

    showToast(
      updatedStatus === 'pago'
        ? `Pagamento registrado com sucesso!`
        : `Status da parcela alterado para PENDENTE.`
    );
  };

  const handleDeleteInstallmentConfirmed = () => {
    if (!deletingInstallmentTarget) return;
    const activeUser = currentUser || DEFAULT_USER;
    const instId = deletingInstallmentTarget.id;
    const debtorId = deletingInstallmentTarget.debtorId;
    const instAmount = deletingInstallmentTarget.amount;
    const debtorName = deletingInstallmentTarget.debtorName;

    deleteInstallmentFromFirestore(activeUser.id, instId).catch(() => {});

    const updatedInstallments = installments.filter((inst) => inst.id !== instId);
    setInstallments(updatedInstallments);

    if (debtorId) {
      const { totalOwed, totalPaid, overdueCount } = calculateDebtorTotals(debtorId, updatedInstallments);
      setDebtors((prevDebtors) =>
        prevDebtors.map((d) => {
          if (d.id === debtorId) {
            const updated = {
              ...d,
              totalOwed,
              totalPaid,
              overdueCount,
            };
            saveSingleDebtorToFirestore(activeUser.id, updated).catch(() => {});
            return updated;
          }
          return d;
        })
      );
    }

    addAuditLog({
      action: 'Exclusão de Parcela',
      performedBy: activeUser.name,
      targetDebtor: debtorName,
      amount: instAmount,
      details: `Parcela #${deletingInstallmentTarget.installmentNumber} removida com sucesso.`,
    });

    showToast(`Parcela #${deletingInstallmentTarget.installmentNumber} de ${debtorName} excluída.`);
    setDeletingInstallmentTarget(null);
  };

  const handleCreateDebtor = (
    newDebtorData: Omit<Debtor, 'id' | 'totalOwed' | 'totalPaid' | 'overdueCount' | 'score'>,
    initialPurchaseData?: {
      product: string;
      totalAmount: number;
      installmentsCount: number;
      firstDueDate: string;
      notes?: string;
    }
  ) => {
    const activeUser = currentUser || DEFAULT_USER;
    const debtorId = `deb-${Date.now()}`;
    const cleanAvatar = getCleanDebtorAvatar(newDebtorData.name, newDebtorData.avatar);

    const newDebtor: Debtor = {
      ...newDebtorData,
      id: debtorId,
      avatar: cleanAvatar,
      totalOwed: 0,
      totalPaid: 0,
      overdueCount: 0,
      score: 100,
    };

    setDebtors((prev) => [newDebtor, ...prev]);
    saveSingleDebtorToFirestore(activeUser.id, newDebtor).catch(() => {});

    if (initialPurchaseData) {
      const purchaseId = `pur-${Date.now()}`;
      const instValue = safeToNumber(initialPurchaseData.totalAmount / initialPurchaseData.installmentsCount);

      const newPurchase: Purchase = {
        id: purchaseId,
        debtorId: debtorId,
        debtorName: newDebtor.name,
        product: initialPurchaseData.product,
        totalAmount: initialPurchaseData.totalAmount,
        installmentsCount: initialPurchaseData.installmentsCount,
        installmentValue: instValue,
        firstDueDate: initialPurchaseData.firstDueDate,
        notes: initialPurchaseData.notes || '',
        createdAt: new Date().toISOString().slice(0, 10),
      };

      const newInsts: Installment[] = [];
      for (let i = 0; i < initialPurchaseData.installmentsCount; i++) {
        const dueDate = addMonthsToDateStr(initialPurchaseData.firstDueDate, i);
        const authCode = generateAuthCode(newDebtor.name, i + 1, dueDate, instValue);

        registerAuthCode(authCode, {
          debtorName: newDebtor.name,
          installmentNumber: i + 1,
          totalInstallments: initialPurchaseData.installmentsCount,
          dueDate: dueDate,
          amount: instValue,
          productName: initialPurchaseData.product,
        });

        newInsts.push({
          id: `inst-${Date.now()}-${i}`,
          purchaseId: purchaseId,
          debtorId: debtorId,
          debtorName: newDebtor.name,
          debtorPhone: newDebtor.phone,
          debtorAvatar: newDebtor.avatar,
          productName: initialPurchaseData.product,
          installmentNumber: i + 1,
          totalInstallments: initialPurchaseData.installmentsCount,
          amount: instValue,
          dueDate: dueDate,
          status: 'pendente',
          authCode: authCode,
        });
      }

      setPurchases((prev) => [newPurchase, ...prev]);
      setInstallments((prev) => [...newInsts, ...prev]);

      saveSinglePurchaseToFirestore(activeUser.id, newPurchase).catch(() => {});
      saveInstallmentsToFirestore(activeUser.id, newInsts).catch(() => {});

      const updatedDebtor = {
        ...newDebtor,
        totalOwed: initialPurchaseData.totalAmount,
        totalPaid: 0,
        overdueCount: 0,
      };

      setDebtors((prev) => prev.map((d) => (d.id === debtorId ? updatedDebtor : d)));
      saveSingleDebtorToFirestore(activeUser.id, updatedDebtor).catch(() => {});
    }

    addAuditLog({
      action: 'Cadastro de Novo Devedor',
      performedBy: activeUser.name,
      targetDebtor: newDebtor.name,
      amount: initialPurchaseData ? initialPurchaseData.totalAmount : 0,
      details: initialPurchaseData
        ? `Cadastrado com compra inicial (${initialPurchaseData.product})`
        : 'Cadastrado sem compras vincularas',
    });

    showToast(`Cliente/Devedor "${newDebtor.name}" cadastrado com sucesso!`);
  };

  const handleUpdateDebtor = (updatedDebtor: Debtor) => {
    const activeUser = currentUser || DEFAULT_USER;
    const cleanAvatar = getCleanDebtorAvatar(updatedDebtor.name, updatedDebtor.avatar);
    const finalDebtor = { ...updatedDebtor, avatar: cleanAvatar };

    setDebtors((prev) => prev.map((d) => (d.id === finalDebtor.id ? finalDebtor : d)));
    saveSingleDebtorToFirestore(activeUser.id, finalDebtor).catch(() => {});

    setPurchases((prev) =>
      prev.map((p) => (p.debtorId === finalDebtor.id ? { ...p, debtorName: finalDebtor.name } : p))
    );

    setInstallments((prev) =>
      prev.map((inst) =>
        inst.debtorId === finalDebtor.id
          ? {
              ...inst,
              debtorName: finalDebtor.name,
              debtorPhone: finalDebtor.phone,
              debtorAvatar: finalDebtor.avatar,
            }
          : inst
      )
    );

    addAuditLog({
      action: 'Edição de Devedor',
      performedBy: activeUser.name,
      targetDebtor: finalDebtor.name,
      details: 'Dados do cliente atualizados com sucesso',
    });

    showToast(`Dados de "${finalDebtor.name}" atualizados com sucesso!`);
    setEditingDebtor(null);
  };

  const handleDeleteDebtorConfirmed = () => {
    if (!deletingDebtorTarget) return;
    const activeUser = currentUser || DEFAULT_USER;
    const targetId = deletingDebtorTarget.id;
    const targetName = deletingDebtorTarget.name;

    addPermanentTombstone(activeUser.id, targetId);
    deleteDebtorFromFirestore(activeUser.id, targetId).catch(() => {});

    setDeletedDebtors((prev) => [
      {
        ...deletingDebtorTarget,
        notes: `Excluído em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
      },
      ...prev,
    ]);

    setDebtors((prev) => prev.filter((d) => d.id !== targetId));
    setPurchases((prev) => prev.filter((p) => p.debtorId !== targetId));
    setInstallments((prev) => prev.filter((inst) => inst.debtorId !== targetId));

    if (targetDebtorId === targetId) {
      setTargetDebtorId('all');
    }

    addAuditLog({
      action: 'Exclusão de Devedor',
      performedBy: activeUser.name,
      targetDebtor: targetName,
      amount: deletingDebtorTarget.totalOwed,
      details: 'Devedor e todas as parcelas vinculadas foram movidos para a Lixeira',
    });

    showToast(`Devedor "${targetName}" movido para a Lixeira com sucesso.`);
    setDeletingDebtorTarget(null);
  };

  const handleRestoreDebtor = (debtorToRestore: Debtor) => {
    const activeUser = currentUser || DEFAULT_USER;
    removePermanentTombstone(activeUser.id, debtorToRestore.id);

    setDeletedDebtors((prev) => prev.filter((d) => d.id !== debtorToRestore.id));
    setDebtors((prev) => [debtorToRestore, ...prev]);

    saveSingleDebtorToFirestore(activeUser.id, debtorToRestore).catch(() => {});

    addAuditLog({
      action: 'Restauração da Lixeira',
      performedBy: activeUser.name,
      targetDebtor: debtorToRestore.name,
      details: 'Devedor restaurado com sucesso para a lista de devedores ativos',
    });

    showToast(`Devedor "${debtorToRestore.name}" restaurado com sucesso!`);
  };

  const handleEmptyTrash = () => {
    const activeUser = currentUser || DEFAULT_USER;
    deletedDebtors.forEach((d) => {
      addPermanentTombstone(activeUser.id, d.id);
      deleteDebtorFromFirestore(activeUser.id, d.id).catch(() => {});
    });
    setDeletedDebtors([]);
    showToast('Lixeira esvaziada permanentemente!');
  };

  const handleImportContractParsedData = (parsed: GeminiParsedContract) => {
    let matchedDebtor = debtors.find(
      (d) =>
        (d.cpfCnpj && parsed.debtorCpfCnpj && d.cpfCnpj.replace(/\D/g, '') === parsed.debtorCpfCnpj.replace(/\D/g, '')) ||
        (d.name && parsed.debtorName && d.name.toLowerCase().trim() === parsed.debtorName.toLowerCase().trim())
    );

    if (matchedDebtor) {
      handleCreatePurchase(
        {
          debtorId: matchedDebtor.id,
          debtorName: matchedDebtor.name,
          product: parsed.productName,
          totalAmount: parsed.totalAmount,
          installmentsCount: parsed.installmentsCount,
          installmentValue: parsed.installmentValue,
          firstDueDate: parsed.firstDueDate,
          notes: `Contrato extraído via IA Gemini em ${new Date().toLocaleDateString('pt-BR')}`,
          createdAt: new Date().toISOString().slice(0, 10),
        },
        Array.from({ length: parsed.installmentsCount }).map((_, idx) => ({
          debtorId: matchedDebtor!.id,
          debtorName: matchedDebtor!.name,
          debtorPhone: matchedDebtor!.phone,
          debtorAvatar: matchedDebtor!.avatar,
          productName: parsed.productName,
          installmentNumber: idx + 1,
          totalInstallments: parsed.installmentsCount,
          amount: parsed.installmentValue,
          dueDate: addMonthsToDateStr(parsed.firstDueDate, idx),
        }))
      );
      showToast(`Novo contrato e parcelas importados para o cliente "${matchedDebtor.name}"!`);
      handleNavigate('devedor-detalhe', matchedDebtor.id);
    } else {
      setPreFilledDebtorData({
        name: parsed.debtorName,
        cpfCnpj: parsed.debtorCpfCnpj,
        phone: parsed.debtorPhone,
        notes: `Cadastrado automaticamente via escaneamento de contrato inteligente`,
        initialProduct: parsed.productName,
        initialAmount: parsed.totalAmount,
        initialInstallmentsCount: parsed.installmentsCount,
        initialDueDate: parsed.firstDueDate,
      });
      setIsNewDebtorOpen(true);
      showToast('Devedor não localizado no cadastro. Preenchemos os dados para novo cadastro!');
    }
  };

  const handleOpenWhatsAppModal = (
    debtorName: string,
    debtorPhone?: string,
    debtorAvatar?: string,
    installmentNumber?: number,
    totalInstallments?: number,
    amount?: number,
    dueDate?: string,
    authCode?: string,
    pixKey?: string,
    productName?: string
  ) => {
    setWhatsappModalData({
      isOpen: true,
      debtorName,
      debtorPhone,
      debtorAvatar: getCleanDebtorAvatar(debtorName, debtorAvatar),
      installmentNumber,
      totalInstallments,
      amount,
      dueDate,
      authCode,
      pixKey,
      productName,
    });
  };

  const handleOpenProofModal = (installment: Installment, debtor?: Debtor) => {
    setProofModalData({
      isOpen: true,
      installment,
      debtor,
    });
  };

  const handleOpenNewPurchaseForDebtor = (debtorId: string) => {
    setTargetDebtorId(debtorId);
    setIsNewPurchaseOpen(true);
  };

  const handleOpenEditDebtor = (debtor: Debtor) => {
    setEditingDebtor(debtor);
  };

  const handleOpenDigitalContract = (debtor: Debtor) => {
    setContractDebtor(debtor);
  };

  const handleLoginSuccess = (user: UserAccount, isNewAccount?: boolean) => {
    isExplicitLogoutRef.current = false;
    setCurrentUser(user);
    try {
      localStorage.setItem('haspaho_auth_user', JSON.stringify(user));
      saveUserToFirestore(user).catch(() => {});
    } catch (err) {
      console.error('Failed to sync user to Firestore:', err);
    }
    showToast(`Bem-vindo, ${user.name}!`);
  };

  const handleLogout = async () => {
    isExplicitLogoutRef.current = true;
    try {
      await logoutSession();
    } catch (e) {
      console.warn('Logout session error:', e);
    }
    setCurrentUser(null);
    setDebtors([]);
    setPurchases([]);
    setInstallments([]);
    localStorage.removeItem('haspaho_auth_user');
    setCurrentTab('inicio');
    setIsAuthOpen(true);
    setIsUserSettingsOpen(false);
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

    try {
      await markWelcomeCompletedInFirestore(userId);
      await saveUserToFirestore(updatedUser);
      console.log(`[Firestore:WELCOME] Apresentação concluída para UID: ${userId}`);
    } catch (err) {
      console.error('[Firestore:WELCOME] Erro ao salvar status de apresentação:', err);
    }
  };

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
      </div>
    );
  }

  const isStackScreen = [
    'parcelas-list',
    'devedor-detalhe',
    'atraso-detalhe',
    'relatorios',
    'perfil-desenvolvedor',
    'admin-forum',
  ].includes(currentTab);

  return (
    <div className={`min-h-screen relative font-sans transition-colors duration-300 ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      <FuturisticCosmicBackground theme={theme} />

      <Header
        activeTab={currentTab}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenNewPurchase={() => setIsNewPurchaseOpen(true)}
        onOpenNewDebtor={() => setIsNewDebtorOpen(true)}
        debtors={debtors}
        installments={installments}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenUserSettings={(tab) => {
          if (tab) setUserSettingsTab(tab);
          setIsUserSettingsOpen(true);
        }}
        onOpenContractScanner={() => setIsGeminiScannerOpen(true)}
        onOpenPreRegistration={() => setIsPreRegistrationOpen(true)}
        onOpenAuthLookup={() => setIsAuthLookupOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main
        className={`w-full transition-all duration-300 relative z-10 ${
          currentTab === 'dashboard'
            ? 'px-1 sm:px-3 lg:px-4 pt-16 md:pt-20 pb-32 sm:pb-28'
            : currentTab === 'devedores-master'
            ? 'px-1 sm:px-2 lg:px-3 pt-16 md:pt-20 pb-28'
            : currentTab === 'legacy-erp'
            ? 'px-1 sm:px-3 lg:px-4 pt-16 md:pt-20 pb-28'
            : currentTab === 'admin-forum'
            ? 'px-1 sm:px-3 lg:px-4 pt-16 md:pt-20 pb-6'
            : isStackScreen
            ? 'px-1 sm:px-4 lg:px-8 xl:px-10 2xl:px-12 pt-20 md:pt-20 pb-36 sm:pb-28'
            : 'px-1 sm:px-4 lg:px-8 xl:px-10 2xl:px-12 pt-24 sm:pt-28 md:pt-20 pb-36 sm:pb-28'
        }`}
      >
        <ErrorBoundary fallbackTitle="Visualização em Recuperação" onReset={() => handleNavigate('dashboard')}>
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
            onLogout={handleLogout}
          />
        )}

        {currentTab === 'dashboard' && (
          <DashboardView
            debtors={debtors}
            purchases={purchases}
            installments={installments}
            institutions={institutions}
            onNavigate={handleNavigate}
            onOpenWhatsApp={handleOpenWhatsAppModal}
            onOpenProof={handleOpenProofModal}
            onToggleStatus={handleToggleInstallmentStatus}
            onOpenNewPurchaseForDebtor={handleOpenNewPurchaseForDebtor}
            onOpenNewDebtor={() => setIsNewDebtorOpen(true)}
            onOpenContractScanner={() => setIsGeminiScannerOpen(true)}
            onOpenExtratoTotal={() => setIsExtratoTotalOpen(true)}
            onOpenPdfDocumentsHub={() => setIsPdfDocumentsHubOpen(true)}
            onOpenMeuGerenciamento={() => setIsMeuGerenciamentoOpen(true)}
            currentUser={currentUser}
            onOpenUserSettings={() => setIsUserSettingsOpen(true)}
            theme={theme}
            onOpenCredorScore={() => setIsCredorScoreOpen(true)}
          />
        )}

        {currentTab === 'parcelas-list' && (
          <ParcelasView
            installments={installments}
            purchases={purchases}
            debtors={debtors}
            institutions={institutions}
            targetDebtorFilter={targetDebtorId}
            targetPurchaseFilter={targetPurchaseFilter}
            onNavigate={handleNavigate}
            onToggleStatus={handleToggleInstallmentStatus}
            onDeleteInstallment={(inst) => setDeletingInstallmentTarget(inst)}
            onOpenWhatsApp={handleOpenWhatsAppModal}
            onOpenProof={handleOpenProofModal}
            theme={theme}
          />
        )}

        {currentTab === 'devedores-list' && (
          <DevedoresView
            debtors={debtors}
            installments={installments}
            onNavigate={handleNavigate}
            onOpenEdit={handleOpenEditDebtor}
            onDeleteDebtor={(d) => setDeletingDebtorTarget(d)}
            onOpenWhatsApp={(d) => handleOpenWhatsAppModal(d.name, d.phone, d.avatar)}
            onOpenNewDebtor={() => setIsNewDebtorOpen(true)}
            onOpenContract={handleOpenDigitalContract}
            theme={theme}
          />
        )}

        {currentTab === 'devedores-master' && (
          <DebtorsMasterSpreadsheet
            debtors={debtors}
            installments={installments}
            purchases={purchases}
            institutions={institutions}
            onNavigate={handleNavigate}
            onToggleStatus={handleToggleInstallmentStatus}
            onDeleteInstallment={(inst) => setDeletingInstallmentTarget(inst)}
            onOpenWhatsApp={handleOpenWhatsAppModal}
            onOpenProof={handleOpenProofModal}
            onOpenEditDebtor={handleOpenEditDebtor}
            onDeleteDebtor={(d) => setDeletingDebtorTarget(d)}
            onOpenNewDebtor={() => setIsNewDebtorOpen(true)}
            theme={theme}
          />
        )}

        {currentTab === 'devedor-detalhe' && (
          <DetalheParcelaView
            debtorId={targetDebtorId}
            debtors={debtors}
            purchases={purchases}
            installments={installments}
            institutions={institutions}
            onNavigate={handleNavigate}
            onToggleStatus={handleToggleInstallmentStatus}
            onDeleteInstallment={(inst) => setDeletingInstallmentTarget(inst)}
            onOpenWhatsApp={handleOpenWhatsAppModal}
            onOpenProof={handleOpenProofModal}
            onOpenNewPurchase={() => handleOpenNewPurchaseForDebtor(targetDebtorId)}
            onOpenEditDebtor={handleOpenEditDebtor}
            onDeleteDebtor={(d) => setDeletingDebtorTarget(d)}
            onOpenDigitalContract={handleOpenDigitalContract}
            theme={theme}
          />
        )}

        {currentTab === 'atraso-detalhe' && (
          <DetalheAtrasoView
            installmentId={targetInstallmentId}
            installments={installments}
            debtors={debtors}
            purchases={purchases}
            institutions={institutions}
            onNavigate={handleNavigate}
            onToggleStatus={handleToggleInstallmentStatus}
            onDeleteInstallment={(inst) => setDeletingInstallmentTarget(inst)}
            onOpenWhatsApp={handleOpenWhatsAppModal}
            onOpenProof={handleOpenProofModal}
            theme={theme}
          />
        )}

        {currentTab === 'relatorios' && (
          <RelatoriosView
            debtors={debtors}
            purchases={purchases}
            installments={installments}
            institutions={institutions}
            onNavigate={handleNavigate}
            onOpenWhatsApp={handleOpenWhatsAppModal}
            theme={theme}
          />
        )}

        {currentTab === 'perfil-desenvolvedor' && (
          <PerfilView
            currentUser={currentUser}
            onOpenUserSettings={(tab) => {
              if (tab) setUserSettingsTab(tab);
              setIsUserSettingsOpen(true);
            }}
            onLogout={handleLogout}
            theme={theme}
          />
        )}

        {currentTab === 'legacy-erp' && (
          <ErpLegacySystem
            debtors={debtors}
            purchases={purchases}
            installments={installments}
            onNavigate={handleNavigate}
            theme={theme}
          />
        )}

        {currentTab === 'admin-forum' && (
          <AdminDevForumView
            currentUser={currentUser}
            onNavigate={handleNavigate}
            theme={theme}
          />
        )}
        </ErrorBoundary>
      </main>

      <BottomNav activeTab={currentTab} onNavigate={handleNavigate} theme={theme} />

      <AssetInspectorModal
        assetKey={selectedAssetKey}
        onClose={() => setSelectedAssetKey(null)}
      />

      <WhatsAppModal
        data={whatsappModalData}
        onClose={() => setWhatsappModalData((prev) => ({ ...prev, isOpen: false }))}
      />

      <ProofModal
        isOpen={proofModalData.isOpen}
        installment={proofModalData.installment}
        debtor={proofModalData.debtor}
        onClose={() => setProofModalData({ isOpen: false })}
      />

      <NewPurchaseModal
        isOpen={isNewPurchaseOpen}
        onClose={() => setIsNewPurchaseOpen(false)}
        debtors={debtors}
        defaultDebtorId={targetDebtorId !== 'all' ? targetDebtorId : undefined}
        onCreatePurchase={handleCreatePurchase}
      />

      <NewDebtorModal
        isOpen={isNewDebtorOpen}
        onClose={() => {
          setIsNewDebtorOpen(false);
          setPreFilledDebtorData(null);
        }}
        onCreateDebtor={handleCreateDebtor}
        preFilledData={preFilledDebtorData || undefined}
      />

      <EditDebtorModal
        isOpen={!!editingDebtor}
        debtor={editingDebtor}
        onClose={() => setEditingDebtor(null)}
        onSave={handleUpdateDebtor}
      />

      <DigitalContractModal
        isOpen={!!contractDebtor}
        debtor={contractDebtor}
        purchases={purchases.filter((p) => p.debtorId === contractDebtor?.id)}
        installments={installments.filter((i) => i.debtorId === contractDebtor?.id)}
        onClose={() => setContractDebtor(null)}
      />

      <GeminiContractScannerModal
        isOpen={isGeminiScannerOpen}
        onClose={() => setIsGeminiScannerOpen(false)}
        onImportContract={handleImportContractParsedData}
      />

      <ExtratoTotalModal
        isOpen={isExtratoTotalOpen}
        onClose={() => setIsExtratoTotalOpen(false)}
        debtors={debtors}
        installments={installments}
        purchases={purchases}
        currentUser={currentUser}
      />

      <PdfDocumentsHubModal
        isOpen={isPdfDocumentsHubOpen}
        onClose={() => setIsPdfDocumentsHubOpen(false)}
        debtors={debtors}
        installments={installments}
        purchases={purchases}
        currentUser={currentUser}
      />

      <MeuGerenciamentoPessoalModal
        isOpen={isMeuGerenciamentoOpen}
        onClose={() => setIsMeuGerenciamentoOpen(false)}
        currentUser={currentUser}
        debtors={debtors}
        installments={installments}
        purchases={purchases}
      />

      <WelcomeModal
        isOpen={isWelcomeOpen}
        user={currentUser}
        onClose={handleDismissWelcome}
      />

      <AuthScreen
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(user, isNew) => {
          handleLoginSuccess(user, isNew);
          setIsAuthOpen(false);
          handleNavigate('dashboard');
        }}
      />

      <UserSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        currentUser={currentUser}
        deletedDebtors={deletedDebtors}
        onSaveUser={handleSaveUserSettings}
        onRestoreDebtor={handleRestoreDebtor}
        onEmptyTrash={handleEmptyTrash}
        onClearAllData={handleClearAllData}
        initialTab={userSettingsTab}
        theme={theme}
      />

      <DeleteDebtorConfirmationModal
        isOpen={!!deletingDebtorTarget}
        debtor={deletingDebtorTarget}
        linkedPurchasesCount={purchases.filter((p) => p.debtorId === deletingDebtorTarget?.id).length}
        linkedInstallmentsCount={installments.filter((inst) => inst.debtorId === deletingDebtorTarget?.id).length}
        onClose={() => setDeletingDebtorTarget(null)}
        onConfirm={handleDeleteDebtorConfirmed}
      />

      <DeleteInstallmentConfirmationModal
        isOpen={!!deletingInstallmentTarget}
        installment={deletingInstallmentTarget}
        onClose={() => setDeletingInstallmentTarget(null)}
        onConfirm={handleDeleteInstallmentConfirmed}
      />

      <PreRegistrationPortalModal
        isOpen={isPreRegistrationOpen}
        onClose={() => setIsPreRegistrationOpen(false)}
        onLoginSuccess={(user) => {
          handleLoginSuccess(user, false);
          setIsPreRegistrationOpen(false);
          handleNavigate('dashboard');
        }}
      />

      <AuthLookupModal
        isOpen={isAuthLookupOpen}
        onClose={() => setIsAuthLookupOpen(false)}
        debtors={debtors}
        installments={installments}
      />

      <SystemHealthAlertModal
        isOpen={isHealthAlertOpen}
        healthInfo={healthAlertInfo}
        onClose={() => setIsHealthAlertOpen(false)}
      />

      <CredorScoreModal
        isOpen={isCredorScoreOpen}
        onClose={() => setIsCredorScoreOpen(false)}
        debtors={debtors}
        installments={installments}
        purchases={purchases}
      />

      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
                                            }
