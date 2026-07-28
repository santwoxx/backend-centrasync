/**
 * Motor Tributário / Calculadora Fiscal Completa e Totalmente Configurável
 * Suporte a ICMS por Estado (Entrada e Saída), Despesas Detalhadas e Overrides Avançados
 */

// Alíquotas internas padrão de ICMS por Estado (UF)
const ALIQUOTAS_ICMS_ESTADOS_PADRAO = {
  AC: 0.19,
  AL: 0.19,
  AM: 0.20,
  AP: 0.18,
  BA: 0.205,
  CE: 0.20,
  DF: 0.20,
  ES: 0.17,
  GO: 0.19,
  MA: 0.22,
  MG: 0.18,
  MS: 0.17,
  MT: 0.17,
  PA: 0.19,
  PB: 0.20,
  PE: 0.205,
  PI: 0.21,
  PR: 0.195,
  RJ: 0.20,
  RN: 0.20,
  RO: 0.175,
  RR: 0.20,
  RS: 0.17,
  SC: 0.17,
  SE: 0.19,
  SP: 0.18,
  TO: 0.20
};

/**
 * Retorna a alíquota interestadual padrão de ICMS entre dois estados
 */
function obterAliquotaInterestadual(ufOrigem, ufDestino, ehImportado = false) {
  if (ehImportado) return 0.04;
  if (!ufOrigem || !ufDestino || ufOrigem === ufDestino) {
    return ALIQUOTAS_ICMS_ESTADOS_PADRAO[ufOrigem] || 0.18;
  }
  const sulSudesteSemES = ['SP', 'RJ', 'MG', 'PR', 'RS', 'SC'];
  if (sulSudesteSemES.includes(ufOrigem.toUpperCase()) && !sulSudesteSemES.includes(ufDestino.toUpperCase())) {
    return 0.07;
  }
  return 0.12;
}

/**
 * Retorna a alíquota interna de ICMS de um estado (permite customTabela)
 */
function obterAliquotaInterna(uf, tabelaCustom = null) {
  if (!uf) return 0.18;
  const tabela = tabelaCustom || ALIQUOTAS_ICMS_ESTADOS_PADRAO;
  return tabela[uf.toUpperCase()] !== undefined ? tabela[uf.toUpperCase()] : 0.18;
}

/**
 * Calcula precificação e apuração tributária (Entrada x Saída)
 * @param {Object} input - Parâmetros totalmente configuráveis
 */
function calcularPrecificacao(input) {
  const {
    produto = 'Produto Sem Nome',
    atividade = 'Comercio', // Comercio ou Servico
    regimeTributario = 'Simples Nacional', // Simples Nacional, Lucro Presumido, Lucro Real, Customizado
    ufOrigem = 'SP',
    ufDestino = 'BA',
    ehImportado = false,
    
    // Tabela de ICMS por Estado personalizada (opcional)
    tabelaIcmsCustom = null,

    // Entrada (Compra)
    custoCompra = 0,
    ipiPct = 0,
    ipi = 0,
    frete = 0,
    desconto = 0,
    outrasDespesasEntrada = 0,
    
    aliquotaIcmsEntradaOverride = null, // Alíquota de entrada personalizada
    creditoIcmsEntradaOverride = null, // Valor direto de crédito de entrada
    antecipacaoParcialManual = null, // Valor manual de antecipação parcial/DIFAL
    
    // Saída (Venda)
    aliquotaSaidaOverride = null, // Alíquota de ICMS ou DAS personalizada
    aliquotaPisSaidaPct = 0, // PIS adicional se Lucro Presumido/Real
    aliquotaCofinsSaidaPct = 0, // COFINS adicional se Lucro Presumido/Real
    aliquotaOutrosImpostosPct = 0, // Outros impostos (ex: ISS, IRPJ/CSLL)

    // Detalhamento de Despesas Variáveis (%)
    comissaoVendaPct = 0,
    taxaCartaoPct = 0,
    taxaMarketplacePct = 0,
    outrasDespesasVariaveisPct = 0,
    despesasVariaveisPct = 8, // fallback geral em % se itens individuais forem 0

    margemLucroDesejadaPct = 18 // Em %
  } = input;

  const custoBase = Number(custoCompra) || 0;
  const freteValor = Number(frete) || 0;
  const descontoValor = Number(desconto) || 0;
  const outrasDespesasEntradaValor = Number(outrasDespesasEntrada) || 0;
  
  // 1. IPI
  const valorIpi = ipi ? Number(ipi) : custoBase * (Number(ipiPct) / 100);

  // 2. Alíquotas de ICMS de Entrada
  const aliquotaInternaDestino = obterAliquotaInterna(ufDestino, tabelaIcmsCustom);
  const aliquotaInterestadual = obterAliquotaInterestadual(ufOrigem, ufDestino, ehImportado);
  
  let aliquotaEntradaEfetiva = 0;
  if (aliquotaIcmsEntradaOverride !== null && aliquotaIcmsEntradaOverride !== '' && !isNaN(aliquotaIcmsEntradaOverride)) {
    aliquotaEntradaEfetiva = Number(aliquotaIcmsEntradaOverride) / 100;
  } else {
    aliquotaEntradaEfetiva = (ufOrigem === ufDestino ? aliquotaInternaDestino : aliquotaInterestadual);
  }

  // Crédito de ICMS de Entrada (R$)
  const baseCalculoEntrada = custoBase + freteValor + valorIpi + outrasDespesasEntradaValor - descontoValor;
  
  let creditoIcmsEntrada = 0;
  if (creditoIcmsEntradaOverride !== null && creditoIcmsEntradaOverride !== '' && !isNaN(creditoIcmsEntradaOverride)) {
    creditoIcmsEntrada = Number(creditoIcmsEntradaOverride);
  } else {
    creditoIcmsEntrada = baseCalculoEntrada * aliquotaEntradaEfetiva;
  }

  // Antecipação Parcial / DIFAL de Entrada (R$)
  let aliquotaAntecipacao = 0;
  let antecipacaoParcial = 0;

  if (antecipacaoParcialManual !== null && antecipacaoParcialManual !== '' && !isNaN(antecipacaoParcialManual)) {
    antecipacaoParcial = Number(antecipacaoParcialManual);
  } else if (ufOrigem !== ufDestino && aliquotaInternaDestino > aliquotaEntradaEfetiva) {
    aliquotaAntecipacao = aliquotaInternaDestino - aliquotaEntradaEfetiva;
    antecipacaoParcial = baseCalculoEntrada * aliquotaAntecipacao;
  }

  // 3. Formação do Custo Líquido Real
  const custoLiquido = custoBase + freteValor + valorIpi + outrasDespesasEntradaValor - descontoValor - creditoIcmsEntrada + antecipacaoParcial;

  // 4. Parâmetros de Saída
  // Soma das despesas variáveis especificadas ou fallback do total
  const somaDespesasDetalhadas = Number(comissaoVendaPct) + Number(taxaCartaoPct) + Number(taxaMarketplacePct) + Number(outrasDespesasVariaveisPct);
  const despesasVariaveisFinalPct = somaDespesasDetalhadas > 0 ? somaDespesasDetalhadas : Number(despesasVariaveisPct);
  const despesasVariaveis = despesasVariaveisFinalPct / 100;

  const margemLucroDesejada = Number(margemLucroDesejadaPct) / 100;

  // Carga Tributária de Saída (T)
  let cargaTributariaSaida = 0;
  if (aliquotaSaidaOverride !== null && aliquotaSaidaOverride !== '' && !isNaN(aliquotaSaidaOverride)) {
    cargaTributariaSaida = Number(aliquotaSaidaOverride) / 100;
  } else {
    if (regimeTributario === 'Simples Nacional') {
      cargaTributariaSaida = atividade === 'Servico' ? 0.15 : 0.085;
    } else {
      const aliquotaIcmsVenda = obterAliquotaInterna(ufDestino, tabelaIcmsCustom);
      const pis = Number(aliquotaPisSaidaPct) / 100 || 0.0065;
      const cofins = Number(aliquotaCofinsSaidaPct) / 100 || 0.03;
      const outros = Number(aliquotaOutrosImpostosPct) / 100 || 0;
      cargaTributariaSaida = aliquotaIcmsVenda + pis + cofins + outros;
    }
  }

  // 5. Preço de Venda (Markup Divisor / Gross Up)
  const denominador = 1 - (despesasVariaveis + margemLucroDesejada + cargaTributariaSaida);

  let precoVenda = 0;
  if (denominador > 0) {
    precoVenda = custoLiquido / denominador;
  } else {
    precoVenda = custoLiquido * 2;
  }

  // 6. Valores Monetários Finais (R$)
  const impostosSaidaValor = precoVenda * cargaTributariaSaida;
  const despesasVariaveisValor = precoVenda * despesasVariaveis;
  const lucroLiquidoValor = precoVenda * margemLucroDesejada;

  const markupSobreCustoBruto = custoBase > 0 ? (precoVenda / custoBase) : 0;
  const markupSobreCustoLiquido = custoLiquido > 0 ? (precoVenda / custoLiquido) : 0;

  // 7. Demonstrativo de Apuração Fiscal (Entrada x Saída)
  const debitoIcmsSaidaEstestimado = precoVenda * (aliquotaSaidaOverride ? Number(aliquotaSaidaOverride)/100 : obterAliquotaInterna(ufDestino, tabelaIcmsCustom));
  const saldoIcmsRecolher = Math.max(0, debitoIcmsSaidaEstestimado - creditoIcmsEntrada);

  return {
    produto,
    atividade,
    regimeTributario,
    ufOrigem,
    ufDestino,
    
    // Entrada detalhada
    entrada: {
      custoCompra: Number(custoBase.toFixed(2)),
      frete: Number(freteValor.toFixed(2)),
      ipi: Number(valorIpi.toFixed(2)),
      outrasDespesasEntrada: Number(outrasDespesasEntradaValor.toFixed(2)),
      desconto: Number(descontoValor.toFixed(2)),
      baseCalculoEntrada: Number(baseCalculoEntrada.toFixed(2)),
      aliquotaEntradaPct: Number((aliquotaEntradaEfetiva * 100).toFixed(2)),
      creditoIcmsEntrada: Number(creditoIcmsEntrada.toFixed(2)),
      aliquotaAntecipacaoPct: Number((aliquotaAntecipacao * 100).toFixed(2)),
      antecipacaoParcial: Number(antecipacaoParcial.toFixed(2)),
      custoLiquido: Number(custoLiquido.toFixed(2))
    },
    
    // Saída detalhada
    saida: {
      comissaoVendaPct: Number(comissaoVendaPct),
      taxaCartaoPct: Number(taxaCartaoPct),
      taxaMarketplacePct: Number(taxaMarketplacePct),
      despesasVariaveisPct: Number(despesasVariaveisFinalPct.toFixed(2)),
      despesasVariaveisValor: Number(despesasVariaveisValor.toFixed(2)),
      margemLucroDesejadaPct: Number((margemLucroDesejada * 100).toFixed(2)),
      cargaTributariaSaidaPct: Number((cargaTributariaSaida * 100).toFixed(2)),
      impostosSaidaValor: Number(impostosSaidaValor.toFixed(2)),
      precoVendaSugerido: Number(precoVenda.toFixed(2)),
      lucroLiquidoValor: Number(lucroLiquidoValor.toFixed(2)),
      markupSobreCustoBruto: Number(markupSobreCustoBruto.toFixed(2)),
      markupSobreCustoLiquido: Number(markupSobreCustoLiquido.toFixed(2)),
      denominador: Number(denominador.toFixed(4))
    },

    // Demonstrativo Fiscal Sintético (para a visão do contador)
    demonstrativoFiscal: {
      creditoEntrada: Number(creditoIcmsEntrada.toFixed(2)),
      antecipacaoParcialRecolhida: Number(antecipacaoParcial.toFixed(2)),
      impostoTotalSaida: Number(impostosSaidaValor.toFixed(2)),
      saldoEstimadoRecolher: Number(saldoIcmsRecolher.toFixed(2)),
      cargaTributariaEfetivaPct: precoVenda > 0 ? Number(((impostosSaidaValor + antecipacaoParcial - creditoIcmsEntrada) / precoVenda * 100).toFixed(2)) : 0
    }
  };
}

module.exports = {
  calcularPrecificacao,
  obterAliquotaInterestadual,
  obterAliquotaInterna,
  ALIQUOTAS_ICMS_ESTADOS_PADRAO
};
