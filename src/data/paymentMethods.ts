export interface PaymentMethodCategory {
  category: string;
  icon: string;
  methods: {
    id: string;
    name: string;
    badge?: string;
    type: 'pix' | 'cash' | 'transfer' | 'card' | 'ticket' | 'other';
  }[];
}

export const PAYMENT_METHOD_GROUPS: PaymentMethodCategory[] = [
  {
    category: '⚡ Meios Instantâneos & Dinheiro',
    icon: 'bolt',
    methods: [
      { id: 'pix_instantaneo', name: 'PIX Instantâneo (Chave / QR Code)', badge: 'PIX', type: 'pix' },
      { id: 'pix_copia_cola', name: 'PIX Copia e Cola', badge: 'PIX', type: 'pix' },
      { id: 'dinheiro_especie', name: 'Dinheiro em Espécie (Físico)', badge: 'ESPÉCIE', type: 'cash' },
      { id: 'ted_doc', name: 'Transferência Bancária (TED / DOC)', badge: 'TRANSF.', type: 'transfer' },
      { id: 'saldo_em_conta', name: 'Saldo em Conta Corrente', badge: 'DÉBITO', type: 'transfer' },
      { id: 'boleto_bancario', name: 'Boleto Bancário', badge: 'BOLETO', type: 'ticket' },
    ],
  },
  {
    category: '🟣 Nubank',
    icon: 'credit_card',
    methods: [
      { id: 'nubank_croma', name: 'Nubank Croma', badge: 'BLACK', type: 'card' },
      { id: 'nubank_ultravioleta', name: 'Nubank Ultravioleta Mastercard Black', badge: 'BLACK', type: 'card' },
      { id: 'nubank_gold', name: 'Nubank Gold Mastercard', badge: 'GOLD', type: 'card' },
      { id: 'nubank_platinum', name: 'Nubank Platinum Mastercard', badge: 'PLATINUM', type: 'card' },
      { id: 'nubank_pj', name: 'Nubank PJ / Empresarial', badge: 'PJ', type: 'card' },
    ],
  },
  {
    category: '⚫ C6 Bank',
    icon: 'credit_card',
    methods: [
      { id: 'c6_carbon_black', name: 'C6 Carbon Black Mastercard', badge: 'CARBON', type: 'card' },
      { id: 'c6_standard', name: 'C6 Bank Standard', badge: 'STANDARD', type: 'card' },
      { id: 'c6_platinum', name: 'C6 Bank Platinum', badge: 'PLATINUM', type: 'card' },
      { id: 'c6_empresas', name: 'C6 Empresas Black', badge: 'PJ', type: 'card' },
    ],
  },
  {
    category: '🟠 Banco Inter',
    icon: 'credit_card',
    methods: [
      { id: 'inter_black', name: 'Inter Black Mastercard', badge: 'BLACK', type: 'card' },
      { id: 'inter_win', name: 'Inter Win Black Exclusivo', badge: 'WIN', type: 'card' },
      { id: 'inter_platinum', name: 'Inter Platinum Mastercard', badge: 'PLATINUM', type: 'card' },
      { id: 'inter_gold', name: 'Inter Gold Mastercard', badge: 'GOLD', type: 'card' },
    ],
  },
  {
    category: '🟡 Itaú & Personnalité',
    icon: 'credit_card',
    methods: [
      { id: 'itau_personnalite_infinite', name: 'Itaú Personnalité Visa Infinite', badge: 'INFINITE', type: 'card' },
      { id: 'itau_personnalite_black', name: 'Itaú Personnalité Mastercard Black', badge: 'BLACK', type: 'card' },
      { id: 'itau_the_one', name: 'Itaú Private The One Mastercard Black', badge: 'THE ONE', type: 'card' },
      { id: 'itau_azul_infinite', name: 'Itaú Azul Linhas Aéreas Visa Infinite', badge: 'INFINITE', type: 'card' },
      { id: 'itau_pao_de_acucar', name: 'Itaú Pão de Açúcar Mastercard Black', badge: 'PDA BLACK', type: 'card' },
      { id: 'itau_latam_pass', name: 'Itaú Latam Pass Mastercard Black', badge: 'LATAM', type: 'card' },
      { id: 'itau_uniclass_black', name: 'Itaú Uniclass Mastercard Black', badge: 'UNICLASS', type: 'card' },
      { id: 'itau_click', name: 'Itaú Click Visa / Mastercard', badge: 'CLICK', type: 'card' },
    ],
  },
  {
    category: '🔴 Bradesco & Prime',
    icon: 'credit_card',
    methods: [
      { id: 'bradesco_aeternum', name: 'Bradesco Aeternum Visa Infinite (Metal)', badge: 'AETERNUM', type: 'card' },
      { id: 'bradesco_elo_diners', name: 'Bradesco Elo Diners Club', badge: 'DINERS', type: 'card' },
      { id: 'bradesco_elo_nanquim', name: 'Bradesco Elo Nanquim', badge: 'NANQUIM', type: 'card' },
      { id: 'bradesco_visa_infinite', name: 'Bradesco Visa Infinite Prime', badge: 'INFINITE', type: 'card' },
      { id: 'bradesco_black', name: 'Bradesco Mastercard Black Prime', badge: 'BLACK', type: 'card' },
      { id: 'bradesco_like', name: 'Bradesco Like Visa', badge: 'LIKE', type: 'card' },
    ],
  },
  {
    category: '🟡 Banco do Brasil (BB)',
    icon: 'credit_card',
    methods: [
      { id: 'bb_altus_infinite', name: 'BB Altus Visa Infinite (Metal)', badge: 'ALTUS', type: 'card' },
      { id: 'bb_ourocard_infinite', name: 'BB Ourocard Visa Infinite', badge: 'INFINITE', type: 'card' },
      { id: 'bb_ourocard_diners', name: 'BB Ourocard Elo Nanquim Diners Club', badge: 'DINERS', type: 'card' },
      { id: 'bb_ourocard_black', name: 'BB Ourocard Mastercard Black', badge: 'BLACK', type: 'card' },
      { id: 'bb_ourocard_estilo', name: 'BB Ourocard Estilo Platinum', badge: 'ESTILO', type: 'card' },
    ],
  },
  {
    category: '🔴 Santander',
    icon: 'credit_card',
    methods: [
      { id: 'santander_unlimited_black', name: 'Santander Unlimited Mastercard Black', badge: 'UNLIMITED', type: 'card' },
      { id: 'santander_unlimited_infinite', name: 'Santander Unlimited Visa Infinite', badge: 'UNLIMITED', type: 'card' },
      { id: 'santander_unique_black', name: 'Santander Unique Mastercard Black', badge: 'UNIQUE', type: 'card' },
      { id: 'santander_unique_infinite', name: 'Santander Unique Visa Infinite', badge: 'UNIQUE', type: 'card' },
      { id: 'santander_aadvantage', name: 'Santander AAdvantage Mastercard Black', badge: 'BLACK', type: 'card' },
      { id: 'santander_elite', name: 'Santander Elite Platinum', badge: 'ELITE', type: 'card' },
      { id: 'santander_sx', name: 'Santander SX Visa / Mastercard', badge: 'SX', type: 'card' },
    ],
  },
  {
    category: '🔵 Caixa Econômica Federal',
    icon: 'credit_card',
    methods: [
      { id: 'caixa_elo_diners', name: 'Caixa Elo Diners Club', badge: 'DINERS', type: 'card' },
      { id: 'caixa_visa_infinite', name: 'Caixa Visa Infinite', badge: 'INFINITE', type: 'card' },
      { id: 'caixa_mastercard_black', name: 'Caixa Mastercard Black', badge: 'BLACK', type: 'card' },
      { id: 'caixa_elo_nanquim', name: 'Caixa Elo Nanquim', badge: 'NANQUIM', type: 'card' },
      { id: 'caixa_sim', name: 'Caixa Sim Visa', badge: 'SIM', type: 'card' },
    ],
  },
  {
    category: '🔘 BTG Pactual & XP Investimentos',
    icon: 'credit_card',
    methods: [
      { id: 'btg_ultrablue', name: 'BTG Pactual Ultrablue Mastercard Black', badge: 'ULTRABLUE', type: 'card' },
      { id: 'btg_black_modular', name: 'BTG Pactual Mastercard Black Modular', badge: 'BLACK', type: 'card' },
      { id: 'btg_platinum', name: 'BTG Pactual Platinum', badge: 'PLATINUM', type: 'card' },
      { id: 'xp_infinite', name: 'XP Visa Infinite', badge: 'INFINITE', type: 'card' },
      { id: 'xp_infinite_one', name: 'XP Visa Infinite One', badge: 'ONE', type: 'card' },
    ],
  },
  {
    category: '🏆 Cartões Exclusivos & Alta Renda',
    icon: 'stars',
    methods: [
      { id: 'brb_dux_infinite', name: 'BRB DUX Visa Infinite (Super Exclusivo)', badge: 'DUX', type: 'card' },
      { id: 'brb_dux_eurobike', name: 'BRB DUX Eurobike Visa Infinite', badge: 'DUX EUROBIKE', type: 'card' },
      { id: 'safra_visa_infinite', name: 'Banco Safra Visa Infinite', badge: 'SAFRA', type: 'card' },
      { id: 'porto_bank_infinite', name: 'Porto Bank Visa Infinite', badge: 'PORTO INFINITE', type: 'card' },
      { id: 'porto_bank_black', name: 'Porto Bank Mastercard Black', badge: 'PORTO BLACK', type: 'card' },
    ],
  },
  {
    category: '🌐 Contas Globais, Carteiras & Fintechs',
    icon: 'public',
    methods: [
      { id: 'nomad_global', name: 'Nomad Global Visa Internacional', badge: 'GLOBAL', type: 'card' },
      { id: 'wise_card', name: 'Wise Multimoeda Visa', badge: 'MULTIMOEDA', type: 'card' },
      { id: 'mercado_pago_visa', name: 'Mercado Pago Visa Crédito / Débito', badge: 'MERCADO PAGO', type: 'card' },
      { id: 'picpay_card_black', name: 'PicPay Card Mastercard Black', badge: 'BLACK', type: 'card' },
      { id: 'picpay_card_plat', name: 'PicPay Card Mastercard Platinum', badge: 'PLATINUM', type: 'card' },
      { id: 'pagbank_mastercard', name: 'PagBank Mastercard', badge: 'PAGBANK', type: 'card' },
      { id: 'neon_visa', name: 'Neon Visa Crédito / Débito', badge: 'NEON', type: 'card' },
      { id: 'next_visa', name: 'Next Visa Internacional', badge: 'NEXT', type: 'card' },
      { id: 'recargapay_mastercard', name: 'RecargaPay Mastercard', badge: 'RECARGAPAY', type: 'card' },
      { id: 'will_bank', name: 'Will Bank Mastercard', badge: 'WILL', type: 'card' },
    ],
  },
  {
    category: '🟢 Cooperativas & Regionais',
    icon: 'account_balance',
    methods: [
      { id: 'sicredi_black', name: 'Sicredi Mastercard Black', badge: 'SICREDI', type: 'card' },
      { id: 'sicredi_infinite', name: 'Sicredi Visa Infinite', badge: 'SICREDI', type: 'card' },
      { id: 'sicoob_black', name: 'Sicoobcard Mastercard Black', badge: 'SICOOB', type: 'card' },
      { id: 'sicoob_infinite', name: 'Sicoobcard Visa Infinite', badge: 'SICOOB', type: 'card' },
      { id: 'banrisul_infinite', name: 'Banrisul Visa Infinite', badge: 'BANRISUL', type: 'card' },
      { id: 'banrisul_black', name: 'Banrisul Mastercard Black', badge: 'BANRISUL', type: 'card' },
      { id: 'unicred_infinite', name: 'Unicred Visa Infinite', badge: 'UNICRED', type: 'card' },
    ],
  },
  {
    category: '✏️ Outro Meio Particular',
    icon: 'edit_note',
    methods: [
      { id: 'custom_outro', name: 'Outro Meio de Pagamento / Cartão Particular (Digitar)', badge: 'CUSTOM', type: 'other' },
    ],
  },
];

// Array plano com todos os nomes para busca rápida
export const ALL_PAYMENT_METHODS_FLAT: string[] = PAYMENT_METHOD_GROUPS.flatMap((group) =>
  group.methods.map((m) => m.name)
);
