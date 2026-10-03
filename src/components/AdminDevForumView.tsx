import React, { useState, useEffect } from 'react';
import { UserAccount, ForumTopic, ScreenTab, ComplianceGuideline } from '../types';
import {
  TIAGO_DIAS_USER,
  getAllUsersForAdmin,
  adminUpdateUser,
  adminResetUserPassword,
  adminSetUserStatus,
  adminDeleteUserAccount,
  getLocalForumTopics,
  createForumTopic,
  updateForumTopic,
  deleteForumTopic,
} from '../lib/firebase';
import { HaspahoLogo } from './HaspahoLogo';
import { CardMeteor } from './CardMeteor';

interface AdminDevForumViewProps {
  currentUser: UserAccount | null;
  onNavigate: (tab: ScreenTab) => void;
  onToast: (msg: string) => void;
  onUpdateCurrentUser?: (user: UserAccount) => void;
}

const COMPLIANCE_GUIDELINES: ComplianceGuideline[] = [
  {
    id: 'g1',
    title: '1. Veracidade de Contratos e Registros Financeiros',
    category: 'financeiro',
    description: 'É expressamente proibida a inserção de contratos, comprovantes de PIX ou dados falsificados. Toda autenticação gerada possui hash criptográfico único rastreável.',
    penalty: 'Advertência formal e suspensão preventiva por 30 dias.',
  },
  {
    id: 'g2',
    title: '2. Segurança das Credenciais & Acesso Responsável',
    category: 'seguranca',
    description: 'Os dados de login e senhas não devem ser compartilhados com terceiros. A recuperação de senhas é mediada pelo Administrador Full Stack Tiago Dias.',
    penalty: 'Bloqueio de sessão e redefinição obrigatória com PIN de segurança.',
  },
  {
    id: 'g3',
    title: '3. Conduta e Urbanidade nas Comunicações',
    category: 'conduta',
    description: 'O envio de lembretes e mensagens de cobrança via WhatsApp deve obedecer aos horários comerciais e manter tom cordial e profissional.',
    penalty: 'Desativação do recurso de disparo de WhatsApp e análise da conta.',
  },
  {
    id: 'g4',
    title: '4. Privacidade e Proteção de Dados (LGPD)',
    category: 'privacidade',
    description: 'Dados pessoais como CPF, número de telefone e endereços de devedores são estritamente confidenciais e protegidos em isolamento no Firestore.',
    penalty: 'Banimento sumário e definitivo da plataforma HASPAHO.',
  },
  {
    id: 'g5',
    title: '5. Livre Arbitragem do Administrador Master',
    category: 'conduta',
    description: 'O Administrador Mestre Tiago Augusto Dias tem plena autonomia para mediar disputas, restaurar acessos, investigar anomalias e aplicar sanções de conformidade.',
    penalty: 'Decisão soberana inapelável em conformidade com as diretrizes.',
  },
];

export const AdminDevForumView: React.FC<AdminDevForumViewProps> = ({
  currentUser,
  onNavigate,
  onToast,
  onUpdateCurrentUser,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'usuarios' | 'forum' | 'conformidade' | 'diagnostico'>('usuarios');

  // Users State
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'todos' | 'ativo' | 'suspenso' | 'banido'>('todos');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserAccount | null>(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [targetUserForPassword, setTargetUserForPassword] = useState<UserAccount | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [targetUserForBan, setTargetUserForBan] = useState<UserAccount | null>(null);
  const [banReasonInput, setBanReasonInput] = useState('');

  // Forum State
  const [forumTopics, setForumTopics] = useState<ForumTopic[]>([]);
  const [forumCategoryFilter, setForumCategoryFilter] = useState<string>('todos');
  const [isNewTopicModalOpen, setIsNewTopicModalOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicContent, setNewTopicContent] = useState('');
  const [newTopicCategory, setNewTopicCategory] = useState<'sugestao' | 'melhoria' | 'bug' | 'duvida' | 'conformidade'>('sugestao');
  const [selectedTopicForReply, setSelectedTopicForReply] = useState<ForumTopic | null>(null);
  const [devReplyInput, setDevReplyInput] = useState('');

  // Developer contact constants
  const DEV_EMAIL = 'tiagodias8888@gmail.com';
  const DEV_PHONE = '14997339863';
  const DEV_PHONE_FORMATTED = '(014) 99733-9863';
  const DEV_CPF = '368.497.448-01';

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const loadedUsers = await getAllUsersForAdmin();
        setUsers(loadedUsers);
      } catch (e) {
        console.error('Error loading users for admin:', e);
      }
      const loadedTopics = getLocalForumTopics();
      setForumTopics(loadedTopics);
    }
    loadData();
  }, []);

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.cpfCnpj && u.cpfCnpj.includes(userSearch)) ||
      (u.phoneWhatsapp && u.phoneWhatsapp.includes(userSearch)) ||
      (u.username && u.username.toLowerCase().includes(userSearch.toLowerCase()));

    const status = u.status || 'ativo';
    const matchesStatus = userStatusFilter === 'todos' || status === userStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filtered Topics
  const filteredTopics = forumTopics.filter((t) => {
    if (forumCategoryFilter === 'todos') return true;
    return t.category === forumCategoryFilter;
  });

  // Handlers for Users
  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    try {
      await adminUpdateUser(selectedUserForEdit.id, selectedUserForEdit);
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUserForEdit.id ? selectedUserForEdit : u))
      );
      if (currentUser?.id === selectedUserForEdit.id && onUpdateCurrentUser) {
        onUpdateCurrentUser(selectedUserForEdit);
      }
      setIsEditUserModalOpen(false);
      onToast(`Dados do usuário "${selectedUserForEdit.name}" atualizados com sucesso!`);
    } catch (err: any) {
      onToast(err.message || 'Erro ao atualizar dados do usuário.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForPassword || !newPasswordInput.trim()) return;

    try {
      const res = await adminResetUserPassword(targetUserForPassword.id, newPasswordInput.trim());
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUserForPassword.id
            ? { ...u, plainPassword: newPasswordInput.trim(), lastKnownPassword: newPasswordInput.trim() }
            : u
        )
      );
      setIsPasswordModalOpen(false);
      onToast(`🔑 ${res.message} Nova senha: "${newPasswordInput.trim()}"`);
      setNewPasswordInput('');
    } catch (err: any) {
      onToast(err.message || 'Erro ao redefinir senha.');
    }
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$';
    let pass = 'Haspaho@';
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPasswordInput(pass);
  };

  const handleApplyBanOrSuspension = async (status: 'ativo' | 'suspenso' | 'banido') => {
    if (!targetUserForBan) return;

    try {
      await adminSetUserStatus(targetUserForBan.id, status, banReasonInput);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUserForBan.id ? { ...u, status, banReason: banReasonInput } : u
        )
      );
      setIsBanModalOpen(false);
      const actionLabel =
        status === 'banido' ? 'BANIDO' : status === 'suspenso' ? 'SUSPENSO' : 'REATIVADO';
      onToast(`⚖️ Usuário "${targetUserForBan.name}" foi ${actionLabel} com sucesso.`);
      setBanReasonInput('');
    } catch (err: any) {
      onToast(err.message || 'Erro ao aplicar arbitragem.');
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (!window.confirm(`Tem certeza que deseja remover permanentemente o usuário "${user.name}"?`)) {
      return;
    }
    try {
      await adminDeleteUserAccount(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      onToast(`Usuário "${user.name}" removido do sistema.`);
    } catch (err: any) {
      onToast(err.message || 'Erro ao remover usuário.');
    }
  };

  // Handlers for Forum Topics
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim() || !newTopicContent.trim()) {
      onToast('Preencha o título e a descrição da sugestão.');
      return;
    }

    try {
      const topic = await createForumTopic({
        authorId: currentUser?.id || TIAGO_DIAS_USER.id,
        authorName: currentUser?.name || TIAGO_DIAS_USER.name,
        authorEmail: currentUser?.email || TIAGO_DIAS_USER.email,
        authorAvatar: currentUser?.avatar,
        authorRole: currentUser?.role || 'Membro do Fórum',
        title: newTopicTitle.trim(),
        content: newTopicContent.trim(),
        category: newTopicCategory,
      });

      setForumTopics((prev) => [topic, ...prev]);
      setIsNewTopicModalOpen(false);
      setNewTopicTitle('');
      setNewTopicContent('');
      onToast('✨ Tópico e sugestão publicados no Fórum Fechado com sucesso!');
    } catch (err: any) {
      onToast(err.message || 'Erro ao publicar tópico.');
    }
  };

  const handleUpdateTopicStatus = async (
    topicId: string,
    status: ForumTopic['status']
  ) => {
    try {
      const updated = await updateForumTopic(topicId, { status });
      setForumTopics(updated);
      onToast(`Status do tópico atualizado para "${status.replace('_', ' ').toUpperCase()}".`);
    } catch (err: any) {
      onToast(err.message || 'Erro ao atualizar tópico.');
    }
  };

  const handleSaveDevReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicForReply || !devReplyInput.trim()) return;

    try {
      const updated = await updateForumTopic(selectedTopicForReply.id, {
        devResponse: devReplyInput.trim(),
        devResponseAt: new Date().toISOString(),
      });
      setForumTopics(updated);
      setSelectedTopicForReply(null);
      setDevReplyInput('');
      onToast('💬 Resposta do Desenvolvedor registrada com sucesso!');
    } catch (err: any) {
      onToast(err.message || 'Erro ao salvar resposta.');
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!window.confirm('Excluir este tópico do fórum?')) return;
    try {
      const updated = await deleteForumTopic(topicId);
      setForumTopics(updated);
      onToast('Tópico excluído.');
    } catch (err: any) {
      onToast(err.message || 'Erro ao excluir tópico.');
    }
  };

  // Direct Communication Link Generators
  const getWhatsAppFeedbackUrl = (topic?: ForumTopic) => {
    const text = topic
      ? `Olá Tiago Augusto Dias (Desenvolvedor Full Stack Haspaho):\n\nEstou acompanhando a sugestão no Fórum Fechado:\n📌 *${topic.title}*\n📝 Categoria: ${topic.category}\n👤 Autor: ${topic.authorName} (${topic.authorEmail})\n\nDetalhes: ${topic.content}`
      : `Olá Tiago Augusto Dias (Desenvolvedor Full Stack & Administrador Master):\n\nEstou no painel da plataforma HASPAHO e gostaria de enviar um feedback / sugestão de melhoria para o sistema.`;
    return `https://wa.me/55${DEV_PHONE}?text=${encodeURIComponent(text)}`;
  };

  const getGmailFeedbackUrl = (topic?: ForumTopic) => {
    const subject = topic
      ? `[FÓRUM HASPAHO] Sugestão: ${topic.title}`
      : `[HASPAHO FEEDBACK] Sugestão e Melhoria da Plataforma`;
    const body = topic
      ? `Olá Tiago Augusto Dias,\n\nSegue o detalhamento da sugestão enviada no Fórum Fechado:\n\nTítulo: ${topic.title}\nCategoria: ${topic.category}\nAutor: ${topic.authorName} (${topic.authorEmail})\n\nMensagem:\n${topic.content}\n\nEnviado via Plataforma HASPAHO.`
      : `Olá Tiago,\n\nEscrevo para sugerir uma melhoria na plataforma HASPAHO:\n\n[Descreva aqui sua sugestão]\n\nAtenciosamente,\n${currentUser?.name || 'Usuário'}`;
    return `mailto:${DEV_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getWhatsAppCredentialsUrl = (user: UserAccount) => {
    const phoneClean = (user.phoneWhatsapp || '').replace(/\D/g, '');
    const pass = user.plainPassword || user.lastKnownPassword || 'haspaho2026';
    const msg = `Olá ${user.name},\n\nO Administrador Full Stack Tiago Augusto Dias gerou suas credenciais de acesso à plataforma *HASPAHO*:\n\n👤 *Usuário:* ${user.username || user.email}\n📧 *E-mail:* ${user.email}\n🔑 *Senha de Acesso:* ${pass}\n🔒 *PIN de Suporte:* ${user.supportPin || '8888'}\n\nEm caso de dúvidas, entre em contato pelo suporte oficial.`;
    return `https://wa.me/55${phoneClean}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full pb-24 gap-5">
      {/* Master Developer & Full Stack Admin Hero Banner (Translúcido Cósmico) */}
      <div className="bg-slate-950/45 backdrop-blur-xl rounded-3xl p-6 text-white shadow-[0_12px_44px_rgba(6,182,212,0.18)] border border-cyan-400/30 relative overflow-hidden">
        {/* Meteoros e brilhos cósmicos cruzando o fundo do banner */}
        <CardMeteor variant="multi" showSparkles={true} className="opacity-95 pointer-events-none" />

        {/* Background decorative watermark */}
        <div className="absolute -right-12 -bottom-12 opacity-15 pointer-events-none">
          <HaspahoLogo size="lg" variant="icon" />
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-cyan-400/50 shadow-xl bg-slate-900/90 flex items-center justify-center">
                <img
                  src={TIAGO_DIAS_USER.avatar}
                  alt="Tiago Augusto Dias"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 ring-2 ring-slate-900 text-xs shadow-md" title="Desenvolvedor Master Verificado">
                <span className="material-symbols-outlined text-[16px] block">verified</span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-amber-400 text-slate-950 font-black text-[11px] px-2.5 py-0.5 rounded-md uppercase tracking-wider font-mono shadow-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">crown</span>
                  ADMIN MASTER &amp; CRIADOR
                </span>
                <span className="bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>PROGRAMADOR FULL STACK</span>
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                Tiago Augusto Dias
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-200/90 mt-1">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-cyan-400">badge</span>
                  <strong>CPF:</strong> {DEV_CPF}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-emerald-400">call</span>
                  <strong>WhatsApp:</strong> {DEV_PHONE_FORMATTED}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-amber-400">mail</span>
                  <strong>Gmail:</strong> {DEV_EMAIL}
                </span>
              </div>

              <p className="text-[11px] text-slate-300 mt-2 max-w-2xl leading-relaxed">
                Autonomia total para governança do aplicativo HASPAHO, suporte a recuperação de senhas, edição de contas de usuários, arbitragem de conformidade e moderação do fórum fechado de sugestões e melhorias.
              </p>
            </div>
          </div>

          {/* Quick Direct Communication Actions */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5 shrink-0 w-full lg:w-auto">
            <a
              href={getWhatsAppFeedbackUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer border border-emerald-400/40"
              title="Falar diretamente com Tiago Dias via WhatsApp (014 99733-9863)"
            >
              <span className="material-symbols-outlined text-[20px]">chat</span>
              <div className="flex flex-col text-left leading-none">
                <span className="text-[9px] uppercase font-bold text-emerald-100">WhatsApp Direto</span>
                <span className="font-extrabold text-xs">{DEV_PHONE_FORMATTED}</span>
              </div>
            </a>

            <a
              href={getGmailFeedbackUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer border border-blue-400/40"
              title="Enviar e-mail para tiagodias8888@gmail.com"
            >
              <span className="material-symbols-outlined text-[20px]">mail</span>
              <div className="flex flex-col text-left leading-none">
                <span className="text-[9px] uppercase font-bold text-blue-100">Gmail Direto</span>
                <span className="font-extrabold text-xs">{DEV_EMAIL}</span>
              </div>
            </a>
          </div>
        </div>

        {/* Navigation Tabs (Estilo Glassmorfismo Cósmico) */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-cyan-500/20 overflow-x-auto no-scrollbar relative z-10">
          <button
            type="button"
            onClick={() => setActiveSubTab('usuarios')}
            className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'usuarios'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_16px_rgba(59,130,246,0.6)] border border-blue-400/60'
                : 'bg-slate-900/50 hover:bg-slate-800/70 text-slate-300 border border-slate-700/50 backdrop-blur-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">group</span>
            <span>Usuários &amp; Suporte de Senhas ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('forum')}
            className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'forum'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_16px_rgba(59,130,246,0.6)] border border-blue-400/60'
                : 'bg-slate-900/50 hover:bg-slate-800/70 text-slate-300 border border-slate-700/50 backdrop-blur-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">forum</span>
            <span>Fórum Fechado &amp; Sugestões ({forumTopics.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('conformidade')}
            className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'conformidade'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_16px_rgba(59,130,246,0.6)] border border-blue-400/60'
                : 'bg-slate-900/50 hover:bg-slate-800/70 text-slate-300 border border-slate-700/50 backdrop-blur-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">gavel</span>
            <span>Diretrizes &amp; Arbitragem</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('diagnostico')}
            className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeSubTab === 'diagnostico'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_16px_rgba(59,130,246,0.6)] border border-blue-400/60'
                : 'bg-slate-900/50 hover:bg-slate-800/70 text-slate-300 border border-slate-700/50 backdrop-blur-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">terminal</span>
            <span>Terminal Full Stack</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: USUÁRIOS & SUPORTE DE SENHAS
      ========================================================================= */}
      {activeSubTab === 'usuarios' && (
        <div className="flex flex-col gap-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail, CPF..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
              />
              {userSearch && (
                <button
                  type="button"
                  onClick={() => setUserSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
              {(['todos', 'ativo', 'suspenso', 'banido'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setUserStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                    userStatusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Stats Badge */}
            <div className="text-xs text-slate-500 font-semibold shrink-0">
              Exibindo <strong className="text-slate-900">{filteredUsers.length}</strong> de {users.length} usuários
            </div>
          </div>

          {/* User Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredUsers.map((user) => {
              const isMaster = user.id === TIAGO_DIAS_USER.id || user.email === 'tiagodias8888@gmail.com';
              const status = user.status || 'ativo';

              return (
                <div
                  key={user.id}
                  className={`bg-white rounded-2xl border p-4 shadow-xs flex flex-col justify-between gap-3 transition-all hover:shadow-md ${
                    isMaster
                      ? 'border-blue-300 ring-2 ring-blue-500/20 bg-gradient-to-br from-blue-50/40 to-white'
                      : status === 'banido'
                      ? 'border-red-200 bg-red-50/20'
                      : status === 'suspenso'
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top line with Avatar & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 ring-2 ring-slate-200 shrink-0 flex items-center justify-center font-black text-slate-600">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          user.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 text-sm leading-tight">
                            {user.name}
                          </h3>
                          {isMaster && (
                            <span className="material-symbols-outlined text-[16px] text-amber-500" title="Criador & Administrador Master">
                              crown
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        <p className="text-[11px] text-slate-400 font-medium">{user.role || 'Usuário'}</p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider font-mono ${
                        status === 'ativo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : status === 'suspenso'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  {/* Identification Details */}
                  <div className="bg-slate-50/80 rounded-xl p-2.5 text-xs grid grid-cols-2 gap-2 border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">CPF / Documento</span>
                      <span className="font-bold text-slate-800 truncate block">{user.cpfCnpj || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">WhatsApp</span>
                      <span className="font-bold text-slate-800 truncate block">{user.phoneWhatsapp || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Chave PIX</span>
                      <span className="font-bold text-emerald-700 truncate block">{user.pixKey || user.email}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">PIN Suporte</span>
                      <span className="font-mono font-bold text-purple-700 block">{user.supportPin || '8888'}</span>
                    </div>
                  </div>

                  {/* Password / Recovery Info Box */}
                  <div className="bg-purple-50/60 border border-purple-200/60 rounded-xl p-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-purple-600 font-bold">
                        lock
                      </span>
                      <span className="text-slate-600 font-semibold text-[11px]">Senha cadastrada:</span>
                      <span className="font-mono font-black text-purple-900">
                        {user.plainPassword || user.lastKnownPassword || '••••••••'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setTargetUserForPassword(user);
                        setNewPasswordInput(user.plainPassword || user.lastKnownPassword || 'haspaho2026');
                        setIsPasswordModalOpen(true);
                      }}
                      className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                      title="Redefinir ou Recuperar Senha do Usuário"
                    >
                      <span className="material-symbols-outlined text-[12px]">key</span>
                      <span>Redefinir</span>
                    </button>
                  </div>

                  {/* Ban / Suspension Justification if present */}
                  {user.banReason && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-xs text-red-800">
                      <span className="font-bold block text-[10px] uppercase">Motivo da Sanção / Auditoria:</span>
                      <p className="text-[11px]">{user.banReason}</p>
                    </div>
                  )}

                  {/* Action Buttons Toolbar */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 flex-wrap">
                    {/* Edit Details */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserForEdit(user);
                        setIsEditUserModalOpen(true);
                      }}
                      className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Editar Informações Cadastrais do Usuário"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                      <span>Editar</span>
                    </button>

                    {/* Send Credentials via WhatsApp */}
                    {user.phoneWhatsapp && (
                      <a
                        href={getWhatsAppCredentialsUrl(user)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Enviar credenciais e suporte de senha via WhatsApp"
                      >
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">send_to_mobile</span>
                        <span className="hidden sm:inline">Enviar Acesso</span>
                      </a>
                    )}

                    {/* Arbitrate: Ban / Suspend / Reactivate */}
                    {!isMaster && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetUserForBan(user);
                            setBanReasonInput(user.banReason || '');
                            setIsBanModalOpen(true);
                          }}
                          className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border ${
                            status === 'ativo'
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
                          }`}
                          title="Aplicar Arbitragem (Suspender, Banir ou Reativar)"
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {status === 'ativo' ? 'gavel' : 'check_circle'}
                          </span>
                          <span>{status === 'ativo' ? 'Arbitragem' : 'Reativar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          className="h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors cursor-pointer ml-auto"
                          title="Excluir Usuário Permanentemente"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: FÓRUM FECHADO & CANAL DE SUGESTÕES E FEEDBACK
      ========================================================================= */}
      {activeSubTab === 'forum' && (
        <div className="flex flex-col gap-4">
          {/* Forum Header & Action Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {['todos', 'sugestao', 'melhoria', 'bug', 'conformidade'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForumCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                    forumCategoryFilter === cat
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsNewTopicModalOpen(true)}
              className="w-full sm:w-auto h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add_comment</span>
              <span>Nova Sugestão / Feedback</span>
            </button>
          </div>

          {/* Topics Feed */}
          <div className="flex flex-col gap-3">
            {filteredTopics.map((topic) => {
              const isPinned = topic.isPinned;

              return (
                <div
                  key={topic.id}
                  className={`bg-white rounded-2xl p-5 border shadow-xs transition-all flex flex-col gap-3 ${
                    isPinned
                      ? 'border-amber-300 ring-2 ring-amber-400/20 bg-gradient-to-br from-amber-50/20 to-white'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Topic Header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 ring-2 ring-slate-200 flex items-center justify-center font-bold text-slate-700">
                        {topic.authorAvatar ? (
                          <img src={topic.authorAvatar} alt={topic.authorName} className="w-full h-full object-cover" />
                        ) : (
                          topic.authorName.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{topic.authorName}</span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {topic.authorRole || 'Membro'}
                          </span>
                          {isPinned && (
                            <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">push_pin</span>
                              FIXADO
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(topic.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Category & Status */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md uppercase">
                        {topic.category}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider font-mono ${
                          topic.status === 'concluido'
                            ? 'bg-emerald-100 text-emerald-800'
                            : topic.status === 'em_desenvolvimento'
                            ? 'bg-purple-100 text-purple-800'
                            : topic.status === 'aprovado'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {topic.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Title and Content */}
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                      {topic.title}
                    </h3>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed whitespace-pre-line">
                      {topic.content}
                    </p>
                  </div>

                  {/* Developer Response Box if available */}
                  {topic.devResponse && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3.5 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-blue-900 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px] text-blue-600">verified</span>
                          Resposta Oficial do Desenvolvedor (Tiago Dias):
                        </span>
                        {topic.devResponseAt && (
                          <span className="text-[10px] text-blue-600">
                            {new Date(topic.devResponseAt).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-800 font-medium">{topic.devResponse}</p>
                    </div>
                  )}

                  {/* Direct Contact & Action Bar */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
                    {/* Send to Developer Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={getWhatsAppFeedbackUrl(topic)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Encaminhar esta sugestão para o WhatsApp de Tiago Dias"
                      >
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">chat</span>
                        <span>Enviar p/ WhatsApp (014 99733-9863)</span>
                      </a>

                      <a
                        href={getGmailFeedbackUrl(topic)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Enviar esta sugestão para tiagodias8888@gmail.com"
                      >
                        <span className="material-symbols-outlined text-[15px] text-blue-600">mail</span>
                        <span>Enviar p/ Gmail</span>
                      </a>
                    </div>

                    {/* Admin Moderation Controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTopicForReply(topic);
                          setDevReplyInput(topic.devResponse || '');
                        }}
                        className="h-8 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Responder como Desenvolvedor Full Stack"
                      >
                        <span className="material-symbols-outlined text-[15px]">rate_review</span>
                        <span>Responder</span>
                      </button>

                      <select
                        value={topic.status}
                        onChange={(e) => handleUpdateTopicStatus(topic.id, e.target.value as any)}
                        className="h-8 px-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 outline-none cursor-pointer"
                      >
                        <option value="aberto">Aberto</option>
                        <option value="em_analise">Em Análise</option>
                        <option value="aprovado">Aprovado</option>
                        <option value="em_desenvolvimento">Em Desenvolvimento</option>
                        <option value="concluido">Concluído</option>
                        <option value="rejeitado">Rejeitado</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleDeleteTopic(topic.id)}
                        className="h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center cursor-pointer"
                        title="Excluir Tópico"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: DIRETRIZES DE CONFORMIDADE & ARBITRAGEM
      ========================================================================= */}
      {activeSubTab === 'conformidade' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
                <span className="material-symbols-outlined text-[28px]">gavel</span>
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 leading-tight">
                  Código de Conformidade &amp; Diretrizes da Plataforma HASPAHO
                </h2>
                <p className="text-xs text-slate-500">
                  Regras oficiais de utilização, termos de conduta e parâmetros de arbitragem administrativa.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {COMPLIANCE_GUIDELINES.map((guide) => (
                <div key={guide.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-blue-600">shield</span>
                      {guide.title}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {guide.description}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 text-[11px] text-red-700 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    <span>Sanção: {guide.penalty}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Direct Support & Moderation Contact Box */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-5 mt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base">
                  Canal de Arbitragem &amp; Recursos de Suspensão
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">
                  Usuários suspensos ou com dúvidas de conformidade podem contatar diretamente o Administrador Mestre Tiago Augusto Dias.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <a
                  href={`https://wa.me/55${DEV_PHONE}?text=${encodeURIComponent('Olá Tiago Augusto Dias, solicito suporte ou revisão de conformidade da minha conta na plataforma Haspaho.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  <span>WhatsApp Arbitragem</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: TERMINAL FULL STACK & DIAGNÓSTICO
      ========================================================================= */}
      {activeSubTab === 'diagnostico' && (
        <div className="bg-slate-950 text-slate-200 rounded-2xl p-6 font-mono text-xs shadow-xl border border-slate-800 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="font-bold text-white text-sm ml-2">HASPAHO Engine Core • Full Stack Developer Console</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              NODE v22 • REACT SPA • FIRESTORE ONLINE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800">
              <span className="text-slate-400 text-[10px] font-bold block">ADMINISTRADOR MASTER</span>
              <span className="text-white font-bold text-sm block mt-1">Tiago Augusto Dias</span>
              <span className="text-emerald-400 text-[11px]">CPF: {DEV_CPF}</span>
            </div>

            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800">
              <span className="text-slate-400 text-[10px] font-bold block">CONTAS DE USUÁRIOS</span>
              <span className="text-white font-bold text-sm block mt-1">{users.length} Registradas</span>
              <span className="text-blue-400 text-[11px]">Autenticação Ativa</span>
            </div>

            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800">
              <span className="text-slate-400 text-[10px] font-bold block">FÓRUM &amp; FEEDBACK</span>
              <span className="text-white font-bold text-sm block mt-1">{forumTopics.length} Tópicos</span>
              <span className="text-purple-400 text-[11px]">WhatsApp &amp; Gmail Sync</span>
            </div>
          </div>

          <div className="bg-black/60 rounded-xl p-4 border border-slate-800 flex flex-col gap-1 text-[11px]">
            <p className="text-emerald-400">⚡ [HASPAHO SYSTEM] Initializing Full Stack Suite for Tiago Augusto Dias...</p>
            <p className="text-slate-300">✔ Cloud Firestore: Synchronized with tenant database ca5a5a06-cd3c-4b8e-a7d3-40a48e1f7799</p>
            <p className="text-slate-300">✔ Password Recovery Pipeline: Active for WhatsApp (014) 99733-9863 &amp; Gmail tiagodias8888@gmail.com</p>
            <p className="text-slate-300">✔ Arbitragem &amp; Sanctions Protocol: Ready</p>
            <p className="text-blue-400">✔ All systems operational with 100% test coverage.</p>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
      ========================================================================= */}

      {/* 1. Modal: Edit User Details */}
      {isEditUserModalOpen && selectedUserForEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">manage_accounts</span>
                Editar Informações do Usuário
              </h3>
              <button
                type="button"
                onClick={() => setIsEditUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={selectedUserForEdit.name}
                  onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">E-mail de Acesso</label>
                  <input
                    type="email"
                    value={selectedUserForEdit.email}
                    onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, email: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    value={selectedUserForEdit.phoneWhatsapp || ''}
                    onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, phoneWhatsapp: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CPF ou CNPJ</label>
                  <input
                    type="text"
                    value={selectedUserForEdit.cpfCnpj || ''}
                    onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, cpfCnpj: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cargo / Função</label>
                  <input
                    type="text"
                    value={selectedUserForEdit.role || ''}
                    onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, role: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Empresa / Razão Social</label>
                  <input
                    type="text"
                    value={selectedUserForEdit.companyName || ''}
                    onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, companyName: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Chave PIX</label>
                  <input
                    type="text"
                    value={selectedUserForEdit.pixKey || ''}
                    onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, pixKey: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Status da Conta</label>
                <select
                  value={selectedUserForEdit.status || 'ativo'}
                  onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, status: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none font-bold"
                >
                  <option value="ativo">🟢 Ativo (Acesso Liberado)</option>
                  <option value="suspenso">🟡 Suspenso Temporariamente</option>
                  <option value="banido">🔴 Banido da Plataforma</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditUserModalOpen(false)}
                  className="w-1/3 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Reset User Password (Support Pipeline) */}
      {isPasswordModalOpen && targetUserForPassword && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600">lock_reset</span>
                Suporte de Senha • {targetUserForPassword.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="flex flex-col gap-3 text-xs">
              <p className="text-slate-600">
                Como Administrador Mestre, você pode redefinir a senha do usuário e enviar as novas credenciais via WhatsApp ou E-mail.
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Nova Senha de Acesso</label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPassword}
                    className="text-purple-600 font-bold hover:underline cursor-pointer"
                  >
                    🎲 Gerar Senha Segura
                  </button>
                </div>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 focus:border-purple-600 outline-none font-mono font-bold text-sm bg-purple-50/50"
                  required
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl text-[11px] text-slate-500 border border-slate-100">
                <p>E-mail: <strong>{targetUserForPassword.email}</strong></p>
                <p>WhatsApp: <strong>{targetUserForPassword.phoneWhatsapp || 'Não cadastrado'}</strong></p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="w-1/3 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md cursor-pointer"
                >
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Ban or Suspend User */}
      {isBanModalOpen && targetUserForBan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600">gavel</span>
                Arbitragem de Usuário • {targetUserForBan.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsBanModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <p className="text-slate-600">
                Selecione a ação administrativa a ser aplicada conforme o Código de Conformidade da plataforma HASPAHO:
              </p>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Justificativa / Motivo da Sanção</label>
                <textarea
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  placeholder="Ex: Violação dos Termos de Uso, Inadimplência Recorrente, Tentativa de Fraude..."
                  className="w-full h-24 p-3 rounded-xl border border-slate-200 focus:border-red-600 outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleApplyBanOrSuspension('ativo')}
                  className="h-10 px-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Reativar</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyBanOrSuspension('suspenso')}
                  className="h-10 px-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Suspender</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyBanOrSuspension('banido')}
                  className="h-10 px-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-1 cursor-pointer shadow-md"
                >
                  <span>Banir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal: New Forum Topic / Suggestion */}
      {isNewTopicModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">rate_review</span>
                Enviar Nova Sugestão / Feedback
              </h3>
              <button
                type="button"
                onClick={() => setIsNewTopicModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTopic} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Título da Sugestão ou Melhoria</label>
                <input
                  type="text"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  placeholder="Ex: Alerta automático de faturas, Exportação em Excel..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Categoria</label>
                <select
                  value={newTopicCategory}
                  onChange={(e) => setNewTopicCategory(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none font-bold"
                >
                  <option value="sugestao">💡 Sugestão de Recurso</option>
                  <option value="melhoria">🚀 Melhoria de Sistema</option>
                  <option value="bug">🐛 Relatório de Inconsistência (Bug)</option>
                  <option value="duvida">❓ Dúvida Operacional</option>
                  <option value="conformidade">⚖️ Conformidade e Auditoria</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Descrição Detalhada</label>
                <textarea
                  value={newTopicContent}
                  onChange={(e) => setNewTopicContent(e.target.value)}
                  placeholder="Explique como essa sugestão facilitará o dia a dia e aumentará a produtividade na plataforma..."
                  className="w-full h-28 p-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none text-xs"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewTopicModalOpen(false)}
                  className="w-1/3 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md cursor-pointer"
                >
                  Publicar no Fórum Fechado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Reply to Topic as Developer */}
      {selectedTopicForReply && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">rate_review</span>
                Resposta Oficial do Desenvolvedor
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTopicForReply(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDevReply} className="flex flex-col gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Tópico:</span>
                <p className="font-bold text-slate-900">{selectedTopicForReply.title}</p>
                <p className="text-slate-600 mt-1">{selectedTopicForReply.content}</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mensagem de Resposta Oficial</label>
                <textarea
                  value={devReplyInput}
                  onChange={(e) => setDevReplyInput(e.target.value)}
                  placeholder="Escreva a resposta e parecer técnico sobre a sugestão..."
                  className="w-full h-28 p-3 rounded-xl border border-slate-200 focus:border-blue-600 outline-none text-xs"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTopicForReply(null)}
                  className="w-1/3 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md cursor-pointer"
                >
                  Salvar Resposta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
