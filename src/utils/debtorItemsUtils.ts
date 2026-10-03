import { Installment, Purchase } from '../types';

export interface DebtorUnitaryItem {
  id: string;
  purchaseId?: string;
  productName: string;
  shortName: string;
  category: string;
  icon: string;
  store: string;
  cardName: string;
  totalInstallments: number;
  paidInstallments: number;
  pendingInstallments: number;
  overdueInstallments: number;
  installmentValue: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  percentPaid: number;
  isPaidOff: boolean;
  nextDueDate: string | null;
  installments: Installment[];
}

/**
 * Retorna o ícone Material Symbols correspondente ao produto/item
 */
export function getProductIcon(productName: string): string {
  const p = (productName || '').toLowerCase();
  if (p.includes('tv') || p.includes('televis') || p.includes('display') || p.includes('monitor')) return 'tv';
  if (p.includes('celular') || p.includes('smartphone') || p.includes('phone') || p.includes('iphone') || p.includes('galaxy') || p.includes('moto') || p.includes('xiaomi')) return 'smartphone';
  if (p.includes('notebook') || p.includes('laptop') || p.includes('macbook') || p.includes('computador') || p.includes('pc') || p.includes('ipad') || p.includes('tablet')) return 'laptop_mac';
  if (p.includes('design gráfico') || p.includes('design grafico') || p.includes('palette')) return 'palette';
  if (p.includes('marketing')) return 'trending_up';
  if (p.includes('estúdio 4k') || p.includes('estudio 4k') || p.includes('4k')) return 'videocam';
  if (p.includes('curso') || p.includes('faculdade') || p.includes('aula') || p.includes('escola') || p.includes('livro')) return 'school';
  if (p.includes('geladeira') || p.includes('refrigerador') || p.includes('freezer')) return 'kitchen';
  if (p.includes('microondas') || p.includes('fogão') || p.includes('fogao') || p.includes('forno')) return 'microwave';
  if (p.includes('ar condicionado') || p.includes('ar-condicionado') || p.includes('ventilador') || p.includes('climatizador')) return 'mode_fan';
  if (p.includes('lavadora') || p.includes('lava e seca') || p.includes('secadora') || p.includes('maquina')) return 'local_laundry_service';
  if (p.includes('fone') || p.includes('headphone') || p.includes('headset') || p.includes('som') || p.includes('jbl') || p.includes('airpods')) return 'headphones';
  if (p.includes('relogio') || p.includes('relógio') || p.includes('smartwatch') || p.includes('watch')) return 'watch';
  if (p.includes('armario') || p.includes('armário') || p.includes('sofa') || p.includes('sofá') || p.includes('cama') || p.includes('movel') || p.includes('móvel') || p.includes('guarda-roupa')) return 'chair';
  if (p.includes('carro') || p.includes('moto') || p.includes('veiculo') || p.includes('pneu')) return 'directions_car';
  return 'devices';
}

/**
 * Retorna o nome curto/unitário do item para exibição sucinta (ex: TV, Celular, Smartphone)
 */
export function getProductShortName(productName: string): string {
  return getSmartProductAbbreviation(productName);
}

/**
 * Abrevia com inteligência nomes de produtos complexos para caber na planilha de forma limpa
 * Ex: "Smart Galaxy S24" -> "S24"
 *     "Smartphone Samsung Galaxy S24 Ultra" -> "S24 Ultra"
 *     "Apple iPhone 15 Pro Max" -> "iPhone 15"
 *     "Smart TV Samsung 55 polegadas" -> "TV 55\""
 *     "Design Gráfico" -> "Design"
 */
export function getSmartProductAbbreviation(productName: string): string {
  if (!productName) return 'Item';
  const p = productName.trim();
  const lower = p.toLowerCase();

  // 1. Linha Samsung Galaxy (S24, S23, Z Flip, Fold, Note, Linha A, etc.)
  // Detectar variantes Ultra, Plus/+, etc.
  const isUltra = lower.includes('ultra');
  const isPlus = lower.includes('plus') || lower.includes('+');

  const galaxySNumberMatch = lower.match(/(?:samsung|galaxy|smart(?:phone)?|celular)?\s*(?:galaxy)?\s*(s\d{1,2})/i);
  if (galaxySNumberMatch && galaxySNumberMatch[1]) {
    const sModel = galaxySNumberMatch[1].toUpperCase();
    if (isUltra) return `${sModel} Ultra`;
    if (isPlus) return `${sModel}+`;
    return sModel;
  }

  const galaxyOtherMatch = lower.match(/(?:galaxy|samsung|smart(?:phone)?)\s*(?:galaxy)?\s*(z\s*flip\s*\d?|z\s*fold\s*\d?|a\d{1,2}|note\s*\d{1,2})/i);
  if (galaxyOtherMatch && galaxyOtherMatch[1]) {
    const model = galaxyOtherMatch[1].toUpperCase().replace(/\s+/g, ' ');
    return model;
  }

  // 2. Linha Apple iPhone
  const iphoneMatch = lower.match(/iphone\s*(\d{1,2}|se|x[sr]?|1[1-6]\s*pro)/i);
  if (iphoneMatch && iphoneMatch[1]) {
    const ipModel = iphoneMatch[1].toUpperCase().replace(/\s+/g, ' ');
    return `iPhone ${ipModel}`;
  }

  // 3. Xiaomi / Redmi / Motorola
  if (lower.includes('redmi') || lower.includes('xiaomi')) {
    const redmiMatch = lower.match(/(?:redmi|note)\s*(\d{1,2})/i);
    if (redmiMatch) return `Redmi ${redmiMatch[1]}`;
    return 'Xiaomi';
  }
  if (lower.includes('motorola') || lower.includes('moto')) {
    const motoMatch = lower.match(/moto\s*(g\d{1,2}|edge|e\d{1,2})/i);
    if (motoMatch) return `Moto ${motoMatch[1].toUpperCase()}`;
    return 'Motorola';
  }

  // 4. Celulares / Smartphones genéricos
  if (lower.includes('celular') || lower.includes('smartphone') || lower.includes('phone')) {
    return 'Smartphone';
  }

  // 5. TV / Smart TV
  if (lower.includes('tv') || lower.includes('televis')) {
    const sizeMatch = lower.match(/(\d{2})\s*(?:polegadas|"|pol)/i);
    if (sizeMatch) return `TV ${sizeMatch[1]}"`;
    return 'Smart TV';
  }

  // 6. Computadores & Notebooks
  if (lower.includes('macbook')) return 'MacBook';
  if (lower.includes('ipad')) return 'iPad';
  if (lower.includes('notebook') || lower.includes('laptop') || lower.includes('computador') || lower.includes('pc')) return 'Notebook';

  // 7. Cursos & Serviços
  if (lower.includes('design gr')) return 'Design';
  if (lower.includes('marketing')) return 'Marketing';
  if (lower.includes('estúdio 4k') || lower.includes('estudio 4k') || lower.includes('4k')) return 'Estúdio 4K';
  if (lower.includes('curso')) return 'Curso';

  // 8. Eletrodomésticos
  if (lower.includes('geladeira') || lower.includes('frost')) return 'Geladeira';
  if (lower.includes('ar condicionado') || lower.includes('ar-condicionado')) return 'Ar-Cond.';
  if (lower.includes('armario') || lower.includes('armário')) return 'Armário';
  if (lower.includes('fone') || lower.includes('airpods') || lower.includes('headphone')) return 'Fone';
  if (lower.includes('relogio') || lower.includes('relógio') || lower.includes('smartwatch') || lower.includes('watch')) return 'Smartwatch';
  
  // Truncate if long
  if (p.length > 12) {
    return p.substring(0, 11) + '…';
  }
  return p || 'Item';
}

/**
 * Constrói a lista de itens unitários de um devedor com todas as métricas detalhadas
 */
export function getDebtorUnitaryItems(
  debtorId: string,
  debtorName: string,
  purchases: Purchase[] = [],
  installments: Installment[] = []
): DebtorUnitaryItem[] {
  const dNameLower = (debtorName || '').toLowerCase().trim();
  
  // 1. Filtrar parcelas deste devedor
  const debtorInsts = installments.filter(
    (i) => i.debtorId === debtorId || (i.debtorName && i.debtorName.toLowerCase().trim() === dNameLower)
  );

  // 2. Filtrar compras deste devedor
  const debtorPurchases = purchases.filter(
    (p) => p.debtorId === debtorId || (p.debtorName && p.debtorName.toLowerCase().trim() === dNameLower)
  );

  // Mapear por chave única (preferência por purchaseId ou nome normalizado do produto)
  const itemMap = new Map<string, {
    purchase?: Purchase;
    installments: Installment[];
    productName: string;
  }>();

  // Registrar compras cadastradas
  for (const pur of debtorPurchases) {
    const key = pur.id || `pur-${pur.product.toLowerCase().trim()}`;
    itemMap.set(key, {
      purchase: pur,
      installments: [],
      productName: pur.product || 'Produto',
    });
  }

  // Associar parcelas
  for (const inst of debtorInsts) {
    let matchedKey: string | null = null;
    
    // Tentar por purchaseId
    if (inst.purchaseId && itemMap.has(inst.purchaseId)) {
      matchedKey = inst.purchaseId;
    } else {
      // Tentar encontrar compra com mesmo nome de produto
      for (const [key, data] of itemMap.entries()) {
        if (data.productName.toLowerCase().trim() === (inst.product || '').toLowerCase().trim()) {
          matchedKey = key;
          break;
        }
      }
    }

    if (matchedKey) {
      itemMap.get(matchedKey)!.installments.push(inst);
    } else {
      // Novo item não listado explicitamente em purchases
      const newKey = inst.purchaseId || `inst-prod-${(inst.product || 'Item').toLowerCase().trim()}`;
      if (!itemMap.has(newKey)) {
        itemMap.set(newKey, {
          installments: [inst],
          productName: inst.product || 'Item Avulso',
        });
      } else {
        itemMap.get(newKey)!.installments.push(inst);
      }
    }
  }

  // 3. Montar objetos de itens unitários
  const result: DebtorUnitaryItem[] = [];

  for (const [key, data] of itemMap.entries()) {
    const insts = [...data.installments].sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
    
    // Ignorar itens sem nenhuma parcela associada a este devedor específico
    if (insts.length === 0) continue;

    const pur = data.purchase;

    const productName = pur?.product || data.productName || 'Item';
    const store = pur?.store || 'Loja Parceira';
    const cardName = pur?.cardName || insts[0]?.cardName || 'Cartão Padrão';
    
    const totalInstsCount = pur?.installmentsTotal || insts[0]?.totalInstallments || (insts.length > 0 ? insts.length : 1);
    
    // Parcelas pagas, pendentes e atrasadas
    const paidInsts = insts.filter((i) => i.status === 'paid');
    const paidCount = pur?.paidCount !== undefined ? Math.max(pur.paidCount, paidInsts.length) : paidInsts.length;
    
    const overdueInsts = insts.filter((i) => i.status === 'overdue');
    const overdueCount = pur?.overdueCount !== undefined ? Math.max(pur.overdueCount, overdueInsts.length) : overdueInsts.length;

    const pendingCount = Math.max(0, totalInstsCount - paidCount);

    const instVal = pur?.installmentValue || (insts.length > 0 ? insts[0].amount : 0);
    const totalAmt = pur?.totalAmount || (instVal * totalInstsCount);
    const paidAmt = instVal * paidCount;
    const remainingAmt = Math.max(0, totalAmt - paidAmt);
    const isPaidOff = remainingAmt <= 0 || paidCount >= totalInstsCount;
    const percentPaid = totalInstsCount > 0 ? (paidCount / totalInstsCount) * 100 : 0;

    // Próximo vencimento do item
    const nextPending = insts.find((i) => i.status !== 'paid');
    const nextDueDate = nextPending?.dueDate || pur?.nextDueDate || null;

    result.push({
      id: key,
      purchaseId: pur?.id || (insts[0]?.purchaseId ?? undefined),
      productName,
      shortName: getProductShortName(productName),
      category: getProductCategory(productName),
      icon: getProductIcon(productName),
      store,
      cardName,
      totalInstallments: totalInstsCount,
      paidInstallments: paidCount,
      pendingInstallments: pendingCount,
      overdueInstallments: overdueCount,
      installmentValue: instVal,
      totalAmount: totalAmt,
      paidAmount: paidAmt,
      remainingAmount: remainingAmt,
      percentPaid,
      isPaidOff,
      nextDueDate,
      installments: insts,
    });
  }

  // Ordenar: primeiro os ativos (com Celular primeiro se houver), depois por saldo a pagar, depois quitados
  result.sort((a, b) => {
    if (a.isPaidOff !== b.isPaidOff) return a.isPaidOff ? 1 : -1;
    const aIsCel = (a.shortName || '').toLowerCase().includes('celular') || (a.productName || '').toLowerCase().includes('galaxy') || (a.productName || '').toLowerCase().includes('smartphone');
    const bIsCel = (b.shortName || '').toLowerCase().includes('celular') || (b.productName || '').toLowerCase().includes('galaxy') || (b.productName || '').toLowerCase().includes('smartphone');
    if (aIsCel && !bIsCel) return -1;
    if (!aIsCel && bIsCel) return 1;
    return b.remainingAmount - a.remainingAmount;
  });

  return result;
}

/**
 * Retorna a categoria padronizada do produto de acordo com o pedido do usuário
 */
export function getProductCategory(productName: string): string {
  const p = (productName || '').toLowerCase();
  if (p.includes('design gráfico') || p.includes('design grafico')) return 'design_grafico';
  if (p.includes('marketing')) return 'marketing';
  if (p.includes('estúdio 4k') || p.includes('estudio 4k') || p.includes('4k')) return 'estudio_4k';
  if (p.includes('tv') || p.includes('televis')) {
    return 'tv_50';
  }
  if (p.includes('celular') || p.includes('smartphone') || p.includes('phone') || p.includes('iphone') || p.includes('galaxy')) {
    return 'smartphone';
  }
  if (p.includes('curso')) return 'curso';
  return 'outro';
}
