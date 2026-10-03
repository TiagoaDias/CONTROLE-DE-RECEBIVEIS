import React, { useState } from 'react';
import { APP_IMAGES } from '../data/mockData';

interface AssetInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AssetInspectorModal: React.FC<AssetInspectorModalProps> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const assetsList = [
    { key: 'logo', name: 'Logotipo do App (Recebíveis Pay)', url: APP_IMAGES.logo, desc: 'Ícone azul com janela e visto verde' },
    { key: 'currentUser', name: 'Perfil: Thiago Dias', url: APP_IMAGES.currentUser, desc: 'Foto de perfil do gestor da conta (HASPAHO TI)' },
    { key: 'jucelia', name: 'Devedora: Jucelia Aizza', url: APP_IMAGES.jucelia, desc: 'Foto de perfil / avatar em alta resolução' },
    { key: 'maria', name: 'Devedora: Maria Silveira / Oliveira', url: APP_IMAGES.maria, desc: 'Foto de perfil / avatar' },
    { key: 'joao', name: 'Devedor: João Pedro Silva', url: APP_IMAGES.joao, desc: 'Foto de perfil / avatar' },
    { key: 'fatima', name: 'Devedora: Fátima Santos', url: APP_IMAGES.fatima, desc: 'Foto de perfil / avatar' },
    { key: 'carlos', name: 'Devedor: Carlos Eduardo', url: APP_IMAGES.carlos, desc: 'Foto de perfil / avatar' },
  ];

  const handleCopy = (key: string, url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004ac6]">image</span>
            <div>
              <h3 className="font-semibold text-slate-800 text-base leading-tight">Links Diretos das Imagens do HTML</h3>
              <p className="text-xs text-slate-500">Imagens oficiais integradas diretamente no app</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 leading-relaxed">
            <span className="font-semibold">Sim, é 100% possível!</span> Todas as imagens das telas foram conectadas por links diretos CDN de alta disponibilidade (Google UserContent) no código HTML e React, garantindo carregamento instantâneo.
          </div>

          <div className="space-y-2.5">
            {assetsList.map((asset) => (
              <div key={asset.key} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3 hover:bg-slate-100/80 transition-colors">
                <img 
                  src={asset.url} 
                  alt={asset.name} 
                  className="w-12 h-12 rounded-lg object-cover shadow-xs border border-white shrink-0 bg-white"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-sm text-slate-800 truncate">{asset.name}</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-medium shrink-0">Ativo</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{asset.desc}</p>
                  <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5 select-all">{asset.url}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => handleCopy(asset.key, asset.url)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 transition-all"
                    title="Copiar URL direta"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedKey === asset.key ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedKey === asset.key ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:text-blue-600 text-center"
                  >
                    Abrir ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">7 imagens diretas carregadas</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-slate-800 hover:bg-slate-900 text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
