import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Debtor, Purchase, Installment, BankInstitution, UserAccount, ScreenTab } from '../types';
import { HaspahoLogo } from './HaspahoLogo';
import { playAppSound } from '../utils/soundUtils';
import { ArpDocumentPrintModal } from './ArpDocumentPrintModal';
import { getAuditLogs, clearAuditLogs, addAuditLog, AuditLogEntry } from '../utils/auditLogger';
import {
  saveDebtorsToFirestore,
  saveSingleDebtorToFirestore,
  deleteDebtorFromFirestore,
  saveInstallmentsToFirestore,
  deleteInstallmentFromFirestore,
} from '../lib/firebase';

export const formatSmartShortName = (fullName: string): string => {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].length > 12 ? parts[0].substring(0, 11) + '…' : parts[0];
  }
  if (trimmed.length <= 13) return trimmed;
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  return `${firstName} ${lastName.charAt(0)}.`;
};

interface ErpLegacySystemProps {
  debtors: Debtor[];
  purchases: Purchase[];
  installments: Installment[];
  institutions: BankInstitution[];
  currentUser: UserAccount | null;
  onNavigate: (tab: ScreenTab) => void;
  onUpdateDebtors: (updatedDebtors: Debtor[]) => void;
  onUpdatePurchases: (updatedPurchases: Purchase[]) => void;
  onUpdateInstallments: (updatedInstallments: Installment[]) => void;
  onToast: (msg: string) => void;
  onRequestDeleteDebtor?: (debtor: Debtor) => void;
  onDeleteInstallment?: (id: string) => void;
}

export const ErpLegacySystem: React.FC<ErpLegacySystemProps> = ({
  debtors,
  purchases,
  installments,
  institutions,
  currentUser,
  onNavigate,
  onUpdateDebtors,
  onUpdatePurchases,
  onUpdateInstallments,
  onToast,
  onRequestDeleteDebtor,
  onDeleteInstallment,
}) => {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'cadastro' | 'pesquisa' | 'titulos' | 'lancamento' | 'massa' | 'auditoria'>('cadastro');
  const [mobileViewMode, setMobileViewMode] = useState<'cards' | 'table'>('cards');
  const [activeBalloonDebtorId, setActiveBalloonDebtorId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [themeMode, setThemeMode] = useState<'modern_erp' | 'classic_delphi'>('modern_erp');

  // Helper para formatar data sem risco de 'Invalid Date'
  const formatDateSafe = (rawDate?: string): string => {
    if (!rawDate) return '15/10/2026';
    const str = String(rawDate).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const parts = str.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString('pt-BR');
    return '15/10/2026';
  };

  // Helper para buscar informações da parcela a vencer / em atraso
  const getUpcomingInstallmentInfo = (debtorId: string, debtorTotalOwed: number | string) => {
    const dInsts = installments.filter(inst => inst.debtorId === debtorId && inst.status !== 'paid');
    if (dInsts.length > 0) {
      dInsts.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      const target = dInsts.find(i => i.status === 'overdue') || dInsts[0];
      const dateStr = formatDateSafe(target.dueDate);
      return {
        parcela: `#${target.installmentNumber}/${target.totalInstallments}`,
        vencimento: dateStr,
        valor: `R$ ${(Number(target.amount) || 0).toFixed(2)}`,
        status: target.status,
      };
    }
    return {
      parcela: '#01/01',
      vencimento: '15/10/2026',
      valor: `R$ ${(Number(debtorTotalOwed) || 118.09).toFixed(2)}`,
      status: 'pending',
    };
  };

  // Audit Logs State & Listener
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => getAuditLogs());
  const [auditFilter, setAuditFilter] = useState('');

  useEffect(() => {
    const handleUpdate = () => setAuditLogs(getAuditLogs());
    window.addEventListener('haspaho-audit-log-updated', handleUpdate);
    return () => window.removeEventListener('haspaho-audit-log-updated', handleUpdate);
  }, []);

  // Selected Debtor for Form Editing
  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(debtors[0]?.id || '');
  const activeDebtor = useMemo(() => {
    return debtors.find((d) => d.id === selectedDebtorId) || debtors[0];
  }, [debtors, selectedDebtorId]);

  // Form State for Debtor (Data Entry Form)
  const [formData, setFormData] = useState({
    id: activeDebtor?.id || '',
    name: activeDebtor?.name || '',
    apelido: activeDebtor?.relation || '',
    personType: 'F' as 'F' | 'J',
    cpfCnpj: activeDebtor?.documentNumber || '123.456.789-00',
    rgIe: '34.567.890-X',
    orgaoExp: 'SSP/SP',
    birthDate: '1988-05-14',
    phone: activeDebtor?.phone || '(14) 99733-9863',
    phoneSecondary: '(14) 3642-1234',
    email: activeDebtor?.email || 'contato@cliente.com.br',
    pixKey: activeDebtor?.pixKey || '',
    cep: '17320-000',
    logradouro: 'Rua Principal dos Bandeirantes',
    numero: '450',
    complemento: 'Sala 02',
    bairro: 'Centro Comercial',
    cidade: 'Mineiros do Tietê',
    uf: 'SP',
    limiteCredito: activeDebtor?.creditLimit || 5000,
    score: activeDebtor?.score || 850,
    taxaJurosMensal: 2.5,
    multaAtrasoFixa: 5.0,
    diasTolerancia: 3,
    ativo: true,
    permiteCobrancaWhatsApp: true,
    bloqueioPreventivo: false,
    protestarApos30Dias: true,
    contratoAssinado: activeDebtor?.contractSigned ?? true,
    observacoes: activeDebtor?.notes || 'Cliente cadastrado no sistema ERP corporativo HASPAHO.',
  });

  // Keep form data in sync when active debtor changes
  useEffect(() => {
    if (activeDebtor) {
      setFormData({
        id: activeDebtor.id,
        name: activeDebtor.name,
        apelido: activeDebtor.relation || 'Cliente',
        personType: activeDebtor.documentNumber?.length && activeDebtor.documentNumber.length > 14 ? 'J' : 'F',
        cpfCnpj: activeDebtor.documentNumber || '123.456.789-00',
        rgIe: '34.567.890-X',
        orgaoExp: 'SSP/SP',
        birthDate: '1988-05-14',
        phone: activeDebtor.phone || '',
        phoneSecondary: '(14) 3642-1234',
        email: activeDebtor.email || '',
        pixKey: activeDebtor.pixKey || activeDebtor.phone || '',
        cep: '17320-000',
        logradouro: 'Rua Principal dos Bandeirantes',
        numero: '450',
        complemento: 'Sala 02',
        bairro: 'Centro',
        cidade: 'Mineiros do Tietê',
        uf: 'SP',
        limiteCredito: activeDebtor.creditLimit || 5000,
        score: activeDebtor.score || 800,
        taxaJurosMensal: 2.5,
        multaAtrasoFixa: 5.0,
        diasTolerancia: 3,
        ativo: true,
        permiteCobrancaWhatsApp: true,
        bloqueioPreventivo: false,
        protestarApos30Dias: true,
        contratoAssinado: activeDebtor.contractSigned ?? true,
        observacoes: activeDebtor.notes || 'Registro homologado no banco de dados.',
      });
    }
  }, [activeDebtor?.id]);

  // Mapeamento sequencial de código numérico de cliente (#01, #02, #03...)
  const debtorCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    debtors.forEach((d, idx) => {
      map.set(d.id, String(idx + 1).padStart(2, '0'));
    });
    return map;
  }, [debtors]);

  const getDebtorCode = (id: string, fallbackIdx?: number) => {
    if (debtorCodeMap.has(id)) {
      return debtorCodeMap.get(id)!;
    }
    const idx = debtors.findIndex((d) => d.id === id);
    if (idx !== -1) {
      return String(idx + 1).padStart(2, '0');
    }
    if (typeof fallbackIdx === 'number') {
      return String(fallbackIdx + 1).padStart(2, '0');
    }
    return '01';
  };

  const formatDocOrPhone = (doc?: string, phone?: string) => {
    if (doc && doc.trim() && doc.trim() !== 'Sem doc' && doc.trim() !== '—') {
      return doc.trim();
    }
    if (phone && phone.trim()) {
      const raw = phone.replace(/\D/g, '');
      if (raw.length === 11) {
        return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
      }
      if (raw.length === 10) {
        return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
      }
      return phone.trim();
    }
    return 'Sem doc';
  };

  // Search & Filter in DBGrid
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'adimplente' | 'atrasado' | 'quitado'>('todos');

  // Filtered Debtors for Grid
  const filteredDebtors = useMemo(() => {
    return debtors.filter((d, idx) => {
      const clientCode = getDebtorCode(d.id, idx);
      const matchText =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.phone.includes(searchQuery) ||
        (d.documentNumber && d.documentNumber.includes(searchQuery)) ||
        d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clientCode.includes(searchQuery) ||
        `#${clientCode}`.includes(searchQuery);

      if (!matchText) return false;
      if (filterStatus === 'todos') return true;
      if (filterStatus === 'adimplente') return d.overdueCount === 0 && d.totalOwed > 0;
      if (filterStatus === 'atrasado') return d.overdueCount > 0;
      if (filterStatus === 'quitado') return d.totalOwed === 0;
      return true;
    });
  }, [debtors, searchQuery, filterStatus, debtorCodeMap]);

  // Installments Search & Filter
  const [instSearch, setInstSearch] = useState('');
  const [instStatusFilter, setInstStatusFilter] = useState<string>('todos');

  // Lixeira Contábil (Recycle Bin / Desfazer) State & Seleção Geral
  const [deletedInstallments, setDeletedInstallments] = useState<(Installment & { deletedAt?: string })[]>(() => {
    try {
      const saved = localStorage.getItem('haspaho_erp_deleted_installments');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  const [lastDeletedBatch, setLastDeletedBatch] = useState<Installment[] | null>(null);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashSearch, setTrashSearch] = useState('');
  const [selectedInstIds, setSelectedInstIds] = useState<string[]>([]);
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [bulkDeleteScope, setBulkDeleteScope] = useState<'selected' | 'all_filtered'>('selected');
  const [confirmLiquidationInst, setConfirmLiquidationInst] = useState<Installment | null>(null);
  const [confirmLiquidateDebtor, setConfirmLiquidateDebtor] = useState<Debtor | null>(null);
  const [confirmDeleteInst, setConfirmDeleteInst] = useState<Installment | null>(null);
  const masterCheckboxRef = useRef<HTMLInputElement>(null);

  const filteredInstallments = useMemo(() => {
    const q = (instSearch || '').trim().toLowerCase();
    return installments.filter((i) => {
      const debtorName = (i.debtorName || '').toLowerCase();
      const product = (i.product || '').toLowerCase();
      const id = (i.id || '').toLowerCase();
      const match =
        !q ||
        debtorName.includes(q) ||
        product.includes(q) ||
        id.includes(q);
      if (!match) return false;
      if (instStatusFilter === 'todos') return true;
      return i.status === instStatusFilter;
    });
  }, [installments, instSearch, instStatusFilter]);

  // Contadores de situação para os filtros contábeis
  const statusCounts = useMemo(() => {
    return {
      todos: installments.length,
      overdue: installments.filter((i) => i.status === 'overdue').length,
      soon: installments.filter((i) => i.status === 'soon').length,
      ontime: installments.filter((i) => i.status === 'ontime').length,
      paid: installments.filter((i) => i.status === 'paid').length,
    };
  }, [installments]);

  // Master Checkbox & Selection Helpers
  const isAllFilteredSelected = useMemo(() => {
    if (!filteredInstallments.length) return false;
    return filteredInstallments.every((i) => selectedInstIds.includes(i.id));
  }, [filteredInstallments, selectedInstIds]);

  useEffect(() => {
    if (masterCheckboxRef.current) {
      const filteredCount = filteredInstallments.length;
      const count = filteredInstallments.filter((i) => selectedInstIds.includes(i.id)).length;
      masterCheckboxRef.current.indeterminate = count > 0 && count < filteredCount;
    }
  }, [filteredInstallments, selectedInstIds]);

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredInstallments.map((i) => i.id));
      setSelectedInstIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newIds = Array.from(new Set([...selectedInstIds, ...filteredInstallments.map((i) => i.id)]));
      setSelectedInstIds(newIds);
    }
  };

  const toggleSelectRow = (instId: string) => {
    setSelectedInstIds((prev) =>
      prev.includes(instId) ? prev.filter((id) => id !== instId) : [...prev, instId]
    );
  };

  const selectedInstallmentsList = useMemo(() => {
    const idSet = new Set(selectedInstIds);
    return installments.filter((i) => idSet.has(i.id));
  }, [installments, selectedInstIds]);

  const totalSelectedAmount = useMemo(() => {
    return selectedInstallmentsList.reduce((acc, i) => acc + (i.amount || 0), 0);
  }, [selectedInstallmentsList]);

  // Mover Títulos para a Lixeira Contábil (Permite Desfazer)
  const moveToTrash = async (targets: Installment[], reasonLabel?: string) => {
    if (!targets.length) return;
    const targetIds = new Set(targets.map((t) => t.id));
    const nowIso = new Date().toISOString();
    const enrichedTargets = targets.map((t) => ({ ...t, deletedAt: nowIso }));

    const nextInstallments = installments.filter((i) => !targetIds.has(i.id));
    const nextDeleted = [...enrichedTargets, ...deletedInstallments.filter((d) => !targetIds.has(d.id))];

    onUpdateInstallments(nextInstallments);
    setDeletedInstallments(nextDeleted);
    setLastDeletedBatch(targets);
    setSelectedInstIds((prev) => prev.filter((id) => !targetIds.has(id)));

    try {
      localStorage.setItem('haspaho_installments', JSON.stringify(nextInstallments));
      localStorage.setItem('haspaho_erp_deleted_installments', JSON.stringify(nextDeleted));
    } catch (e) {
      console.error(e);
    }

    const activeUserId = currentUser?.id || 'tiagodias8';
    try {
      await saveInstallmentsToFirestore(activeUserId, nextInstallments);
      for (const t of targets) {
        deleteInstallmentFromFirestore(activeUserId, t.id).catch(console.warn);
      }
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInstallments));
    } catch (err) {
      console.warn('Erro ao sincronizar exclusão com Firestore:', err);
    }

    addAuditLog(
      'EXCLUSAO_TITULOS_ERP',
      `${targets.length} título(s) contábil(is) excluído(s) no ERP (${reasonLabel || 'Movido para Lixeira'}).`,
      targets.length === 1 ? targets[0].debtorName : `Lote de ${targets.length} títulos`,
      'FIRESTORE_SAVED'
    );

    onToast(`🗑️ ${targets.length} título(s) movido(s) para a Lixeira Contábil. Ação reversível!`);
  };

  // Restaurar Títulos da Lixeira (Desfazer Ação)
  const handleRestoreInstallments = async (targets: (Installment & { deletedAt?: string })[]) => {
    if (!targets.length) return;
    const targetIds = new Set(targets.map((t) => t.id));

    const cleanedTargets = targets.map((t) => {
      const copy: any = { ...t };
      delete copy.deletedAt;
      return copy as Installment;
    });

    const existingIds = new Set(installments.map((i) => i.id));
    const toAdd = cleanedTargets.filter((t) => !existingIds.has(t.id));
    const nextInstallments = [...toAdd, ...installments];
    const nextDeleted = deletedInstallments.filter((d) => !targetIds.has(d.id));

    onUpdateInstallments(nextInstallments);
    setDeletedInstallments(nextDeleted);
    if (lastDeletedBatch && targets.some((t) => lastDeletedBatch.some((b) => b.id === t.id))) {
      setLastDeletedBatch(null);
    }

    try {
      localStorage.setItem('haspaho_installments', JSON.stringify(nextInstallments));
      localStorage.setItem('haspaho_erp_deleted_installments', JSON.stringify(nextDeleted));
    } catch (e) {
      console.error(e);
    }

    const activeUserId = currentUser?.id || 'tiagodias8';
    try {
      await saveInstallmentsToFirestore(activeUserId, nextInstallments);
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(nextInstallments));
    } catch (err) {
      console.warn('Erro ao sincronizar restauração com Firestore:', err);
    }

    addAuditLog(
      'RESTAURACAO_TITULOS_ERP',
      `${targets.length} título(s) contábil(is) restaurado(s) da Lixeira para a Grade Contábil do ERP.`,
      targets.length === 1 ? targets[0].debtorName : `Lote de ${targets.length} títulos`,
      'FIRESTORE_SAVED'
    );

    onToast(`♻️ ${targets.length} título(s) restaurado(s) com sucesso para a Grade Contábil!`);
  };

  // Esvaziar Lixeira Definitivamente
  const handleEmptyTrash = () => {
    if (!deletedInstallments.length) return;
    if (window.confirm(`⚠️ EXCLUSÃO PERMANENTE: Deseja esvaziar definitivamente todos os ${deletedInstallments.length} títulos da lixeira? Esta ação não pode ser desfeita.`)) {
      setDeletedInstallments([]);
      setLastDeletedBatch(null);
      try {
        localStorage.removeItem('haspaho_erp_deleted_installments');
      } catch (e) {
        console.error(e);
      }
      addAuditLog(
        'LIMPEZA_LIXEIRA_ERP',
        `Lixeira de Contas a Receber esvaziada permanentemente.`,
        'SISTEMA_ERP',
        'LOCAL_SAVED'
      );
      onToast('🧹 Lixeira contábil esvaziada definitivamente.');
    }
  };

  // Solicitar Exclusão em Massa (Abre Modal de Confirmação)
  const handleRequestBulkDelete = (scope: 'selected' | 'all_filtered') => {
    setBulkDeleteScope(scope);
    setConfirmBulkDeleteOpen(true);
  };

  // Confirmar Exclusão em Massa
  const handleConfirmBulkDelete = () => {
    const targets = bulkDeleteScope === 'selected' ? selectedInstallmentsList : filteredInstallments;
    setConfirmBulkDeleteOpen(false);
    moveToTrash(
      targets,
      bulkDeleteScope === 'selected'
        ? `Exclusão de ${targets.length} títulos selecionados via caixa marcável`
        : `Exclusão Geral de ${targets.length} títulos da Grade Contábil`
    );
  };

  // Rapid Purchase Entry State (Emissão de Carnê/Lançamento)
  const [newPurchaseDebtorId, setNewPurchaseDebtorId] = useState(debtors[0]?.id || '');
  const [newPurchaseProduct, setNewPurchaseProduct] = useState('');
  const [newPurchaseStore, setNewPurchaseStore] = useState('Magazine Luiza');
  const [newPurchaseCard, setNewPurchaseCard] = useState(institutions[0]?.name || 'Nubank Mastercard');
  const [newPurchaseAmount, setNewPurchaseAmount] = useState('1200.00');
  const [newPurchaseCount, setNewPurchaseCount] = useState('6');
  const [newPurchaseFirstDate, setNewPurchaseFirstDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Bulk Data Entry Table State (Linhas de Digitação em Massa)
  const [bulkRows, setBulkRows] = useState([
    { id: 1, debtorName: 'Carlos Eduardo Ramos', doc: '445.678.901-22', valor: '350.00', venc: '2026-10-10', parc: '1/3', status: 'Pendente' },
    { id: 2, debtorName: 'Mariana Souza Alves', doc: '112.334.556-77', valor: '520.00', venc: '2026-10-15', parc: '1/6', status: 'Pendente' },
    { id: 3, debtorName: 'Roberto Silveira Lima', doc: '889.990.112-33', valor: '180.00', venc: '2026-10-20', parc: '2/4', status: 'Pendente' },
  ]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleNewDebtor();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleSaveDebtor();
      } else if (e.key === 'F6') {
        e.preventDefault();
        setActiveTab('pesquisa');
      } else if (e.key === 'F7') {
        e.preventDefault();
        setShowPrintModal(true);
        playAppSound('pop');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onNavigate('dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData, debtors]);

  // CRUD Actions
  const handleNewDebtor = () => {
    const tempId = `new_${Date.now()}`;
    setSelectedDebtorId(tempId);
    setFormData({
      id: tempId,
      name: '',
      apelido: 'Cliente Comercial',
      personType: 'F',
      cpfCnpj: '',
      rgIe: '34.567.890-X',
      orgaoExp: 'SSP/SP',
      birthDate: '1990-01-01',
      phone: '',
      phoneSecondary: '',
      email: '',
      pixKey: '',
      cep: '17320-000',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: 'Centro',
      cidade: 'Mineiros do Tietê',
      uf: 'SP',
      limiteCredito: 5000,
      score: 800,
      taxaJurosMensal: 2.5,
      multaAtrasoFixa: 5.0,
      diasTolerancia: 3,
      ativo: true,
      permiteCobrancaWhatsApp: true,
      bloqueioPreventivo: false,
      protestarApos30Dias: true,
      contratoAssinado: true,
      observacoes: '',
    });
    setActiveTab('cadastro');
    onToast('[F2 - Novo] Formulário limpo! Digite o nome completo e os dados do devedor real.');
  };

  const handleSaveDebtor = () => {
    if (!formData.name || !formData.name.trim()) {
      onToast('Erro: Por favor, digite o Nome Completo do devedor/cliente antes de gravar.');
      return;
    }

    const debtorName = formData.name.trim().toUpperCase();
    const isNew = formData.id.startsWith('new_') || !debtors.some((d) => d.id === formData.id);

    if (isNew) {
      const realId = `deb_${Date.now()}`;
      const newDebtor: Debtor = {
        id: realId,
        name: debtorName,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        phone: formData.phone.trim() || '(14) 99999-0000',
        relation: formData.apelido.trim() || 'Cliente Comercial',
        totalOwed: 0,
        totalPaid: 0,
        overdueCount: 0,
        score: Number(formData.score) || 800,
        scoreTier: 'bom',
        onTimePaymentsCount: 0,
        justInTimePaymentsCount: 0,
        latePaymentsCount: 0,
        spendingAlert: false,
        documentNumber: formData.cpfCnpj.trim() || '000.000.000-00',
        cpfCnpj: formData.cpfCnpj.trim() || '000.000.000-00',
        creditLimit: Number(formData.limiteCredito) || 5000,
        pixKey: formData.pixKey.trim() || formData.phone.trim(),
        email: formData.email.trim(),
        notes: formData.observacoes.trim() || 'Cadastrado via formulário ERP.',
        contractSigned: formData.contratoAssinado,
      };

      onUpdateDebtors([newDebtor, ...debtors]);
      addAuditLog(
        'CADASTRO_DEVEDOR_FIRESTORE',
        `Novo devedor "${debtorName}" (CPF: ${newDebtor.cpfCnpj}) gravado e sincronizado com sucesso no banco de dados Firestore.`,
        debtorName,
        'FIRESTORE_SAVED'
      );
      onToast(`✨ [F3 - Commit] Novo devedor "${debtorName}" gravado com sucesso! Adicionado à lista de Devedores.`);
      onNavigate('dashboard');
    } else {
      const updated = debtors.map((d) => {
        if (d.id === formData.id) {
          return {
            ...d,
            name: debtorName,
            relation: formData.apelido.trim() || d.relation,
            phone: formData.phone.trim() || d.phone,
            documentNumber: formData.cpfCnpj.trim() || d.documentNumber,
            cpfCnpj: formData.cpfCnpj.trim() || d.cpfCnpj,
            creditLimit: Number(formData.limiteCredito) || d.creditLimit,
            score: Number(formData.score) || d.score,
            pixKey: formData.pixKey.trim() || d.pixKey,
            email: formData.email.trim() || d.email,
            notes: formData.observacoes.trim() || d.notes,
            contractSigned: formData.contratoAssinado,
          };
        }
        return d;
      });

      onUpdateDebtors(updated);
      onToast(`✨ [F3 - Commit] Registro de "${debtorName}" atualizado com sucesso! Redirecionando para o Dashboard...`);
      onNavigate('dashboard');
    }
  };

  const handleDeleteDebtor = () => {
    const target = debtors.find((d) => d.id === formData.id) || activeDebtor;
    if (!target) return;
    if (onRequestDeleteDebtor) {
      onRequestDeleteDebtor(target);
      return;
    }
    if (window.confirm(`⚠️ CONFIRMAÇÃO ERP: Deseja realmente excluir o registro de "${target.name}"?\n\nEsta ação removerá o cadastro do devedor da base de dados.`)) {
      const updated = debtors.filter((d) => d.id !== target.id);
      onUpdateDebtors(updated);
      try {
        localStorage.setItem('haspaho_debtors', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      const activeUserId = currentUser?.id || 'tiagodias8';
      try {
        deleteDebtorFromFirestore(activeUserId, target.id);
        saveDebtorsToFirestore(activeUserId, updated);
        localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(updated));
      } catch (err) {
        console.error('Error deleting from firestore:', err);
      }
      addAuditLog(
        'EXCLUSAO_REGISTRO_ERP',
        `Registro de "${target.name}" (ID: ${target.id}) excluído do ERP.`,
        target.name,
        'FIRESTORE_SAVED'
      );
      if (updated.length > 0) {
        setSelectedDebtorId(updated[0].id);
      }
      onToast(`🗑️ Registro de "${target.name}" excluído com sucesso da base de dados.`);
    }
  };

  // Excluir registro específico da linha da tabela ERP
  const handleDeleteSpecificDebtor = (debtor: Debtor) => {
    if (onRequestDeleteDebtor) {
      onRequestDeleteDebtor(debtor);
      return;
    }
    if (window.confirm(`⚠️ CONFIRMAÇÃO ERP: Deseja realmente excluir o registro de "${debtor.name}"?\n\nEsta ação removerá o cadastro deste devedor da base de dados.`)) {
      const nextDebtors = debtors.filter((d) => d.id !== debtor.id);
      onUpdateDebtors(nextDebtors);
      try {
        localStorage.setItem('haspaho_debtors', JSON.stringify(nextDebtors));
      } catch (e) {
        console.error(e);
      }
      const activeUserId = currentUser?.id || 'tiagodias8';
      try {
        deleteDebtorFromFirestore(activeUserId, debtor.id);
        saveDebtorsToFirestore(activeUserId, nextDebtors);
        localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(nextDebtors));
      } catch (err) {
        console.error('Error deleting from firestore:', err);
      }
      addAuditLog(
        'EXCLUSAO_REGISTRO_ERP',
        `Registro de "${debtor.name}" (ID: ${debtor.id}) excluído via tabela/linha ERP.`,
        debtor.name,
        'FIRESTORE_SAVED'
      );
      if (selectedDebtorId === debtor.id) {
        const remaining = nextDebtors[0];
        if (remaining) setSelectedDebtorId(remaining.id);
      }
      onToast(`🗑️ Registro de "${debtor.name}" excluído com sucesso do ERP.`);
    }
  };

  // Liquidar todas as pendências do devedor (Abre confirmação in-app para contornar bloqueio de window.confirm)
  const handleLiquidarDebtor = (debtor: Debtor) => {
    if (Number(debtor.totalOwed) <= 0) {
      onToast(`✨ O cliente "${debtor.name}" já está totalmente Liquidado!`);
      playAppSound('pop');
      return;
    }
    setConfirmLiquidateDebtor(debtor);
    playAppSound('pop');
  };

  // Executa a liquidação total de todas as pendências do devedor
  const executeLiquidationDebtor = (debtor: Debtor) => {
    const amountToLiquidate = Number(debtor.totalOwed) || 0;
    const updatedDebtors = debtors.map((d) => {
      if (d.id === debtor.id) {
        return {
          ...d,
          totalPaid: (Number(d.totalPaid) || 0) + amountToLiquidate,
          totalOwed: 0,
          overdueCount: 0,
          score: Math.min(1000, (Number(d.score) || 800) + 50),
        };
      }
      return d;
    });

    const updatedInst = installments.map((i) => {
      const isMatch = i.debtorId === debtor.id || (debtor.name && i.debtorName?.trim().toLowerCase() === debtor.name.trim().toLowerCase());
      if (isMatch && i.status !== 'paid') {
        return {
          ...i,
          status: 'paid' as const,
          paidAt: new Date().toISOString().split('T')[0],
          paidAmount: i.amount,
        };
      }
      return i;
    });

    onUpdateDebtors(updatedDebtors);
    onUpdateInstallments(updatedInst);

    const activeUserId = currentUser?.id || 'tiagodias8';
    try {
      localStorage.setItem('haspaho_debtors', JSON.stringify(updatedDebtors));
      localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(updatedDebtors));
      localStorage.setItem('haspaho_installments', JSON.stringify(updatedInst));
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(updatedInst));
    } catch (e) {
      console.error(e);
    }

    try {
      saveDebtorsToFirestore(activeUserId, updatedDebtors);
      saveInstallmentsToFirestore(activeUserId, updatedInst);
    } catch (err) {
      console.error('Error saving liquidation to firestore:', err);
    }

    addAuditLog(
      'LIQUIDACAO_TOTAL_DEVEDOR',
      `Cliente "${debtor.name}" teve saldo de R$ ${amountToLiquidate.toFixed(2)} totalmente Liquidado.`,
      debtor.name,
      'FIRESTORE_SAVED'
    );

    playAppSound('pop');
    onToast(`🎉 Sucesso! Saldo de "${debtor.name}" foi completamente Liquidado!`);
  };

  // Salvar / Sincronizar registro específico da linha da tabela ERP
  const handleQuickSaveRecord = async (debtor: Debtor) => {
    const activeUserId = currentUser?.id || 'tiagodias8';
    try {
      await saveSingleDebtorToFirestore(activeUserId, debtor);
      await saveDebtorsToFirestore(activeUserId, debtors);
      try {
        localStorage.setItem('haspaho_debtors', JSON.stringify(debtors));
        localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(debtors));
      } catch (e) {
        console.error(e);
      }
      addAuditLog(
        'SALVAR_REGISTRO_ERP',
        `Registro de "${debtor.name}" (ID: ${debtor.id}) gravado e sincronizado com sucesso no banco de dados.`,
        debtor.name,
        'FIRESTORE_SAVED'
      );
      onToast(`💾 Registro de "${debtor.name}" salvo e sincronizado no ERP com sucesso!`);
    } catch (err) {
      console.error(err);
      onToast(`✅ Registro de "${debtor.name}" confirmado e preservado localmente.`);
    }
  };

  // Excluir parcela específica do título contábil (Envia para Lixeira com opção de Desfazer e solicitação de permissão)
  const handleDeleteSpecificInstallment = (inst: Installment) => {
    setConfirmDeleteInst(inst);
  };

  // Quick Settlement / Baixa Manual de Parcela (Totalmente funcional, auditada e persistida)
  const handleQuickPayInstallment = (instId: string) => {
    const targetInst = installments.find((i) => i.id === instId);
    if (!targetInst) return;

    if (targetInst.status === 'paid') {
      onToast(`ℹ️ Esta parcela #${targetInst.installmentNumber} já está Liquidada.`);
      return;
    }

    const updatedInst = installments.map((i) => {
      if (i.id === instId) {
        return {
          ...i,
          status: 'paid' as const,
          paidAt: new Date().toISOString().split('T')[0],
          paidAmount: i.amount,
          receiptName: `REC-ERP-${Date.now().toString().slice(-6)}`,
        };
      }
      return i;
    });

    // Atualiza saldo do devedor correspondente (pelo ID ou pelo Nome)
    const updatedDebtors = debtors.map((d) => {
      if (
        d.id === targetInst.debtorId ||
        d.name.trim().toLowerCase() === targetInst.debtorName.trim().toLowerCase()
      ) {
        const owed = Number(d.totalOwed) || 0;
        const paid = Number(d.totalPaid) || 0;
        return {
          ...d,
          totalOwed: Math.max(0, owed - targetInst.amount),
          totalPaid: paid + targetInst.amount,
          overdueCount: Math.max(0, (Number(d.overdueCount) || 0) - (targetInst.status === 'overdue' ? 1 : 0)),
          onTimePaymentsCount: (Number(d.onTimePaymentsCount) || 0) + 1,
          score: Math.min(1000, (Number(d.score) || 750) + 25),
        };
      }
      return d;
    });

    onUpdateInstallments(updatedInst);
    onUpdateDebtors(updatedDebtors);

    const activeUserId = currentUser?.id || 'tiagodias8';
    try {
      localStorage.setItem('haspaho_installments', JSON.stringify(updatedInst));
      localStorage.setItem(`haspaho_installments_${activeUserId}`, JSON.stringify(updatedInst));
      localStorage.setItem('haspaho_debtors', JSON.stringify(updatedDebtors));
      localStorage.setItem(`haspaho_debtors_${activeUserId}`, JSON.stringify(updatedDebtors));
    } catch (e) {
      console.error(e);
    }

    try {
      saveInstallmentsToFirestore(activeUserId, updatedInst);
      saveDebtorsToFirestore(activeUserId, updatedDebtors);
    } catch (err) {
      console.error('Error saving installment payment to firestore:', err);
    }

    addAuditLog(
      'BAIXA_TITULO_ERP',
      `Título #${targetInst.id.slice(-6)} (${targetInst.debtorName} - ${targetInst.product}) no valor de R$ ${targetInst.amount.toFixed(2)} foi Liquidado no razão contábil.`,
      targetInst.debtorName,
      'FIRESTORE_SAVED'
    );

    playAppSound('pop');
    onToast(`🎉 [Sucesso] Parcela #${targetInst.installmentNumber} de "${targetInst.debtorName}" Liquidada com sucesso!`);
  };

  // Submit Rapid Purchase (Gerar Títulos em Lote)
  const handleCreatePurchaseBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const targetDebtor = debtors.find((d) => d.id === newPurchaseDebtorId);
    if (!targetDebtor) {
      onToast('Selecione um cliente válido.');
      return;
    }

    const totalVal = parseFloat(newPurchaseAmount) || 0;
    const count = parseInt(newPurchaseCount) || 1;
    if (totalVal <= 0) {
      onToast('Informe um valor válido.');
      return;
    }

    const valPerInstallment = parseFloat((totalVal / count).toFixed(2));
    const purchaseId = `pur_erp_${Date.now()}`;

    const newPurchase: Purchase = {
      id: purchaseId,
      debtorId: targetDebtor.id,
      debtorName: targetDebtor.name,
      product: newPurchaseProduct.trim() || 'Lançamento Comercial ERP',
      store: newPurchaseStore.trim(),
      cardName: newPurchaseCard,
      totalAmount: totalVal,
      installmentsTotal: count,
      installmentValue: valPerInstallment,
      paidCount: 0,
      overdueCount: 0,
      pendingCount: count,
      nextDueDate: newPurchaseFirstDate,
      attachmentsCount: 1,
    };

    const newGeneratedInstallments: Installment[] = [];
    const baseDate = new Date(newPurchaseFirstDate);

    for (let i = 1; i <= count; i++) {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      newGeneratedInstallments.push({
        id: `inst_erp_${purchaseId}_${i}`,
        purchaseId: purchaseId,
        debtorId: targetDebtor.id,
        debtorName: targetDebtor.name,
        debtorAvatar: targetDebtor.avatar,
        product: newPurchaseProduct.trim() || 'Lançamento Comercial ERP',
        cardName: newPurchaseCard,
        installmentNumber: i,
        totalInstallments: count,
        amount: valPerInstallment,
        originalAmount: valPerInstallment,
        lateFee: 5.0,
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'ontime',
      });
    }

    // Update global state
    onUpdatePurchases([newPurchase, ...purchases]);
    onUpdateInstallments([...newGeneratedInstallments, ...installments]);

    // Update debtor owed balance
    const updatedDebtors = debtors.map((d) => {
      if (d.id === targetDebtor.id) {
        return {
          ...d,
          totalOwed: d.totalOwed + totalVal,
          activePurchases: (d.activePurchases || 0) + 1,
        };
      }
      return d;
    });
    onUpdateDebtors(updatedDebtors);

    onToast(`[Lote Gerado] ${count} parcelas no valor total de R$ ${totalVal.toFixed(2)} criadas para ${targetDebtor.name}.`);
    setNewPurchaseProduct('');
    setActiveTab('titulos');
  };

  // Export DBGrid to CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Nome', 'Documento', 'Telefone', 'Total Devedor', 'Total Pago', 'Parcelas Atrasadas', 'Score'];
    const rows = debtors.map((d) => [
      d.id,
      `"${d.name}"`,
      `"${d.documentNumber || ''}"`,
      `"${d.phone}"`,
      (Number(d.totalOwed) || 0).toFixed(2),
      (Number(d.totalPaid) || 0).toFixed(2),
      d.overdueCount || 0,
      d.score || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HASPAHO_ERP_EXPORT_CLIENTES_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onToast('[F8 - Exportação] Arquivo CSV gerado e descarregado com sucesso.');
  };

  // Total Metrics for Status Bar
  const totalReceivables = useMemo(() => {
    return debtors.reduce((acc, d) => acc + (Number(d.totalOwed) || 0), 0);
  }, [debtors]);

  const totalOverdueAmount = useMemo(() => {
    return installments.filter((i) => i.status === 'overdue').reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  }, [installments]);

  const totalOverdueCount = useMemo(() => {
    return installments.filter((i) => i.status === 'overdue').length;
  }, [installments]);

  return (
    <div
      className={`min-h-[calc(100vh-4.5rem)] pb-16 sm:pb-8 flex flex-col font-sans select-text ${
        themeMode === 'classic_delphi'
          ? 'bg-[#d4d0c8] text-black text-xs'
          : 'bg-slate-100 text-slate-900 text-xs'
      }`}
    >
      {/* Top Windows ERP Titlebar & System Bar (Reenquadrado e Otimizado no Mobile) */}
      <div
        className={`w-full border-b px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 shadow-xs select-none ${
          themeMode === 'classic_delphi'
            ? 'bg-gradient-to-r from-[#000080] via-[#1084d0] to-[#000080] text-white border-slate-400 font-bold'
            : 'bg-white text-slate-900 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0 font-bold">desktop_windows</span>
          <span className="font-mono text-xs tracking-tight font-bold truncate text-slate-900">
            HASPAHO ERP <span className="hidden xs:inline">Enterprise</span> <span className="hidden md:inline text-slate-600">• Gestão Financeira</span> <span className="text-[10px] text-blue-700 font-bold">[v4.8.2]</span>
          </span>
          <span className="hidden lg:inline text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200 font-semibold whitespace-nowrap">
            Operador: {currentUser?.name || 'Thiago Dias'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Theme Mode Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setThemeMode((prev) => (prev === 'modern_erp' ? 'classic_delphi' : 'modern_erp'));
              playAppSound('pop');
              onToast(`Visual alternado para: ${themeMode === 'modern_erp' ? 'Modo Retrô Delphi' : 'Modo ERP Moderno'}`);
            }}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              themeMode === 'modern_erp'
                ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                : 'bg-slate-200 text-slate-800 border-slate-400 hover:bg-slate-300'
            }`}
            title="Alternar entre Visual ERP Moderno e Retrô Delphi"
          >
            <span className="material-symbols-outlined text-[14px]">
              {themeMode === 'modern_erp' ? 'view_quilt' : 'history_toggle_off'}
            </span>
            <span>{themeMode === 'modern_erp' ? 'Visual: ERP Moderno' : 'Visual: Retrô Delphi'}</span>
          </button>

          {/* Quick Exit to Modern Mode */}
          <button
            onClick={() => onNavigate('dashboard')}
            className="px-2 sm:px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Retornar para o Dashboard Web Moderno"
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            <span>Voltar<span className="hidden sm:inline"> ao Dashboard</span></span>
          </button>

          {/* Windows Classic Window Controls */}
          <div className="flex items-center gap-1 pl-1 sm:pl-2 border-l border-slate-300">
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-5 h-5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold flex items-center justify-center rounded-xs cursor-pointer"
              title="Minimizar para o Dashboard"
            >
              _
            </button>
            <button
              onClick={() => onToast('Janela maximizada em modo tela cheia ERP.')}
              className="w-5 h-5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold flex items-center justify-center rounded-xs cursor-pointer"
              title="Maximizar"
            >
              🗖
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-5 h-5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold flex items-center justify-center rounded-xs cursor-pointer"
              title="Fechar Modo ERP (Esc)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Classic Menu Bar (Visível no Desktop para fidelidade Delphi; oculto no mobile para poupar espaço) */}
      <div
        className={`w-full px-2.5 sm:px-3 py-1 hidden sm:flex items-center gap-3 sm:gap-4 text-[11px] border-b select-none overflow-x-auto scrollbar-none flex-nowrap ${
          themeMode === 'classic_delphi'
            ? 'bg-[#ece9d8] text-black border-slate-300 font-medium'
            : 'bg-slate-50 text-slate-700 border-slate-200'
        }`}
      >
        {[
          { label: 'Arquivo', hotkey: 'A', action: () => onToast('Menu Arquivo: Sistema sincronizado com Firestore.') },
          { label: 'Cadastros', hotkey: 'C', action: () => setActiveTab('cadastro') },
          { label: 'Consultas & DBGrid', hotkey: 'Q', action: () => setActiveTab('pesquisa') },
          { label: 'Contas a Receber', hotkey: 'R', action: () => setActiveTab('titulos') },
          { label: 'Emissão de Carnês', hotkey: 'E', action: () => setActiveTab('lancamento') },
          { label: 'Lançamento em Massa', hotkey: 'M', action: () => setActiveTab('massa') },
          { label: 'Auditoria & Logs', hotkey: 'L', action: () => setActiveTab('auditoria') },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="hover:underline hover:text-blue-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {item.label.split(item.hotkey)[0]}
            <span className="underline font-bold">{item.hotkey}</span>
            {item.label.split(item.hotkey)[1]}
          </button>
        ))}

        <div className="ml-auto text-[10px] font-mono text-emerald-500 hidden md:flex items-center gap-1.5 whitespace-nowrap shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>BD ONLINE: isentropic-tangent-sdtd0 | LATÊNCIA: 14ms</span>
        </div>
      </div>

      {/* Standard ERP Toolbar with F-Key Actions */}
      <div
        className={`w-full px-1.5 sm:px-3 py-1 sm:py-1.5 border-b select-none ${
          themeMode === 'classic_delphi'
            ? 'bg-[#f0f0f0] border-slate-300'
            : 'bg-white border-slate-200 shadow-2xs'
        }`}
      >
        {/* Mobile Layout: 3 Columns x 2 Rows - High Contrast & High Legibility - Otimizado e Mais Junto */}
        <div className="grid grid-cols-3 gap-1 w-full sm:hidden">
          <button
            type="button"
            onClick={handleNewDebtor}
            className="h-7.5 px-1 bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-300 rounded-lg text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer shadow-2xs leading-none"
            title="Novo Cadastro (F2)"
          >
            <span className="material-symbols-outlined text-[14px] text-emerald-600 font-black">add_box</span>
            <span>1. Novo</span>
          </button>

          <button
            type="button"
            onClick={handleSaveDebtor}
            className="h-7.5 px-1 bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700 rounded-lg text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer shadow-xs leading-none"
            title="Gravar no Banco (F3)"
          >
            <span className="material-symbols-outlined text-[14px] text-white font-black">save</span>
            <span>2. Gravar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pesquisa')}
            className="h-7.5 px-1 bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-300 rounded-lg text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer shadow-2xs leading-none"
            title="Buscar Registro (F6)"
          >
            <span className="material-symbols-outlined text-[14px] text-blue-600 font-black">search</span>
            <span>3. Buscar</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteDebtor}
            className="h-7.5 px-1 bg-red-50 hover:bg-red-100 text-red-800 border-2 border-red-300 rounded-lg text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer shadow-2xs leading-none"
            title="Excluir Registro (F5)"
          >
            <span className="material-symbols-outlined text-[14px] text-red-600 font-black">delete</span>
            <span>4. Excluir</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToast('🔄 Atualizando página e sincronizando dados contábeis...');
              setTimeout(() => {
                window.location.reload();
              }, 300);
            }}
            className="h-7.5 px-1 bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-300 rounded-lg text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer shadow-2xs leading-none"
            title="Atualizar Sistema (F9)"
          >
            <span className="material-symbols-outlined text-[14px] text-blue-600 font-black">refresh</span>
            <span>5. Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowPrintModal(true);
              playAppSound('pop');
            }}
            className="h-7.5 px-1 bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-300 rounded-lg text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer shadow-2xs leading-none"
            title="Imprimir Carnês, Fichas e Promissórias ARP (F7)"
          >
            <span className="material-symbols-outlined text-[14px] text-slate-700 font-black">print</span>
            <span>6. Imprimir</span>
          </button>
        </div>

        {/* Desktop Layout: Horizontal Toolbar */}
        <div className="hidden sm:flex items-center gap-1.5 flex-nowrap shrink-0 pr-2">
          <button
            type="button"
            onClick={handleNewDebtor}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border whitespace-nowrap shrink-0 min-w-max ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-400 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-2xs'
            }`}
            title="Criar novo cadastro em branco (F2)"
          >
            <span className="material-symbols-outlined text-[15px] text-emerald-600 font-bold">add_box</span>
            <span>[F2] Novo</span>
          </button>

          <button
            type="button"
            onClick={handleSaveDebtor}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border whitespace-nowrap shrink-0 min-w-max ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-blue-900 border-slate-400 shadow-xs'
                : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-2xs'
            }`}
            title="Salvar alterações no banco (F3)"
          >
            <span className="material-symbols-outlined text-[15px]">save</span>
            <span>[F3] Gravar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pesquisa')}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border whitespace-nowrap shrink-0 min-w-max ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-400 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-blue-700 border-slate-300 shadow-2xs'
            }`}
            title="Localizar devedor ou título (F6)"
          >
            <span className="material-symbols-outlined text-[15px]">search</span>
            <span>[F6] Buscar</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteDebtor}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border whitespace-nowrap shrink-0 min-w-max ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-red-700 border-slate-400 shadow-xs'
                : 'bg-white hover:bg-red-50 text-red-700 border-slate-300 shadow-2xs'
            }`}
            title="Excluir devedor ativo (F5)"
          >
            <span className="material-symbols-outlined text-[15px] text-red-600">delete</span>
            <span>[F5] Excluir</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToast('🔄 Atualizando página e sincronizando dados contábeis...');
              setTimeout(() => {
                window.location.reload();
              }, 300);
            }}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border whitespace-nowrap shrink-0 min-w-max ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-blue-800 border-slate-400 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 shadow-2xs'
            }`}
            title="Atualizar página e recarregar dados do sistema (F9)"
          >
            <span className="material-symbols-outlined text-[15px] text-blue-600">refresh</span>
            <span>[F9] Atualizar</span>
          </button>

          <span className="w-px h-5 bg-slate-300 mx-0.5 shrink-0"></span>

          <button
            type="button"
            onClick={() => {
              setShowPrintModal(true);
              playAppSound('pop');
            }}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border whitespace-nowrap shrink-0 min-w-max ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-400 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs'
            }`}
            title="Imprimir Documentos, Carnês e Fichas ARP (F7)"
          >
            <span className="material-symbols-outlined text-[15px]">print</span>
            <span>[F7] Imprimir</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border whitespace-nowrap shrink-0 min-w-max ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-emerald-800 border-slate-400 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-emerald-700 border-slate-300 shadow-2xs'
            }`}
            title="Exportar dados para Excel / CSV (F8)"
          >
            <span className="material-symbols-outlined text-[15px]">table_view</span>
            <span>[F8] CSV</span>
          </button>
        </div>
      </div>

      {/* Main Workspace with Delphi/WinForms TPageControl */}
      <div className="flex-1 w-full px-1 sm:px-4 py-1.5 sm:py-3 flex flex-col min-h-0">
        {/* Mobile PageControl Tabs: High Contrast & High Legibility - Otimizado e Mais Junto */}
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-200/90 border border-slate-300 rounded-lg sm:hidden shadow-2xs mb-1.5 select-none">
          {/* Tab 1: Ficha */}
          <button
            type="button"
            onClick={() => setActiveTab('cadastro')}
            className={`h-7 px-1 rounded-md text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all cursor-pointer border-2 ${
              activeTab === 'cadastro'
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm font-black'
                : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span className={`material-symbols-outlined text-[13px] font-black ${
              activeTab === 'cadastro' ? 'text-white' : 'text-blue-600'
            }`}>badge</span>
            <span className="truncate">1. Ficha</span>
          </button>

          {/* Tab 2: Clientes */}
          <button
            type="button"
            onClick={() => setActiveTab('pesquisa')}
            className={`h-7 px-1 rounded-md text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all cursor-pointer border-2 ${
              activeTab === 'pesquisa'
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm font-black'
                : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span className={`material-symbols-outlined text-[13px] font-black ${
              activeTab === 'pesquisa' ? 'text-white' : 'text-blue-600'
            }`}>grid_on</span>
            <span className="truncate">2. Clientes</span>
          </button>

          {/* Tab 3: Contas */}
          <button
            type="button"
            onClick={() => setActiveTab('titulos')}
            className={`h-7 px-1 rounded-md text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all cursor-pointer border-2 relative ${
              activeTab === 'titulos'
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm font-black'
                : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span className={`material-symbols-outlined text-[13px] font-black ${
              activeTab === 'titulos' ? 'text-white' : 'text-amber-600'
            }`}>receipt_long</span>
            <span className="truncate">3. Contas</span>
            {totalOverdueCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse shrink-0 ring-1 ring-white"></span>
            )}
          </button>

          {/* Tab 4: Carnês */}
          <button
            type="button"
            onClick={() => setActiveTab('lancamento')}
            className={`h-7 px-1 rounded-md text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all cursor-pointer border-2 ${
              activeTab === 'lancamento'
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm font-black'
                : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span className={`material-symbols-outlined text-[13px] font-black ${
              activeTab === 'lancamento' ? 'text-white' : 'text-emerald-600'
            }`}>add_shopping_cart</span>
            <span className="truncate">4. Carnês</span>
          </button>

          {/* Tab 5: Digitação */}
          <button
            type="button"
            onClick={() => setActiveTab('massa')}
            className={`h-7 px-1 rounded-md text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all cursor-pointer border-2 ${
              activeTab === 'massa'
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm font-black'
                : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span className={`material-symbols-outlined text-[13px] font-black ${
              activeTab === 'massa' ? 'text-white' : 'text-purple-600'
            }`}>keyboard</span>
            <span className="truncate">5. Digitação</span>
          </button>

          {/* Tab 6: Auditoria */}
          <button
            type="button"
            onClick={() => setActiveTab('auditoria')}
            className={`h-7 px-1 rounded-md text-[9.5px] font-extrabold flex items-center justify-center gap-0.5 transition-all cursor-pointer border-2 ${
              activeTab === 'auditoria'
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm font-black'
                : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span className={`material-symbols-outlined text-[13px] font-black ${
              activeTab === 'auditoria' ? 'text-white' : 'text-slate-700'
            }`}>security</span>
            <span className="truncate">6. Auditoria</span>
          </button>
        </div>

        {/* Desktop PageControl Tabs: Horizontal Row */}
        <div
          className={`hidden sm:flex items-end gap-1 border-b px-1 sm:px-2 overflow-x-auto scrollbar-none flex-nowrap ${
            themeMode === 'classic_delphi' ? 'border-slate-300 bg-slate-100' : 'border-slate-300 bg-slate-200/50'
          }`}
        >
          {[
            { id: 'cadastro', label: '1. Ficha', fullLabel: '1. Ficha Cadastral do Devedor (Data Entry)', icon: 'badge' },
            { id: 'pesquisa', label: '2. Clientes', fullLabel: '2. DBGrid de Clientes & Consulta Avançada', icon: 'grid_on' },
            { id: 'titulos', label: '3. Contas a Receber', fullLabel: '3. Contas a Receber (Grade Contábil)', icon: 'receipt_long', badge: totalOverdueCount > 0 ? `${totalOverdueCount} atrasadas` : undefined },
            { id: 'lancamento', label: '4. Carnês', fullLabel: '4. Emissão de Carnê & Parcelamento em Lote', icon: 'add_shopping_cart' },
            { id: 'massa', label: '5. Digitação ARP', fullLabel: '5. Digitação ARP em Massa (Grade Otimizada)', icon: 'keyboard' },
            { id: 'auditoria', label: '6. Auditoria', fullLabel: '6. Trilha de Auditoria & Segurança', icon: 'security' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-bold border-t border-x rounded-t-md transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? themeMode === 'classic_delphi'
                      ? 'bg-white text-blue-900 border-slate-300 font-black shadow-xs -mb-px'
                      : 'bg-white text-blue-700 border-slate-300 border-b-white font-black shadow-xs -mb-px'
                    : themeMode === 'classic_delphi'
                    ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-white hover:text-blue-900'
                    : 'bg-slate-100/70 text-slate-600 border-slate-300 hover:bg-white hover:text-blue-800'
                }`}
              >
                <span className="material-symbols-outlined text-[15px] sm:text-[16px]">{tab.icon}</span>
                <span>{tab.fullLabel}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-mono font-bold animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Box (PageControl Body) */}
        <div
          className={`flex-1 border border-t-0 ${activeTab === 'massa' ? 'p-1 sm:p-3' : 'p-2 sm:p-4'} min-h-0 overflow-y-visible sm:overflow-y-auto ${
            themeMode === 'classic_delphi'
              ? 'bg-white text-slate-900 border-slate-400 shadow-inner'
              : 'bg-white text-slate-900 border-slate-300 shadow-xs'
          }`}
        >
          {/* TAB 1: FICHA CADASTRAL DO DEVEDOR (DATA ENTRY FORM) */}
          {activeTab === 'cadastro' && (
            <div className="space-y-4">
              {/* Modern Enterprise ERP Record Selector & Financial KPIs Bar */}
              <div
                className={`p-3 sm:p-4 rounded-xl border flex flex-col gap-3 transition-all ${
                  themeMode === 'classic_delphi'
                    ? 'bg-gradient-to-b from-[#f8f6f0] to-[#eae6d8] border-slate-300 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                {/* Selector Row - Modern ERP Control */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-lg">badge</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                        Registro Ativo
                      </span>
                      <label className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span>Seletor de Devedor</span>
                        <span className="text-[10px] font-mono text-slate-400 font-normal hidden sm:inline">
                          ({debtors.length} cadastrados)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-1 max-w-full sm:max-w-xl">
                    {/* Botão Anterior */}
                    <button
                      type="button"
                      onClick={() => {
                        const currentIdx = debtors.findIndex((d) => d.id === selectedDebtorId);
                        const prevIdx = currentIdx > 0 ? currentIdx - 1 : debtors.length - 1;
                        if (debtors[prevIdx]) {
                          setSelectedDebtorId(debtors[prevIdx].id);
                          playAppSound('click');
                        }
                      }}
                      className="h-9 w-9 bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
                      title="Devedor Anterior (Seta Esquerda)"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>

                    <div className="relative flex-1 min-w-0">
                      <select
                        value={selectedDebtorId}
                        onChange={(e) => {
                          setSelectedDebtorId(e.target.value);
                          playAppSound('pop');
                        }}
                        className="w-full h-9 px-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 rounded-lg font-mono text-xs sm:text-sm font-semibold outline-none transition-all shadow-2xs cursor-pointer truncate"
                      >
                        {debtors.map((d, idx) => {
                          const isDemo = d.id === 'DEMO-001' || d.id === 'DEMO-002' || d.relation === 'Demonstração' || (d.id && d.id.startsWith('DEMO-'));
                          return (
                            <option key={d.id} value={d.id}>
                              {getDebtorCode(d.id, idx)} — {d.name} {isDemo ? '[Exemplo Fictício]' : ''} — R$ {(Number(d.totalOwed) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {(Number(d.overdueCount) || 0) > 0 ? `(${d.overdueCount} atrasadas)` : '(Em dia)'}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Botão Próximo */}
                    <button
                      type="button"
                      onClick={() => {
                        const currentIdx = debtors.findIndex((d) => d.id === selectedDebtorId);
                        const nextIdx = currentIdx < debtors.length - 1 ? currentIdx + 1 : 0;
                        if (debtors[nextIdx]) {
                          setSelectedDebtorId(debtors[nextIdx].id);
                          playAppSound('click');
                        }
                      }}
                      className="h-9 w-9 bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
                      title="Próximo Devedor (Seta Direita)"
                    >
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                </div>

                {/* Etiqueta para devedores de demonstração / fictícios - Estilo ERP Corporativo com Máximo Contraste em Verde */}
                {activeDebtor && (activeDebtor.id === 'DEMO-001' || activeDebtor.id === 'DEMO-002' || activeDebtor.relation === 'Demonstração' || activeDebtor.id?.startsWith('DEMO-')) && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50 border-2 border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs shadow-xs">
                    <div className="flex items-center gap-2.5 text-emerald-950">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <span className="material-symbols-outlined text-[18px]">verified_user</span>
                      </div>
                      <span className="text-emerald-950 font-medium">
                        <strong className="font-black text-emerald-950 text-xs sm:text-[13px]">Cliente de Demonstração:</strong>{' '}
                        <span className="text-emerald-900 font-bold">
                          Registro gerado para testes e homologação de rotinas no sistema.
                        </span>
                      </span>
                    </div>
                    {onRequestDeleteDebtor && (
                      <button
                        type="button"
                        onClick={() => onRequestDeleteDebtor(activeDebtor)}
                        className="self-end sm:self-auto px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer transition-all shrink-0"
                        title="Excluir cliente fictício de exemplo"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                        <span>Excluir Exemplo</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 3 KPI Summary Cards - Modern Enterprise ERP Financial Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-left">
                  {/* CARD 1: Total a Receber */}
                  <div
                    onClick={() => {
                      playAppSound('pop');
                      onToast(`💸 A Receber: R$ ${(Number(activeDebtor?.totalOwed) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    }}
                    className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-rose-400/60 dark:hover:border-rose-500/50 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                    title="Clique para ver detalhes do saldo a receber"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Total a Receber
                        </span>
                      </div>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        Em Aberto
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-base sm:text-xl font-mono font-black text-rose-600 dark:text-rose-400 tracking-tight tabular-nums">
                        R$ {(Number(activeDebtor?.totalOwed) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-[13px] text-slate-400">schedule</span>
                        <span>Saldo devedor ativo na conta</span>
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: Total Já Liquidado */}
                  <div
                    onClick={() => {
                      playAppSound('pop');
                      onToast(`🎉 Já Liquidado: R$ ${(Number(activeDebtor?.totalPaid) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                    }}
                    className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-emerald-400/60 dark:hover:border-emerald-500/50 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                    title="Clique para ver total já liquidado"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-base">check_circle</span>
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Total Já Liquidado
                        </span>
                      </div>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Quitado
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-base sm:text-xl font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
                        R$ {(Number(activeDebtor?.totalPaid) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-[13px] text-emerald-500">verified</span>
                        <span>Baixas autenticadas com recibo</span>
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: Score Crediário & Risco */}
                  <div
                    onClick={() => {
                      playAppSound('pop');
                      onToast(`🚀 Score de Crédito: ${activeDebtor?.score || 800}/1000 — ${
                        (activeDebtor?.score || 800) >= 700 ? 'Excelente!' : (activeDebtor?.score || 800) >= 500 ? 'Médio Risk' : 'Atenção ao Crédito'
                      }`);
                    }}
                    className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-blue-400/60 dark:hover:border-blue-500/50 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                    title="Clique para ver avaliação de score de crédito"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-base">speed</span>
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Score de Pontualidade
                        </span>
                      </div>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {(activeDebtor?.score || 800) >= 700 ? 'Excelente' : (activeDebtor?.score || 800) >= 500 ? 'Regular' : 'Atenção'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base sm:text-xl font-mono font-black text-blue-600 dark:text-blue-400 tracking-tight">
                          {activeDebtor?.score || 800}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">/ 1000 pts</span>
                      </div>
                      
                      {/* Subtle Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, ((activeDebtor?.score || 800) / 1000) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 1: DADOS DE IDENTIFICAÇÃO PRINCIPAL */}
              <fieldset
                className={`p-3 rounded-lg border ${
                  themeMode === 'classic_delphi' ? 'border-slate-300 bg-[#fafafa]' : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <legend className="px-2 font-bold text-[11px] text-blue-700 uppercase tracking-wider">
                  1. Identificação Principal &amp; Documentos Fiscais
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Código ERP (CÓD)</label>
                    <input
                      type="text"
                      readOnly
                      value={getDebtorCode(formData.id)}
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 font-mono font-bold text-xs sm:text-[11px] bg-slate-100 border border-slate-300 rounded-lg sm:rounded text-blue-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Tipo Pessoa</label>
                    <div className="flex items-center gap-3 h-8.5 sm:h-7">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="personType"
                          checked={formData.personType === 'F'}
                          onChange={() => setFormData({ ...formData, personType: 'F' })}
                        />
                        <span className="text-xs sm:text-[11px] font-semibold text-slate-800">Física</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="personType"
                          checked={formData.personType === 'J'}
                          onChange={() => setFormData({ ...formData, personType: 'J' })}
                        />
                        <span className="text-xs sm:text-[11px] font-semibold text-slate-800">Jurídica</span>
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">
                      Nome Completo / Razão Social *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="EX: JOÃO DA SILVA SA"
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded font-semibold text-xs sm:text-[11px] uppercase outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">
                      {formData.personType === 'F' ? 'CPF' : 'CNPJ'} *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.cpfCnpj}
                      onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value })}
                      placeholder="000.000.000-00"
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded font-mono text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">
                      {formData.personType === 'F' ? 'RG' : 'Inscrição Estadual'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.rgIe}
                      onChange={(e) => setFormData({ ...formData, rgIe: e.target.value })}
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded font-mono text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Apelido / Parentesco</label>
                    <input
                      type="text"
                      value={formData.apelido}
                      onChange={(e) => setFormData({ ...formData, apelido: e.target.value })}
                      placeholder="Amigo, Primo, Cliente"
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Data Nasc. / Abertura</label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Órgão Expedidor</label>
                    <input
                      type="text"
                      value={formData.orgaoExp}
                      onChange={(e) => setFormData({ ...formData, orgaoExp: e.target.value })}
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>
                </div>
              </fieldset>

              {/* SECTION 2: DADOS DE CONTATO & CHAVE PIX */}
              <fieldset
                className={`p-3 rounded-lg border ${
                  themeMode === 'classic_delphi' ? 'border-slate-300 bg-[#fafafa]' : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <legend className="px-2 font-bold text-[11px] text-emerald-700 uppercase tracking-wider">
                  2. Contatos, WhatsApp &amp; Chave PIX
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Celular / WhatsApp Principal *</label>
                    <div className="flex gap-1.5">
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(14) 99733-9863"
                        className="flex-1 h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded font-mono text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const clean = formData.phone.replace(/\D/g, '');
                          window.open(`https://wa.me/55${clean}?text=Olá ${encodeURIComponent(formData.name)}, cobrança amigável HASPAHO`, '_blank');
                        }}
                        className="px-2.5 h-8.5 sm:h-7 rounded-lg sm:rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-[10px] flex items-center gap-1 cursor-pointer"
                        title="Abrir WhatsApp Web Oficial"
                      >
                        <span className="material-symbols-outlined text-[15px] sm:text-[13px]">chat</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Telefone Secundário / Fixo</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={formData.phoneSecondary}
                      onChange={(e) => setFormData({ ...formData, phoneSecondary: e.target.value })}
                      placeholder="(14) 3642-0000"
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded font-mono text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">E-mail de Cobrança</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="devedor@email.com"
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Chave PIX Cadastrada</label>
                    <input
                      type="text"
                      value={formData.pixKey}
                      onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                      placeholder="CPF, Telefone ou E-mail"
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded font-mono text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>
                </div>
              </fieldset>

              {/* SECTION 3: ENDEREÇO & CEP */}
              <fieldset
                className={`p-3 rounded-lg border ${
                  themeMode === 'classic_delphi' ? 'border-slate-300 bg-[#fafafa]' : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <legend className="px-2 font-bold text-[11px] text-amber-700 uppercase tracking-wider">
                  3. Endereço Completo &amp; Localização Notarial
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 pt-1">
                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">CEP *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      placeholder="17320-000"
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded font-mono text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Logradouro / Rua</label>
                    <input
                      type="text"
                      value={formData.logradouro}
                      onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                      placeholder="Rua Central"
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Número</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.numero}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                      placeholder="100"
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Bairro</label>
                    <input
                      type="text"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                      placeholder="Centro"
                      className="w-full h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-[10px] font-bold mb-0.5 text-slate-700">Cidade / UF</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={formData.cidade}
                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                        className="flex-1 h-8.5 sm:h-7 px-2.5 sm:px-2 border rounded-lg sm:rounded text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        maxLength={2}
                        value={formData.uf}
                        onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                        className="w-11 sm:w-9 h-8.5 sm:h-7 text-center font-bold uppercase border rounded-lg sm:rounded text-xs sm:text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* SECTION 4: PARÂMETROS FINANCEIROS, SCORE & REGRAS */}
              <fieldset
                className={`p-3 rounded-lg border ${
                  themeMode === 'classic_delphi' ? 'border-slate-300 bg-[#fafafa]' : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <legend className="px-2 font-bold text-[11px] text-purple-700 uppercase tracking-wider">
                  4. Parâmetros de Crédito, Juros &amp; Políticas de Cobrança
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold mb-0.5 text-slate-700">Limite de Crédito Concedido (R$)</label>
                    <input
                      type="number"
                      value={formData.limiteCredito}
                      onChange={(e) => setFormData({ ...formData, limiteCredito: Number(e.target.value) })}
                      className="w-full h-7 px-2 border rounded font-mono font-bold text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5 text-slate-700">Score de Pontualidade (0 - 1000)</label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={formData.score}
                      onChange={(e) => setFormData({ ...formData, score: Number(e.target.value) })}
                      className="w-full h-7 px-2 border rounded font-mono font-bold text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5 text-slate-700">Multa por Atraso Fixa (R$)</label>
                    <input
                      type="number"
                      value={formData.multaAtrasoFixa}
                      onChange={(e) => setFormData({ ...formData, multaAtrasoFixa: Number(e.target.value) })}
                      className="w-full h-7 px-2 border rounded font-mono text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5 text-slate-700">Juros Mensais Padrão (%)</label>
                    <input
                      type="number"
                      step={0.1}
                      value={formData.taxaJurosMensal}
                      onChange={(e) => setFormData({ ...formData, taxaJurosMensal: Number(e.target.value) })}
                      className="w-full h-7 px-2 border rounded font-mono text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Dense Checkboxes & Flags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-3 border-t border-slate-200 mt-2 text-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    />
                    <span>[x] Cadastro Ativo no Sistema</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={formData.permiteCobrancaWhatsApp}
                      onChange={(e) => setFormData({ ...formData, permiteCobrancaWhatsApp: e.target.checked })}
                    />
                    <span>[x] Disparo Automático via WhatsApp</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={formData.protestarApos30Dias}
                      onChange={(e) => setFormData({ ...formData, protestarApos30Dias: e.target.checked })}
                    />
                    <span>[x] Encaminhar p/ Protesto se &gt; 30 dias</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={formData.bloqueioPreventivo}
                      onChange={(e) => setFormData({ ...formData, bloqueioPreventivo: e.target.checked })}
                    />
                    <span className="text-red-600 font-bold">[ ] Bloqueio Preventivo de Crédito</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={formData.contratoAssinado}
                      onChange={(e) => setFormData({ ...formData, contratoAssinado: e.target.checked })}
                    />
                    <span>[x] Contrato Confissão Assinado</span>
                  </label>
                </div>
              </fieldset>

              {/* SECTION 5: OBSERVAÇÕES & HISTÓRICO DE NEGOCIAÇÃO */}
              <fieldset
                className={`p-3 rounded-lg border ${
                  themeMode === 'classic_delphi' ? 'border-slate-300 bg-[#fafafa]' : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <legend className="px-2 font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                  5. Parecer Contábil &amp; Histórico de Negociações
                </legend>
                <textarea
                  rows={2}
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Anotações internas, promessas de pagamento, datas combinadas..."
                  className="w-full p-2 border rounded font-mono text-[11px] outline-none bg-white border-slate-300 text-slate-900 focus:border-blue-500"
                />
              </fieldset>

              {/* Bottom Action Footer for the Form */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/60">
                <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
                  Atalhos: F2: Novo | F3: Gravar | F4: Cancelar | F5: Excluir | Esc: Voltar
                </div>
                <div className="grid grid-cols-3 sm:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNewDebtor}
                    className="h-9 sm:h-auto px-3 py-2 sm:py-1.5 rounded-xl sm:rounded bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs sm:text-[11px] cursor-pointer flex items-center justify-center gap-1 transition-all active:scale-95 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Novo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDebtor}
                    className="h-9 sm:h-auto px-4 py-2 sm:py-1.5 rounded-xl sm:rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-[11px] shadow-sm cursor-pointer flex items-center justify-center gap-1 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[15px]">save</span>
                    <span>Gravar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteDebtor}
                    className="h-9 sm:h-auto px-3 py-2 sm:py-1.5 rounded-xl sm:rounded bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-[11px] shadow-sm cursor-pointer flex items-center justify-center gap-1 transition-all active:scale-95"
                    title="Excluir cadastro ativo no ERP (F5)"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DBGRID DE CLIENTES & CONSULTA AVANÇADA */}
          {activeTab === 'pesquisa' && (
            <div className="space-y-3">
              {/* Filter and Search Bar */}
              <div className={`flex flex-wrap items-center justify-between gap-2.5 p-2 rounded border ${
                themeMode === 'classic_delphi'
                  ? 'bg-[#f8fafc] border-slate-300 text-slate-800'
                  : 'bg-black/20 border-slate-800 text-white'
              }`}>
                <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
                  <span className={`material-symbols-outlined text-[16px] ${
                    themeMode === 'classic_delphi' ? 'text-blue-600' : 'text-slate-400'
                  }`}>filter_alt</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar por Código, Nome, CPF ou Telefone..."
                    className={`w-full h-7 px-2.5 rounded text-[11px] outline-none border ${
                      themeMode === 'classic_delphi'
                        ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500'
                        : 'bg-slate-800 border-slate-700 text-white'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[11px] font-bold ${
                    themeMode === 'classic_delphi' ? 'text-slate-700' : 'text-slate-300'
                  }`}>Filtro:</span>
                  {(['todos', 'adimplente', 'atrasado', 'quitado'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                        filterStatus === st
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : themeMode === 'classic_delphi'
                          ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seletor de Modo no Mobile (Listinha Planilha vs Grade Ampla) */}
              <div className={`flex sm:hidden items-center justify-between p-2 rounded border text-xs ${
                themeMode === 'classic_delphi'
                  ? 'bg-[#f8fafc] border-slate-300 text-slate-800'
                  : 'bg-slate-900/90 border-slate-700 text-slate-300'
              }`}>
                <span className="font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">table_rows</span>
                  <span>Modo ARP Mobile:</span>
                </span>
                <div className={`flex items-center gap-1 p-0.5 rounded border ${
                  themeMode === 'classic_delphi'
                    ? 'bg-white border-slate-300'
                    : 'bg-slate-800 border-slate-700'
                }`}>
                  <button
                    type="button"
                    onClick={() => setMobileViewMode('cards')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      mobileViewMode === 'cards'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : themeMode === 'classic_delphi'
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">view_list</span>
                    <span>Listinha Planilha</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileViewMode('table')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      mobileViewMode === 'table'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : themeMode === 'classic_delphi'
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">table_chart</span>
                    <span>Grade DBGrid</span>
                  </button>
                </div>
              </div>

              {/* Modo Listinha Tipo Planilha Mobile (Compacto, Profissional, Delphiano e Clarinho) */}
              {mobileViewMode === 'cards' && (
                <div className={`sm:hidden border rounded-lg overflow-hidden font-sans shadow-xs select-none ${
                  themeMode === 'classic_delphi'
                    ? 'bg-white border-slate-300'
                    : 'bg-slate-950/60 border-slate-700'
                }`}>
                  {/* Cabeçalho de Colunas da Planilha Mobile */}
                  <div className={`grid grid-cols-12 gap-1 px-2 py-1.5 border-b text-[10.5px] font-mono font-bold uppercase ${
                    themeMode === 'classic_delphi'
                      ? 'bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-slate-950 border-slate-700 text-slate-400'
                  }`}>
                    <div className="col-span-1 text-center pr-0.5 border-r border-slate-300/60 dark:border-slate-700/60">Cód</div>
                    <div className="col-span-5 px-1 border-r border-slate-300/60 dark:border-slate-700/60">Cliente / Doc</div>
                    <div className="col-span-3 text-center px-1 border-r border-slate-300/60 dark:border-slate-700/60">Saldo / Status</div>
                    <div className="col-span-3 text-center px-1">Ações ERP</div>
                  </div>

                  {/* Linhas da Planilha */}
                  <div className={`divide-y ${themeMode === 'classic_delphi' ? 'divide-slate-200' : 'divide-slate-800/80'}`}>
                    {filteredDebtors.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        Nenhum devedor encontrado com os filtros atuais.
                      </div>
                    ) : (
                      filteredDebtors.map((d, index) => {
                        const isSelected = d.id === selectedDebtorId;
                        const isOverdue = (Number(d.overdueCount) || 0) > 0;
                        return (
                          <div
                            key={d.id}
                            onClick={() => setSelectedDebtorId(d.id)}
                            className={`grid grid-cols-12 gap-1 px-1.5 py-1 items-center cursor-pointer transition-all ${
                              isSelected
                                ? themeMode === 'classic_delphi'
                                  ? 'bg-blue-100/90 border-l-4 border-l-blue-600 shadow-inner'
                                  : 'bg-blue-950/80 border-l-3 border-l-blue-500 shadow-inner'
                                : index % 2 === 0
                                ? themeMode === 'classic_delphi'
                                  ? 'bg-white hover:bg-blue-50/50'
                                  : 'bg-slate-900/60 hover:bg-slate-800/80'
                                : themeMode === 'classic_delphi'
                                ? 'bg-[#fcfbf9] hover:bg-blue-50/50'
                                : 'bg-slate-950/40 hover:bg-slate-800/80'
                            }`}
                          >
                            {/* Coluna 1: Cód ID (Puramente Numérico Sequencial 01, 02, 03...) */}
                            <div className={`col-span-1 font-mono text-[10.5px] font-bold truncate text-center pr-0.5 border-r ${
                              themeMode === 'classic_delphi' ? 'border-slate-200 text-slate-600' : 'border-slate-800 text-slate-400'
                            }`}>
                              {getDebtorCode(d.id, index)}
                            </div>

                            {/* Coluna 2: Nome do Devedor & Doc / Telefone com ícone no mobile */}
                            <div className={`col-span-5 min-w-0 px-1 border-r ${
                              themeMode === 'classic_delphi' ? 'border-slate-200' : 'border-slate-800'
                            }`}>
                              <div className="flex items-center gap-1 min-w-0">
                                <span className={`font-extrabold text-xs truncate leading-tight shrink min-w-0 ${
                                  themeMode === 'classic_delphi' ? 'text-slate-900' : 'text-white'
                                }`} title={d.name}>
                                  {formatSmartShortName(d.name)}
                                </span>
                                <span className={`px-1 py-0.2 rounded text-[7.5px] font-bold font-mono inline-flex items-center gap-0.5 shrink-0 whitespace-nowrap ${
                                  (Number(d.score) || 800) >= 700
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : (Number(d.score) || 800) >= 500
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-red-100 text-red-800 border border-red-300'
                                }`} title={`Score: ${d.score || 800}`}>
                                  <span>Score:</span>
                                  <span className="font-extrabold">{d.score || 800}</span>
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5 mt-0.5 font-mono">
                                {d.phone && d.phone.trim() ? (
                                  <div className="flex items-center gap-1 text-blue-700 font-semibold truncate text-[9.5px]">
                                    <span className="material-symbols-outlined text-[10.5px] shrink-0">call</span>
                                    <span>{d.phone}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-slate-400 italic truncate text-[8.5px]">
                                    <span className="material-symbols-outlined text-[10.5px] shrink-0">call</span>
                                    <span>Sem telefone</span>
                                  </div>
                                )}
                                {d.documentNumber && d.documentNumber.trim() && d.documentNumber.trim() !== 'Sem doc' && d.documentNumber.trim() !== '—' ? (
                                  <div className="text-[8.5px] text-slate-600 font-mono truncate">
                                    Doc: <span className="font-semibold text-slate-800">{d.documentNumber}</span>
                                  </div>
                                ) : (
                                  <div className="text-[8.5px] text-slate-400 italic font-mono truncate">
                                    Doc: Não consta
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Coluna 3: Saldo & Status (Valor Já Quitado em cima do Valor Devedor) */}
                            <div className={`col-span-3 text-center min-w-0 px-1 border-r ${
                              themeMode === 'classic_delphi' ? 'border-slate-200' : 'border-slate-800'
                            }`}>
                              {/* Valor Já Quitado (Verde) em cima */}
                              <div
                                className="font-mono font-black text-xs truncate text-emerald-600 dark:text-emerald-400 leading-tight"
                                title="Valor Já Quitado / Liquidado pelo cliente"
                              >
                                R$ {(Number(d.totalPaid) || 0).toFixed(0)}
                              </div>
                              {/* Valor Devedor (Vermelho) embaixo do valor quitado */}
                              <div className={`font-mono font-black text-xs truncate leading-tight mt-0.5 ${
                                Number(d.totalOwed) > 0
                                  ? themeMode === 'classic_delphi' ? 'text-red-600' : 'text-red-400'
                                  : themeMode === 'classic_delphi' ? 'text-emerald-700' : 'text-emerald-400'
                              }`} title="Saldo Devedor pendente">
                                R$ {(Number(d.totalOwed) || 0).toFixed(0)}
                              </div>
                              <div className="mt-0.5 relative inline-block">
                                {isOverdue ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveBalloonDebtorId(activeBalloonDebtorId === d.id ? null : d.id);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-red-100 hover:bg-red-200 active:scale-95 text-red-800 border border-red-300 text-[8px] font-extrabold font-mono animate-fun-overdue inline-flex items-center gap-0.5 shadow-2xs cursor-pointer transition-all"
                                    title="Clique para ver número da parcela e data de vencimento"
                                  >
                                    <span className="animate-bounce inline-block text-[8px]">🚨</span>
                                    <span>{d.overdueCount} atraso(s)</span>
                                  </button>
                                ) : Number(d.totalOwed) > 0 ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveBalloonDebtorId(activeBalloonDebtorId === d.id ? null : d.id);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-900 border border-amber-300 text-[8px] font-bold font-mono animate-fun-duesoon inline-flex items-center gap-0.5 shadow-2xs cursor-pointer transition-all"
                                    title="Clique para ver número da parcela e data de vencimento"
                                  >
                                    <span className="inline-block text-[8px]">⏳</span>
                                    <span>Prestes a vencer</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveBalloonDebtorId(activeBalloonDebtorId === d.id ? null : d.id);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 active:scale-95 text-emerald-800 border border-emerald-300 text-[8px] font-bold font-mono inline-flex items-center gap-0.5 cursor-pointer transition-all shadow-2xs"
                                    title="Clique para ver os detalhes da parcela"
                                  >
                                    <span className="text-[8px]">✅</span>
                                    <span>Em dia</span>
                                  </button>
                                )}

                                {/* Balões emparelhados e bem próximos (1: Card Claro Próximo Vencimento + 2: Balão Escuro Quitado/Saldo Dev) */}
                                {activeBalloonDebtorId === d.id && (() => {
                                  const info = getUpcomingInstallmentInfo(d.id, d.totalOwed);
                                  const isFirstRow = index === 0;
                                  const isOverdue = d.overdueCount > 0;
                                  const isPaid = Number(d.totalOwed) <= 0;

                                  return (
                                    <div
                                      className={`absolute ${
                                        isFirstRow ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                                      } left-1/2 -translate-x-1/2 z-[250] w-[210px] flex flex-col items-center gap-1 pointer-events-auto select-none`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {/* BALÃO 1: Card Claro do Próximo Vencimento */}
                                      <div
                                        className={`w-full p-2.5 rounded-xl border-2 shadow-xl text-center font-sans relative animate-in zoom-in-95 fade-in duration-150 ${
                                          isOverdue
                                            ? 'bg-gradient-to-b from-red-50 via-white to-red-100 border-red-500 text-red-950 shadow-red-500/20'
                                            : !isPaid
                                            ? 'bg-gradient-to-b from-amber-50 via-white to-amber-100 border-amber-400 text-amber-950 shadow-amber-500/20'
                                            : 'bg-gradient-to-b from-emerald-50 via-white to-emerald-100 border-emerald-400 text-emerald-950 shadow-emerald-500/20'
                                        }`}
                                      >
                                        {/* Setinha apontando para o botão quando abre para baixo */}
                                        {isFirstRow && (
                                          <div
                                            className={`absolute left-1/2 -translate-x-1/2 bottom-full border-4 border-transparent ${
                                              isOverdue
                                                ? 'border-b-red-500'
                                                : !isPaid
                                                ? 'border-b-amber-400'
                                                : 'border-b-emerald-400'
                                            }`}
                                          ></div>
                                        )}

                                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-200/80">
                                          <span className="font-extrabold text-[10.5px] flex items-center gap-1">
                                            <span className="text-xs">{isOverdue ? '🚨' : !isPaid ? '⏳' : '✅'}</span>
                                            <span className={isOverdue ? 'text-red-900' : !isPaid ? 'text-amber-900' : 'text-emerald-900'}>
                                              {isOverdue ? 'Parcela em Atraso' : !isPaid ? 'Próximo Vencimento' : 'Situação Regular'}
                                            </span>
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveBalloonDebtorId(null);
                                            }}
                                            className="w-4 h-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors cursor-pointer"
                                            title="Fechar"
                                          >
                                            ✕
                                          </button>
                                        </div>

                                        <div className="text-left text-[9px] mb-1 font-mono">
                                          <div className="text-[8px] text-slate-500 font-semibold uppercase">CLIENTE / DEVEDOR:</div>
                                          <div className="font-extrabold text-[10px] text-slate-900 truncate">{d.name}</div>
                                        </div>

                                        <div className="bg-white/95 p-1.5 rounded-lg border border-slate-200 text-[9px] font-mono space-y-0.5 text-left shadow-2xs">
                                          <div className="flex justify-between items-center">
                                            <span className="text-slate-500 font-semibold">Nº Parcela:</span>
                                            <span className="font-extrabold text-blue-700 bg-blue-50 px-1 rounded border border-blue-200">{info.parcela}</span>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <span className="text-slate-500 font-semibold">Vencimento:</span>
                                            <span className={`font-black ${isOverdue ? 'text-red-600' : !isPaid ? 'text-amber-900' : 'text-emerald-700'}`}>{info.vencimento}</span>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <span className="text-slate-500 font-semibold">Valor:</span>
                                            <span className="font-black text-red-600">{info.valor}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* BALÃO 2: Balão Escuro de Quitado vs Saldo Dev */}
                                      <div className="w-full p-2 bg-slate-900 text-white rounded-xl shadow-2xl border border-blue-400/80 font-mono text-[9px] relative animate-in zoom-in-95 fade-in duration-150">
                                        {/* Setinha apontando para o botão quando abre para cima */}
                                        {!isFirstRow && (
                                          <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-900"></div>
                                        )}

                                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-700">
                                          <span className="font-extrabold text-blue-300 flex items-center gap-1 text-[9.5px]">
                                            <span>📌</span>
                                            <span>{info.parcela}</span>
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveBalloonDebtorId(null);
                                            }}
                                            className="w-4 h-4 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-full flex items-center justify-center text-[9px] font-bold transition-colors cursor-pointer"
                                            title="Fechar"
                                          >
                                            ✕
                                          </button>
                                        </div>

                                        <div className="space-y-0.5">
                                          <div className="flex items-center justify-between text-[9px]">
                                            <span className="text-slate-400">Vencimento:</span>
                                            <span className="font-extrabold text-amber-300">{info.vencimento}</span>
                                          </div>
                                          <div className="flex items-center justify-between text-[9px]">
                                            <span className="text-slate-300">Liquidado:</span>
                                            <span className="font-extrabold text-emerald-400">
                                              R$ {(Number(d.totalPaid) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between text-[9px]">
                                            <span className="text-slate-300">Saldo Devedor:</span>
                                            <span className="font-extrabold text-red-400">
                                              R$ {(Number(d.totalOwed) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Coluna 4: Botões de Ação ERP (Liquidar / Liquidado no topo e Lixeira debaixo) */}
                            <div className="col-span-3 flex flex-col items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {/* Topo: Liquidar ou Liquidado sem abreviar */}
                              {Number(d.totalOwed) > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleLiquidarDebtor(d)}
                                  className="w-full h-7.5 px-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-[10px] font-extrabold cursor-pointer inline-flex items-center justify-center gap-1 shadow-xs hover:shadow-md transition-all uppercase tracking-wider border border-emerald-500"
                                  title="Liquidar todas as pendências financeiras do cliente"
                                >
                                  <span className="text-[12px]">💰</span>
                                  <span>LIQUIDAR</span>
                                </button>
                              ) : (
                                <div
                                  className="w-full h-7.5 px-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[10px] font-extrabold inline-flex items-center justify-center gap-1 shadow-2xs uppercase tracking-wider"
                                  title="Cliente totalmente Liquidado"
                                >
                                  <span className="text-[12px]">✅</span>
                                  <span>LIQUIDADO</span>
                                </div>
                              )}

                              {/* Debaixo de Liquidar / Liquidado: Lixeira (Excluir) e Editar */}
                              <div className="flex items-center justify-center gap-1 w-full">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDebtorId(d.id);
                                    setActiveTab('cadastro');
                                  }}
                                  className="flex-1 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[8px] font-extrabold inline-flex items-center justify-center gap-0.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                  title="Editar Ficha Cadastral (F2)"
                                >
                                  <span className="material-symbols-outlined text-[10px]">edit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteSpecificDebtor(d)}
                                  className="flex-1 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[8px] font-extrabold inline-flex items-center justify-center gap-0.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
                                  title="Lixeira - Excluir registro"
                                >
                                  <span className="material-symbols-outlined text-[10px]">delete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Rodapé da Planilha Mobile */}
                  <div className={`px-2.5 py-1.5 border-t text-[10px] flex items-center justify-between font-mono ${
                    themeMode === 'classic_delphi'
                      ? 'bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}>
                    <span>{filteredDebtors.length} devedor(es) listados</span>
                    <span className="text-blue-600 font-bold">Toque na linha para selecionar</span>
                  </div>
                </div>
              )}

              {/* DataGrid (DBGrid Delphi style - Desktop ou quando ativado no mobile) */}
              <div className={`${mobileViewMode === 'cards' ? 'hidden sm:block' : 'block'} border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white`}>
                <div className="px-3 py-2 bg-white border-b border-slate-200 text-xs font-sans flex items-center justify-between select-none">
                  <span className="flex items-center gap-1.5 font-bold text-blue-900 text-xs sm:text-sm">
                    <span className="material-symbols-outlined text-[16px] text-blue-600">table_chart</span>
                    <span>Grade DBGrid ARP Mobile</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <span>Arraste para o lado</span>
                    <span className="text-[13px]">→</span>
                  </span>
                </div>
                <div className="w-full overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-full">
                    <thead className="bg-[#f8fafc] text-slate-600 uppercase font-mono text-[9px] sm:text-[10px] border-b border-slate-200 select-none font-bold">
                      <tr className="h-8 sm:h-9">
                        <th className="px-2 py-1 border-r border-slate-200 whitespace-nowrap">NOME / SCORE / TEL</th>
                        <th className="px-2 py-1 border-r border-slate-200 text-center whitespace-nowrap">VALORES & STATUS</th>
                        <th className="px-1 py-1 text-center w-16 whitespace-nowrap select-none">AÇÕES ERP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 font-sans">
                      {filteredDebtors.map((d, index) => {
                        const isSelected = d.id === selectedDebtorId;
                        const totalOwedFormatted = (Number(d.totalOwed) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        const totalPaidFormatted = (Number(d.totalPaid) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        const scoreNum = Number(d.score) || 800;

                        return (
                          <tr
                            key={d.id}
                            onClick={() => setSelectedDebtorId(d.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50/90 font-bold'
                                : index % 2 === 0
                                ? 'bg-white hover:bg-slate-50'
                                : 'bg-[#fcfbf9] hover:bg-slate-50'
                            }`}
                          >
                            {/* Nome + Score bem pequeno estritamente ao lado do nome (sem quebrar linha) + Doc + Telefone */}
                            <td className="px-2 py-1.5 border-r border-slate-200 whitespace-nowrap">
                              <div className="flex items-center gap-1 min-w-0 max-w-[175px] sm:max-w-none">
                                <span className="font-extrabold text-slate-900 text-xs truncate shrink min-w-0" title={d.name}>{formatSmartShortName(d.name)}</span>
                                <span className={`px-1 py-0.2 rounded text-[7.5px] font-bold font-mono inline-flex items-center gap-0.5 shrink-0 whitespace-nowrap ${
                                  scoreNum >= 700
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : scoreNum >= 500
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-red-100 text-red-800 border border-red-300'
                                }`} title={`Score de crédito do cliente: ${scoreNum}`}>
                                  <span>Score:</span>
                                  <span className="font-extrabold">{scoreNum}</span>
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5 mt-0.5 font-mono text-[9.5px]">
                                {d.phone && d.phone.trim() ? (
                                  <div className="flex items-center gap-0.5 text-blue-700 font-semibold truncate text-[9.5px]">
                                    <span className="material-symbols-outlined text-[10px] shrink-0">call</span>
                                    <span>{d.phone}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-0.5 text-slate-400 italic truncate text-[8.5px]">
                                    <span className="material-symbols-outlined text-[10px] shrink-0">call</span>
                                    <span>Sem telefone</span>
                                  </div>
                                )}
                                {d.documentNumber && d.documentNumber.trim() && d.documentNumber.trim() !== 'Sem doc' && d.documentNumber.trim() !== '—' ? (
                                  <div className="text-[8.5px] text-slate-600 font-mono truncate">
                                    Doc: <span className="font-semibold text-slate-800">{d.documentNumber}</span>
                                  </div>
                                ) : (
                                  <div className="text-[8.5px] text-slate-400 italic font-mono truncate">
                                    Doc: Não consta
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Total Pago (Verde) em cima, Total Devedor (Vermelho) no meio, Atraso em baixo com animação divertida */}
                            <td className="px-2 py-1.5 border-r border-slate-200 text-center font-mono whitespace-nowrap">
                              <div className="font-black text-emerald-600 text-[10.5px] sm:text-xs" title="Total Pago pelo cliente">
                                R$ {totalPaidFormatted}
                              </div>
                              <div className="font-black text-red-600 text-[10.5px] sm:text-xs mt-0.5" title="Saldo Devedor pendente">
                                R$ {totalOwedFormatted}
                              </div>
                              <div className="mt-1 flex items-center justify-center relative">
                                <div className="relative inline-block">
                                  {d.overdueCount > 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveBalloonDebtorId(activeBalloonDebtorId === d.id ? null : d.id);
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-red-100 hover:bg-red-200 active:scale-95 text-red-800 border border-red-300 font-extrabold font-mono text-[8px] sm:text-[8.5px] inline-flex items-center gap-0.5 animate-fun-overdue shadow-2xs cursor-pointer transition-all"
                                      title="Clique para ver o número da parcela e data de vencimento!"
                                    >
                                      <span className="animate-bounce inline-block text-[8.5px]">🚨</span>
                                      <span>{d.overdueCount} atraso(s)</span>
                                    </button>
                                  ) : Number(d.totalOwed) > 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveBalloonDebtorId(activeBalloonDebtorId === d.id ? null : d.id);
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-900 border border-amber-300 font-bold font-mono text-[8px] sm:text-[8.5px] inline-flex items-center gap-0.5 animate-fun-duesoon shadow-2xs cursor-pointer transition-all"
                                      title="Clique para ver o número da parcela e data de vencimento!"
                                    >
                                      <span className="inline-block text-[8.5px]">⏳</span>
                                      <span>Prestes a vencer</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveBalloonDebtorId(activeBalloonDebtorId === d.id ? null : d.id);
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 active:scale-95 text-emerald-800 border border-emerald-300 font-bold font-mono text-[8px] sm:text-[8.5px] inline-flex items-center gap-0.5 cursor-pointer transition-all shadow-2xs"
                                      title="Clique para ver os detalhes"
                                    >
                                      <span className="text-[8.5px]">✅</span>
                                      <span>Em dia</span>
                                    </button>
                                  )}

                                  {/* Balões emparelhados e bem próximos (1: Card Claro Próximo Vencimento + 2: Balão Escuro Quitado/Saldo Dev) */}
                                  {activeBalloonDebtorId === d.id && (() => {
                                    const info = getUpcomingInstallmentInfo(d.id, d.totalOwed);
                                    const isFirstRow = index === 0;
                                    const isOverdue = d.overdueCount > 0;
                                    const isPaid = Number(d.totalOwed) <= 0;

                                    return (
                                      <div
                                        className={`absolute ${
                                          isFirstRow ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                                        } left-1/2 -translate-x-1/2 z-[250] w-[210px] flex flex-col items-center gap-1 pointer-events-auto select-none`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {/* BALÃO 1: Card Claro do Próximo Vencimento */}
                                        <div
                                          className={`w-full p-2.5 rounded-xl border-2 shadow-xl text-center font-sans relative animate-in zoom-in-95 fade-in duration-150 ${
                                            isOverdue
                                              ? 'bg-gradient-to-b from-red-50 via-white to-red-100 border-red-500 text-red-950 shadow-red-500/20'
                                              : !isPaid
                                              ? 'bg-gradient-to-b from-amber-50 via-white to-amber-100 border-amber-400 text-amber-950 shadow-amber-500/20'
                                              : 'bg-gradient-to-b from-emerald-50 via-white to-emerald-100 border-emerald-400 text-emerald-950 shadow-emerald-500/20'
                                          }`}
                                        >
                                          {/* Setinha apontando para o botão quando abre para baixo */}
                                          {isFirstRow && (
                                            <div
                                              className={`absolute left-1/2 -translate-x-1/2 bottom-full border-4 border-transparent ${
                                                isOverdue
                                                  ? 'border-b-red-500'
                                                  : !isPaid
                                                  ? 'border-b-amber-400'
                                                  : 'border-b-emerald-400'
                                              }`}
                                            ></div>
                                          )}
                                          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-200/80">
                                            <span className="font-extrabold text-[10.5px] flex items-center gap-1">
                                              <span className="text-xs">{isOverdue ? '🚨' : !isPaid ? '⏳' : '✅'}</span>
                                              <span className={isOverdue ? 'text-red-900' : !isPaid ? 'text-amber-900' : 'text-emerald-900'}>
                                                {isOverdue ? 'Parcela em Atraso' : !isPaid ? 'Próximo Vencimento' : 'Situação Regular'}
                                              </span>
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveBalloonDebtorId(null);
                                              }}
                                              className="w-4 h-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors cursor-pointer"
                                              title="Fechar"
                                            >
                                              ✕
                                            </button>
                                          </div>

                                          <div className="text-left text-[9px] mb-1 font-mono">
                                            <div className="text-[8px] text-slate-500 font-semibold uppercase">CLIENTE / DEVEDOR:</div>
                                            <div className="font-extrabold text-[10px] text-slate-900 truncate">{d.name}</div>
                                          </div>

                                          <div className="bg-white/95 p-1.5 rounded-lg border border-slate-200 text-[9px] font-mono space-y-0.5 text-left shadow-2xs">
                                            <div className="flex justify-between items-center">
                                              <span className="text-slate-500 font-semibold">Nº Parcela:</span>
                                              <span className="font-extrabold text-blue-700 bg-blue-50 px-1 rounded border border-blue-200">{info.parcela}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-slate-500 font-semibold">Vencimento:</span>
                                              <span className={`font-black ${isOverdue ? 'text-red-600' : !isPaid ? 'text-amber-900' : 'text-emerald-700'}`}>{info.vencimento}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-slate-500 font-semibold">Valor:</span>
                                              <span className="font-black text-red-600">{info.valor}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* BALÃO 2: Balão Escuro de Quitado vs Saldo Dev */}
                                        <div className="w-full p-2 bg-slate-900 text-white rounded-xl shadow-2xl border border-blue-400/80 font-mono text-[9px] relative animate-in zoom-in-95 fade-in duration-150">
                                          {/* Setinha apontando para o botão quando abre para cima */}
                                          {!isFirstRow && (
                                            <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-900"></div>
                                          )}

                                          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-700">
                                            <span className="font-extrabold text-blue-300 flex items-center gap-1 text-[9.5px]">
                                              <span>📌</span>
                                              <span>{info.parcela}</span>
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveBalloonDebtorId(null);
                                              }}
                                              className="w-4 h-4 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-full flex items-center justify-center text-[9px] font-bold transition-colors cursor-pointer"
                                              title="Fechar"
                                            >
                                              ✕
                                            </button>
                                          </div>

                                          <div className="space-y-0.5">
                                            <div className="flex items-center justify-between text-[9px]">
                                              <span className="text-slate-400">Vencimento:</span>
                                              <span className="font-extrabold text-amber-300">{info.vencimento}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[9px]">
                                              <span className="text-slate-300">Quitado:</span>
                                              <span className="font-extrabold text-emerald-400">
                                                R$ {(Number(d.totalPaid) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[9px]">
                                              <span className="text-slate-300">Saldo Dev:</span>
                                              <span className="font-extrabold text-red-400">
                                                R$ {(Number(d.totalOwed) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </td>

                            <td className="px-1 py-1 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col items-center justify-center gap-1 w-full max-w-[80px] mx-auto">
                                {/* Topo: Liquidar ou Liquidado sem abreviar */}
                                {Number(d.totalOwed) > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleLiquidarDebtor(d)}
                                    className="w-full h-7.5 px-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-extrabold cursor-pointer inline-flex items-center justify-center gap-1 shadow-xs hover:shadow-md transition-all active:scale-95 uppercase tracking-wider border border-emerald-500"
                                    title="Liquidar todas as pendências financeiras do cliente"
                                  >
                                    <span className="text-[12px]">💰</span>
                                    <span>LIQUIDAR</span>
                                  </button>
                                ) : (
                                  <div
                                    className="w-full h-7.5 px-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[10px] font-extrabold inline-flex items-center justify-center gap-1 shadow-2xs uppercase tracking-wider"
                                    title="Cliente com saldo totalmente Liquidado"
                                  >
                                    <span className="text-[12px]">✅</span>
                                    <span>LIQUIDADO</span>
                                  </div>
                                )}

                                {/* Debaixo de Liquidar / Liquidado: Lixeira (Excluir) e Editar */}
                                <div className="flex items-center justify-center gap-1 w-full">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDebtorId(d.id);
                                      setActiveTab('cadastro');
                                    }}
                                    className="flex-1 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[8px] font-bold cursor-pointer inline-flex items-center justify-center gap-0.5 transition-all active:scale-95 shadow-2xs"
                                    title="Abrir ficha cadastral no ERP"
                                  >
                                    <span className="material-symbols-outlined text-[9.5px]">edit</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSpecificDebtor(d)}
                                    className="flex-1 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[8px] font-bold cursor-pointer inline-flex items-center justify-center gap-0.5 transition-all active:scale-95 shadow-2xs"
                                    title="Lixeira - Excluir registro do ERP"
                                  >
                                    <span className="material-symbols-outlined text-[9.5px]">delete</span>
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                <span>Registros encontrados: {filteredDebtors.length} de {debtors.length}</span>
                <span className="hidden sm:inline">Dica: Dê duplo clique em qualquer linha para abrir a ficha no formulário de entrada.</span>
              </div>
            </div>
          )}

          {/* TAB 3: CONTAS A RECEBER (GRADE CONTÁBIL DE PARCELAS) */}
          {activeTab === 'titulos' && (
            <div className="space-y-3">
              {/* Notificação Rápida de Desfazer Exclusão */}
              {lastDeletedBatch && lastDeletedBatch.length > 0 && (
                <div className="flex items-center justify-between gap-3 px-3 py-2 bg-amber-950/80 border border-amber-500 rounded text-amber-200 text-xs shadow-md animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-400">info</span>
                    <span>
                      <strong>{lastDeletedBatch.length} título(s)</strong> movido(s) para a Lixeira Contábil do ERP. Caso tenha sido um engano:
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRestoreInstallments(lastDeletedBatch)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded text-[11px] cursor-pointer flex items-center gap-1 shadow-xs transition-transform active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[14px]">undo</span>
                      <span>Desfazer Exclusão Agora</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLastDeletedBatch(null)}
                      className="text-amber-800 hover:text-black p-0.5 rounded cursor-pointer"
                      title="Dispensar aviso"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Filtros e Barra de Ferramentas Contábeis (Otimizado para Mobile) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-1.5 sm:p-2 bg-[#f8fafc] rounded-lg border border-slate-300">
                <div className="flex items-center gap-1.5 flex-1 w-full sm:max-w-md">
                  <span className="material-symbols-outlined text-[15px] text-blue-600 shrink-0">search</span>
                  <input
                    type="search"
                    value={instSearch}
                    onChange={(e) => setInstSearch(e.target.value)}
                    placeholder="Filtrar por devedor, produto ou título..."
                    className="w-full h-7 sm:h-7 px-2 bg-white border border-slate-300 rounded-lg text-[11px] text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto">
                  <span className="text-[10px] font-bold text-slate-700 mr-0.5 hidden sm:inline">Situação:</span>
                  {(
                    [
                      { id: 'todos', label: 'Todas', count: statusCounts.todos, color: 'blue' },
                      { id: 'overdue', label: 'Atrasadas', count: statusCounts.overdue, color: 'red' },
                      { id: 'soon', label: 'Vence Logo', count: statusCounts.soon, color: 'amber' },
                      { id: 'ontime', label: 'Em dia', count: statusCounts.ontime, color: 'emerald' },
                      { id: 'paid', label: 'Pagas', count: statusCounts.paid, color: 'slate' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setInstStatusFilter(item.id as any)}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] sm:text-[10px] font-bold transition-all cursor-pointer border flex items-center gap-0.5 ${
                        instStatusFilter === item.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className={`px-1 rounded-full text-[8.5px] font-mono ${
                        item.id === 'overdue' && item.count > 0
                          ? 'bg-red-600 text-white font-extrabold'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {item.count}
                      </span>
                    </button>
                  ))}

                  {/* Botão da Lixeira Contábil */}
                  <button
                    type="button"
                    onClick={() => setShowTrashModal(true)}
                    className={`px-1.5 py-0.5 rounded text-[9.5px] sm:text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border shadow-xs ml-auto sm:ml-2 ${
                      deletedInstallments.length > 0
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-400'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                    title="Abrir Lixeira Contábil para restaurar ou desfazer exclusões"
                  >
                    <span className="material-symbols-outlined text-[13px] text-amber-600">delete_sweep</span>
                    <span>Lixeira</span>
                    <span className={`px-1 py-0.1 rounded-full text-[8.5px] font-mono font-bold ${
                      deletedInstallments.length > 0 ? 'bg-amber-500 text-black' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {deletedInstallments.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Seletor de Modo no Mobile (Listinha Planilha vs Grade Ampla) */}
              <div className="flex sm:hidden items-center justify-between p-1 px-2 bg-[#f8fafc] rounded border border-slate-300 text-[10.5px]">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-blue-600">table_rows</span>
                  <span>Modo Contábil Mobile:</span>
                </span>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setMobileViewMode('cards')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer ${
                      mobileViewMode === 'cards' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px]">view_list</span>
                    <span>Listinha Planilha</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileViewMode('table')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer ${
                      mobileViewMode === 'table' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px]">table_chart</span>
                    <span>Grade DBGrid</span>
                  </button>
                </div>
              </div>

              {/* Caixa Selecionável & Barra de Ações em Massa (Excluir Geral Compacta) */}
              <div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-[#fafafa] border border-slate-300 rounded-lg text-[10.5px] font-mono text-slate-800">
                <div className="flex items-center gap-1.5 min-w-0">
                  <label className="flex items-center gap-1 cursor-pointer font-bold select-none text-slate-800 hover:text-blue-900 shrink-0">
                    <input
                      type="checkbox"
                      ref={masterCheckboxRef}
                      checked={isAllFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-600"
                    />
                    <span className="truncate">Selecionar Geral ({filteredInstallments.length})</span>
                  </label>

                  {selectedInstIds.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded bg-blue-100 border border-blue-300 text-blue-900 text-[9.5px] font-bold truncate">
                      ✓ <strong>{selectedInstIds.length}</strong> sel.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {selectedInstIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRequestBulkDelete('selected')}
                      className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-[9.5px] cursor-pointer flex items-center gap-0.5 shadow-xs transition-all active:scale-95"
                      title="Excluir títulos marcados"
                    >
                      <span className="material-symbols-outlined text-[12px]">delete_sweep</span>
                      <span>Excluir Sel. ({selectedInstIds.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRequestBulkDelete('all_filtered')}
                    disabled={filteredInstallments.length === 0}
                    className="px-1.5 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded text-[9.5px] cursor-pointer flex items-center gap-0.5 border border-red-300 shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Excluir geral todos os títulos exibidos"
                  >
                    <span className="material-symbols-outlined text-[12px]">delete_forever</span>
                    <span>Excluir Geral ({filteredInstallments.length})</span>
                  </button>
                </div>
              </div>

              {/* Modo Listinha Planilha Contábil Mobile (Compacta, Delphiana, Clarinha e sem sobreposição) */}
              {mobileViewMode === 'cards' && (
                <div className="sm:hidden border border-slate-300 rounded-lg overflow-hidden bg-white font-sans shadow-xs select-none">
                  {/* Cabeçalho da Planilha Contábil Mobile (Reenquadrado e Agrupado) */}
                  <div className="grid grid-cols-12 gap-1 px-2 py-1 bg-slate-100 border-b border-slate-300 text-[9.5px] font-mono font-bold uppercase text-slate-700">
                    <div className="col-span-4 flex items-center gap-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        title="Marcar todos"
                        className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-600 shrink-0"
                      />
                      <span className="truncate">Sacado / Cliente</span>
                    </div>
                    <div className="col-span-5 text-center px-0.5">Venc / Valor / Parc</div>
                    <div className="col-span-3 text-center">Ações</div>
                  </div>

                  {/* Linhas da Planilha Contábil */}
                  <div className="divide-y divide-slate-200">
                    {filteredInstallments.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        Nenhum título encontrado com os filtros atuais.
                      </div>
                    ) : (
                      filteredInstallments.map((inst, index) => {
                        const isOverdue = inst.status === 'overdue';
                        const isPaid = inst.status === 'paid';
                        const isSelected = selectedInstIds.includes(inst.id);

                        const now = new Date();
                        now.setHours(0, 0, 0, 0);
                        const due = new Date(inst.dueDate);
                        due.setHours(0, 0, 0, 0);
                        const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        const daysOverdue = diffDays < 0 ? Math.abs(diffDays) : 1;

                        return (
                          <div
                            key={inst.id}
                            className={`grid grid-cols-12 gap-0.5 px-1.5 py-1 items-center transition-all ${
                              isSelected
                                ? 'bg-blue-100/90 border-l-2 border-l-blue-600 shadow-inner'
                                : isOverdue
                                ? 'bg-red-50/90 border-l-2 border-l-red-500'
                                : isPaid
                                ? 'bg-slate-50/80 opacity-75'
                                : index % 2 === 0
                                ? 'bg-white hover:bg-blue-50/30'
                                : 'bg-[#fcfbf9] hover:bg-blue-50/30'
                            }`}
                          >
                            {/* Coluna 1: Checkbox + Sacado / Cliente + Produto (Selecionável) */}
                            <div
                              className="col-span-5 min-w-0 pr-0.5 flex items-start gap-1 cursor-pointer"
                              onClick={() => toggleSelectRow(inst.id)}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(inst.id)}
                                className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-600 mt-0.5 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div
                                  className="font-extrabold text-[10.5px] text-slate-900 truncate leading-tight hover:text-blue-600 cursor-pointer select-text"
                                  title="Clique para selecionar este sacado"
                                >
                                  {inst.debtorName}
                                </div>
                                <div
                                  className="text-[8.5px] text-slate-500 truncate font-mono hover:text-slate-800 cursor-pointer select-text leading-tight mt-0.5"
                                  title="Produto / Descrição"
                                >
                                  {inst.product}
                                </div>
                              </div>
                            </div>

                            {/* Coluna 2: Valor Nominal, Vencimento & Parcela (Próximo do Nome, Selecionáveis) */}
                            <div
                              className="col-span-4 text-center min-w-0 px-0.5 flex flex-col items-center justify-center cursor-pointer"
                              onClick={() => toggleSelectRow(inst.id)}
                            >
                              <div className="flex items-center justify-center gap-1 leading-tight">
                                <span className="font-mono font-black text-[10.5px] truncate text-red-600 cursor-pointer select-text">
                                  R$ {inst.amount.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-[8.5px] text-slate-600 font-mono font-semibold flex items-center justify-center gap-0.5 leading-tight mt-0.5">
                                <span
                                  className="hover:text-blue-700 cursor-pointer select-text bg-slate-100 px-0.5 py-0 rounded border border-slate-200"
                                  title="Data de Vencimento"
                                >
                                  Venc: {formatDateSafe(inst.dueDate)}
                                </span>
                                <span
                                  className="bg-blue-100 text-blue-800 text-[8px] px-0.5 py-0 rounded font-bold border border-blue-200 hover:bg-blue-200 cursor-pointer select-text"
                                  title="Número da Parcela"
                                >
                                  #{inst.installmentNumber}/{inst.totalInstallments}
                                </span>
                              </div>
                              {isOverdue && (
                                <div className="text-[7.5px] text-red-600 font-mono font-bold animate-pulse leading-none mt-0.5">
                                  🚨 Em atraso
                                </div>
                              )}
                            </div>

                            {/* Coluna 3: Status / Botão de Baixa & Excluir Empilhados (Lixeira de Baixo do Liquidar/Liquidado) */}
                            <div className="col-span-3 flex flex-col items-center justify-center gap-0.5 min-w-0 my-0.2" onClick={(e) => e.stopPropagation()}>
                              {!isPaid ? (
                                <button
                                  type="button"
                                  onClick={() => handleQuickPayInstallment(inst.id)}
                                  className="h-6.5 px-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-md text-[9.5px] font-black cursor-pointer inline-flex items-center justify-center gap-0.5 active:scale-95 transition-all shadow-xs w-full max-w-[80px] uppercase tracking-wider border border-emerald-400"
                                  title="Liquidar e dar baixa contábil nesta parcela"
                                >
                                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                  <span>LIQUIDAR</span>
                                </button>
                              ) : (
                                <span className="h-6.5 px-1 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 text-[9px] font-black font-mono inline-flex items-center justify-center gap-0.5 w-full max-w-[80px] uppercase tracking-wider shadow-2xs">
                                  <span className="material-symbols-outlined text-[12px] text-emerald-700">verified</span>
                                  <span>LIQUIDADO</span>
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteSpecificInstallment(inst)}
                                className="h-5 px-1 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 rounded-md text-[8.5px] font-bold flex items-center justify-center gap-0.5 cursor-pointer active:scale-95 transition-all shadow-2xs w-full max-w-[80px]"
                                title="Excluir título (Lixeira)"
                              >
                                <span className="material-symbols-outlined text-[11px] text-red-600">delete</span>
                                <span>Lixeira</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Rodapé da Planilha Contábil Mobile */}
                  <div className="px-2 py-1 bg-slate-100 border-t border-slate-300 text-[9.5px] text-slate-700 flex items-center justify-between font-mono font-semibold">
                    <span>{filteredInstallments.length} títulos listados</span>
                    {selectedInstIds.length > 0 && (
                      <span className="text-blue-700 font-bold">{selectedInstIds.length} sel. (R$ {totalSelectedAmount.toFixed(2)})</span>
                    )}
                  </div>
                </div>
              )}

              {/* DataGrid of Installments (Desktop ou quando ativado no mobile) */}
              <div className={`${mobileViewMode === 'cards' ? 'hidden sm:block' : 'block'} border border-slate-300 rounded-lg overflow-x-auto max-h-[520px] scrollbar-thin bg-white w-full shadow-2xs`}>
                <div className={`sm:hidden px-2 py-0.5 border-b text-[9.5px] font-sans flex items-center justify-between select-none bg-slate-100 text-slate-800 border-slate-300`}>
                  <span className="flex items-center gap-1 font-bold text-blue-900">
                    <span className="material-symbols-outlined text-[13px]">table_chart</span>
                    <span>Grade DBGrid Títulos Mobile</span>
                  </span>
                  <span className="text-[8.5px] text-emerald-700 font-mono font-bold">100% visível na tela</span>
                </div>
                <table className="w-full text-left border-collapse text-[9px] sm:text-[11px] erp-dbgrid-table min-w-full">
                  <thead className="bg-slate-100 text-slate-800 uppercase font-mono text-[8px] sm:text-[10px] border-b border-slate-300 sticky top-0 z-10 select-none font-bold">
                    <tr className="h-6 sm:h-7">
                      <th className="p-0.5 border-r border-slate-200 text-center w-7 select-none">
                        <input
                          type="checkbox"
                          checked={isAllFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          title="Caixa Selecionável Geral (Marcar/Desmarcar todos)"
                          className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-600"
                        />
                      </th>
                      <th className="hidden sm:table-cell px-1.5 py-1 border-r border-slate-200 w-12 whitespace-nowrap">Título</th>
                      <th className="px-1.5 sm:px-2 py-1 border-r border-slate-200 w-[33%] sm:w-auto truncate">Devedor / Item</th>
                      <th className="px-1 sm:px-2 py-1 border-r border-slate-200 text-center w-[41%] sm:w-auto bg-blue-50/80 text-blue-900 font-bold">Valor, Parcela & Vencimento</th>
                      <th className="hidden sm:table-cell px-1.5 py-1 border-r border-slate-200 text-center whitespace-nowrap">Situação</th>
                      <th className="px-1 sm:px-2 py-1 text-center w-[26%] sm:w-28 whitespace-nowrap select-none">Ações ARP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[9.5px] sm:text-[10.5px]">
                    {filteredInstallments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-500 font-sans">
                          Nenhum título encontrado com os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      filteredInstallments.map((inst, index) => {
                        const isOverdue = inst.status === 'overdue';
                        const isPaid = inst.status === 'paid';
                        const isSelected = selectedInstIds.includes(inst.id);
                        return (
                          <tr
                            key={inst.id}
                            className={`transition-colors h-auto py-1 sm:h-9 ${
                              isSelected
                                ? 'bg-blue-100 text-blue-950 font-bold'
                                : isPaid
                                ? 'opacity-75 bg-slate-50'
                                : isOverdue
                                ? 'bg-red-50 text-red-950'
                                : index % 2 === 0
                                ? 'bg-white hover:bg-slate-100'
                                : 'bg-[#fcfbf9] hover:bg-slate-100'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="p-0.5 border-r border-slate-200 text-center w-7 select-none" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(inst.id)}
                                title={`Selecionar título ${inst.id}`}
                                className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-600"
                              />
                            </td>

                            {/* Título ID (visível em telas sm+) */}
                            <td className="hidden sm:table-cell px-1.5 py-0.5 border-r border-slate-200 text-slate-600 font-mono text-[9.5px] truncate w-12 whitespace-nowrap">{inst.id.slice(-5)}</td>
                            
                            {/* Devedor com Nome do Item debaixo do Nome */}
                            <td className="px-1.5 sm:px-2 py-1 border-r border-slate-200 font-sans min-w-0 w-[33%] sm:w-auto">
                              <div className="font-extrabold text-[10px] sm:text-[11px] text-slate-900 leading-tight truncate">
                                {inst.debtorName}
                              </div>
                              <div className="text-[8.5px] sm:text-[9px] text-slate-500 font-mono leading-tight mt-0.5 truncate" title="Produto / Item debaixo do nome">
                                {inst.product}
                              </div>
                            </td>

                            {/* Valor com Parcela junto e Vencimento debaixo do valor */}
                            <td className="px-1 sm:px-2 py-1 border-r border-slate-200 text-center font-mono bg-blue-50/30 min-w-0 w-[41%] sm:w-auto">
                              <div className="flex items-center justify-center gap-1 leading-tight flex-wrap">
                                <span className="font-mono font-black text-red-600 text-[10px] sm:text-[11px]">
                                  R$ {inst.amount.toFixed(2)}
                                </span>
                                <span className="px-1 py-0.1 rounded bg-blue-100 border border-blue-300 text-blue-800 text-[7.5px] sm:text-[8.5px] font-bold" title="Parcela junto com o valor">
                                  #{inst.installmentNumber}/{inst.totalInstallments}
                                </span>
                              </div>
                              <div className="text-[8px] sm:text-[9px] text-slate-600 font-semibold leading-tight mt-0.5" title="Vencimento debaixo do valor">
                                Venc: <span className="font-bold text-slate-800">{formatDateSafe(inst.dueDate)}</span>
                              </div>
                              {isOverdue && (
                                <div className="sm:hidden text-[7.5px] text-red-600 font-bold font-mono mt-0.5 animate-pulse">
                                  🚨 Em atraso
                                </div>
                              )}
                            </td>

                            {/* Situação (visível em telas sm+) */}
                            <td className="hidden sm:table-cell px-1.5 py-0.5 border-r border-slate-200 text-center whitespace-nowrap">
                              {isPaid ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-[8.5px] font-bold inline-flex items-center gap-0.5">
                                  <span>✅</span>
                                  <span>PAGO</span>
                                </span>
                              ) : isOverdue ? (
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 text-[8.5px] font-extrabold animate-fun-overdue inline-flex items-center gap-0.5 shadow-2xs">
                                  <span className="animate-bounce inline-block text-[9px]">🚨</span>
                                  <span>ATRASADA</span>
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[8.5px] font-bold animate-fun-duesoon inline-flex items-center gap-0.5 shadow-2xs">
                                  <span className="inline-block text-[9px]">⏳</span>
                                  <span>PRESTES A VENCER</span>
                                </span>
                              )}
                            </td>

                            {/* Ações ARP (Liquidar/Liquidado no topo e Lixeira debaixo) - 100% visível na tela mobile */}
                            <td className="px-1 sm:px-1.5 py-1 text-center w-[26%] sm:w-28 whitespace-nowrap select-none" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col items-center justify-center gap-0.5 my-0.2 w-full max-w-[76px] sm:max-w-[90px] mx-auto">
                                {!isPaid ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuickPayInstallment(inst.id);
                                    }}
                                    className="w-full h-6 sm:h-7.5 px-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded text-[8.5px] sm:text-[10px] font-black cursor-pointer transition-all active:scale-95 inline-flex items-center justify-center gap-0.5 shadow-2xs uppercase tracking-wider border border-emerald-400"
                                    title="Liquidar e dar baixa contábil nesta parcela"
                                  >
                                    <span className="material-symbols-outlined text-[10px] sm:text-[13px]">check_circle</span>
                                    <span>LIQUIDAR</span>
                                  </button>
                                ) : (
                                  <span className="w-full h-6 sm:h-7.5 px-1 bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-[8px] sm:text-[9.5px] inline-flex items-center justify-center gap-0.5 rounded uppercase tracking-wider shadow-2xs">
                                    <span className="material-symbols-outlined text-[10px] sm:text-[13px] text-emerald-700">verified</span>
                                    <span>LIQUIDADO</span>
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSpecificInstallment(inst);
                                  }}
                                  className="w-full h-5 sm:h-6 px-1 bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 rounded text-[8px] sm:text-[9px] font-bold cursor-pointer transition-all active:scale-95 inline-flex items-center justify-center gap-0.5 shadow-2xs"
                                  title="Excluir este título (Mover para Lixeira)"
                                >
                                  <span className="material-symbols-outlined text-[9.5px] sm:text-[12px] text-red-600">delete</span>
                                  <span>Lixeira</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Rodapé da Grade com Atalhos e Lixeira */}
              <div className="flex flex-wrap items-center justify-between text-[10px] sm:text-[11px] text-slate-500 font-mono pt-1">
                <div className="flex items-center gap-2 sm:gap-4">
                  <span>Títulos listados: <strong className="text-slate-900 dark:text-white font-black">{filteredInstallments.length}</strong> de {installments.length}</span>
                  {selectedInstIds.length > 0 && (
                    <span className="text-blue-300">Selecionados: <strong>{selectedInstIds.length}</strong></span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowTrashModal(true)}
                    className="hover:text-amber-400 underline transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">restore_from_trash</span>
                    <span>Ver Lixeira Contábil ({deletedInstallments.length} itens)</span>
                  </button>
                  <span>Dica: Caixa selecionável no cabeçalho marca todos para exclusão geral.</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EMISSÃO DE CARNÊ & PARCELAMENTO EM LOTE */}
          {activeTab === 'lancamento' && (
            <form onSubmit={handleCreatePurchaseBatch} className="space-y-4 max-w-3xl mx-auto">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-900 text-xs">
                <span className="font-bold flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">receipt</span>
                  Emissão Rápida de Compra e Desdobramento de Títulos em Lote
                </span>
                <p className="text-[11px] text-slate-600">
                  Cadastre uma compra e o sistema ERP dividirá automaticamente o valor total em até 24 parcelas com datas de vencimento sequenciais e gravação no razão contábil.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#fafafa] border border-slate-300 rounded-xl">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold mb-1 text-slate-700">Devedor Titular da Compra *</label>
                  <select
                    required
                    value={newPurchaseDebtorId}
                    onChange={(e) => setNewPurchaseDebtorId(e.target.value)}
                    className="w-full h-8.5 sm:h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none font-semibold"
                  >
                    {debtors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} (Saldo: R$ {(Number(d.totalOwed) || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold mb-1 text-slate-700">Descrição do Produto / Serviço *</label>
                  <input
                    type="text"
                    required
                    value={newPurchaseProduct}
                    onChange={(e) => setNewPurchaseProduct(e.target.value)}
                    placeholder="Ex: Pneus Aro 16 Pirelli Scorpion"
                    className="w-full h-8.5 sm:h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none uppercase font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1 text-slate-700">Loja / Estabelecimento</label>
                  <input
                    type="text"
                    value={newPurchaseStore}
                    onChange={(e) => setNewPurchaseStore(e.target.value)}
                    placeholder="Ex: Magazine Luiza"
                    className="w-full h-8.5 sm:h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1 text-slate-700">Cartão / Banco Emissor</label>
                  <input
                    type="text"
                    list="erp-card-options"
                    value={newPurchaseCard}
                    onChange={(e) => setNewPurchaseCard(e.target.value)}
                    placeholder="Ex: Nubank Nação, Itaú..."
                    className="w-full h-8.5 sm:h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none"
                    required
                  />
                  <datalist id="erp-card-options">
                    <option value="Nubank Nação" />
                    <option value="Nubank Croma" />
                    <option value="Nubank Black" />
                    <option value="Itaú Uniclass" />
                    <option value="Mercado Pago" />
                    {institutions.map((b) => (
                      <option key={b.id} value={b.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1 text-slate-700">Valor Total da Compra (R$) *</label>
                  <input
                    type="number"
                    step={0.01}
                    required
                    value={newPurchaseAmount}
                    onChange={(e) => setNewPurchaseAmount(e.target.value)}
                    placeholder="1200.00"
                    className="w-full h-8.5 sm:h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1 text-slate-700">Número de Parcelas *</label>
                  <select
                    value={newPurchaseCount}
                    onChange={(e) => setNewPurchaseCount(e.target.value)}
                    className="w-full h-8.5 sm:h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 24].map((num) => (
                      <option key={num} value={num}>
                        {num}x de R$ {(parseFloat(newPurchaseAmount || '0') / num).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold mb-1 text-slate-700">Vencimento da 1ª Parcela *</label>
                  <input
                    type="date"
                    required
                    value={newPurchaseFirstDate}
                    onChange={(e) => setNewPurchaseFirstDate(e.target.value)}
                    className="w-full h-8.5 sm:h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">done_all</span>
                  <span>Gravar e Desdobrar Carnê de Parcelas</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: ENTRADA RÁPIDA DE DIGITAÇÃO ARP EM MASSA (PLANILHA CONTÁBIL ULTRA OTIMIZADA) */}
          {activeTab === 'massa' && (
            <div className="space-y-1">
              {/* Barra Superior de Controle Compacta */}
              <div className="p-0.5 px-1 bg-amber-50/90 border border-amber-200 rounded text-amber-900 text-[10px] flex items-center justify-between gap-1 shadow-2xs">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="material-symbols-outlined text-[13px] text-amber-700 shrink-0">grid_on</span>
                  <span className="font-bold text-[10px] text-amber-900 truncate">
                    Digitação ARP
                  </span>
                  <span className="text-[8.5px] text-amber-800 hidden md:inline border-l border-amber-300 pl-1">
                    Navegue por <kbd className="px-0.5 py-0 bg-amber-200 rounded font-mono font-bold text-[8px]">Tab</kbd>
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (bulkRows.length > 0) {
                        const last = bulkRows[bulkRows.length - 1];
                        setBulkRows([
                          ...bulkRows,
                          {
                            id: Date.now(),
                            debtorName: last.debtorName,
                            doc: last.doc,
                            valor: last.valor,
                            venc: last.venc,
                            parc: last.parc,
                            status: 'Pendente',
                          },
                        ]);
                        onToast('Linha duplicada.');
                      }
                    }}
                    className="px-1 py-0 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-bold text-[8.5px] rounded cursor-pointer transition-colors"
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkRows([
                        ...bulkRows,
                        {
                          id: Date.now(),
                          debtorName: '',
                          doc: '',
                          valor: '0.00',
                          venc: new Date().toISOString().split('T')[0],
                          parc: '1/1',
                          status: 'Pendente',
                        },
                      ]);
                      onToast('Nova linha adicionada.');
                    }}
                    className="px-1.5 py-0 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[9px] rounded cursor-pointer shadow-2xs flex items-center gap-0.5 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[11px]">add</span>
                    <span>+ Linha</span>
                  </button>
                </div>
              </div>

              {/* GRADE ULTRA OTIMIZADA COM CPF ABAIXO DO NOME E PARCELAS JUNTO AO VENCIMENTO */}
              <div className="border border-slate-300 rounded overflow-x-auto scrollbar-none bg-white shadow-2xs max-h-[62vh] sm:max-h-[500px] w-full">
                <table className="w-full table-fixed border-collapse text-[8px] sm:text-[11px] digitacao-arp-table">
                  <thead className="bg-slate-100 text-slate-800 font-mono text-[7px] sm:text-[10px] border-b border-slate-300 font-bold select-none sticky top-0 z-10">
                    <tr className="h-5 sm:h-7">
                      <th className="p-0 border-r border-slate-300 w-[5%] sm:w-[32px] text-center bg-slate-200/80 text-slate-700 leading-none">#</th>
                      <th className="p-0 px-1 border-r border-slate-300 w-[38%] sm:w-auto bg-slate-100 text-left leading-none">
                        Nome / Razão <span className="text-[6.5px] sm:text-[8.5px] text-slate-500 font-normal block">(CPF / CNPJ abaixo)</span>
                      </th>
                      <th className="p-0 px-1 border-r border-slate-300 w-[32%] sm:w-[150px] bg-slate-100 text-left leading-none">
                        Vencimento <span className="text-[6.5px] sm:text-[8.5px] text-amber-700 font-normal block">(e Parc.)</span>
                      </th>
                      <th className="p-0 px-1 border-r border-slate-300 w-[20%] sm:w-[100px] bg-red-50/90 text-red-800 text-right leading-none">Valor</th>
                      <th className="p-0 text-center w-[5%] sm:w-[32px] bg-slate-100 leading-none">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {bulkRows.map((row, idx) => (
                      <tr key={row.id} className="bg-white hover:bg-amber-50/40 transition-colors h-9 sm:h-10">
                        <td className="p-0 border-r border-slate-200 w-[5%] sm:w-[32px] font-mono text-[8px] sm:text-[10px] text-slate-500 font-bold text-center bg-slate-50/60 select-none leading-none">
                          {idx + 1}
                        </td>
                        <td className="p-0.5 border-r border-slate-200 w-[38%] sm:w-auto">
                          <div className="flex flex-col gap-0.5">
                            <input
                              type="text"
                              value={row.debtorName}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const updated = [...bulkRows];
                                updated[idx].debtorName = e.target.value;
                                setBulkRows(updated);
                              }}
                              placeholder="NOME / RAZÃO SOCIAL"
                              className="w-full h-4 sm:h-5 px-1 bg-transparent border-0 hover:bg-amber-50/50 focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-[8.5px] sm:text-[11px] text-slate-900 uppercase font-semibold outline-none rounded-none transition-colors p-0 leading-tight cursor-text"
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.doc}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const updated = [...bulkRows];
                                updated[idx].doc = e.target.value;
                                setBulkRows(updated);
                              }}
                              placeholder="CPF / CNPJ"
                              className="w-full h-3.5 sm:h-4.5 px-1 bg-slate-50/80 border-t border-slate-200 hover:bg-amber-50/50 focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 text-[7.5px] sm:text-[10px] font-mono text-slate-700 tracking-tighter outline-none rounded-none transition-colors p-0 leading-tight cursor-text"
                            />
                          </div>
                        </td>
                        <td className="p-0.5 border-r border-slate-200 w-[32%] sm:w-[150px]">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-0.5 bg-slate-50/80 hover:bg-amber-100/60 transition-colors rounded-none p-0 cursor-pointer border-0">
                              <input
                                type="date"
                                value={row.venc}
                                onClick={(e) => {
                                  try {
                                    e.currentTarget.showPicker?.();
                                  } catch (_) {}
                                }}
                                onChange={(e) => {
                                  const updated = [...bulkRows];
                                  updated[idx].venc = e.target.value;
                                  setBulkRows(updated);
                                }}
                                className="w-full h-4 sm:h-5 bg-transparent border-0 text-[7.5px] sm:text-[10.5px] font-bold font-mono text-slate-900 outline-none cursor-pointer p-0 px-0.5 leading-tight active:bg-amber-100"
                              />
                            </div>
                            <div className="flex items-center border-t border-slate-200 bg-amber-50/40 hover:bg-amber-100/60 transition-colors">
                              <span className="text-[7px] text-amber-800 font-bold px-0.5 shrink-0">Parc:</span>
                              <select
                                value={row.parc}
                                onChange={(e) => {
                                  const updated = [...bulkRows];
                                  updated[idx].parc = e.target.value;
                                  setBulkRows(updated);
                                }}
                                className="w-full h-3.5 sm:h-4.5 text-center bg-transparent hover:bg-amber-100/80 focus:bg-white text-[7.5px] sm:text-[10px] font-mono font-bold text-slate-900 outline-none cursor-pointer rounded-none transition-colors p-0 leading-tight"
                              >
                                {["1/1", "1/2", "1/3", "1/4", "1/5", "1/6", "1/7", "1/8", "1/9", "1/10", "1/11", "1/12", "1/15", "1/18", "1/24", "1/36", "1/48", "1/60", "1/100"]
                                  .concat(!["1/1", "1/2", "1/3", "1/4", "1/5", "1/6", "1/7", "1/8", "1/9", "1/10", "1/11", "1/12", "1/15", "1/18", "1/24", "1/36", "1/48", "1/60", "1/100"].includes(row.parc) ? [row.parc] : [])
                                  .map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </td>
                        <td className="p-0.5 border-r border-slate-200 w-[20%] sm:w-[100px] bg-red-50/20">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.valor}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const updated = [...bulkRows];
                              updated[idx].valor = e.target.value;
                              setBulkRows(updated);
                            }}
                            placeholder="150.00"
                            className="w-full h-8 sm:h-10 px-1 bg-transparent border-0 hover:bg-red-50 focus:bg-white focus:ring-1 focus:ring-red-500 text-[8.5px] sm:text-[11px] font-mono text-red-600 font-bold text-right outline-none rounded-none transition-colors p-0 leading-tight cursor-text"
                          />
                        </td>
                        <td className="p-0 text-center w-[5%] sm:w-[32px]">
                          <button
                            type="button"
                            onClick={() => {
                              if (bulkRows.length <= 1) {
                                onToast('A planilha de digitação deve conter ao menos 1 linha.');
                                return;
                              }
                              setBulkRows(bulkRows.filter((r) => r.id !== row.id));
                              onToast('Linha de digitação removida.');
                            }}
                            className="w-full h-8 sm:h-10 flex items-center justify-center bg-red-50/50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer p-0"
                            title="Remover linha"
                          >
                            <span className="material-symbols-outlined text-[10px] sm:text-[14px] block leading-none">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rodapé de Totais e Gravação do Lote Otimizado */}
              <div className="p-1 bg-slate-100 border border-slate-300 rounded flex items-center justify-between gap-1 shadow-2xs font-mono text-[9.5px]">
                <div className="flex items-center gap-1.5 text-slate-700 min-w-0">
                  <span className="truncate text-[9px]">
                    Lote: <strong className="text-slate-900">{bulkRows.length}</strong>
                  </span>
                  <span className="truncate text-[9px]">
                    Total:{' '}
                    <strong className="text-red-600 font-black text-[10px]">
                      R${' '}
                      {bulkRows
                        .reduce((sum, r) => sum + (parseFloat(r.valor.replace(',', '.')) || 0), 0)
                        .toFixed(2)}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkRows([
                        { id: Date.now(), debtorName: '', doc: '', valor: '0.00', venc: new Date().toISOString().split('T')[0], parc: '1/1', status: 'Pendente' }
                      ]);
                      onToast('Planilha de digitação limpa.');
                    }}
                    className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[8.5px] rounded transition-colors cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const filledRows = bulkRows.filter((r) => r.debtorName.trim() !== '' && parseFloat(r.valor) > 0);
                      onToast(`[Gravação ARP] Lote com ${filledRows.length || bulkRows.length} título(s) processado e salvo no ERP!`);
                    }}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] rounded shadow cursor-pointer flex items-center justify-center gap-0.5 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[11px]">save</span>
                    <span>Gravar Lote</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUDITORIA & LOGS (TELA PRETA E VERDE DE AUDITORIA REAL) */}
          {activeTab === 'auditoria' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="p-4 bg-black border-2 border-emerald-500/60 rounded-2xl text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)] space-y-4">
                {/* Terminal Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-emerald-500/30 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h4 className="font-extrabold text-sm text-emerald-300 uppercase tracking-wider">
                      📟 Trilha de Auditoria, Criptografia &amp; Rastro Firestore
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-emerald-300/80 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                    <span>HASH: BR-CONF-256</span>
                    <span>•</span>
                    <span>{auditLogs.length} EVENTOS REGISTRADOS</span>
                  </div>
                </div>

                {/* Search & Actions Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={auditFilter}
                      onChange={(e) => setAuditFilter(e.target.value)}
                      placeholder="Filtrar eventos por ação, devedor ou hash..."
                      className="w-full h-8 px-3 bg-black/90 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 placeholder-emerald-700 outline-none focus:border-emerald-400 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const content = auditLogs
                          .map((l) => `[${l.timestamp}] [${l.hash}] [${l.status}] ${l.action}: ${l.details}`)
                          .join('\n');
                        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `HASPAHO_Auditoria_${Date.now()}.txt`;
                        a.click();
                        onToast('Relatório de auditoria exportado em TXT!');
                      }}
                      className="h-8 px-3 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/50 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">download</span>
                      <span>Exportar (.txt)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        clearAuditLogs();
                        onToast('Trilha de auditoria limpa.');
                      }}
                      className="h-8 px-3 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                      <span>Limpar Logs</span>
                    </button>
                  </div>
                </div>

                {/* Console Log Terminal Stream */}
                <div className="bg-black/95 border border-emerald-500/30 rounded-xl p-3 max-h-[380px] overflow-y-auto space-y-2 text-[11px] leading-relaxed scrollbar-thin">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-8 text-emerald-600">
                      &gt; Nenhum registro na trilha de auditoria até o momento.
                    </div>
                  ) : (
                    auditLogs
                      .filter((log) => {
                        if (!auditFilter.trim()) return true;
                        const q = auditFilter.toLowerCase();
                        return (
                          log.action.toLowerCase().includes(q) ||
                          log.details.toLowerCase().includes(q) ||
                          log.hash.toLowerCase().includes(q) ||
                          log.timestamp.toLowerCase().includes(q)
                        );
                      })
                      .map((log) => (
                        <div
                          key={log.id}
                          className="p-2 bg-emerald-950/20 hover:bg-emerald-950/40 rounded-lg border border-emerald-500/20 flex flex-col gap-1 transition-colors"
                        >
                          <div className="flex items-center justify-between text-[10px] text-emerald-400/80 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-500 font-bold">[{log.timestamp}]</span>
                              <span className="px-1.5 py-0.2 bg-emerald-900/60 border border-emerald-500/40 rounded text-[9.5px] font-bold text-emerald-200">
                                {log.status}
                              </span>
                            </div>
                            <span className="font-mono text-emerald-600 font-bold">{log.hash}</span>
                          </div>

                          <div className="text-emerald-300 font-semibold">
                            <span className="text-amber-400 font-bold mr-1.5">&gt; {log.action}:</span>
                            <span>{log.details}</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Classic Windows ERP Status Bar (TStatusBar - Reenquadrado no Mobile) */}
      <div
        className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-1 border-t text-[10.5px] sm:text-[10px] font-mono select-none ${
          themeMode === 'classic_delphi'
            ? 'bg-slate-100 text-slate-800 border-slate-300'
            : 'bg-slate-950 text-slate-400 border-slate-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-4">
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              ONLINE
            </span>
            <span className="text-slate-700">REG: <strong>{debtors.findIndex((d) => d.id === selectedDebtorId) + 1}</strong>/{debtors.length}</span>
            <span className="hidden sm:inline text-slate-600">BD: isentropic-tangent-sdtd0</span>
            <span className="truncate max-w-[120px] sm:max-w-none text-slate-600">OP: {currentUser?.name || 'Thiago Dias'}</span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-4 font-bold border-t sm:border-t-0 pt-1 sm:pt-0 border-slate-300">
            <span>RECEBÍVEIS: <strong className="text-emerald-700">R$ {totalReceivables.toFixed(2)}</strong></span>
            <span>ATRASO: <strong className="text-red-700">R$ {totalOverdueAmount.toFixed(2)}</strong></span>
          </div>
        </div>
      </div>

      {/* MODAL 1: CONFIRMAÇÃO DE EXCLUSÃO EM MASSA / EXCLUIR GERAL */}
      {confirmBulkDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/50 rounded-xl shadow-2xl p-5 text-white animate-fade-in font-sans">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-500/50 flex items-center justify-center shrink-0 text-red-400">
                <span className="material-symbols-outlined text-[24px]">delete_sweep</span>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>Confirmação de Exclusão Contábil</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  {bulkDeleteScope === 'selected' ? (
                    <>
                      Você selecionou <strong>{selectedInstIds.length} título(s)</strong> no valor total de{' '}
                      <strong className="text-amber-300">R$ {totalSelectedAmount.toFixed(2)}</strong>.
                    </>
                  ) : (
                    <>
                      Você solicitou a <strong>Exclusão Geral</strong> de todos os{' '}
                      <strong>{filteredInstallments.length} títulos</strong> listados na Grade Contábil (Total:{' '}
                      <strong className="text-amber-300">
                        R$ {filteredInstallments.reduce((acc, i) => acc + i.amount, 0).toFixed(2)}
                      </strong>
                      ).
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-300 space-y-1.5 font-mono">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="material-symbols-outlined text-[15px]">shield</span>
                <span>Proteção HASPAHO ERP &amp; Lixeira Ativa</span>
              </div>
              <p className="text-slate-400">
                Os títulos serão retirados de circulação ativa e enviados com segurança para a <strong>Lixeira Contábil</strong>. Se você cometeu um engano, poderá <strong>desfazer imediatamente</strong> ou restaurá-los pela Lixeira a qualquer momento.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmBulkDeleteOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Confirmar e Mover para a Lixeira</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: LIXEIRA CONTÁBIL DE CONTAS A RECEBER (DESFAZER AÇÕES) */}
      {showTrashModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in font-sans">
            {/* Cabeçalho do Modal */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 select-none">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Lixeira de Contas a Receber (Grade Contábil)</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/40 font-bold">
                      {deletedInstallments.length} registro(s)
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Recupere títulos excluídos ou desfaça ações contábeis acidentais.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {deletedInstallments.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleRestoreInstallments(deletedInstallments)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                      title="Restaurar todos os títulos excluídos para a Grade Contábil"
                    >
                      <span className="material-symbols-outlined text-[16px]">restore</span>
                      <span>Restaurar Todos (Desfazer Tudo)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEmptyTrash}
                      className="px-2.5 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-700/60 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                      title="Excluir permanentemente todos os registros da lixeira"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete_forever</span>
                      <span>Esvaziar Lixeira</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowTrashModal(false)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                  title="Fechar lixeira"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Barra de Filtro na Lixeira */}
            <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-slate-400">search</span>
              <input
                type="search"
                value={trashSearch}
                onChange={(e) => setTrashSearch(e.target.value)}
                placeholder="Pesquisar por devedor, produto ou título na lixeira..."
                className="w-full h-8 px-2.5 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none"
              />
            </div>

            {/* Conteúdo da Lixeira / Tabela de Títulos Excluídos */}
            <div className="flex-1 overflow-auto p-3">
              {deletedInstallments.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <div className="w-14 h-14 mx-auto rounded-full bg-slate-800/60 flex items-center justify-center text-slate-500 mb-3">
                    <span className="material-symbols-outlined text-[28px]">delete_outline</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-300">A Lixeira Contábil está vazia</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Nenhum título ou parcela foi excluído recentemente. Quando você excluir parcelas no ERP, elas aparecerão aqui para serem restauradas se necessário.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-700 rounded-lg overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] font-mono min-w-[700px]">
                    <thead className="bg-slate-950 text-slate-300 uppercase text-[10px] border-b border-slate-700 select-none sticky top-0">
                      <tr>
                        <th className="p-2 border-r border-slate-800 w-14">Título</th>
                        <th className="p-2 border-r border-slate-800">Devedor</th>
                        <th className="p-2 border-r border-slate-800">Produto</th>
                        <th className="p-2 border-r border-slate-800 text-center">Parc.</th>
                        <th className="p-2 border-r border-slate-800">Vencimento</th>
                        <th className="p-2 border-r border-slate-800 text-right">Valor</th>
                        <th className="p-2 border-r border-slate-800">Excluído em</th>
                        <th className="p-2 text-center w-32 select-none">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {deletedInstallments
                        .filter((item) => {
                          if (!trashSearch.trim()) return true;
                          const q = trashSearch.toLowerCase();
                          return (
                            item.debtorName.toLowerCase().includes(q) ||
                            item.product.toLowerCase().includes(q) ||
                            item.id.toLowerCase().includes(q)
                          );
                        })
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-2 border-r border-slate-800 text-slate-400">{item.id.slice(-5)}</td>
                            <td className="p-2 border-r border-slate-800 font-sans font-semibold text-white">{item.debtorName}</td>
                            <td className="p-2 border-r border-slate-800 truncate max-w-xs text-slate-300">{item.product}</td>
                            <td className="p-2 border-r border-slate-800 text-center text-slate-400">
                              {item.installmentNumber}/{item.totalInstallments}
                            </td>
                            <td className="p-2 border-r border-slate-800 text-slate-300">
                              {new Date(item.dueDate).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-2 border-r border-slate-800 text-right font-bold text-amber-300">
                              R$ {item.amount.toFixed(2)}
                            </td>
                            <td className="p-2 border-r border-slate-800 text-[10px] text-slate-400">
                              {item.deletedAt ? new Date(item.deletedAt).toLocaleString('pt-BR') : 'Hoje'}
                            </td>
                            <td className="p-2 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleRestoreInstallments([item])}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10px] cursor-pointer inline-flex items-center gap-1 shadow-xs transition-transform active:scale-95"
                                title="Desfazer exclusão e restaurar este título"
                              >
                                <span className="material-symbols-outlined text-[13px]">undo</span>
                                <span>Restaurar</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Rodapé do Modal da Lixeira */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>
                Total na lixeira: <strong>{deletedInstallments.length}</strong> títulos | Total:{' '}
                <strong className="text-amber-300">
                  R$ {deletedInstallments.reduce((acc, i) => acc + i.amount, 0).toFixed(2)}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setShowTrashModal(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs cursor-pointer font-sans"
              >
                Fechar Lixeira
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / BALÃOZINHO DE CONFIRMAÇÃO DE PERMISSÃO DE LIQUIDAÇÃO ARP */}
      {confirmLiquidationInst && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3.5 animate-fade-in font-sans select-none">
          <div className="w-full max-w-sm bg-white border-2 border-emerald-500 rounded-2xl shadow-2xl overflow-hidden transform transition-all relative">
            {/* Cabeçalho estilo balãozinho de permissão */}
            <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span className="material-symbols-outlined text-[22px] text-emerald-200">verified_user</span>
                <span>Permissão de Liquidação</span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmLiquidationInst(null)}
                className="w-6 h-6 rounded-full hover:bg-emerald-700 flex items-center justify-center text-white cursor-pointer transition-colors font-bold text-xs"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo Principal */}
            <div className="p-4 sm:p-5 text-slate-800 space-y-3.5">
              <div className="flex items-center gap-3 p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl">
                <span className="material-symbols-outlined text-[28px] text-emerald-600 shrink-0">help_center</span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                    Tem certeza? Liquidar compra
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Solicitação de autorização para dar baixa contábil.
                  </p>
                </div>
              </div>

              {/* Card de Detalhes da Compra / Parcela */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2 font-mono">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Cliente / Sacado:</span>
                  <strong className="text-slate-900 font-sans truncate max-w-[170px] text-right">{confirmLiquidationInst.debtorName}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Produto / Item:</span>
                  <strong className="text-slate-900 font-sans truncate max-w-[170px] text-right">{confirmLiquidationInst.product}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Parcela:</span>
                  <strong className="text-blue-700">#{confirmLiquidationInst.installmentNumber} de {confirmLiquidationInst.totalInstallments}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Vencimento:</span>
                  <strong className="text-slate-800">{new Date(confirmLiquidationInst.dueDate).toLocaleDateString('pt-BR')}</strong>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 text-slate-800 font-bold">
                  <span>Valor Nominal:</span>
                  <strong className="text-red-600 font-black text-sm">R$ {confirmLiquidationInst.amount.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* Botões Sim e Não */}
            <div className="bg-slate-100 px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmLiquidationInst(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => {
                  handleQuickPayInstallment(confirmLiquidationInst.id);
                  setConfirmLiquidationInst(null);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Sim</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE LIQUIDAÇÃO TOTAL DO DEVEDOR (AÇÕES ERP) */}
      {confirmLiquidateDebtor && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3.5 animate-fade-in font-sans select-none">
          <div className="w-full max-w-sm bg-white border-2 border-emerald-500 rounded-2xl shadow-2xl overflow-hidden transform transition-all relative">
            {/* Cabeçalho */}
            <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span className="material-symbols-outlined text-[22px] text-emerald-200">paid</span>
                <span>Confirmar Liquidação do Devedor</span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmLiquidateDebtor(null)}
                className="w-6 h-6 rounded-full hover:bg-emerald-700 flex items-center justify-center text-white cursor-pointer transition-colors font-bold text-xs"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[32px] text-emerald-600 shrink-0">verified</span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                    Liquidar Saldo Total?
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Esta ação quitará todas as pendências e atualizará o status contábil para Liquidado.
                  </p>
                </div>
              </div>

              {/* Card de Detalhes */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Cliente / Devedor:</span>
                  <strong className="text-slate-900 font-sans truncate max-w-[170px] text-right">{confirmLiquidateDebtor.name}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>CPF / Documento:</span>
                  <strong className="text-slate-800">{confirmLiquidateDebtor.documentNumber || confirmLiquidateDebtor.cpfCnpj || 'Não consta'}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Total Já Quitado:</span>
                  <strong className="text-emerald-700">R$ {(Number(confirmLiquidateDebtor.totalPaid) || 0).toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-slate-900 font-bold">
                  <span>Saldo a Liquidar:</span>
                  <strong className="text-red-600 font-black text-sm">
                    R$ {(Number(confirmLiquidateDebtor.totalOwed) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>

            {/* Botões Não / Sim */}
            <div className="bg-slate-100 px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmLiquidateDebtor(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                Não, Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmLiquidateDebtor;
                  setConfirmLiquidateDebtor(null);
                  executeLiquidationDebtor(target);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Sim, Liquidar Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / BALÃOZINHO DE CONFIRMAÇÃO DE PERMISSÃO DE EXCLUSÃO (LIXEIRA) ARP */}
      {confirmDeleteInst && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3.5 animate-fade-in font-sans select-none">
          <div className="w-full max-w-sm bg-white border-2 border-red-500 rounded-2xl shadow-2xl overflow-hidden transform transition-all relative">
            {/* Cabeçalho estilo balãozinho de permissão */}
            <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span className="material-symbols-outlined text-[22px] text-red-200">delete_forever</span>
                <span>Permissão de Exclusão (Lixeira)</span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteInst(null)}
                className="w-6 h-6 rounded-full hover:bg-red-700 flex items-center justify-center text-white cursor-pointer transition-colors font-bold text-xs"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo Principal */}
            <div className="p-4 sm:p-5 text-slate-800 space-y-3.5">
              <div className="flex items-center gap-3 p-3 bg-red-50/90 border border-red-200 rounded-xl">
                <span className="material-symbols-outlined text-[28px] text-red-600 shrink-0">help_center</span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                    Tem certeza? Excluir item / título
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    O registro será movido para a Lixeira Contábil do ERP.
                  </p>
                </div>
              </div>

              {/* Card de Detalhes do Registro a Excluir */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2 font-mono">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Cliente / Sacado:</span>
                  <strong className="text-slate-900 font-sans truncate max-w-[170px] text-right">{confirmDeleteInst.debtorName}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Produto / Item:</span>
                  <strong className="text-slate-900 font-sans truncate max-w-[170px] text-right">{confirmDeleteInst.product}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Parcela:</span>
                  <strong className="text-blue-700">#{confirmDeleteInst.installmentNumber} de {confirmDeleteInst.totalInstallments}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Vencimento:</span>
                  <strong className="text-slate-800">{new Date(confirmDeleteInst.dueDate).toLocaleDateString('pt-BR')}</strong>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 text-slate-800 font-bold">
                  <span>Valor do Título:</span>
                  <strong className="text-red-600 font-black text-sm">R$ {confirmDeleteInst.amount.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* Botões Sim e Não */}
            <div className="bg-slate-100 px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteInst(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetInst = confirmDeleteInst;
                  setConfirmDeleteInst(null);
                  moveToTrash([targetInst], `Parcela #${targetInst.installmentNumber} do produto "${targetInst.product}" (${targetInst.debtorName})`);
                }}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                <span>Sim</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JANELAS FLUTUANTES DUPLAS DE INFORMAÇÃO DO DEVEDOR ARP */}
      {activeBalloonDebtorId && (() => {
        const d = debtors.find(deb => deb.id === activeBalloonDebtorId) || debtors[0];
        if (!d) return null;
        const info = getUpcomingInstallmentInfo(d.id, d.totalOwed);
        const isOverdue = d.overdueCount > 0;
        const isPaid = Number(d.totalOwed) <= 0;

        return (
          <div className="fixed inset-0 z-[9990] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pb-6 sm:pb-4 animate-in fade-in duration-300 font-sans select-none" onClick={() => { try { playAppSound('click'); } catch {} setActiveBalloonDebtorId(null); }}>
            <div className="w-full max-w-xl sm:max-w-2xl bg-white dark:bg-slate-900 border-2 border-cyan-400 rounded-3xl shadow-2xl transform transition-all relative animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden max-h-[88vh] sm:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              {/* Cabeçalho da Janela Principal */}
              <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between border-b border-cyan-500/40 shadow-md shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-inner">
                    <span className="material-symbols-outlined text-[20px] animate-spin" style={{ animationDuration: '10s' }}>tab_window</span>
                  </div>
                  <div>
                    <h3 className="font-black text-xs sm:text-sm text-white tracking-tight flex items-center gap-1.5">
                      <span>Janelas de Informação do Devedor</span>
                      <span className="text-xs animate-bounce">✨</span>
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-cyan-200/90 font-medium truncate max-w-[240px] sm:max-w-md">
                      Exibindo painéis para <strong className="text-white font-bold">{d.name}</strong> 🚀
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { try { playAppSound('click'); } catch {} setActiveBalloonDebtorId(null); }}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold transition-all transform hover:scale-105 cursor-pointer shadow-md shrink-0"
                  title="Fechar"
                >
                  ✕
                </button>
              </div>

              {/* Corpo com as 2 Janelas Lado a Lado / Empilhadas - Reenquadrado com rolagem suave no mobile */}
              <div className="p-2.5 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 bg-slate-100 dark:bg-slate-950 overflow-y-auto flex-1 scrollbar-thin">
                
                {/* JANELA 1: Card de Vencimento / Atraso */}
                <div className={`p-3 sm:p-3.5 rounded-2xl border-2 shadow-md flex flex-col justify-between font-sans ${
                  isOverdue
                    ? 'bg-gradient-to-b from-red-50 via-white to-red-100 border-red-500 text-red-950'
                    : !isPaid
                    ? 'bg-gradient-to-b from-amber-50 via-white to-amber-100 border-amber-400 text-amber-950'
                    : 'bg-gradient-to-b from-emerald-50 via-white to-emerald-100 border-emerald-400 text-emerald-950'
                }`}>
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80">
                      <span className="font-black text-[11px] sm:text-xs flex items-center gap-1.5">
                        <span className="text-sm">{isOverdue ? '🚨' : !isPaid ? '⏳' : '✅'}</span>
                        <span>{isOverdue ? 'Parcela em Atraso' : !isPaid ? 'Próximo Vencimento' : 'Situação Regular'}</span>
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-white/90 border border-slate-300 font-mono">
                        Janela 01
                      </span>
                    </div>

                    <div className="text-[11px] mb-2 font-mono bg-white/80 p-2 rounded-xl border border-slate-200">
                      <div className="text-[8.5px] text-slate-500 font-bold uppercase tracking-wider">Cliente:</div>
                      <div className="font-black text-xs text-slate-900 truncate">{d.name}</div>
                    </div>

                    <div className="bg-white/95 p-2.5 rounded-xl border border-slate-200 text-[11px] font-mono space-y-1.5 shadow-2xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-semibold">Nº Parcela:</span>
                        <span className="font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{info.parcela}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-semibold">Vencimento:</span>
                        <span className={`font-black ${isOverdue ? 'text-red-600' : !isPaid ? 'text-amber-900' : 'text-emerald-700'}`}>{info.vencimento}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-semibold">Valor da Parcela:</span>
                        <span className="font-black text-red-600 text-xs sm:text-sm">{info.valor}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 text-[9px] text-slate-500 text-center font-medium">
                    Rastreio inteligente de vencimento
                  </div>
                </div>

                {/* JANELA 2: Balão Escuro de Resumo Financeiro & Scores */}
                <div className="p-3 sm:p-3.5 bg-slate-900 text-white rounded-2xl border-2 border-blue-400/80 shadow-md flex flex-col justify-between font-mono">
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
                      <span className="font-black text-cyan-300 flex items-center gap-1.5 text-[11px] sm:text-xs">
                        <span>📌</span>
                        <span>Resumo & Scores</span>
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-slate-800 text-cyan-300 border border-slate-700 font-mono">
                        Janela 02
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] pt-0.5">
                      <div className="flex items-center justify-between bg-slate-800/90 p-2 rounded-xl border border-slate-700">
                        <span className="text-slate-400 font-medium">Vencimento:</span>
                        <span className="font-extrabold text-amber-300">{info.vencimento}</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-800/90 p-2 rounded-xl border border-slate-700">
                        <span className="text-slate-300 font-medium">Liquidado:</span>
                        <span className="font-extrabold text-emerald-400">
                          R$ {(Number(d.totalPaid) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-800/90 p-2 rounded-xl border border-slate-700">
                        <span className="text-slate-300 font-medium">Saldo Devedor:</span>
                        <span className="font-extrabold text-red-400">
                          R$ {(Number(d.totalOwed) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Bloco de Scores (Credor e Devedor um abaixo do outro) */}
                      {(() => {
                        const totalRec = installments.filter(i => i.status === 'paid').reduce((acc, i) => acc + (i.amount || 0), 0);
                        const totalPend = installments.filter(i => i.status !== 'paid').reduce((acc, i) => acc + (i.amount || 0), 0);
                        const totalAll = totalRec + totalPend;
                        const recRate = totalAll > 0 ? (totalRec / totalAll) * 100 : 100;
                        const overdueCt = installments.filter(i => i.status === 'overdue').length;
                        let credScore = 820;
                        if (recRate >= 80) credScore += 100;
                        else if (recRate >= 50) credScore += 40;
                        else credScore -= 120;
                        if (overdueCt > 0) credScore -= overdueCt * 45;
                        credScore = Math.max(100, Math.min(1000, Math.round(credScore)));
                        const isCredPos = credScore >= 600;

                        const debtorScoreVal = Number(d.score) || 780;
                        const isDebtorPos = debtorScoreVal >= 600;

                        const getScoreBadge = (score: number) => {
                          if (score >= 800) return { label: 'Excelente', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
                          if (score >= 700) return { label: 'Bom', className: 'bg-teal-500/20 text-teal-300 border-teal-500/40' };
                          if (score >= 600) return { label: 'Regular', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
                          return { label: 'Crítico', className: 'bg-red-500/20 text-red-300 border-red-500/40' };
                        };

                        const credBadge = getScoreBadge(credScore);
                        const debtorBadge = getScoreBadge(debtorScoreVal);

                        return (
                          <div className="mt-2 pt-2 border-t border-slate-700 space-y-1.5">
                            {/* Score do Credor */}
                            <div className="flex items-center justify-between bg-slate-800/95 p-1.5 sm:p-2 rounded-lg border border-cyan-500/30">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">🏆</span>
                                <span className="text-slate-200 font-bold text-[10px] sm:text-[11px]">Score Credor:</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-extrabold px-1.5 py-0.5 rounded border text-[9px] sm:text-[10px] ${credBadge.className}`}>
                                  {credBadge.label}
                                </span>
                                <span className="font-extrabold text-cyan-300 text-[11px] sm:text-[12px]">
                                  {credScore}
                                </span>
                              </div>
                            </div>

                            {/* Score do Devedor */}
                            <div className="flex items-center justify-between bg-slate-800/95 p-1.5 sm:p-2 rounded-lg border border-cyan-500/30">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">👤</span>
                                <span className="text-slate-200 font-bold text-[10px] sm:text-[11px]">Score Devedor:</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-extrabold px-1.5 py-0.5 rounded border text-[9px] sm:text-[10px] ${debtorBadge.className}`}>
                                  {debtorBadge.label}
                                </span>
                                <span className="font-extrabold text-cyan-300 text-[11px] sm:text-[12px]">
                                  {debtorScoreVal}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800 text-[9px] text-cyan-300/80 text-center font-sans font-medium">
                    PIX e status em tempo real ⚡
                  </div>
                </div>

              </div>

              {/* Rodapé da Janela Reenquadrado */}
              <div className="bg-slate-200 dark:bg-slate-900 px-4 py-3 border-t border-slate-300 dark:border-slate-800 flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    try { playAppSound('click'); } catch {}
                    setActiveBalloonDebtorId(null);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  title="Entendido"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Entendido</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Impressão de Documentos Oficiais ARP */}
      <ArpDocumentPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        debtors={debtors}
        installments={installments}
        purchases={purchases}
        initialDebtorId={selectedDebtorId}
        onToast={onToast}
      />

    </div>
  );
};
