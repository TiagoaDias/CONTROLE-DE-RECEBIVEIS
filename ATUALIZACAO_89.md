# 📌 MARCO DE PRODUÇÃO OFICIAL: ATUALIZAÇÃO 89

- **Nome**: Atualização 89
- **Status**: Versão Oficial Ativa e Homologada em Produção
- **Autor/Proprietário**: Tiago Dias (HASPAHO Tecnologia da Informação)
- **Repositório GitHub Oficial**: https://github.com/TiagoaDias/CONTROLE-DE-RECEBIVEIS.git
- **Branch Ativa**: `main`
- **Site em Produção Vercel**: https://controle-de-recebiveis.vercel.app/

---

### 🚀 Resumo das Entregas e Recursos da Atualização 89

1. **Restauração do Botão ERP Oficial no Painel:**
   - Posicionado no canto superior direito do card do Painel Operacional (`DashboardView`), exatamente ao lado do seletor *"Todos os Clientes"*.
   - Estilizado com degradê âmbar, ícone `desktop_windows` e efeito sonoro nativo.
   - Dá acesso completo ao subsistema ERP Delphi Corporativo Desktop.

2. **Organização do Menu Inferior (BottomNav):**
   - Removido o botão ERP de "Ações Rápidas", deixando o menu focado exclusivamente em ações rápidas de lançamento (*Nova Compra*, *Calculadora* e *Scanner*).

3. **Reenquadramento e Simplificação do Modal ERP:**
   - O modal de balões informativos do devedor no ERP foi reenquadrado com rolagem vertical automática (`max-h-[90vh]` e `overflow-y-auto`), impedindo que o rodapé seja cortado em telas de celulares menores.
   - O botão de fechamento foi simplificado de 3 palavras para apenas **"Entendido"**, com ícone de verificação.

4. **Persistência de Exclusões e Tombstones no Firestore:**
   - Exclusões permanentes e lixeira sincronizadas com a coleção `tombstones` no Firestore, associadas ao `UID` real do Firebase Auth.
   - Isolamento de escopo por usuário, garantindo que devedores de teste (DEMO-001 e DEMO-002) excluídos nunca mais reapareçam em novos logins ou atualizações.

5. **Segurança e Estabilidade:**
   - Endpoints do servidor Express com verificação defensiva de integridade de arquivos.
   - Sincronização compatível com Capacitor Android e Vercel.

---

### 🛡️ Histórico de Recuperação:
A versão anterior (**Atualização 88**) permanece preservada como cópia de segurança em `ATUALIZACAO_88.md` para fins de histórico e contingência.
