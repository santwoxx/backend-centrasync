/**
 * Motor Tributário / Calculadora Fiscal Completa
 * Suporte a ICMS por Estado (Entrada e Saída)
 * Regime: Simples Nacional, Lucro Presumido, Lucro Real
 */

// Alíquotas internas padrão de ICMS por Estado (UF)
const ALIQUOTAS_ICMS_ESTADOS = {
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

const CONFIG_PADRAO = {
  regime: 'Simples Nacional',
  ufOrigem: 'SP',
  ufDestino: 'BA',
  despesasVariaveis: 0.08, // 8% (comissao, cartao, marketplace)
  margemLucroDesejada: 0.18, // 18%
};

/**
 * Retorna a alíquota interestadual padrão de ICMS entre dois estados
 */
function obterAliquotaInterestadual(ufOrigem, ufDestino, ehImportado = false) {
  if (ehImportado) return 0.04;
  if (!ufOrigem || !ufDestino || ufOrigem === ufDestino) {
    return ALIQUOTAS_ICMS_ESTADOS[ufOrigem] || 0.18;
  }
  const sulSudesteSemES = ['SP', 'RJ', 'MG', 'PR', 'RS', 'SC'];
  if (sulSudesteSemES.includes(ufOrigem.toUpperCase()) && !sulSudesteSemES.includes(ufDestino.toUpperCase())) {
    return 0.07;
  }
  return 0.12;
}

/**
 * Retorna a alíquota interna de ICMS de um estado
 */
function obterAliquotaInterna(uf) {
  if (!uf) return 0.18;
  return ALIQUOTAS_ICMS_ESTADOS[uf.toUpperCase()] || 0.18;
}

/**
 * Calcula precificação e apuração tributária (Entrada x Saída)
 * @param {Object} input - Parâmetros fornecidos
 */
function calcularPrecificacao(input) {
  const {
    produto = 'Produto Sem Nome',
    atividade = 'Comercio', // Comercio ou Servico
    regimeTributario = 'Simples Nacional', // Simples Nacional, Lucro Presumido, Lucro Real
    ufOrigem = 'SP',
    ufDestino = 'BA',
    ehImportado = false,
    
    // Entrada (Compra)
    custoCompra = 0,
    ipiPct = 0, // % de IPI sobre compra
    ipi = 0, // Valor de IPI direto (opcional)
    frete = 0,
    desconto = 0,
    
    aliquotaIcmsEntradaOverride = null, // Alíquota de entrada personalizada
    antecipacaoParcialManual = null, // Valor manual se não usar cálculo automático
    
    // Saída (Venda)
    aliquotaSaidaOverride = null, // Alíquota efetiva personalizada de saída (ex: % DAS do Simples)
    despesasVariaveisPct = 8, // Em % (ex: 8%)
    margemLucroDesejadaPct = 18 // Em % (ex: 18%)
  } = input;

  const custoBase = Number(custoCompra) || 0;
  const freteValor = Number(frete) || 0;
  const descontoValor = Number(desconto) || 0;
  
  // 1. IPI
  const valorIpi = ipi ? Number(ipi) : custoBase * (Number(ipiPct) / 100);

  // 2. Alíquotas de ICMS de Entrada
  const aliquotaInternaDestino = obterAliquotaInterna(ufDestino);
  const aliquotaInterestadual = obterAliquotaInterestadual(ufOrigem, ufDestino, ehImportado);
  
  const aliquotaEntradaEfetiva = aliquotaIcmsEntradaOverride !== null && aliquotaIcmsEntradaOverride !== '' && !isNaN(aliquotaIcmsEntradaOverride)
    ? Number(aliquotaIcmsEntradaOverride) / 100
    : (ufOrigem === ufDestino ? aliquotaInternaDestino : aliquotaInterestadual);

  // Crédito de ICMS de Entrada (R$)
  const baseCalculoEntrada = custoBase + freteValor + valorIpi - descontoValor;
  const creditoIcmsEntrada = baseCalculoEntrada * aliquotaEntradaEfetiva;

  // Antecipação Parcial / DIFAL de Entrada (R$)
  let aliquotaAntecipacao = 0;
  let antecipacaoParcial = 0;

  if (antecipacaoParcialManual !== null && antecipacaoParcialManual !== '' && !isNaN(antecipacaoParcialManual)) {
    antecipacaoParcial = Number(antecipacaoParcialManual);
  } else if (ufOrigem !== ufDestino && aliquotaInternaDestino > aliquotaEntradaEfetiva) {
    aliquotaAntecipacao = aliquotaInternaDestino - aliquotaEntradaEfetiva;
    antecipacaoParcial = baseCalculoEntrada * aliquotaAntecipacao;
  }

  // 3. Formação do Custo Líquido
  // Custo Líquido = Custo Bruto + Frete + IPI - Desconto - Crédito ICMS Entrada + Antecipação Parcial
  const custoLiquido = custoBase + freteValor + valorIpi - descontoValor - creditoIcmsEntrada + antecipacaoParcial;

  // 4. Parâmetros de Saída
  const despesasVariaveis = Number(despesasVariaveisPct) / 100;
  const margemLucroDesejada = Number(margemLucroDesejadaPct) / 100;

  // Carga Tributária de Saída (T)
  let cargaTributariaSaida = 0;
  if (aliquotaSaidaOverride !== null && aliquotaSaidaOverride !== '' && !isNaN(aliquotaSaidaOverride)) {
    cargaTributariaSaida = Number(aliquotaSaidaOverride) / 100;
  } else {
    if (regimeTributario === 'Simples Nacional') {
      cargaTributariaSaida = atividade === 'Servico' ? 0.15 : 0.085; // 8.5% Comércio, 15% Serviço por padrão
    } else {
      // Lucro Presumido / Real (ICMS da UF Destino + PIS/COFINS ~ 3.65% Presumido)
      const aliquotaIcmsVenda = obterAliquotaInterna(ufDestino);
      const pisCofinsVenda = 0.0365;
      cargaTributariaSaida = aliquotaIcmsVenda + pisCofinsVenda;
    }
  }

  // 5. Preço de Venda (Markup Divisor / Gross Up)
  // Denominador = 1 - (Despesas Variáveis + Margem Lucro + Carga Tributária Saída)
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

  // Markup multiplicador
  const markupSobreCustoBruto = custoBase > 0 ? (precoVenda / custoBase) : 0;
  const markupSobreCustoLiquido = custoLiquido > 0 ? (precoVenda / custoLiquido) : 0;

  // 7. Demonstrativo de Apuração Fiscal (Entrada x Saída)
  const debitoIcmsSaidaEstestimado = precoVenda * (aliquotaSaidaOverride ? Number(aliquotaSaidaOverride)/100 : obterAliquotaInterna(ufDestino));
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
      despesasVariaveisPct: Number((despesasVariaveis * 100).toFixed(2)),
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
  ALIQUOTAS_ICMS_ESTADOS,
  CONFIG_PADRAO
};
