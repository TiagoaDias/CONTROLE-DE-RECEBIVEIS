# Sistema de Gestão de Recebíveis, Parcelas e Compradores (HASPAHO TI)

Aplicação web completa desenvolvida em React (Vite) + TypeScript + Tailwind CSS, com backend em Node.js (Express) e persistência em tempo real com **Firebase Firestore**.

## 🚀 Funcionalidades Principais

- **Painel Operacional e Dashboard**: Visão geral de recebíveis, parcelas quitadas, atrasadas e a vencer.
- **Gestão de Compradores & Devedores**: Cadastro completo, histórico de compras, limites de crédito e acompanhamento por cliente.
- **Gestão de Parcelas & Recibos**: Emissão de recibos em PDF, compartilhamento via WhatsApp e controle de quitação.
- **Sistema ERP Corporativo**: Ferramentas avançadas para lançamentos em massa e gerenciamento financeiro.
- **Modo Mobile Otimizado**: Experiência compacta e rápida para uso em smartphones com navegação por toque e cartões responsivos.

---

## 🛠️ Como Executar Localmente

1. Clone ou baixe o repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o arquivo `.env` com base em `.env.example`.
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

---

## 📦 Build para Produção

Para gerar a build de produção otimizada:
```bash
npm run build
```

Para iniciar o servidor em produção:
```bash
npm start
```

---

## ☁️ Publicação na Vercel & GitHub

1. **GitHub**:
   - Crie um repositório vazio no GitHub.
   - No terminal do projeto:
     ```bash
     git init
     git add .
     git commit -m "Initial commit: Sistema de Recebíveis HASPAHO TI"
     git branch -M main
     git remote add origin <URL_DO_SEU_REPOSITORIO_GITHUB>
     git push -u origin main
     ```

2. **Vercel**:
   - Importe o repositório do GitHub na Vercel.
   - O projeto já possui o arquivo `vercel.json` configurado.
   - Configure as variáveis de ambiente do Firebase se necessário no painel da Vercel.
