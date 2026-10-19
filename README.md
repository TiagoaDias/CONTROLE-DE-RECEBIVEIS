# 📱 HASPAHO Recebíveis & Parcelas PRO

> **Sistema Completo de Gestão de Recebíveis, Parcelas, Compradores e Contratos Digitais**  
> Desenvolvido por **Tiago Dias** (HASPAHO Tecnologia da Informação).

---

## 🚀 Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Material Symbols, Canvas Confetti
- **Build & Dev**: Vite 8, ESBuild, TSX
- **Mobile Nativo**: Capacitor 6 (Android), Google Sign-In Nativo
- **Backend & APIs**: Node.js, Express, Google GenAI SDK (Gemini)
- **Banco de Dados & Autenticação**: Firebase Firestore & Firebase Auth
- **Geração de Documentos**: jsPDF, html2canvas, QRCode, XLSX

---

## 📋 Pré-requisitos

- **Node.js** >= 18 ou 20 LTS
- **npm** >= 9

---

## 💻 Como Rodar Localmente

1. **Instalar dependências**:
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Configurar variáveis de ambiente**:
   Copie o arquivo de exemplo:
   ```bash
   cp .env.example .env
   ```

3. **Iniciar o ambiente de desenvolvimento**:
   ```bash
   npm run dev
   ```
   Acesse no navegador: `http://localhost:3000`

---

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor Node.js + Vite em modo de desenvolvimento |
| `npm run build:client` | Compila o frontend React/Vite para a pasta `dist` (ideal para Vercel) |
| `npm run build` | Compila o frontend e empacota o backend Node.js (`dist/server.cjs`) |
| `npm start` | Inicia o servidor compilado em produção |
| `npm run lint` | Executa a verificação estrita de TypeScript (`tsc --noEmit`) |
| `npm run cap:sync` | Sincroniza o build web com o projeto nativo Android |

---

## 🐙 Como Subir para o GitHub

Se você já possui o repositório no GitHub ou deseja subir as alterações:

```bash
# 1. Verificar o status dos arquivos limpos
git status

# 2. Adicionar todos os arquivos rastreados
git add .

# 3. Criar o commit com as melhorias
git commit -m "feat: otimizacoes de acoes rapidas, layout de lista, icones pro e limpeza geral"

# 4. Enviar para a branch principal do GitHub
git push origin main
```

> **Dica**: Se estiver iniciando um novo repositório:
> ```bash
> git init
> git add .
> git commit -m "Initial commit: HASPAHO Recebíveis & Parcelas PRO"
> git branch -M main
> git remote add origin https://github.com/TiagoaDias/CONTROLE-DE-RECEBIVEIS.git
> git push -u origin main
> ```

---

## ⚡ Como Publicar na Vercel

O projeto já conta com o arquivo `vercel.json` pré-configurado para implantação automática com suporte a rotas SPA (Single Page Application):

1. Acesse [vercel.com](https://vercel.com) e faça login.
2. Clique em **"Add New Project"** e selecione o repositório **`CONTROLE-DE-RECEBIVEIS`** do GitHub.
3. As configurações já são detectadas automaticamente:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build:client`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install --legacy-peer-deps`
4. Clique em **"Deploy"**.
5. Em poucos segundos, sua aplicação estará no ar com certificado SSL automático!

---

## 🔒 Segurança e Dados

- Acesso autenticado com isolamento por usuário.
- Nenhuma chave secreta ou credencial sensível é exposta no código frontend.
- O `.gitignore` está configurado para não subir `.env`, `node_modules/`, arquivos de build e caches.

---

## 📄 Licença

Propriedade de **HASPAHO Tecnologia da Informação** &copy; 2026. Todos os direitos reservados.
