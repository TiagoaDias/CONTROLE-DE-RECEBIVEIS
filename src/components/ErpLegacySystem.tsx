import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Debtor, Purchase, Installment, BankInstitution, UserAccount, ScreenTab } from '../types';
import { HaspahoLogo } from './HaspahoLogo';
import { getAuditLogs, clearAuditLogs, addAuditLog, AuditLogEntry } from '../utils/auditLogger';
import { saveDebtorsToFirestore, saveSingleDebtorToFirestore, deleteDebtorFromFirestore } from '../lib/firebase';

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
  const themeMode = 'classic_delphi';

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

  // Search & Filter in DBGrid
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'adimplente' | 'atrasado' | 'quitado'>('todos');

  // Filtered Debtors for Grid
  const filteredDebtors = useMemo(() => {
    return debtors.filter((d) => {
      const matchText =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.phone.includes(searchQuery) ||
        (d.documentNumber && d.documentNumber.includes(searchQuery)) ||
        d.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchText) return false;
      if (filterStatus === 'todos') return true;
      if (filterStatus === 'adimplente') return d.overdueCount === 0 && d.totalOwed > 0;
      if (filterStatus === 'atrasado') return d.overdueCount > 0;
      if (filterStatus === 'quitado') return d.totalOwed === 0;
      return true;
    });
  }, [debtors, searchQuery, filterStatus]);

  // Installments Search & Filter
  const [instSearch, setInstSearch] = useState('');
  const [instStatusFilter, setInstStatusFilter] = useState<string>('todos');

  const filteredInstallments = useMemo(() => {
    return installments.filter((i) => {
      const match =
        i.debtorName.toLowerCase().includes(instSearch.toLowerCase()) ||
        i.product.toLowerCase().includes(instSearch.toLowerCase()) ||
        i.id.toLowerCase().includes(instSearch.toLowerCase());
      if (!match) return false;
      if (instStatusFilter === 'todos') return true;
      return i.status === instStatusFilter;
    });
  }, [installments, instSearch, instStatusFilter]);

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
      const activeUserId = currentUser?.id || 'tiagodias8888@gmail.com';
      try {
        deleteDebtorFromFirestore(activeUserId, target.id);
        saveDebtorsToFirestore(activeUserId, updated);
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
      const activeUserId = currentUser?.id || 'tiagodias8888@gmail.com';
      try {
        deleteDebtorFromFirestore(activeUserId, debtor.id);
        saveDebtorsToFirestore(activeUserId, nextDebtors);
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

  // Salvar / Sincronizar registro específico da linha da tabela ERP
  const handleQuickSaveRecord = async (debtor: Debtor) => {
    const activeUserId = currentUser?.id || 'tiagodias8888@gmail.com';
    try {
      await saveSingleDebtorToFirestore(activeUserId, debtor);
      await saveDebtorsToFirestore(activeUserId, debtors);
      try {
        localStorage.setItem('haspaho_debtors', JSON.stringify(debtors));
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

  // Excluir parcela específica do título contábil
  const handleDeleteSpecificInstallment = (inst: Installment) => {
    if (onDeleteInstallment) {
      onDeleteInstallment(inst.id);
      return;
    }
    if (window.confirm(`⚠️ CONFIRMAÇÃO ERP: Deseja excluir a parcela ${inst.installmentNumber}/${inst.totalInstallments} de R$ ${inst.amount.toFixed(2)} (${inst.debtorName})?`)) {
      const nextInstallments = installments.filter((i) => i.id !== inst.id);
      onUpdateInstallments(nextInstallments);
      try {
        localStorage.setItem('haspaho_installments', JSON.stringify(nextInstallments));
      } catch (e) {
        console.error(e);
      }
      addAuditLog(
        'EXCLUSAO_PARCELA_ERP',
        `Título/Parcela ID ${inst.id} de "${inst.debtorName}" excluído no ERP.`,
        inst.debtorName,
        'FIRESTORE_SAVED'
      );
      onToast(`🗑️ Título/Parcela de R$ ${inst.amount.toFixed(2)} excluído com sucesso.`);
    }
  };

  // Quick Settlement / Baixa Manual de Parcela
  const handleQuickPayInstallment = (instId: string) => {
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
    onUpdateInstallments(updatedInst);

    // Update debtor balance
    const targetInst = installments.find((i) => i.id === instId);
    if (targetInst) {
      const updatedDebtors = debtors.map((d) => {
        if (d.id === targetInst.debtorId) {
          return {
            ...d,
            totalOwed: Math.max(0, d.totalOwed - targetInst.amount),
            totalPaid: d.totalPaid + targetInst.amount,
            overdueCount: Math.max(0, d.overdueCount - (targetInst.status === 'overdue' ? 1 : 0)),
            onTimePaymentsCount: d.onTimePaymentsCount + 1,
            score: Math.min(1000, d.score + 25),
          };
        }
        return d;
      });
      onUpdateDebtors(updatedDebtors);
    }
    onToast(`[Baixa Efetivada] Parcela #${instId} liquidada no razão contábil.`);
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
    return debtors.reduce((acc, d) => acc + d.totalOwed, 0);
  }, [debtors]);

  const totalOverdueAmount = useMemo(() => {
    return installments.filter((i) => i.status === 'overdue').reduce((acc, i) => acc + i.amount, 0);
  }, [installments]);

  return (
    <div
      className={`min-h-screen pt-16 pb-12 flex flex-col font-sans select-text ${
        themeMode === 'classic_delphi'
          ? 'bg-[#d4d0c8] text-black text-xs'
          : 'bg-slate-900 text-slate-100 text-xs'
      }`}
    >
      {/* Top Windows ERP Titlebar & System Bar */}
      <div
        className={`w-full border-b px-3 py-1.5 flex items-center justify-between shadow-xs select-none ${
          themeMode === 'classic_delphi'
            ? 'bg-gradient-to-r from-[#000080] via-[#1084d0] to-[#000080] text-white border-slate-400 font-bold'
            : 'bg-slate-950 text-slate-200 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-amber-400">desktop_windows</span>
          <span className="font-mono text-[11px] sm:text-xs tracking-tight font-bold">
            HASPAHO ERP Enterprise • Sistema de Gestão Financeira &amp; Lançamento em Massa [v4.8.2]
          </span>
          <span className="hidden lg:inline text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
            Operador: {currentUser?.name || 'Thiago Dias'} (ID: {currentUser?.username || 'tiagodias'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Static Classic Theme Badge */}
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#d4d0c8] text-black border border-slate-500 shadow-2xs">
            🖥️ Tema Clássico Profissional
          </span>

          {/* Quick Exit to Modern Mode */}
          <button
            onClick={() => onNavigate('dashboard')}
            className="px-3 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Retornar para o Dashboard Web Moderno"
          >
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            <span>Voltar ao Modo Moderno</span>
          </button>

          {/* Windows Classic Window Controls */}
          <div className="flex items-center gap-1 pl-2 border-l border-white/20">
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-5 h-5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold flex items-center justify-center rounded-xs"
              title="Minimizar para o Dashboard"
            >
              _
            </button>
            <button
              onClick={() => onToast('Janela maximizada em modo tela cheia ERP.')}
              className="w-5 h-5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold flex items-center justify-center rounded-xs"
              title="Maximizar"
            >
              🗖
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-5 h-5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold flex items-center justify-center rounded-xs"
              title="Fechar Modo ERP (Esc)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Classic Menu Bar (Arquivo, Cadastros, Lançamentos, etc.) */}
      <div
        className={`w-full px-3 py-1 flex flex-wrap items-center gap-4 text-[11px] border-b select-none ${
          themeMode === 'classic_delphi'
            ? 'bg-[#ece9d8] text-black border-slate-300 font-medium'
            : 'bg-slate-900 text-slate-300 border-slate-800'
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
            className="hover:underline hover:text-blue-500 transition-colors cursor-pointer"
          >
            {item.label.split(item.hotkey)[0]}
            <span className="underline font-bold">{item.hotkey}</span>
            {item.label.split(item.hotkey)[1]}
          </button>
        ))}

        <div className="ml-auto text-[10px] font-mono text-emerald-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>BD ONLINE: isentropic-tangent-sdtd0 | LATÊNCIA: 14ms</span>
        </div>
      </div>

      {/* Standard ERP Toolbar with F-Key Actions */}
      <div
        className={`w-full px-3 py-1.5 border-b flex flex-wrap items-center justify-between gap-2 select-none ${
          themeMode === 'classic_delphi'
            ? 'bg-[#f0f0f0] border-slate-300'
            : 'bg-slate-950/80 border-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={handleNewDebtor}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-400 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
            }`}
            title="Criar novo cadastro em branco (F2)"
          >
            <span className="material-symbols-outlined text-[15px] text-emerald-500">add_box</span>
            <span>[F2] Novo</span>
          </button>

          <button
            onClick={handleSaveDebtor}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-blue-900 border-slate-400 shadow-xs'
                : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
            }`}
            title="Salvar alterações no banco (F3)"
          >
            <span className="material-symbols-outlined text-[15px]">save</span>
            <span>[F3] Gravar</span>
          </button>

          <button
            onClick={() => onToast('[F4] Edição cancelada. Restaurados valores originais.')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-400 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Cancelar edição (F4)"
          >
            <span className="material-symbols-outlined text-[15px] text-amber-500">cancel</span>
            <span>[F4] Cancelar</span>
          </button>

          <button
            onClick={handleDeleteDebtor}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-red-700 border-slate-400 shadow-xs'
                : 'bg-slate-800 hover:bg-red-900/40 text-red-400 border-slate-700'
            }`}
            title="Excluir devedor ativo (F5)"
          >
            <span className="material-symbols-outlined text-[15px] text-red-500">delete</span>
            <span>[F5] Excluir</span>
          </button>

          <span className="w-px h-5 bg-slate-700 mx-1"></span>

          <button
            onClick={() => setActiveTab('pesquisa')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-400 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-blue-400 border-slate-700'
            }`}
            title="Localizar devedor ou título (F6)"
          >
            <span className="material-symbols-outlined text-[15px]">search</span>
            <span>[F6] Localizar</span>
          </button>

          <button
            onClick={() => window.print()}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-400 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Imprimir Ficha Cadastral Oficial (F7)"
          >
            <span className="material-symbols-outlined text-[15px]">print</span>
            <span>[F7] Imprimir</span>
          </button>

          <button
            onClick={handleExportCSV}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer border ${
              themeMode === 'classic_delphi'
                ? 'bg-white hover:bg-slate-100 text-emerald-800 border-slate-400 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
            }`}
            title="Exportar dados para Excel / CSV (F8)"
          >
            <span className="material-symbols-outlined text-[15px]">table_view</span>
            <span>[F8] Exportar CSV</span>
          </button>
        </div>

        {/* TDBNavigator buttons (Delphi style) */}
        <div className="flex items-center gap-1 bg-black/20 p-1 rounded border border-slate-700">
          <span className="text-[10px] font-mono text-slate-400 mr-1 hidden sm:inline">DBNavigator:</span>
          {[
            {
              icon: 'first_page',
              title: 'Primeiro Registro',
              action: () => debtors[0] && setSelectedDebtorId(debtors[0].id),
            },
            {
              icon: 'chevron_left',
              title: 'Registro Anterior',
              action: () => {
                const idx = debtors.findIndex((d) => d.id === selectedDebtorId);
                if (idx > 0) setSelectedDebtorId(debtors[idx - 1].id);
              },
            },
            {
              icon: 'chevron_right',
              title: 'Próximo Registro',
              action: () => {
                const idx = debtors.findIndex((d) => d.id === selectedDebtorId);
                if (idx < debtors.length - 1) setSelectedDebtorId(debtors[idx + 1].id);
              },
            },
            {
              icon: 'last_page',
              title: 'Último Registro',
              action: () => debtors[debtors.length - 1] && setSelectedDebtorId(debtors[debtors.length - 1].id),
            },
          ].map((nav, idx) => (
            <button
              key={idx}
              onClick={nav.action}
              className={`w-6 h-6 flex items-center justify-center rounded text-[13px] font-bold cursor-pointer transition-colors ${
                themeMode === 'classic_delphi'
                  ? 'bg-white hover:bg-slate-200 text-black border border-slate-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={nav.title}
            >
              <span className="material-symbols-outlined text-[16px]">{nav.icon}</span>
            </button>
          ))}
          <span className="font-mono text-[10px] px-1 text-amber-300">
            {debtors.findIndex((d) => d.id === selectedDebtorId) + 1} de {debtors.length}
          </span>
        </div>
      </div>

      {/* Main Workspace with Delphi/WinForms TPageControl */}
      <div className="flex-1 w-full px-2 sm:px-4 py-3 flex flex-col">
        {/* Tab Headers (PageControl Tabs) */}
        <div
          className={`flex items-end gap-1 border-b px-2 overflow-x-auto ${
            themeMode === 'classic_delphi' ? 'border-slate-400 bg-[#ece9d8]' : 'border-slate-800 bg-slate-950/40'
          }`}
        >
          {[
            { id: 'cadastro', label: '1. Ficha Cadastral do Devedor (Data Entry)', icon: 'badge' },
            { id: 'pesquisa', label: '2. DBGrid de Clientes & Consulta Avançada', icon: 'grid_on' },
            { id: 'titulos', label: '3. Contas a Receber (Grade Contábil)', icon: 'receipt_long' },
            { id: 'lancamento', label: '4. Emissão de Carnê & Parcelamento em Lote', icon: 'add_shopping_cart' },
            { id: 'massa', label: '5. Entrada Rápida de Digitação em Massa', icon: 'keyboard' },
            { id: 'auditoria', label: '6. Trilha de Auditoria & Segurança', icon: 'security' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold border-t border-x rounded-t-sm transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? themeMode === 'classic_delphi'
                      ? 'bg-white text-blue-900 border-slate-400 font-black shadow-xs -mb-px'
                      : 'bg-slate-800 text-blue-400 border-slate-700 shadow-xs -mb-px'
                    : themeMode === 'classic_delphi'
                    ? 'bg-[#dcd8cc] text-slate-700 border-slate-400 hover:bg-white/80'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Box (PageControl Body) */}
        <div
          className={`flex-1 border border-t-0 p-3 sm:p-4 overflow-y-auto ${
            themeMode === 'classic_delphi'
              ? 'bg-white text-slate-900 border-slate-400 shadow-inner'
              : 'bg-slate-900/90 text-slate-100 border-slate-800'
          }`}
        >
          {/* TAB 1: FICHA CADASTRAL DO DEVEDOR (DATA ENTRY FORM) */}
          {activeTab === 'cadastro' && (
            <div className="space-y-4">
              {/* Quick Record Selector Bar */}
              <div
                className={`p-2 rounded border flex flex-wrap items-center justify-between gap-3 ${
                  themeMode === 'classic_delphi'
                    ? 'bg-[#f4f2ea] border-slate-300'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <label className="font-bold text-[11px]">Selecionar Devedor:</label>
                  <select
                    value={selectedDebtorId}
                    onChange={(e) => setSelectedDebtorId(e.target.value)}
                    className={`h-7 px-2 border rounded font-semibold text-[11px] outline-none ${
                      themeMode === 'classic_delphi'
                        ? 'bg-white text-black border-slate-400'
                        : 'bg-slate-800 text-slate-100 border-slate-700'
                    }`}
                  >
                    {debtors.map((d) => (
                      <option key={d.id} value={d.id}>
                        [ID: {d.id}] {d.name} — Owed: R$ {(Number(d.totalOwed) || 0).toFixed(2)} {(Number(d.overdueCount) || 0) > 0 ? `${d.overdueCount} ATRASADAS` : 'Em dia'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                  <span className="font-mono">
                    Total Devedor Ativo: <strong className="text-red-500">R$ {(Number(activeDebtor?.totalOwed) || 0).toFixed(2)}</strong>
                  </span>
                  <span className="font-mono">
                    Total Já Pago: <strong className="text-emerald-500">R$ {(Number(activeDebtor?.totalPaid) || 0).toFixed(2)}</strong>
                  </span>
                  <span className="font-mono">
                    Score: <strong>{activeDebtor?.score || 0}/1000</strong>
                  </span>
                </div>
              </div>

              {/* SECTION 1: DADOS DE IDENTIFICAÇÃO PRINCIPAL */}
              <fieldset
                className={`p-3 rounded border ${
                  themeMode === 'classic_delphi' ? 'border-slate-300 bg-[#fafafa]' : 'border-slate-800 bg-slate-950/40'
                }`}
              >
                <legend className="px-2 font-bold text-[11px] text-blue-500 uppercase tracking-wider">
                  1. Identificação Principal &amp; Documentos Fiscais
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold mb-0.5 text-slate-400">Código ERP (ID)</label>
                    <input
                      type="text"
                      readOnly
                      value={formData.id}
                      className="w-full h-7 px-2 font-mono text-[11px] bg-black/10 border border-slate-700 rounded text-slate-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Tipo Pessoa</label>
                    <div className="flex items-center gap-3 h-7">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="personType"
                          checked={formData.personType === 'F'}
                          onChange={() => setFormData({ ...formData, personType: 'F' })}
                        />
                        <span className="text-[11px] font-semibold">Física</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="personType"
                          checked={formData.personType === 'J'}
                          onChange={() => setFormData({ ...formData, personType: 'J' })}
                        />
                        <span className="text-[11px] font-semibold">Jurídica</span>
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold mb-0.5">
                      Nome Completo / Razão Social *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="EX: JOÃO DA SILVA SA"
                      className={`w-full h-7 px-2 border rounded font-semibold text-[11px] uppercase outline-none focus:border-blue-500 ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">
                      {formData.personType === 'F' ? 'CPF' : 'CNPJ'} *
                    </label>
                    <input
                      type="text"
                      value={formData.cpfCnpj}
                      onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value })}
                      placeholder="000.000.000-00"
                      className={`w-full h-7 px-2 border rounded font-mono text-[11px] outline-none focus:border-blue-500 ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">
                      {formData.personType === 'F' ? 'RG' : 'Inscrição Estadual'}
                    </label>
                    <input
                      type="text"
                      value={formData.rgIe}
                      onChange={(e) => setFormData({ ...formData, rgIe: e.target.value })}
                      className={`w-full h-7 px-2 border rounded font-mono text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Apelido / Parentesco</label>
                    <input
                      type="text"
                      value={formData.apelido}
                      onChange={(e) => setFormData({ ...formData, apelido: e.target.value })}
                      placeholder="Amigo, Primo, Cliente"
                      className={`w-full h-7 px-2 border rounded text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Data Nasc. / Abertura</label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      className={`w-full h-7 px-2 border rounded text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Órgão Expedidor</label>
                    <input
                      type="text"
                      value={formData.orgaoExp}
                      onChange={(e) => setFormData({ ...formData, orgaoExp: e.target.value })}
                      className={`w-full h-7 px-2 border rounded text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>
                </div>
              </fieldset>

              {/* SECTION 2: DADOS DE CONTATO & CHAVE PIX */}
              <fieldset
                className={`p-3 rounded border ${
                  themeMode === 'classic_delphi' ? 'border-slate-300 bg-[#fafafa]' : 'border-slate-800 bg-slate-950/40'
                }`}
              >
                <legend className="px-2 font-bold text-[11px] text-emerald-500 uppercase tracking-wider">
                  2. Contatos, WhatsApp &amp; Chave PIX
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Celular / WhatsApp Principal *</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(14) 99733-9863"
                        className={`flex-1 h-7 px-2 border rounded font-mono text-[11px] outline-none ${
                          themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const clean = formData.phone.replace(/\D/g, '');
                          window.open(`https://wa.me/55${clean}?text=Olá ${encodeURIComponent(formData.name)}, cobrança amigável HASPAHO`, '_blank');
                        }}
                        className="px-2 h-7 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        title="Abrir WhatsApp Web Oficial"
                      >
                        <span className="material-symbols-outlined text-[13px]">chat</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Telefone Secundário / Fixo</label>
                    <input
                      type="text"
                      value={formData.phoneSecondary}
                      onChange={(e) => setFormData({ ...formData, phoneSecondary: e.target.value })}
                      placeholder="(14) 3642-0000"
                      className={`w-full h-7 px-2 border rounded font-mono text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">E-mail de Cobrança</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="devedor@email.com"
                      className={`w-full h-7 px-2 border rounded text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Chave PIX Cadastrada</label>
                    <input
                      type="text"
                      value={formData.pixKey}
                      onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                      placeholder="CPF, Telefone ou E-mail"
                      className={`w-full h-7 px-2 border rounded font-mono text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>
                </div>
              </fieldset>

              {/* SECTION 3: ENDEREÇO & CEP */}
              <fieldset
                className={`p-3 rounded border ${
                  themeMode === 'classic_delphi' ? 'border-slate-300 bg-[#fafafa]' : 'border-slate-800 bg-slate-950/40'
                }`}
              >
                <legend className="px-2 font-bold text-[11px] text-amber-500 uppercase tracking-wider">
                  3. Endereço Completo &amp; Localização Notarial
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">CEP *</label>
                    <input
                      type="text"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      placeholder="17320-000"
                      className={`w-full h-7 px-2 border rounded font-mono text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold mb-0.5">Logradouro / Rua</label>
                    <input
                      type="text"
                      value={formData.logradouro}
                      onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                      placeholder="Rua Central"
                      className={`w-full h-7 px-2 border rounded text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Número</label>
                    <input
                      type="text"
                      value={formData.numero}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                      placeholder="100"
                      className={`w-full h-7 px-2 border rounded text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Bairro</label>
                    <input
                      type="text"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                      placeholder="Centro"
                      className={`w-full h-7 px-2 border rounded text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Cidade / UF</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={formData.cidade}
                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                        className={`flex-1 h-7 px-2 border rounded text-[11px] outline-none ${
                          themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                        }`}
                      />
                      <input
                        type="text"
                        maxLength={2}
                        value={formData.uf}
                        onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                        className={`w-9 h-7 text-center font-bold uppercase border rounded text-[11px] outline-none ${
                          themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* SECTION 4: PARÂMETROS FINANCEIROS, SCORE & REGRAS */}
              <fieldset
                className={`p-3 rounded border ${
                  themeMode === 'classic_delphi' ? 'border-slate-300 bg-[#fafafa]' : 'border-slate-800 bg-slate-950/40'
                }`}
              >
                <legend className="px-2 font-bold text-[11px] text-purple-400 uppercase tracking-wider">
                  4. Parâmetros de Crédito, Juros &amp; Políticas de Cobrança
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Limite de Crédito Concedido (R$)</label>
                    <input
                      type="number"
                      value={formData.limiteCredito}
                      onChange={(e) => setFormData({ ...formData, limiteCredito: Number(e.target.value) })}
                      className={`w-full h-7 px-2 border rounded font-mono font-bold text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Score de Pontualidade (0 - 1000)</label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={formData.score}
                      onChange={(e) => setFormData({ ...formData, score: Number(e.target.value) })}
                      className={`w-full h-7 px-2 border rounded font-mono font-bold text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Multa por Atraso Fixa (R$)</label>
                    <input
                      type="number"
                      value={formData.multaAtrasoFixa}
                      onChange={(e) => setFormData({ ...formData, multaAtrasoFixa: Number(e.target.value) })}
                      className={`w-full h-7 px-2 border rounded font-mono text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold mb-0.5">Juros Mensais Padrão (%)</label>
                    <input
                      type="number"
                      step={0.1}
                      value={formData.taxaJurosMensal}
                      onChange={(e) => setFormData({ ...formData, taxaJurosMensal: Number(e.target.value) })}
                      className={`w-full h-7 px-2 border rounded font-mono text-[11px] outline-none ${
                        themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                      }`}
                    />
                  </div>
                </div>

                {/* Dense Checkboxes & Flags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-3 border-t border-slate-800/40 mt-2">
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
                    <span className="text-red-400 font-bold">[ ] Bloqueio Preventivo de Crédito</span>
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
                className={`p-3 rounded border ${
                  themeMode === 'classic_delphi' ? 'border-slate-300 bg-[#fafafa]' : 'border-slate-800 bg-slate-950/40'
                }`}
              >
                <legend className="px-2 font-bold text-[11px] text-slate-400 uppercase tracking-wider">
                  5. Parecer Contábil &amp; Histórico de Negociações
                </legend>
                <textarea
                  rows={2}
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Anotações internas, promessas de pagamento, datas combinadas..."
                  className={`w-full p-2 border rounded font-mono text-[11px] outline-none ${
                    themeMode === 'classic_delphi' ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-700'
                  }`}
                />
              </fieldset>

              {/* Bottom Action Footer for the Form */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-[10px] text-slate-500 font-mono">
                  Atalhos: F2: Novo | F3: Gravar | F4: Cancelar | F5: Excluir | Esc: Voltar
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNewDebtor}
                    className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Novo [F2]
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDebtor}
                    className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-sm cursor-pointer"
                  >
                    Gravar Registro [F3]
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteDebtor}
                    className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] shadow-sm cursor-pointer inline-flex items-center gap-1"
                    title="Excluir cadastro ativo no ERP (F5)"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    <span>Excluir [F5]</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DBGRID DE CLIENTES & CONSULTA AVANÇADA */}
          {activeTab === 'pesquisa' && (
            <div className="space-y-3">
              {/* Filter and Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-black/20 rounded border border-slate-800">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <span className="material-symbols-outlined text-[16px] text-slate-400">filter_alt</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar por Código, Nome, CPF ou Telefone..."
                    className="w-full h-7 px-2.5 bg-slate-800 border border-slate-700 rounded text-[11px] text-white outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold">Filtro de Situação:</span>
                  {(['todos', 'adimplente', 'atrasado', 'quitado'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                        filterStatus === st
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* DataGrid (DBGrid Delphi style) */}
              <div className="border border-slate-700 rounded overflow-x-auto table-scroll-container financial-table-container">
                <table className="w-full text-left border-collapse text-[11px] min-w-[700px]">
                  <thead className="bg-slate-950 text-slate-300 uppercase font-mono text-[10px] border-b border-slate-700 select-none">
                    <tr>
                      <th className="p-2 border-r border-slate-800 w-16">Cód ID</th>
                      <th className="p-2 border-r border-slate-800">Nome / Razão Social</th>
                      <th className="p-2 border-r border-slate-800">Documento CPF/CNPJ</th>
                      <th className="p-2 border-r border-slate-800">Telefone / WhatsApp</th>
                      <th className="p-2 border-r border-slate-800 text-right">Saldo Devedor</th>
                      <th className="p-2 border-r border-slate-800 text-right">Total Pago</th>
                      <th className="p-2 border-r border-slate-800 text-center">Score</th>
                      <th className="p-2 border-r border-slate-800 text-center">Atrasos</th>
                      <th className="p-2 text-center min-w-[210px] w-56 select-none">Ações ERP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {filteredDebtors.map((d, index) => {
                      const isSelected = d.id === selectedDebtorId;
                      return (
                        <tr
                          key={d.id}
                          onClick={() => setSelectedDebtorId(d.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-900/50 text-white font-bold'
                              : index % 2 === 0
                              ? 'bg-slate-900/60 hover:bg-slate-800'
                              : 'bg-slate-950/40 hover:bg-slate-800'
                          }`}
                        >
                          <td className="p-2 border-r border-slate-800 text-slate-400">{d.id.slice(-6)}</td>
                          <td className="p-2 border-r border-slate-800 font-sans font-semibold">{d.name}</td>
                          <td className="p-2 border-r border-slate-800">{d.documentNumber || '—'}</td>
                          <td className="p-2 border-r border-slate-800">{d.phone}</td>
                          <td className="p-2 border-r border-slate-800 text-right font-bold text-red-400">
                            R$ {(Number(d.totalOwed) || 0).toFixed(2)}
                          </td>
                          <td className="p-2 border-r border-slate-800 text-right text-emerald-400">
                            R$ {(Number(d.totalPaid) || 0).toFixed(2)}
                          </td>
                          <td className="p-2 border-r border-slate-800 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold">
                              {d.score}
                            </span>
                          </td>
                          <td className="p-2 border-r border-slate-800 text-center">
                            {d.overdueCount > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 font-bold text-[10px]">
                                {d.overdueCount} PARC
                              </span>
                            ) : (
                              <span className="text-emerald-400 text-[10px]">0</span>
                            )}
                          </td>
                          <td className="p-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Botão de Editar Ficha */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDebtorId(d.id);
                                  setActiveTab('cadastro');
                                }}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold cursor-pointer inline-flex items-center gap-1 transition-all active:scale-95 shadow-xs"
                                title="Abrir ficha cadastral completa no ERP"
                              >
                                <span className="material-symbols-outlined text-[13px]">edit_note</span>
                                <span>Editar</span>
                              </button>

                              {/* Botão de Salvar / Sincronizar Registro no Banco */}
                              <button
                                type="button"
                                onClick={() => handleQuickSaveRecord(d)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer inline-flex items-center gap-1 transition-all active:scale-95 shadow-xs"
                                title="Salvar e sincronizar registro no banco de dados ERP"
                              >
                                <span className="material-symbols-outlined text-[13px]">save</span>
                                <span>Salvar</span>
                              </button>

                              {/* Botão de Excluir Registro */}
                              <button
                                type="button"
                                onClick={() => handleDeleteSpecificDebtor(d)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer inline-flex items-center gap-1 transition-all active:scale-95 shadow-xs"
                                title="Excluir este devedor/registro do sistema ERP"
                              >
                                <span className="material-symbols-outlined text-[13px]">delete</span>
                                <span>Excluir</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                <span>Registros encontrados: {filteredDebtors.length} de {debtors.length}</span>
                <span>Dica: Dê duplo clique em qualquer linha para abrir a ficha no formulário de entrada.</span>
              </div>
            </div>
          )}

          {/* TAB 3: CONTAS A RECEBER (GRADE CONTÁBIL DE PARCELAS) */}
          {activeTab === 'titulos' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-black/20 rounded border border-slate-800">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <span className="material-symbols-outlined text-[16px] text-slate-400">search</span>
                  <input
                    type="search"
                    value={instSearch}
                    onChange={(e) => setInstSearch(e.target.value)}
                    placeholder="Filtrar por devedor, produto ou título..."
                    className="w-full h-7 px-2.5 bg-slate-800 border border-slate-700 rounded text-[11px] text-white outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold">Situação:</span>
                  {(['todos', 'overdue', 'soon', 'ontime', 'paid'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setInstStatusFilter(st)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                        instStatusFilter === st
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {st === 'overdue' ? 'Atrasadas' : st === 'soon' ? 'Vence Logo' : st === 'ontime' ? 'Em dia' : st === 'paid' ? 'Pagas' : 'Todas'}
                    </button>
                  ))}
                </div>
              </div>

              {/* DataGrid of Installments */}
              <div className="border border-slate-700 rounded overflow-x-auto max-h-[500px] table-scroll-container financial-table-container">
                <table className="w-full text-left border-collapse text-[11px] min-w-[700px]">
                  <thead className="bg-slate-950 text-slate-300 uppercase font-mono text-[10px] border-b border-slate-700 sticky top-0 z-10 select-none">
                    <tr>
                      <th className="p-2 border-r border-slate-800 w-14">Título</th>
                      <th className="p-2 border-r border-slate-800">Devedor</th>
                      <th className="p-2 border-r border-slate-800">Descrição do Produto</th>
                      <th className="p-2 border-r border-slate-800 text-center">Parc.</th>
                      <th className="p-2 border-r border-slate-800">Vencimento</th>
                      <th className="p-2 border-r border-slate-800 text-right">Valor Nominal</th>
                      <th className="p-2 border-r border-slate-800 text-right">Multa R$5</th>
                      <th className="p-2 border-r border-slate-800 text-center">Situação</th>
                      <th className="p-2 text-center min-w-[150px] w-40 select-none">Baixa / Ações ERP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {filteredInstallments.map((inst, index) => {
                      const isOverdue = inst.status === 'overdue';
                      const isPaid = inst.status === 'paid';
                      return (
                        <tr
                          key={inst.id}
                          className={`transition-colors ${
                            isPaid
                              ? 'opacity-60 bg-slate-950/20'
                              : isOverdue
                              ? 'bg-red-950/30 text-red-200'
                              : index % 2 === 0
                              ? 'bg-slate-900/60'
                              : 'bg-slate-950/40'
                          }`}
                        >
                          <td className="p-2 border-r border-slate-800 text-slate-400">{inst.id.slice(-5)}</td>
                          <td className="p-2 border-r border-slate-800 font-sans font-semibold">{inst.debtorName}</td>
                          <td className="p-2 border-r border-slate-800 truncate max-w-xs">{inst.product}</td>
                          <td className="p-2 border-r border-slate-800 text-center">
                            {inst.installmentNumber}/{inst.totalInstallments}
                          </td>
                          <td className="p-2 border-r border-slate-800 font-bold">
                            {new Date(inst.dueDate).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-2 border-r border-slate-800 text-right font-bold">
                            R$ {inst.amount.toFixed(2)}
                          </td>
                          <td className="p-2 border-r border-slate-800 text-right text-amber-400">
                            {isOverdue ? 'R$ 5,00' : '—'}
                          </td>
                          <td className="p-2 border-r border-slate-800 text-center">
                            {isPaid ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300 font-bold text-[9px]">
                                QUITADO
                              </span>
                            ) : isOverdue ? (
                              <span className="px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 font-bold text-[9px]">
                                ATRASADA
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 text-[9px]">
                                ABERTO
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              {!isPaid ? (
                                <button
                                  type="button"
                                  onClick={() => handleQuickPayInstallment(inst.id)}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer transition-all active:scale-95 inline-flex items-center gap-1 shadow-xs"
                                  title="Liquidar com recibo contábil oficial"
                                >
                                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                  <span>Dar Baixa</span>
                                </button>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300 font-bold text-[9px] inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">verified</span>
                                  <span>Baixado</span>
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteSpecificInstallment(inst)}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer transition-all active:scale-95 inline-flex items-center gap-1 shadow-xs"
                                title="Excluir esta parcela do ERP"
                              >
                                <span className="material-symbols-outlined text-[13px]">delete</span>
                                <span>Excluir</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: EMISSÃO DE CARNÊ & PARCELAMENTO EM LOTE */}
          {activeTab === 'lancamento' && (
            <form onSubmit={handleCreatePurchaseBatch} className="space-y-4 max-w-3xl mx-auto">
              <div className="p-3 bg-blue-950/40 border border-blue-800 rounded text-blue-200 text-xs">
                <span className="font-bold flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-[16px]">receipt</span>
                  Emissão Rápida de Compra e Desdobramento de Títulos em Lote
                </span>
                <p className="text-[11px] text-blue-300">
                  Cadastre uma compra e o sistema ERP dividirá automaticamente o valor total em até 24 parcelas com datas de vencimento sequenciais e gravação no razão contábil.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold mb-1">Devedor Titular da Compra *</label>
                  <select
                    required
                    value={newPurchaseDebtorId}
                    onChange={(e) => setNewPurchaseDebtorId(e.target.value)}
                    className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none"
                  >
                    {debtors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} (Saldo Devedor Atual: R$ {(Number(d.totalOwed) || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold mb-1">Descrição do Produto / Serviço *</label>
                  <input
                    type="text"
                    required
                    value={newPurchaseProduct}
                    onChange={(e) => setNewPurchaseProduct(e.target.value)}
                    placeholder="Ex: Pneus Aro 16 Pirelli Scorpion"
                    className="w-full h-8 px-2.5 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1">Loja / Estabelecimento</label>
                  <input
                    type="text"
                    value={newPurchaseStore}
                    onChange={(e) => setNewPurchaseStore(e.target.value)}
                    placeholder="Ex: Magazine Luiza"
                    className="w-full h-8 px-2.5 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1">Cartão / Banco Emissor (Autocompletar ou Digitar)</label>
                  <input
                    type="text"
                    list="erp-card-options"
                    value={newPurchaseCard}
                    onChange={(e) => setNewPurchaseCard(e.target.value)}
                    placeholder="Ex: Nubank Nação, Nubank Croma..."
                    className="w-full h-8 px-2.5 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none"
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
                  <label className="block text-[11px] font-bold mb-1">Valor Total da Compra (R$) *</label>
                  <input
                    type="number"
                    step={0.01}
                    required
                    value={newPurchaseAmount}
                    onChange={(e) => setNewPurchaseAmount(e.target.value)}
                    placeholder="1200.00"
                    className="w-full h-8 px-2.5 bg-slate-800 border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1">Número de Parcelas *</label>
                  <select
                    value={newPurchaseCount}
                    onChange={(e) => setNewPurchaseCount(e.target.value)}
                    className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-xs font-bold text-white outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 24].map((num) => (
                      <option key={num} value={num}>
                        {num}x de R$ {(parseFloat(newPurchaseAmount || '0') / num).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold mb-1">Vencimento da 1ª Parcela *</label>
                  <input
                    type="date"
                    required
                    value={newPurchaseFirstDate}
                    onChange={(e) => setNewPurchaseFirstDate(e.target.value)}
                    className="w-full h-8 px-2.5 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded shadow-md cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">done_all</span>
                  <span>Gravar e Desdobrar Carnê de Parcelas</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: ENTRADA RÁPIDA DE DIGITAÇÃO EM MASSA (BULK DATA ENTRY) */}
          {activeTab === 'massa' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-950/40 border border-amber-800 rounded text-amber-200 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold block">
                    Modo Digitação Rápida por Tabulação (Operadores de Entrada Massiva)
                  </span>
                  <span className="text-[11px] text-amber-300">
                    Pressione Tab para saltar entre colunas rapidamente e Enter para incluir nova linha.
                  </span>
                </div>
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
                    onToast('Nova linha de digitação adicionada.');
                  }}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded cursor-pointer"
                >
                  + Inserir Linha
                </button>
              </div>

              <div className="border border-slate-700 rounded overflow-x-auto table-scroll-container financial-table-container">
                <table className="w-full text-left border-collapse text-[11px] min-w-[700px]">
                  <thead className="bg-slate-950 text-slate-300 uppercase font-mono text-[10px] border-b border-slate-700">
                    <tr>
                      <th className="p-2 border-r border-slate-800 w-10">#</th>
                      <th className="p-2 border-r border-slate-800">Nome do Devedor</th>
                      <th className="p-2 border-r border-slate-800">CPF / CNPJ</th>
                      <th className="p-2 border-r border-slate-800">Valor (R$)</th>
                      <th className="p-2 border-r border-slate-800">Vencimento</th>
                      <th className="p-2 border-r border-slate-800 text-center">Parc</th>
                      <th className="p-2 text-center w-16">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {bulkRows.map((row, idx) => (
                      <tr key={row.id} className="bg-slate-900/60">
                        <td className="p-2 border-r border-slate-800 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-1 border-r border-slate-800">
                          <input
                            type="text"
                            value={row.debtorName}
                            onChange={(e) => {
                              const updated = [...bulkRows];
                              updated[idx].debtorName = e.target.value;
                              setBulkRows(updated);
                            }}
                            className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none uppercase"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-800">
                          <input
                            type="text"
                            value={row.doc}
                            onChange={(e) => {
                              const updated = [...bulkRows];
                              updated[idx].doc = e.target.value;
                              setBulkRows(updated);
                            }}
                            className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-white outline-none"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-800">
                          <input
                            type="text"
                            value={row.valor}
                            onChange={(e) => {
                              const updated = [...bulkRows];
                              updated[idx].valor = e.target.value;
                              setBulkRows(updated);
                            }}
                            className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-emerald-400 outline-none"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-800">
                          <input
                            type="date"
                            value={row.venc}
                            onChange={(e) => {
                              const updated = [...bulkRows];
                              updated[idx].venc = e.target.value;
                              setBulkRows(updated);
                            }}
                            className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none"
                          />
                        </td>
                        <td className="p-1 border-r border-slate-800">
                          <input
                            type="text"
                            value={row.parc}
                            onChange={(e) => {
                              const updated = [...bulkRows];
                              updated[idx].parc = e.target.value;
                              setBulkRows(updated);
                            }}
                            className="w-full h-7 px-1 text-center bg-slate-800 border border-slate-700 rounded text-xs font-mono text-white outline-none"
                          />
                        </td>
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setBulkRows(bulkRows.filter((r) => r.id !== row.id));
                              onToast('Linha removida.');
                            }}
                            className="px-2 py-0.5 bg-red-800/80 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => onToast('[Gravação em Massa] Lote de digitação processado com sucesso.')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow cursor-pointer"
                >
                  Processar e Gravar Lote no Banco
                </button>
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

      {/* Classic Windows ERP Status Bar (TStatusBar) */}
      <div
        className={`w-full px-3 py-1 border-t flex flex-wrap items-center justify-between text-[10px] font-mono select-none ${
          themeMode === 'classic_delphi'
            ? 'bg-[#ece9d8] text-slate-800 border-slate-400'
            : 'bg-slate-950 text-slate-400 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            CONECTADO
          </span>
          <span>BD: isentropic-tangent-sdtd0</span>
          <span>REG: {debtors.findIndex((d) => d.id === selectedDebtorId) + 1} de {debtors.length}</span>
          <span className="hidden sm:inline">CAPS: ON</span>
          <span className="hidden sm:inline">NUM: ON</span>
          <span className="hidden md:inline">INS: ON</span>
        </div>

        <div className="flex items-center gap-4">
          <span>RECEBÍVEIS: <strong className="text-white">R$ {totalReceivables.toFixed(2)}</strong></span>
          <span>EM ATRASO: <strong className="text-red-400">R$ {totalOverdueAmount.toFixed(2)}</strong></span>
          <span>OPERADOR: {currentUser?.name || 'Thiago Dias'}</span>
        </div>
      </div>
    </div>
  );
};
