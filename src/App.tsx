import { safeToFixed, safeFormatCurrency, safeToNumber } from "./utils/numberUtils";
import React, { useState, useEffect, useRef } from 'react';
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
  getDebtorsFromFirestore,
  deleteDebtorFromFirestore,
  savePurchasesToFirestore,
  getPurchasesFromFirestore,
  saveInstallmentsToFirestore,
  getInstallmentsFromFirestore,
  saveAuthRecordToFirestore,
  clearAllUserDataFromFirestore,
  logoutSession,
  TIAGO_DIAS_USER,
} from './lib/firebase';

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
import { GeminiParsedContract } from './types';

const DEFAULT_USER: UserAccount = TIAGO_DIAS_USER;

export const getCleanDebtorAvatar = (name?: string, currentAvatar?: string): string => {
  const n = (name || '').toLowerCase();
  if (n.includes('jucelia')) return APP_IMAGES.jucelia;
  if (n.includes('marcos')) return APP_IMAGES.marcos;
  if (n.includes('renata')) return APP_IMAGES.renata;
  if (n.includes('jubileu')) return APP_IMAGES.jubileu;
  if (n.includes('joão') || n.includes('joao')) return APP_IMAGES.joao;
  if (n.includes('maria')) return APP_IMAGES.maria;
  if (n.includes('fátima') || n.includes('fatima')) return APP_IMAGES.fatima;
  if (n.includes('carlos')) return APP_IMAGES.carlos;
  if (currentAvatar && !currentAvatar.includes('aida-public') && currentAvatar.length > 15) {
    return currentAvatar;
  }
  return APP_IMAGES.marcos;
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

  // Authentication & Welcome States
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem('haspaho_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.email === 'tiagodias8888@gmail.com' ||
          parsed.username === 'tiagodias' ||
          parsed.id === 'usr_thiago_dias'
        ) {
          return {
            ...TIAGO_DIAS_USER,
            ...parsed,
            name: 'Tiago Augusto Dias',
            cpfCnpj: '368.497.448-01',
            phoneWhatsapp: '(14) 99733-9863',
            role: 'Desenvolvedor e Programador Full Stack | Administrador Master',
            isMasterAdmin: true,
            isFullStackDev: true,
          };
        }
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_USER;
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('haspaho_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed.isFirstLogin && !parsed.hasSeenWelcome);
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  });

  // Domain data in state - with robust LocalStorage persistence and fallback
  const [debtors, setDebtors] = useState<Debtor[]>(() => {
    try {
      const saved = localStorage.getItem('haspaho_debtors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_DEBTORS;
  });

  const [purchases, setPurchases] = useState<Purchase[]>(() => {
    try {
      const saved = localStorage.getItem('haspaho_purchases');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_PURCHASES;
  });

  const [installments, setInstallments] = useState<Installment[]>(() => {
    try {
      const saved = localStorage.getItem('haspaho_installments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_INSTALLMENTS;
  });

  const [institutions] = useState<BankInstitution[]>(INITIAL_INSTITUTIONS);

  // Deleted Debtors Trash Bin (Lixeira) - LocalStorage Persistence
  const [deletedDebtors, setDeletedDebtors] = useState<Debtor[]>(() => {
    try {
      const saved = localStorage.getItem('haspaho_deleted_debtors');
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

  const isInitialLoadRef = useRef(true);

  // Sync initial user data from Firebase Firestore
  useEffect(() => {
    const activeUser = currentUser || DEFAULT_USER;
    if (!activeUser) return;
    let isMounted = true;

    async function loadUserData(user: UserAccount) {
      try {
        const remoteUser = await getUserFromFirestore(user.id);
        if (remoteUser && isMounted) {
          setCurrentUser(remoteUser);
          localStorage.setItem('haspaho_auth_user', JSON.stringify(remoteUser));
        } else {
          await saveUserToFirestore(user);
        }

        const [remoteDebtors, remotePurchases, remoteInstallments] = await Promise.all([
          getDebtorsFromFirestore(user.id),
          getPurchasesFromFirestore(user.id),
          getInstallmentsFromFirestore(user.id),
        ]);

        if (isMounted) {
          if (remoteDebtors && remoteDebtors.length > 0) {
            setDebtors(
              remoteDebtors.map((d) => ({
                ...d,
                avatar: getCleanDebtorAvatar(d.name, d.avatar),
              }))
            );
          } else {
            setDebtors((prev) => (prev && prev.length > 0 ? prev : INITIAL_DEBTORS));
          }

          if (remotePurchases && remotePurchases.length > 0) {
            setPurchases(remotePurchases);
          } else {
            setPurchases((prev) => (prev && prev.length > 0 ? prev : INITIAL_PURCHASES));
          }

          if (remoteInstallments && remoteInstallments.length > 0) {
            setInstallments(
              remoteInstallments.map((inst) => {
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
              })
            );
          } else {
            setInstallments((prev) => (prev && prev.length > 0 ? prev : INITIAL_INSTALLMENTS));
          }

          // Se o banco ainda não foi inicializado para este usuário, salvar os dados iniciais uma única vez
          const hasInitKey = `haspaho_db_init_${user.id}`;
          if (!localStorage.getItem(hasInitKey) && (!remoteDebtors || remoteDebtors.length === 0)) {
            localStorage.setItem(hasInitKey, 'true');
            saveDebtorsToFirestore(user.id, INITIAL_DEBTORS).catch(() => {});
            savePurchasesToFirestore(user.id, INITIAL_PURCHASES).catch(() => {});
            saveInstallmentsToFirestore(user.id, INITIAL_INSTALLMENTS).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[Firebase Sync Error]:', err);
      } finally {
        if (isMounted) {
          isInitialLoadRef.current = false;
        }
      }
    }

    loadUserData(activeUser);

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  // Auto-sync subsequent changes to LocalStorage and Firestore
  useEffect(() => {
    const activeUserId = currentUser?.id || DEFAULT_USER.id;
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

    if (isInitialLoadRef.current) return;

    const timer = setTimeout(() => {
      saveDebtorsToFirestore(activeUserId, debtors).catch((err) => console.warn(err));
      savePurchasesToFirestore(activeUserId, purchases).catch((err) => console.warn(err));
      saveInstallmentsToFirestore(activeUserId, installments).catch((err) => console.warn(err));
    }, 500);

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

    setDebtors(nextDebtors);
    setDeletedDebtors(nextDeleted);

    try {
      localStorage.setItem('haspaho_debtors', JSON.stringify(nextDebtors));
      localStorage.setItem('haspaho_deleted_debtors', JSON.stringify(nextDeleted));
    } catch (e) {
      console.error(e);
    }

    try {
      await deleteDebtorFromFirestore(activeUserId, debtor.id);
      await saveDebtorsToFirestore(activeUserId, nextDebtors);
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
      const nextDebtors = [target, ...debtors.filter((d) => d.id !== debtorId)];
      setDeletedDebtors((prev) => prev.filter((d) => d.id !== debtorId));
      setDebtors(nextDebtors);

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

    // Filter out purchases and installments associated with the permanently deleted debtor
    const nextPurchases = purchases.filter((p) => p.debtorId !== debtorId);
    const nextInstallments = installments.filter((i) => i.debtorId !== debtorId);
    setPurchases(nextPurchases);
    setInstallments(nextInstallments);

    try {
      localStorage.setItem('haspaho_deleted_debtors', JSON.stringify(nextDeleted));
      localStorage.setItem('haspaho_purchases', JSON.stringify(nextPurchases));
      localStorage.setItem('haspaho_installments', JSON.stringify(nextInstallments));
      localStorage.setItem(`haspaho_purchases_${activeUserId}`, JSON.stringify(nextPurchases));
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInstallments));
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
    setDebtors(INITIAL_DEBTORS);
    setPurchases(INITIAL_PURCHASES);
    setInstallments(INITIAL_INSTALLMENTS);
    setDeletedDebtors([]);
    try {
      localStorage.setItem('haspaho_debtors', JSON.stringify(INITIAL_DEBTORS));
      localStorage.setItem('haspaho_purchases', JSON.stringify(INITIAL_PURCHASES));
      localStorage.setItem('haspaho_installments', JSON.stringify(INITIAL_INSTALLMENTS));
      localStorage.setItem('haspaho_deleted_debtors', JSON.stringify([]));
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
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [contractDebtorId, setContractDebtorId] = useState<string | null>(null);
  const [isGeminiScannerOpen, setIsGeminiScannerOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isAuthLookupOpen, setIsAuthLookupOpen] = useState(false);
  const [isPdfHubOpen, setIsPdfHubOpen] = useState(false);
  const [pdfHubDebtorId, setPdfHubDebtorId] = useState<string>('');
  const [isMeuGerenciamentoOpen, setIsMeuGerenciamentoOpen] = useState(false);

  const handleOpenPdfHub = (debtorId?: string) => {
    if (debtorId) {
      setPdfHubDebtorId(debtorId);
      setTargetDebtorId(debtorId);
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

      if (purchaseId) {
        matchedPurchase = purchases.find((p) => p.id === purchaseId);
      }
      if (debtorId) {
        matchedDebtor = debtors.find((d) => d.id === debtorId);
      }

      if (matchedPurchase) {
        matchedInsts = installments.filter((i) => i.purchaseId === matchedPurchase!.id);
        if (!matchedDebtor) {
          matchedDebtor = debtors.find((d) => d.id === matchedPurchase!.debtorId);
        }
      }

      // Se não encontrou parcelas pelo purchaseId ou purchaseId não foi passado, busca pelo devedor
      if (matchedInsts.length === 0 && matchedDebtor) {
        matchedInsts = installments.filter((i) => i.debtorId === matchedDebtor!.id);
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
        matchedDebtor = debtors[0];
        matchedInsts = installments.filter((i) => i.debtorId === matchedDebtor!.id);
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
      setDebtors((prev) =>
        prev.map((d) => {
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
        })
      );

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

      setDebtors((prev) => [newDebtor, ...prev]);
      setPurchases((prev) => [newPurchase, ...prev]);

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

      setInstallments((prev) => [...newInsts, ...prev]);
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
    phone?: string
  ) => {
    const debtor = debtors.find((d) => d.name === name);
    setWhatsAppData({
      isOpen: true,
      debtorName: name,
      phone: phone || debtor?.phone || '(11) 98765-4321',
      amount,
      product: `${item} (${parcel})`,
      dueDate: '10/09/2026',
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

  const handleConfirmDeleteInstallment = (inst: Installment) => {
    setInstallments((prev) => prev.filter((i) => i.id !== inst.id));
    setDeletingInstallmentTarget(null);
    showToast('Parcela excluída com sucesso!');
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

    // Atualiza a contagem de parcelas pagas na Compra
    const nextPurchases = purchases.map((p) => {
      const prodA = (p.product || '').toLowerCase().trim();
      const prodB = (inst.product || '').toLowerCase().trim();
      if (p.id === inst.purchaseId || (p.debtorId === inst.debtorId && prodA === prodB)) {
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
      if (d.id === inst.debtorId) {
        const newTotalOwed = Math.max(0, (d.totalOwed || 0) - (inst.amount || inst.originalAmount || 0));
        const newTotalPaid = (d.totalPaid || 0) + paidAmount;
        const newOverdueCount = isOverdue ? Math.max(0, (d.overdueCount || 0) - 1) : (d.overdueCount || 0);

        const debtorInsts = updatedInstallments.filter((i) => i.debtorId === d.id);
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
      saveInstallmentsToFirestore(activeUserId, updatedInstallments).catch(console.warn);
      savePurchasesToFirestore(activeUserId, nextPurchases).catch(console.warn);
      saveDebtorsToFirestore(activeUserId, nextDebtors).catch(console.warn);
    }

    let toastMsg = `Pagamento da parcela #${inst.installmentNumber} safeToFixed(R$ ${safeToFixed(paidAmount).replace('.', ',')}) confirmado via ${method}! Chave ${persistentAuthCode} gerada e registrada com sucesso.`;

    addAuditLog('PAGAMENTO_CONFIRMADO', `Pagamento de R$ ${safeToFixed(paidAmount, 2)} confirmado (${method}). Autenticação ${persistentAuthCode}.`, inst.debtorName, 'FIRESTORE_SAVED');
    showToast(toastMsg);

    return persistentAuthCode;
  };

  const handleUpdateInstallment = (updatedInst: Installment) => {
    setInstallments((prev) => prev.map((item) => (item.id === updatedInst.id ? updatedInst : item)));
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

      setPurchases((prev) => [newPurchase, ...prev]);
      setInstallments((prev) => [...newInsts, ...prev]);
      setDebtors([newDebtor, ...debtors]);
      addAuditLog('CADASTRO_DEVEDOR_E_COMPRA', `Comprador "${newD.name}" e compra "${p.product}" safeToFixed(${instCount}x de R$ ${safeToFixed(instValue).replace('.', ',')}) cadastrados simultaneamente.`, newD.name, 'FIRESTORE_SAVED');
      showToast(`✨ Comprador "${newD.name}" e compra "${p.product}" cadastrados juntos com sucesso!`);
    } else {
      setDebtors([newDebtor, ...debtors]);
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
    setDebtors((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setInstallments((prev) =>
      prev.map((i) =>
        i.debtorId === updated.id
          ? { ...i, debtorName: updated.name, debtorAvatar: updated.avatar }
          : i
      )
    );
    setPurchases((prev) =>
      prev.map((p) =>
        p.debtorId === updated.id ? { ...p, debtorName: updated.name } : p
      )
    );
    addAuditLog('EDICAO_DEVEDOR_SISTEMA', `Dados cadastrais do devedor "${updated.name}" atualizados no Firestore.`, updated.name, 'FIRESTORE_SAVED');
    showToast(`Devedor ${updated.name} atualizado com sucesso!`);
  };

  // Handler para abrir contrato digital
  const handleOpenContract = (debtorId: string) => {
    setContractDebtorId(debtorId);
    setIsContractOpen(true);
  };

  // Handler para assinar o contrato digital
  const handleSignContract = (debtorId: string, signatureUrl: string, signDate: string) => {
    setDebtors((prev) =>
      prev.map((d) =>
        d.id === debtorId
          ? {
              ...d,
              contractSigned: true,
              contractSignedDate: signDate,
              contractSignatureUrl: signatureUrl,
            }
          : d
      )
    );
    showToast('Contrato digital assinado e registrado com sucesso!');
  };

  // Handler para atualizar dados do devedor (ex: pré-preenchimento para usuário leigo)
  const handleUpdateDebtorData = (debtorId: string, updatedData: Partial<Debtor>) => {
    setDebtors((prev) =>
      prev.map((d) => (d.id === debtorId ? { ...d, ...updatedData } : d))
    );
    if (updatedData.name) {
      setInstallments((prev) =>
        prev.map((i) =>
          i.debtorId === debtorId ? { ...i, debtorName: updatedData.name! } : i
        )
      );
      setPurchases((prev) =>
        prev.map((p) =>
          p.debtorId === debtorId ? { ...p, debtorName: updatedData.name! } : p
        )
      );
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
      setDebtors((prev) =>
        prev.map((d) => {
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
        })
      );
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
      setDebtors((prev) => [newDebtor, ...prev]);
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
    setCurrentUser(user);
    localStorage.setItem('haspaho_auth_user', JSON.stringify(user));
    setIsAuthOpen(false);
    if (isNewAccount || user.isFirstLogin || !user.hasSeenWelcome) {
      setIsWelcomeOpen(true);
    }
    try {
      await saveUserToFirestore(user);
    } catch (err) {
      console.error('Failed to sync user to Firestore:', err);
    }
    showToast(`Bem-vindo, ${user.name}!`);
  };

  const handleLogout = async () => {
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

  const handleDismissWelcome = () => {
    setIsWelcomeOpen(false);
    if (currentUser) {
      const updated: UserAccount = {
        ...currentUser,
        isFirstLogin: false,
        hasSeenWelcome: true,
      };
      setCurrentUser(updated);
      localStorage.setItem('haspaho_auth_user', JSON.stringify(updated));
    }
  };

  // Trava de Autenticação Segura: Se não houver usuário autenticado, exibe a tela oficial de login/cadastro
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-hidden">
        <FuturisticCosmicBackground />
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
        onOpenNewDebtor={() => setIsNewDebtorModalOpen(true)}
        onEditDebtor={handleOpenEditDebtor}
        onOpenContract={handleOpenContract}
        onOpenLogin={() => setIsAuthOpen(true)}
        onOpenWelcome={() => setIsWelcomeOpen(true)}
        onOpenUserSettings={() => setIsUserSettingsOpen(true)}
        onOpenAuthLookup={() => setIsAuthLookupOpen(true)}
        onLogout={handleLogout}
        onRestoreAllData={handleRestoreAllData}
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
        className={`flex-1 w-full relative z-10 ${
          currentTab === 'erp-legacy' || currentTab === 'admin-forum'
            ? 'px-1 sm:px-3 lg:px-4 pt-20 md:pt-20 pb-6'
            : isStackScreen
            ? 'px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-20 md:pt-20 pb-36 sm:pb-28'
            : 'px-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-28 sm:pt-28 md:pt-20 pb-36 sm:pb-28'
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
              if (isNew) {
                setIsWelcomeOpen(true);
              }
              handleNavigate('dashboard');
            }}
            onEnterDashboard={() => handleNavigate('dashboard')}
            onOpenGeminiScanner={() => setIsGeminiScannerOpen(true)}
            onLogout={handleLogout}
          />
        )}

        {(currentTab === 'dashboard' || currentTab === 'devedores' || currentTab === 'parcelas') && (
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
            initialSection={currentTab === 'devedores' ? 'devedores' : currentTab === 'parcelas' ? 'parcelas' : 'visao_geral'}
            onRestoreAllData={handleRestoreAllData}
            theme={theme}
            onToggleTheme={handleToggleTheme}
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
          onOpenPdfHub={() => setIsPdfHubOpen(true)}
          onOpenMeuGerenciamento={() => setIsMeuGerenciamentoOpen(true)}
          onOpenUserSettings={(tab) => {
            if (tab) setUserSettingsTab(tab);
            setIsUserSettingsOpen(true);
          }}
          onLogout={handleLogout}
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
        isOpen={isAuthOpen || !currentUser}
        canClose={currentUser !== null}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* User Settings Modal (Thiago Dias: Foto, E-mail, PIX, CEP, Endereço, Senha, Lixeira) */}
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
          deletedDebtors={deletedDebtors}
          onRestoreDebtor={handleRestoreDebtor}
          onPermanentDeleteDebtor={handlePermanentDeleteDebtor}
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
        transactions={INITIAL_TRANSACTIONS}
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
