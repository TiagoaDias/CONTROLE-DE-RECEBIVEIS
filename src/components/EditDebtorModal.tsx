import React, { useState, useEffect } from 'react';
import { Debtor } from '../types';
import { APP_IMAGES } from '../data/mockData';

interface EditDebtorModalProps {
  isOpen: boolean;
  debtor: Debtor | null;
  onClose: () => void;
  onSave: (updatedDebtor: Debtor) => void;
  onOpenContract?: (debtorId: string) => void;
}

const AVATAR_OPTIONS = [
  { label: 'Jucelia', url: APP_IMAGES.jucelia },
  { label: 'Jubileu', url: APP_IMAGES.jubileu },
  { label: 'Marcos', url: APP_IMAGES.marcos },
  { label: 'Maria', url: APP_IMAGES.maria },
  { label: 'Carlos', url: APP_IMAGES.carlos },
  { label: 'Fátima', url: APP_IMAGES.fatima },
  { label: 'João', url: APP_IMAGES.joao },
  { label: 'Renata', url: APP_IMAGES.renata },
];

const VINCULO_OPTIONS = [
  'Amigo(a)',
  'Família',
  'Colega de Trabalho',
  'Vizinho(a)',
  'Prestador de Serviço',
  'Outro Vínculo Particular',
];

const getRelationIcon = (rel: string): string => {
  const r = (rel || '').toLowerCase();
  if (r.includes('amig')) return 'sentiment_satisfied';
  if (r.includes('famíl') || r.includes('famil') || r.includes('irmã') || r.includes('irma') || r.includes('mãe') || r.includes('pai')) return 'family_restroom';
  if (r.includes('trabalho') || r.includes('colega') || r.includes('sócio') || r.includes('socio') || r.includes('empresa')) return 'business_center';
  if (r.includes('vizinh')) return 'home';
  if (r.includes('prestador') || r.includes('serviço') || r.includes('servico')) return 'handyman';
  return 'handshake';
};

export const EditDebtorModal: React.FC<EditDebtorModalProps> = ({
  isOpen,
  debtor,
  onClose,
  onSave,
  onOpenContract,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('Amigo(a)');
  const [isCustomRelation, setIsCustomRelation] = useState(false);
  const [customRelationText, setCustomRelationText] = useState('');
  const [isAvatarListOpen, setIsAvatarListOpen] = useState(false);
  const [isRelationListOpen, setIsRelationListOpen] = useState(false);
  const [pixKey, setPixKey] = useState('');
  const [email, setEmail] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [avatar, setAvatar] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (debtor) {
      setName(debtor.name || '');
      setPhone(debtor.phone || '');
      const standardRelations = ['Amigo(a)', 'Amigo', 'Família', 'Colega de Trabalho', 'Vizinho(a)', 'Prestador de Serviço', 'Outro Vínculo Particular'];
      const currentRel = debtor.relation || 'Amigo(a)';
      if (standardRelations.includes(currentRel)) {
        setRelation(currentRel);
        setIsCustomRelation(false);
        setCustomRelationText('');
      } else {
        setRelation('Outro Vínculo Particular');
        setIsCustomRelation(true);
        setCustomRelationText(currentRel);
      }
      setPixKey(debtor.pixKey || '');
      setEmail(debtor.email || '');
      setDocumentNumber(debtor.documentNumber || '');
      setCreditLimit(debtor.creditLimit ? debtor.creditLimit.toString() : '');
      setAvatar(debtor.avatar || APP_IMAGES.carlos);
      setNotes(debtor.notes || '');
    }
  }, [debtor]);

  if (!isOpen || !debtor) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedLimit = creditLimit ? parseFloat(creditLimit.replace(',', '.')) : undefined;
    const finalRelation = isCustomRelation ? (customRelationText.trim() || 'Outro') : relation;

    const updated: Debtor = {
      ...debtor,
      name: name.trim(),
      phone: phone.trim() || debtor.phone,
      relation: finalRelation,
      pixKey: pixKey.trim(),
      email: email.trim(),
      documentNumber: documentNumber.trim(),
      creditLimit: isNaN(parsedLimit as number) ? undefined : parsedLimit,
      avatar,
      notes: notes.trim(),
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col items-center justify-start overflow-y-auto pt-16 sm:pt-20 pb-24 sm:pb-28 px-3 sm:px-6 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[calc(100dvh-160px)] sm:max-h-[calc(100dvh-180px)] overflow-hidden border border-slate-200 my-auto shrink-0">
        
        {/* Topo do Modal com Botão Voltar & Fechar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-900 text-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border border-white/10"
            title="Voltar"
          >
            <span className="material-symbols-outlined text-[17px]">arrow_back</span>
            <span>Voltar</span>
          </button>

          <div className="text-center min-w-0 px-2">
            <h3 className="font-bold text-white text-sm sm:text-base leading-tight truncate">
              Editar Dados do Devedor
            </h3>
            <span className="text-[10.5px] text-slate-300 block">
              Atualização de Cadastro e Vínculo
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-slate-300 flex items-center justify-center transition-colors cursor-pointer border border-white/10"
            title="Fechar (X)"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form Body Scrollable em Colunas */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          
          {/* Barra Superior de Seleção Rápida: Foto/Avatar à Esquerda & Vínculo à Direita (Idêntico ao topo do card) */}
          <div className="w-full flex flex-col gap-2 relative">
            <div className="bg-slate-50 p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2 w-full select-none">
              
              {/* 1. LADO ESQUERDO: FOTO / AVATAR */}
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarListOpen((prev) => !prev);
                    setIsRelationListOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isAvatarListOpen
                      ? 'bg-blue-50 border-blue-400 text-slate-900 ring-2 ring-blue-200'
                      : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                  title="Clique para escolher foto / avatar"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={avatar || APP_IMAGES.carlos}
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-lg object-cover shadow-xs border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 leading-tight">
                      <span className="text-xs font-bold text-slate-900 truncate block">
                        Foto / Avatar
                      </span>
                      <span className="text-[9.5px] text-slate-500 truncate block font-medium">
                        Toque para alterar
                      </span>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-[16px] text-slate-500 transition-transform shrink-0 ${isAvatarListOpen ? 'rotate-180 text-blue-600' : ''}`}>
                    expand_more
                  </span>
                </button>
              </div>

              {/* 2. LADO DIREITO: VÍNCULO / PARENTESCO */}
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsRelationListOpen((prev) => !prev);
                    setIsAvatarListOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isRelationListOpen
                      ? 'bg-indigo-50 border-indigo-400 text-slate-900 ring-2 ring-indigo-200'
                      : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                  title="Clique para escolher o vínculo"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px]">
                        {getRelationIcon(isCustomRelation ? 'Outro Vínculo Particular' : relation)}
                      </span>
                    </div>
                    <div className="min-w-0 leading-tight">
                      <span className="text-xs font-bold text-slate-900 truncate block">
                        {isCustomRelation ? (customRelationText || 'Personalizado') : relation}
                      </span>
                      <span className="text-[9.5px] text-slate-500 truncate block font-medium">
                        Vínculo
                      </span>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-[16px] text-slate-500 transition-transform shrink-0 ${isRelationListOpen ? 'rotate-180 text-indigo-600' : ''}`}>
                    expand_more
                  </span>
                </button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* A LISTINHA DE FOTOS/AVATARES QUE ABRE AO CLICAR               */}
            {/* ============================================================ */}
            {isAvatarListOpen && (
              <div className="bg-white p-3 rounded-2xl border border-blue-200 shadow-xl flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150 z-30">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-xs">
                  <span className="font-bold text-slate-800 text-[11.5px] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-blue-600">account_circle</span>
                    <span>Escolha a Foto / Avatar ({AVATAR_OPTIONS.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAvatarListOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 py-1">
                  {AVATAR_OPTIONS.map((opt) => {
                    const isSelected = avatar === opt.url;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          setAvatar(opt.url);
                          setIsAvatarListOpen(false);
                        }}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300 scale-105 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="relative">
                          <img
                            src={opt.url}
                            alt={opt.label}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg object-cover shadow-2xs"
                          />
                          {isSelected && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-[9px] font-black ring-1 ring-white">
                              ✓
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] truncate max-w-full font-bold ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* A LISTINHA DE VÍNCULOS QUE ABRE AO CLICAR                     */}
            {/* ============================================================ */}
            {isRelationListOpen && (
              <div className="bg-white p-3 rounded-2xl border border-indigo-200 shadow-xl flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150 z-30">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-xs">
                  <span className="font-bold text-slate-800 text-[11.5px] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-indigo-600">handshake</span>
                    <span>Opções de Vínculo ({VINCULO_OPTIONS.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRelationListOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>

                <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-0.5 custom-scrollbar">
                  {VINCULO_OPTIONS.map((opt) => {
                    const isSelected = !isCustomRelation && relation === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          if (opt === 'Outro Vínculo Particular') {
                            setIsCustomRelation(true);
                            setRelation('Outro Vínculo Particular');
                          } else {
                            setIsCustomRelation(false);
                            setRelation(opt);
                          }
                          setIsRelationListOpen(false);
                        }}
                        className={`w-full p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-left select-none ${
                          isSelected
                            ? 'bg-gradient-to-r from-indigo-50 via-blue-50/60 to-white border-indigo-400 text-slate-900 shadow-xs ring-1 ring-indigo-300'
                            : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 text-transparent'
                          }`}>
                            <span className="material-symbols-outlined text-[11px] font-black">
                              {isSelected ? 'check' : ''}
                            </span>
                          </span>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                            isSelected
                              ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}>
                            <span className="material-symbols-outlined text-[15px]">
                              {getRelationIcon(opt)}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {opt}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-indigo-700 font-mono bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                            Selecionado
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {isCustomRelation && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-indigo-900">
                      Digite o vínculo particular:
                    </label>
                    <input
                      type="text"
                      value={customRelationText}
                      onChange={(e) => setCustomRelationText(e.target.value)}
                      placeholder="Ex: Primo, Sócio, Afiliado..."
                      className="w-full h-9 px-3 bg-slate-50 border border-indigo-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}

            {/* Se estiver com vínculo personalizado e a listinha fechada, mostra campo direto para digitar */}
            {isCustomRelation && !isRelationListOpen && (
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  value={customRelationText}
                  onChange={(e) => setCustomRelationText(e.target.value)}
                  placeholder="Especifique o vínculo personalizado..."
                  className="w-full h-10 px-3 bg-white border-2 border-indigo-400 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
            )}
          </div>

          {/* Nome Completo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-600">person</span>
              <span>Nome Completo *</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              required
            />
          </div>

          {/* CPF / CNPJ */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-500">badge</span>
              <span>CPF ou CNPJ</span>
            </label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="000.000.000-00"
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>

          {/* Telefone / WhatsApp */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">phone</span>
              <span>Telefone / WhatsApp</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 98765-4321"
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>

          {/* Chave PIX */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-teal-600">qr_code_2</span>
              <span>Chave PIX do Devedor</span>
            </label>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="CPF, Telefone, E-mail ou Chave Aleatória"
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>

          {/* E-mail */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-500">mail</span>
              <span>E-mail</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>

          {/* Observações */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-slate-500">notes</span>
              <span>Observações / Histórico</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações internas..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
            />
          </div>

          {/* Ação rápida para abrir contrato se houver */}
          {onOpenContract && (
            <button
              type="button"
              onClick={() => onOpenContract(debtor.id)}
              className="w-full h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
            >
              <span className="material-symbols-outlined text-[18px] text-blue-600">description</span>
              <span>Visualizar Contrato / Instrumento de Restituição</span>
            </button>
          )}

          {/* Rodapé com Botões */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Voltar</span>
            </button>
            <button
              type="submit"
              className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">check</span>
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
