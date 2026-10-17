# 📌 MARCO DE PRODUÇÃO OFICIAL: ATUALIZAÇÃO 90

- **Nome**: Atualização 90 PRO
- **Status**: Versão Oficial Ativa e Homologada em Produção
- **Autor/Proprietário**: Tiago Dias (HASPAHO Tecnologia da Informação)
- **Repositório GitHub Oficial**: https://github.com/TiagoaDias/CONTROLE-DE-RECEBIVEIS.git
- **Branch Ativa**: `main`
- **Release Tag**: `v90.0`
- **Site em Produção Vercel**: https://controle-de-recebiveis.vercel.app/

---

### 🚀 Resumo das Entregas e Recursos da Atualização 90

1. **Seletor de Contas Google Interativo no Aplicativo Android (Capacitor/WebView):**
   - Ao tocar em **"ENTRAR COM CONTA GOOGLE"** no aplicativo, abre o modal de seleção com todas as contas conhecidas no aparelho.
   - Permite selecionar a conta de Tiago Dias, qualquer outra conta salva, ou digitar um novo e-mail Gmail diretamente.
   - Botão para tentar o seletor nativo do navegador sempre disponível.

2. **Troca Limpa de Usuário sem Reutilização de Cache:**
   - Ao clicar em **"Sair"**, o estado de logout explícito é registrado no dispositivo.
   - O `onAuthStateChanged` e o ciclo de vida de autenticação validam estritamente que os dados em cache pertencem exatamente ao e-mail autenticado, impedindo que a sessão anterior de outro usuário seja recuperada acidentalmente.

3. **Gerador Automático de APK no GitHub Actions atualizado para `v90.0`:**
   - O fluxo `.github/workflows/build-apk.yml` foi configurado para gerar a Release Oficial **v90.0**.
   - O arquivo `app-debug.apk` novo traz embutido o código atualizado.

4. **Sincronização de Assets Nativa:**
   - Build do cliente compilado com sucesso e sincronizado via `npx cap sync android` na pasta de assets nativos.
