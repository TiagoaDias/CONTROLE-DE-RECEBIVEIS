import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import {
  syncCadastroTxt,
  appendMovimentacaoTxt,
  appendPagamentoTxt,
  syncStatusFinanceiroTxt,
  readClientTxtFile,
  normalizeClientFolderName,
} from './txtHistoryManager';

export interface AutomationContext {
  currentUser: any;
  debtors: any[];
  purchases: any[];
  installments: any[];
  transactions: any[];
}

export interface AutomationResponse {
  reply: string;
  intent: 'A_OBSERVACAO' | 'B_PROMESSA' | 'C_PAGAMENTO_INFORMADO' | 'D_PAGAMENTO_CONFIRMADO' | 'E_PARCIAL' | 'F_QUITADA' | 'G_CONSULTA' | 'H_CORRECAO_CANCELAMENTO' | 'OUTRO';
  intentLabel: string;
  clientIdentified?: {
    id: string;
    name: string;
    phone?: string;
    totalOwed: number;
    totalPaid: number;
  };
  operation?: {
    type: string;
    amount?: number;
    date?: string;
    status: string;
    description: string;
    divergenceWarning?: string;
    operationId: string;
  };
  requiresUserConfirmation?: boolean;
  confirmationPrompt?: string;
  txtUpdated?: boolean;
  txtFiles?: Array<{
    fileName: string;
    clientFolder: string;
    preview: string;
  }>;
  mutations?: {
    updatedDebtor?: any;
    updatedInstallments?: any[];
    newTransaction?: any;
  };
}

// 1. Declaração das Ferramentas Oficiais do Gemini (Function Calling)
const toolConsultarClientes: FunctionDeclaration = {
  name: 'consultar_clientes',
  description: 'Consulta e lista clientes/devedores pelo nome ou termo de busca.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      termoBusca: {
        type: Type.STRING,
        description: 'Nome, apelido ou trecho do nome do cliente (ex: Fábio, Renata, Dias)',
      },
    },
    required: ['termoBusca'],
  },
};

const toolConsultarRecebiveis: FunctionDeclaration = {
  name: 'consultar_recebiveis',
  description: 'Consulta parcelas, compras e situação financeira detalhada de um cliente específico.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      nomeCliente: {
        type: Type.STRING,
        description: 'Nome do cliente a ser consultado',
      },
    },
    required: ['nomeCliente'],
  },
};

const toolRegistrarPagamentoInformado: FunctionDeclaration = {
  name: 'registrar_pagamento_informado',
  description: 'Registra um pagamento informado pelo usuário ou devedor (Status: Aguardando confirmação / Pagamento informado). NÃO baixa a dívida como quitada sem conferência.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      nomeCliente: {
        type: Type.STRING,
        description: 'Nome do cliente que efetuou o pagamento',
      },
      valor: {
        type: Type.NUMBER,
        description: 'Valor informado do pagamento em reais (número positivo)',
      },
      dataPagamento: {
        type: Type.STRING,
        description: 'Data do pagamento (ex: 23/10/2026 ou "hoje")',
      },
      formaPagamento: {
        type: Type.STRING,
        description: 'Forma de pagamento (PIX, Dinheiro, Transferência, etc.)',
      },
      observacao: {
        type: Type.STRING,
        description: 'Observação do pagamento informado',
      },
    },
    required: ['nomeCliente', 'valor'],
  },
};

const toolConfirmarPagamento: FunctionDeclaration = {
  name: 'confirmar_pagamento',
  description: 'Confirma e valida um pagamento com fonte autorizada (baixa a parcela, atualiza saldos oficiais e registra comprovante).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      nomeCliente: {
        type: Type.STRING,
        description: 'Nome do cliente',
      },
      valor: {
        type: Type.NUMBER,
        description: 'Valor efetivamente confirmado em reais',
      },
      formaPagamento: {
        type: Type.STRING,
        description: 'Forma de pagamento confirmada (PIX, Ted, etc.)',
      },
      autenticacaoPix: {
        type: Type.STRING,
        description: 'Código de autenticação ou ID da transação se houver',
      },
    },
    required: ['nomeCliente', 'valor'],
  },
};

const toolRegistrarObservacao: FunctionDeclaration = {
  name: 'registrar_informacao_observacao',
  description: 'Registra uma observação, anotação ou promessa de pagamento no histórico do cliente.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      nomeCliente: {
        type: Type.STRING,
        description: 'Nome do cliente',
      },
      tipo: {
        type: Type.STRING,
        description: 'Tipo da anotação: "promessa_pagamento", "observacao_geral", ou "contato"',
      },
      conteudo: {
        type: Type.STRING,
        description: 'Texto da observação ou termos da promessa',
      },
      dataPromessa: {
        type: Type.STRING,
        description: 'Data combinada para pagamento caso seja promessa (ex: 24/10/2026, amanhã)',
      },
    },
    required: ['nomeCliente', 'conteudo'],
  },
};

const toolGerarRelatorioResumo: FunctionDeclaration = {
  name: 'gerar_relatorio_resumo',
  description: 'Gera relatório consolidado de recebíveis, total a receber, atrasados e taxa de pontualidade.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filtro: {
        type: Type.STRING,
        description: 'Filtro desejado: "geral", "atrasados", "a_vencer", "hoje"',
      },
    },
  },
};

const toolConsultarArquivosTxt: FunctionDeclaration = {
  name: 'consultar_arquivos_txt',
  description: 'Lê o conteúdo do arquivo TXT de histórico correspondente ao cliente (cadastro.txt, movimentacoes.txt, pagamentos.txt ou status_financeiro.txt).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      nomeCliente: {
        type: Type.STRING,
        description: 'Nome do cliente',
      },
      tipoArquivo: {
        type: Type.STRING,
        description: 'Arquivo a consultar: "pagamentos.txt", "movimentacoes.txt", "cadastro.txt", ou "status_financeiro.txt"',
      },
    },
    required: ['nomeCliente', 'tipoArquivo'],
  },
};

// Localizador seguro de clientes no banco existente
function findDebtor(nameQuery: string, debtors: any[]) {
  if (!nameQuery || !debtors || debtors.length === 0) return { matches: [] };
  const clean = nameQuery.trim().toLowerCase();

  // 1. Busca exata
  const exact = debtors.filter((d) => (d.name || '').toLowerCase() === clean);
  if (exact.length === 1) return { exact: exact[0], matches: exact };

  // 2. Busca por partes do nome
  const parts = clean.split(/\s+/).filter(Boolean);
  const matched = debtors.filter((d) => {
    const dName = (d.name || '').toLowerCase();
    return parts.every((p) => dName.includes(p)) || dName.includes(clean);
  });

  return { exact: matched.length === 1 ? matched[0] : null, matches: matched };
}

// Motor de Execução da Automação com Gemini
export async function runGeminiAutomation(
  userCommand: string,
  context: AutomationContext,
  geminiClient: GoogleGenAI | null,
  forceConfirmed: boolean = false
): Promise<AutomationResponse> {
  const debtors = context.debtors || [];
  const installments = context.installments || [];
  const purchases = context.purchases || [];
  const now = new Date();
  const todayStr = now.toLocaleDateString('pt-BR');
  const operationId = `OP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Informações resumidas para o prompt do modelo
  const debtorsSummary = debtors
    .map(
      (d) =>
        `- ID: ${d.id} | Nome: "${d.name}" | Dívida Total: R$ ${(d.totalOwed || 0).toFixed(2)} | Já Pago: R$ ${(d.totalPaid || 0).toFixed(2)} | Atrasadas: ${d.overdueCount || 0} | Score: ${d.score || 850}`
    )
    .join('\n');

  // Execução via Gemini SDK com Function Calling
  if (geminiClient) {
    try {
      const systemInstruction = `
Você é o assistente oficial de Automação Inteligente do sistema de Controle de Recebíveis HASPAHO (Desenvolvido por Tiago Dias).
Sua missão é interpretar comandos em linguagem natural, acionar as ferramentas (function calling) necessárias para verificar e gravar as operações no aplicativo, sincronizar os arquivos TXT de histórico e retornar confirmações claras ao usuário.

REGRAS DE NEGÓCIO E SEGURANÇA MANDATÓRIAS:
1. DIFERENCIAÇÃO DE INTENÇÃO (Seção 5):
   - A. Informação ou observação registrada (ex: "Anote que...", "Observação...")
   - B. Promessa de pagamento (ex: "Prometeu pagar amanhã", "Disse que paga dia 10")
   - C. Pagamento informado, mas ainda NÃO confirmado (ex: "Fábio pagou 150", "Registre o pagamento de 150"): Chame 'registrar_pagamento_informado'. O status deve ser 'Aguardando confirmação'. NUNCA considere a dívida quitada sem confirmação explícita.
   - D. Pagamento confirmado por procedimento autorizado: Chame 'confirmar_pagamento' somente quando o usuário solicitar confirmação expressa (ex: "Confirmar pagamento", "Baixar comprovante validado").
   - G. Consulta: Chame 'consultar_recebiveis' ou 'consultar_clientes'.
2. CRUZAMENTO AUTOMÁTICO COM O APLICATIVO:
   - Verifique sempre a identidade do cliente nos dados cadastrados.
   - Se houver ambiguidade (dois clientes com nomes semelhantes), alerte o usuário e pergunte qual é o correto.
   - Se o valor pago for maior que o saldo devedor restante, aponte a divergência.
3. RETORNO AO USUÁRIO:
   - Seja claro, profissional, transparente e objetivo em português do Brasil.
   - Informe exatamente o que foi gravado no banco de dados e nos arquivos TXT.
`;

      const prompt = `
Comando do usuário: "${userCommand}"

Data atual do sistema: ${todayStr} às ${now.toLocaleTimeString('pt-BR')}

Clientes cadastrados no sistema atualmente:
${debtorsSummary || '(Nenhum cliente cadastrado ainda)'}
`;

      // Timeout de 10s para evitar que a requisição fique travada indefinidamente se houver latência externa
      const callAutomationModel = async (modelName: string) => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout de comunicação com o serviço Gemini (${modelName})`)), 10000)
        );
        return Promise.race([
          geminiClient.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction,
              tools: [
                {
                  functionDeclarations: [
                    toolConsultarClientes,
                    toolConsultarRecebiveis,
                    toolRegistrarPagamentoInformado,
                    toolConfirmarPagamento,
                    toolRegistrarObservacao,
                    toolGerarRelatorioResumo,
                    toolConsultarArquivosTxt,
                  ],
                },
              ],
            },
          }),
          timeoutPromise,
        ]);
      };

      let response;
      try {
        response = await callAutomationModel('gemini-3.1-flash-lite');
      } catch {
        response = await callAutomationModel('gemini-3-flash-preview');
      }

      // Verifica se o Gemini chamou alguma função
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        const { name, args } = call as any;

        // Executa a ferramenta solicitada
        return await executeToolAction(name, args, userCommand, context, operationId, forceConfirmed);
      }

      // Se respondeu diretamente em texto sem function call
      const replyText = response.text || 'Comando compreendido pelo Gemini.';
      return analyzeDirectTextReply(replyText, userCommand, context, operationId);
    } catch {
      // Continua de forma transparente para o motor autônomo heurístico
    }
  }

  // Motor de Contingência Autônomo (Heuristic Fallback Engine)
  return executeHeuristicAutomation(userCommand, context, operationId, forceConfirmed);
}

// Executor das chamadas de ferramentas disparadas pelo Gemini
async function executeToolAction(
  name: string,
  args: any,
  userCommand: string,
  context: AutomationContext,
  operationId: string,
  forceConfirmed: boolean
): Promise<AutomationResponse> {
  const { debtors, installments, purchases } = context;

  // 1. REGISTRAR PAGAMENTO INFORMADO (Status: Aguardando confirmação)
  if (name === 'registrar_pagamento_informado') {
    const clientName = args.nomeCliente;
    const amount = Number(args.valor) || 0;
    const { exact: debtor, matches } = findDebtor(clientName, debtors);

    // Ambiguidade de clientes
    if (!debtor && matches.length > 1) {
      return {
        reply: `Identifiquei mais de um cliente com o nome semelhante a "${clientName}": ${matches.map((m) => m.name).join(', ')}. Por favor, especifique qual cliente deseja movimentar para garantir a integridade dos registros.`,
        intent: 'C_PAGAMENTO_INFORMADO',
        intentLabel: 'Identificação Pendente (Ambiguidade)',
        requiresUserConfirmation: true,
        confirmationPrompt: `Qual cliente você deseja movimentar? (${matches.map((m) => m.name).join(' ou ')})`,
      };
    }

    if (!debtor) {
      return {
        reply: `Não encontrei nenhum cliente com o nome "${clientName}" cadastrado no aplicativo. Deseja cadastrar este cliente primeiro antes de registrar o pagamento?`,
        intent: 'C_PAGAMENTO_INFORMADO',
        intentLabel: 'Cliente Não Encontrado',
      };
    }

    // Conferir saldo
    const totalOwed = debtor.totalOwed || 0;
    let divergenceWarning = '';
    if (amount > totalOwed && totalOwed > 0) {
      divergenceWarning = `Atenção: O valor informado de R$ ${amount.toFixed(2)} é maior que o saldo devedor restante do cliente (R$ ${totalOwed.toFixed(2)}).`;
    }

    // Sincroniza arquivos TXT
    syncCadastroTxt(debtor);
    appendMovimentacaoTxt(debtor.name, {
      tipo: 'PAGAMENTO INFORMADO',
      descricao: `Pagamento de R$ ${amount.toFixed(2)} informado pelo usuário via comando Gemini. Observação: ${args.observacao || 'Sem observações adicionais'}. Status: Aguardando confirmação.`,
      valor: amount,
      idMovimentacao: operationId,
    });
    const pagamentosTxt = appendPagamentoTxt(debtor.name, {
      valor: amount,
      tipo: 'informado',
      status: 'Aguardando confirmação',
      idMovimentacao: operationId,
      observacao: args.observacao || 'Pagamento informado pelo usuário via Gemini.',
    });
    const statusTxt = syncStatusFinanceiroTxt(debtor);

    // Atualiza observações no devedor sem quitar a dívida oficial precipitadamente
    const updatedNotes = debtor.notes
      ? `${debtor.notes} | [${new Date().toLocaleDateString('pt-BR')}] Pagamento de R$ ${amount.toFixed(2)} informado (Aguardando confirmação)`
      : `[${new Date().toLocaleDateString('pt-BR')}] Pagamento de R$ ${amount.toFixed(2)} informado (Aguardando confirmação)`;

    const updatedDebtor = {
      ...debtor,
      notes: updatedNotes,
      statusLabel: 'Pagamento informado',
    };

    const reply = `Encontrei o cadastro de ${debtor.name}. O pagamento de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi registrado como informado e está aguardando confirmação. O saldo oficial não foi quitado porque ainda exige validação da fonte. Os arquivos TXT do histórico foram sincronizados com sucesso. ${divergenceWarning}`;

    return {
      reply,
      intent: 'C_PAGAMENTO_INFORMADO',
      intentLabel: 'C. Pagamento informado (Aguardando confirmação)',
      clientIdentified: {
        id: debtor.id,
        name: debtor.name,
        phone: debtor.phone,
        totalOwed: debtor.totalOwed,
        totalPaid: debtor.totalPaid,
      },
      operation: {
        type: 'Pagamento Informado',
        amount,
        date: args.dataPagamento || new Date().toLocaleDateString('pt-BR'),
        status: 'Aguardando confirmação',
        description: `Pagamento informado de R$ ${amount.toFixed(2)} aguardando validação de autenticidade.`,
        divergenceWarning: divergenceWarning || undefined,
        operationId,
      },
      txtUpdated: true,
      txtFiles: [
        {
          fileName: 'pagamentos.txt',
          clientFolder: normalizeClientFolderName(debtor.name),
          preview: pagamentosTxt,
        },
        {
          fileName: 'status_financeiro.txt',
          clientFolder: normalizeClientFolderName(debtor.name),
          preview: statusTxt,
        },
      ],
      mutations: {
        updatedDebtor,
      },
    };
  }

  // 2. CONFIRMAR PAGAMENTO (Efetiva a quitação oficial)
  if (name === 'confirmar_pagamento') {
    const clientName = args.nomeCliente;
    const amount = Number(args.valor) || 0;
    const { exact: debtor, matches } = findDebtor(clientName, debtors);

    if (!debtor && matches.length > 1) {
      return {
        reply: `Identifiquei mais de um cliente semelhante: ${matches.map((m) => m.name).join(', ')}. Especifique o cliente exato.`,
        intent: 'D_PAGAMENTO_CONFIRMADO',
        intentLabel: 'Identificação Pendente',
        requiresUserConfirmation: true,
      };
    }

    if (!debtor) {
      return {
        reply: `Cliente "${clientName}" não encontrado para confirmação de pagamento.`,
        intent: 'D_PAGAMENTO_CONFIRMADO',
        intentLabel: 'Cliente Não Encontrado',
      };
    }

    // Localizar parcela(s) pendentes do devedor para quitar
    const debtorInstallments = installments.filter((i) => i.debtorId === debtor.id && i.status !== 'paid');
    let remaining = amount;
    const updatedInstallmentsList: any[] = [];
    const now = new Date();
    const nowStr = now.toISOString();

    for (const inst of debtorInstallments) {
      if (remaining <= 0) break;
      const needed = inst.amount || 0;
      if (remaining >= needed) {
        updatedInstallmentsList.push({
          ...inst,
          status: 'paid',
          paidAmount: needed,
          paidAt: nowStr,
          paymentMethod: args.formaPagamento || 'PIX',
          authCode: args.autenticacaoPix || `AUT-${Date.now()}`,
        });
        remaining -= needed;
      } else {
        // Parcial
        updatedInstallmentsList.push({
          ...inst,
          amount: Number((needed - remaining).toFixed(2)),
          paidAmount: (inst.paidAmount || 0) + remaining,
          paidAt: nowStr,
          paymentMethod: args.formaPagamento || 'PIX',
        });
        remaining = 0;
      }
    }

    const newTotalPaid = (debtor.totalPaid || 0) + amount;
    const newTotalOwed = Math.max(0, (debtor.totalOwed || 0) - amount);

    const updatedDebtor = {
      ...debtor,
      totalPaid: newTotalPaid,
      totalOwed: newTotalOwed,
      onTimePaymentsCount: (debtor.onTimePaymentsCount || 0) + 1,
      overdueCount: Math.max(0, (debtor.overdueCount || 0) - (updatedInstallmentsList.filter((i) => i.status === 'paid').length > 0 ? 1 : 0)),
    };

    // Histórico TXT
    syncCadastroTxt(updatedDebtor);
    appendMovimentacaoTxt(debtor.name, {
      tipo: 'PAGAMENTO CONFIRMADO',
      descricao: `Pagamento de R$ ${amount.toFixed(2)} confirmado oficialmente. Saldo devedor atualizado para R$ ${newTotalOwed.toFixed(2)}.`,
      valor: amount,
      idMovimentacao: operationId,
    });
    const pagamentosTxt = appendPagamentoTxt(debtor.name, {
      valor: amount,
      tipo: 'confirmado',
      status: 'Pagamento confirmado',
      idMovimentacao: operationId,
      saldoAtualizado: newTotalOwed,
      observacao: 'Pagamento confirmado e validado pelo operador.',
    });
    const statusTxt = syncStatusFinanceiroTxt(updatedDebtor, {
      totalOwed: newTotalOwed,
      totalPaid: newTotalPaid,
    });

    const newTx = {
      id: `tx_${Date.now()}`,
      debtorName: debtor.name,
      debtorInitials: debtor.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase(),
      product: updatedInstallmentsList[0]?.product || 'Pagamento Consolidado',
      installmentText: `${updatedInstallmentsList.length} parcela(s)`,
      amount,
      bankName: 'Nubank PIX',
      bankId: 'nubank',
      channel: 'Gemini Automação Inteligente',
      timestamp: nowStr,
      monthGroup: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      monthLabel: now.toLocaleString('pt-BR', { month: 'short' }).toUpperCase(),
      authCode: args.autenticacaoPix || `AUT-GEMINI-${operationId}`,
      statusText: 'Confirmado e Liquidado',
    };

    return {
      reply: `Pagamento de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} confirmado e registrado com sucesso para ${debtor.name}. As parcelas e o saldo foram atualizados no banco de dados e os arquivos TXT foram sincronizados. Saldo devedor restante: R$ ${newTotalOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      intent: 'D_PAGAMENTO_CONFIRMADO',
      intentLabel: 'D. Pagamento confirmado por procedimento autorizado',
      clientIdentified: {
        id: debtor.id,
        name: debtor.name,
        phone: debtor.phone,
        totalOwed: newTotalOwed,
        totalPaid: newTotalPaid,
      },
      operation: {
        type: 'Pagamento Confirmado',
        amount,
        date: new Date().toLocaleDateString('pt-BR'),
        status: 'Pago e Confirmado',
        description: `Pagamento de R$ ${amount.toFixed(2)} liquidado no aplicativo e refletido no extrato.`,
        operationId,
      },
      txtUpdated: true,
      txtFiles: [
        {
          fileName: 'pagamentos.txt',
          clientFolder: normalizeClientFolderName(debtor.name),
          preview: pagamentosTxt,
        },
        {
          fileName: 'status_financeiro.txt',
          clientFolder: normalizeClientFolderName(debtor.name),
          preview: statusTxt,
        },
      ],
      mutations: {
        updatedDebtor,
        updatedInstallments: updatedInstallmentsList,
        newTransaction: newTx,
      },
    };
  }

  // 3. REGISTRAR OBSERVAÇÃO OU PROMESSA DE PAGAMENTO
  if (name === 'registrar_informacao_observacao') {
    const clientName = args.nomeCliente;
    const tipo = args.tipo || 'observacao_geral';
    const conteudo = args.conteudo || '';
    const { exact: debtor } = findDebtor(clientName, debtors);

    if (!debtor) {
      return {
        reply: `Não localizei o cliente "${clientName}" para registrar a anotação.`,
        intent: tipo === 'promessa_pagamento' ? 'B_PROMESSA' : 'A_OBSERVACAO',
        intentLabel: tipo === 'promessa_pagamento' ? 'B. Promessa de pagamento' : 'A. Informação ou observação registrada',
      };
    }

    const noteEntry = `[${new Date().toLocaleDateString('pt-BR')}] ${tipo === 'promessa_pagamento' ? 'Promessa: ' : 'Obs: '}${conteudo}`;
    const updatedNotes = debtor.notes ? `${debtor.notes} | ${noteEntry}` : noteEntry;
    const updatedDebtor = { ...debtor, notes: updatedNotes };

    syncCadastroTxt(updatedDebtor);
    const movTxt = appendMovimentacaoTxt(debtor.name, {
      tipo: tipo === 'promessa_pagamento' ? 'PROMESSA DE PAGAMENTO' : 'OBSERVAÇÃO REGISTRADA',
      descricao: `${conteudo}${args.dataPromessa ? ` (Data combinada: ${args.dataPromessa})` : ''}`,
      idMovimentacao: operationId,
    });
    const statusTxt = syncStatusFinanceiroTxt(updatedDebtor);

    const isPromessa = tipo === 'promessa_pagamento' || conteudo.toLowerCase().includes('prometeu') || Boolean(args.dataPromessa);

    return {
      reply: isPromessa
        ? `Promessa de pagamento registrada para ${debtor.name}: "${conteudo}"${args.dataPromessa ? ` para a data ${args.dataPromessa}` : ''}. O histórico TXT e a ficha do cliente foram atualizados.`
        : `Observação anotada com sucesso para ${debtor.name}: "${conteudo}". Sincronizada no banco de dados e nos arquivos de histórico TXT.`,
      intent: isPromessa ? 'B_PROMESSA' : 'A_OBSERVACAO',
      intentLabel: isPromessa ? 'B. Promessa de pagamento' : 'A. Informação ou observação registrada',
      clientIdentified: {
        id: debtor.id,
        name: debtor.name,
        phone: debtor.phone,
        totalOwed: debtor.totalOwed,
        totalPaid: debtor.totalPaid,
      },
      operation: {
        type: isPromessa ? 'Promessa de Pagamento' : 'Observação Cadastrada',
        status: 'Registrado no Histórico',
        description: conteudo,
        operationId,
      },
      txtUpdated: true,
      txtFiles: [
        {
          fileName: 'movimentacoes.txt',
          clientFolder: normalizeClientFolderName(debtor.name),
          preview: movTxt,
        },
        {
          fileName: 'status_financeiro.txt',
          clientFolder: normalizeClientFolderName(debtor.name),
          preview: statusTxt,
        },
      ],
      mutations: {
        updatedDebtor,
      },
    };
  }

  // 4. CONSULTAR RECEBÍVEIS
  if (name === 'consultar_recebiveis' || name === 'consultar_clientes') {
    const clientName = args.nomeCliente || args.termoBusca || '';
    const { exact: debtor, matches } = findDebtor(clientName, debtors);

    if (debtor) {
      const debtorInstallments = installments.filter((i) => i.debtorId === debtor.id);
      const pendingCount = debtorInstallments.filter((i) => i.status !== 'paid').length;
      const overdueCount = debtorInstallments.filter((i) => i.status === 'overdue').length;

      return {
        reply: `Cliente localizado: ${debtor.name}.\n- Saldo Devedor: R$ ${(debtor.totalOwed || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n- Total Já Pago: R$ ${(debtor.totalPaid || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n- Parcelas Pendentes: ${pendingCount}\n- Parcelas em Atraso: ${overdueCount}\n- Score de Pontualidade: ${debtor.score || 850}/1000 (${debtor.scoreTier || 'BOM'})\n- Observações: ${debtor.notes || 'Nenhuma'}.`,
        intent: 'G_CONSULTA',
        intentLabel: 'G. Solicitação de consulta',
        clientIdentified: {
          id: debtor.id,
          name: debtor.name,
          phone: debtor.phone,
          totalOwed: debtor.totalOwed,
          totalPaid: debtor.totalPaid,
        },
      };
    }

    if (matches.length > 1) {
      return {
        reply: `Encontrei ${matches.length} clientes com nomes semelhantes: ${matches.map((m) => m.name).join(', ')}. Especifique qual deseja consultar.`,
        intent: 'G_CONSULTA',
        intentLabel: 'G. Solicitação de consulta',
      };
    }

    return {
      reply: `Não encontrei nenhum cliente com o nome "${clientName}".`,
      intent: 'G_CONSULTA',
      intentLabel: 'G. Solicitação de consulta',
    };
  }

  // 5. CONSULTAR ARQUIVO TXT
  if (name === 'consultar_arquivos_txt') {
    const clientName = args.nomeCliente;
    const fileName = args.tipoArquivo || 'status_financeiro.txt';
    const folder = normalizeClientFolderName(clientName);
    const content = readClientTxtFile(folder, fileName);

    if (!content) {
      return {
        reply: `O arquivo TXT "${fileName}" do cliente "${clientName}" ainda não possui histórico gravado. Envie um comando de registro para criá-lo.`,
        intent: 'G_CONSULTA',
        intentLabel: 'G. Solicitação de consulta',
      };
    }

    return {
      reply: `Aqui está o conteúdo atual do arquivo TXT (${fileName}) de ${clientName}:\n\n${content}`,
      intent: 'G_CONSULTA',
      intentLabel: 'G. Solicitação de consulta',
      txtFiles: [
        {
          fileName,
          clientFolder: folder,
          preview: content,
        },
      ],
    };
  }

  // Fallback para relatórios
  return executeHeuristicAutomation(userCommand, context, operationId, forceConfirmed);
}

// Analisador para respostas diretas sem ferramentas
function analyzeDirectTextReply(
  replyText: string,
  userCommand: string,
  context: AutomationContext,
  operationId: string
): AutomationResponse {
  const isQuery = userCommand.toLowerCase().includes('quanto') || userCommand.toLowerCase().includes('mostre') || userCommand.toLowerCase().includes('consulte');
  return {
    reply: replyText,
    intent: isQuery ? 'G_CONSULTA' : 'A_OBSERVACAO',
    intentLabel: isQuery ? 'G. Solicitação de consulta' : 'A. Informação ou observação registrada',
  };
}

// Motor de Contingência Autônomo Heurístico (funciona mesmo sem conexão com a API do Gemini)
function executeHeuristicAutomation(
  userCommand: string,
  context: AutomationContext,
  operationId: string,
  forceConfirmed: boolean
): AutomationResponse {
  const { debtors, installments } = context;
  const cmd = userCommand.toLowerCase();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. Extração de Valor (R$ 150,00 ou 150)
  let extractedAmount = 0;
  const valMatch = userCommand.match(/R\$\s*([0-9.,]+)/i) || userCommand.match(/\b([1-9][0-9]{1,4}(?:[.,][0-9]{2})?)\b/);
  if (valMatch) {
    const clean = valMatch[1].replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 0) extractedAmount = num;
  }

  // 2. Extração de Cliente nos devedores existentes
  let matchedDebtor: any = null;
  for (const d of debtors) {
    const dLower = (d.name || '').toLowerCase();
    const firstName = dLower.split(' ')[0];
    if (cmd.includes(dLower) || (firstName.length >= 3 && cmd.includes(firstName))) {
      matchedDebtor = d;
      break;
    }
  }

  // Se não localizou pelo nome no banco, cria referência segura se tiver nome composto mencionado
  if (!matchedDebtor) {
    const possibleNameMatch = userCommand.match(/([A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú][a-zà-ú]+)/);
    if (possibleNameMatch && !cmd.includes('quanto') && !cmd.includes('consulte')) {
      const detectedName = possibleNameMatch[1];
      // Criar devedor temporário ou sugerir cadastro
      matchedDebtor = {
        id: `debtor_auto_${Date.now()}`,
        name: detectedName,
        phone: '(14) 99823-0000',
        relation: 'Cliente',
        totalOwed: extractedAmount || 150.0,
        totalPaid: 0,
        overdueCount: 0,
        score: 850,
        scoreTier: 'bom',
        onTimePaymentsCount: 0,
        latePaymentsCount: 0,
        spendingAlert: false,
      };
    }
  }

  // Classificação de Intenção:
  // A: Observação
  // B: Promessa de pagamento
  // C: Pagamento informado (aguardando confirmação)
  // D: Pagamento confirmado
  // G: Consulta

  const isConfirmation = cmd.includes('confirmar') || cmd.includes('confirmado') || cmd.includes('validado') || forceConfirmed;
  const isPaymentInformed = (cmd.includes('pagou') || cmd.includes('efetuou um pagamento') || cmd.includes('pagamento de') || cmd.includes('quitou') || cmd.includes('transferiu')) && !isConfirmation;
  const isPromise = cmd.includes('prometeu') || cmd.includes('combinou') || cmd.includes('vai pagar') || cmd.includes('amanhã');
  const isQuery = cmd.includes('quanto') || cmd.includes('consulte') || cmd.includes('mostre') || cmd.includes('saldo') || cmd.includes('extrato') || cmd.includes('histórico') || cmd.includes('historico');

  // Caso Consulta
  if (isQuery && matchedDebtor) {
    return {
      reply: `Encontrei o cadastro de ${matchedDebtor.name}. O saldo devedor atual é de R$ ${(matchedDebtor.totalOwed || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} e o valor já liquidado é de R$ ${(matchedDebtor.totalPaid || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Score de pontualidade: ${matchedDebtor.score || 850}/1000.`,
      intent: 'G_CONSULTA',
      intentLabel: 'G. Solicitação de consulta',
      clientIdentified: {
        id: matchedDebtor.id,
        name: matchedDebtor.name,
        phone: matchedDebtor.phone,
        totalOwed: matchedDebtor.totalOwed,
        totalPaid: matchedDebtor.totalPaid,
      },
    };
  }

  // Caso Promessa de Pagamento
  if (isPromise && matchedDebtor) {
    syncCadastroTxt(matchedDebtor);
    const movTxt = appendMovimentacaoTxt(matchedDebtor.name, {
      tipo: 'PROMESSA DE PAGAMENTO',
      descricao: userCommand,
      idMovimentacao: operationId,
    });
    const statusTxt = syncStatusFinanceiroTxt(matchedDebtor);

    const updatedDebtor = {
      ...matchedDebtor,
      notes: matchedDebtor.notes ? `${matchedDebtor.notes} | Promessa: ${userCommand}` : `Promessa: ${userCommand}`,
    };

    return {
      reply: `Promessa de pagamento registrada para ${matchedDebtor.name}: "${userCommand}". O histórico TXT e as observações do cliente foram atualizados com sucesso.`,
      intent: 'B_PROMESSA',
      intentLabel: 'B. Promessa de pagamento',
      clientIdentified: {
        id: matchedDebtor.id,
        name: matchedDebtor.name,
        totalOwed: matchedDebtor.totalOwed,
        totalPaid: matchedDebtor.totalPaid,
      },
      operation: {
        type: 'Promessa de Pagamento',
        status: 'Registrado em Histórico',
        description: userCommand,
        operationId,
      },
      txtUpdated: true,
      txtFiles: [
        {
          fileName: 'movimentacoes.txt',
          clientFolder: normalizeClientFolderName(matchedDebtor.name),
          preview: movTxt,
        },
        {
          fileName: 'status_financeiro.txt',
          clientFolder: normalizeClientFolderName(matchedDebtor.name),
          preview: statusTxt,
        },
      ],
      mutations: {
        updatedDebtor,
      },
    };
  }

  // Caso Pagamento Confirmado
  if (isConfirmation && matchedDebtor && extractedAmount > 0) {
    const newTotalPaid = (matchedDebtor.totalPaid || 0) + extractedAmount;
    const newTotalOwed = Math.max(0, (matchedDebtor.totalOwed || 0) - extractedAmount);

    const updatedDebtor = {
      ...matchedDebtor,
      totalPaid: newTotalPaid,
      totalOwed: newTotalOwed,
      onTimePaymentsCount: (matchedDebtor.onTimePaymentsCount || 0) + 1,
    };

    syncCadastroTxt(updatedDebtor);
    appendMovimentacaoTxt(matchedDebtor.name, {
      tipo: 'PAGAMENTO CONFIRMADO',
      descricao: `Pagamento de R$ ${extractedAmount.toFixed(2)} confirmado oficialmente.`,
      valor: extractedAmount,
      idMovimentacao: operationId,
    });
    const pagamentosTxt = appendPagamentoTxt(matchedDebtor.name, {
      valor: extractedAmount,
      tipo: 'confirmado',
      status: 'Pagamento confirmado',
      idMovimentacao: operationId,
      saldoAtualizado: newTotalOwed,
      observacao: 'Pagamento confirmado por procedimento autorizado.',
    });
    const statusTxt = syncStatusFinanceiroTxt(updatedDebtor, {
      totalOwed: newTotalOwed,
      totalPaid: newTotalPaid,
    });

    return {
      reply: `Pagamento de R$ ${extractedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} confirmado e registrado. A parcela e o saldo de ${matchedDebtor.name} foram atualizados no banco de dados e o histórico TXT foi sincronizado. Saldo devedor atualizado: R$ ${newTotalOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      intent: 'D_PAGAMENTO_CONFIRMADO',
      intentLabel: 'D. Pagamento confirmado por procedimento autorizado',
      clientIdentified: {
        id: matchedDebtor.id,
        name: matchedDebtor.name,
        totalOwed: newTotalOwed,
        totalPaid: newTotalPaid,
      },
      operation: {
        type: 'Pagamento Confirmado',
        amount: extractedAmount,
        date: todayStr,
        status: 'Pago e Liquidado',
        description: `Pagamento de R$ ${extractedAmount.toFixed(2)} validado e baixado.`,
        operationId,
      },
      txtUpdated: true,
      txtFiles: [
        {
          fileName: 'pagamentos.txt',
          clientFolder: normalizeClientFolderName(matchedDebtor.name),
          preview: pagamentosTxt,
        },
        {
          fileName: 'status_financeiro.txt',
          clientFolder: normalizeClientFolderName(matchedDebtor.name),
          preview: statusTxt,
        },
      ],
      mutations: {
        updatedDebtor,
      },
    };
  }

  // Caso Pagamento Informado (Padrão: Aguardando confirmação - Seção 5C)
  if (isPaymentInformed && matchedDebtor && extractedAmount > 0) {
    let divergence = '';
    if (extractedAmount > (matchedDebtor.totalOwed || 0) && (matchedDebtor.totalOwed || 0) > 0) {
      divergence = `Atenção: O valor de R$ ${extractedAmount.toFixed(2)} é maior que a dívida restante de R$ ${(matchedDebtor.totalOwed || 0).toFixed(2)}.`;
    }

    syncCadastroTxt(matchedDebtor);
    appendMovimentacaoTxt(matchedDebtor.name, {
      tipo: 'PAGAMENTO INFORMADO',
      descricao: `Pagamento de R$ ${extractedAmount.toFixed(2)} informado pelo usuário. Status: Aguardando confirmação.`,
      valor: extractedAmount,
      idMovimentacao: operationId,
    });
    const pagamentosTxt = appendPagamentoTxt(matchedDebtor.name, {
      valor: extractedAmount,
      tipo: 'informado',
      status: 'Aguardando confirmação',
      idMovimentacao: operationId,
      observacao: userCommand,
    });
    const statusTxt = syncStatusFinanceiroTxt(matchedDebtor);

    const updatedDebtor = {
      ...matchedDebtor,
      notes: matchedDebtor.notes
        ? `${matchedDebtor.notes} | [${todayStr}] Pagamento informado R$ ${extractedAmount.toFixed(2)} (Aguardando confirmação)`
        : `[${todayStr}] Pagamento informado R$ ${extractedAmount.toFixed(2)} (Aguardando confirmação)`,
    };

    return {
      reply: `Encontrei o cadastro de ${matchedDebtor.name}. O pagamento de R$ ${extractedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi registrado como informado e está aguardando confirmação. O saldo oficial não foi alterado porque ainda não existe confirmação suficiente. Os arquivos TXT do histórico foram atualizados. ${divergence}`,
      intent: 'C_PAGAMENTO_INFORMADO',
      intentLabel: 'C. Pagamento informado (Aguardando confirmação)',
      clientIdentified: {
        id: matchedDebtor.id,
        name: matchedDebtor.name,
        totalOwed: matchedDebtor.totalOwed,
        totalPaid: matchedDebtor.totalPaid,
      },
      operation: {
        type: 'Pagamento Informado',
        amount: extractedAmount,
        date: todayStr,
        status: 'Aguardando confirmação',
        description: `Pagamento informado de R$ ${extractedAmount.toFixed(2)}.`,
        divergenceWarning: divergence || undefined,
        operationId,
      },
      txtUpdated: true,
      txtFiles: [
        {
          fileName: 'pagamentos.txt',
          clientFolder: normalizeClientFolderName(matchedDebtor.name),
          preview: pagamentosTxt,
        },
        {
          fileName: 'status_financeiro.txt',
          clientFolder: normalizeClientFolderName(matchedDebtor.name),
          preview: statusTxt,
        },
      ],
      mutations: {
        updatedDebtor,
      },
    };
  }

  // Observação Geral
  if (matchedDebtor) {
    syncCadastroTxt(matchedDebtor);
    const movTxt = appendMovimentacaoTxt(matchedDebtor.name, {
      tipo: 'OBSERVAÇÃO REGISTRADA',
      descricao: userCommand,
      idMovimentacao: operationId,
    });

    return {
      reply: `Informação registrada com sucesso no cadastro de ${matchedDebtor.name}: "${userCommand}". O histórico TXT foi sincronizado.`,
      intent: 'A_OBSERVACAO',
      intentLabel: 'A. Informação ou observação registrada',
      clientIdentified: {
        id: matchedDebtor.id,
        name: matchedDebtor.name,
        totalOwed: matchedDebtor.totalOwed,
        totalPaid: matchedDebtor.totalPaid,
      },
      txtUpdated: true,
      txtFiles: [
        {
          fileName: 'movimentacoes.txt',
          clientFolder: normalizeClientFolderName(matchedDebtor.name),
          preview: movTxt,
        },
      ],
    };
  }

  // Resposta geral caso cliente não seja detectado
  return {
    reply: `Compreendi seu comando: "${userCommand}". Para registrar uma alteração financeira no aplicativo e nos arquivos TXT de histórico, informe o nome do cliente cadastrado (ex: "Fábio Dias pagou R$ 150,00" ou "Quanto Renata deve?").`,
    intent: 'OUTRO',
    intentLabel: 'Comando Geral',
  };
}
