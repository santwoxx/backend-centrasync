/**
 * Motor Tributário / Calculadora Fiscal Completa e Totalmente Configurável
 * Suporte a ICMS por Estado (Entrada e Saída), PIS, COFINS, CSLL, IRPJ sobre a Venda
 */

const ALIQUOTAS_ICMS_ESTADOS_PADRAO = {
  AC: 0.19, AL: 0.19, AM: 0.20, AP: 0.18, BA: 0.205, CE: 0.20, DF: 0.20, ES: 0.17, GO: 0.19, MA: 0.22,
  MG: 0.18, MS: 0.17, MT: 0.17, PA: 0.19, PB: 0.20, PE: 0.205, PI: 0.21, PR: 0.195, RJ: 0.20, RN: 0.20,
  RO: 0.175, RR: 0.20, RS: 0.17, SC: 0.17, SE: 0.19, SP: 0.18, TO: 0.20
};

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

function obterAliquotaInterna(uf, tabelaCustom = null) {
  if (!uf) return 0.18;
  const tabela = tabelaCustom || ALIQUOTAS_ICMS_ESTADOS_PADRAO;
  return tabela[uf.toUpperCase()] !== undefined ? tabela[uf.toUpperCase()] : 0.18;
}

/**
 * Calcula precificação e apuração tributária (Entrada x Saída)
 */
function calcularPrecificacao(input) {
  const {
    produto = 'Produto da NFe',
    atividade = 'Comercio',
    regimeTributario = 'Lucro Presumido',
    ufOrigem = 'MG',
    ufDestino = 'BA',
    ehImportado = false,
    tabelaIcmsCustom = null,

    // Entrada (Compra)
    custoCompra = 337.616,
    fretePct = 0, // % de frete sobre a compra
    frete = 0, // valor fixo de frete (se fornecido)
    ipiPct = 3.25,
    ipi = 0,
    desconto = 0,
    outrasDespesasEntrada = 0,
    
    aliquotaIcmsEntradaOverride = null,
    creditoIcmsEntradaOverride = null,
    antecipacaoParcialManual = null,
    
    // Saída (Venda) & Impostos sobre a Venda
    aliquotaSaidaOverride = null, // Alíquota ICMS Saída (%)
    pisPct = 0, // PIS % sobre venda
    cofinsPct = 0, // COFINS % sobre venda
    csllPct = 0, // CSLL % sobre venda
    irpjPct = 0, // IRPJ % sobre venda

    // Despesas Variáveis (%)
    comissaoVendaPct = 5,
    taxaCartaoPct = 5,
    taxaMarketplacePct = 0,
    outrasDespesasVariaveisPct = 0,
    despesasVariaveisPct = 10,

    margemLucroDesejadaPct = 0
  } = input;

  const custoBase = Number(custoCompra) || 0;
  const descontoValor = Number(desconto) || 0;
  const outrasDespesasEntradaValor = Number(outrasDespesasEntrada) || 0;
  
  // 1. Frete (em % ou valor)
  const freteValor = frete ? Number(frete) : custoBase * (Number(fretePct) / 100);

  // 2. IPI
  const valorIpi = ipi ? Number(ipi) : custoBase * (Number(ipiPct) / 100);

  // 3. Alíquotas de ICMS de Entrada
  const aliquotaInternaDestino = obterAliquotaInterna(ufDestino, tabelaIcmsCustom);
  const aliquotaInterestadual = obterAliquotaInterestadual(ufOrigem, ufDestino, ehImportado);
  
  let aliquotaEntradaEfetiva = 0;
  if (aliquotaIcmsEntradaOverride !== null && aliquotaIcmsEntradaOverride !== '' && !isNaN(aliquotaIcmsEntradaOverride)) {
    aliquotaEntradaEfetiva = Number(aliquotaIcmsEntradaOverride) / 100;
  } else {
    aliquotaEntradaEfetiva = (ufOrigem === ufDestino ? aliquotaInternaDestino : aliquotaInterestadual);
  }

  // Base de cálculo e crédito de entrada
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

  // 4. Formação do Custo Líquido Real
  const custoLiquido = custoBase + freteValor + valorIpi + outrasDespesasEntradaValor - descontoValor - creditoIcmsEntrada + antecipacaoParcial;

  // 5. Despesas Variáveis
  const somaDespesasDetalhadas = Number(comissaoVendaPct) + Number(taxaCartaoPct) + Number(taxaMarketplacePct) + Number(outrasDespesasVariaveisPct);
  const despesasVariaveisFinalPct = somaDespesasDetalhadas > 0 ? somaDespesasDetalhadas : Number(despesasVariaveisPct);
  const despesasVariaveis = despesasVariaveisFinalPct / 100;

  const margemLucroDesejada = Number(margemLucroDesejadaPct) / 100;

  // 6. Impostos sobre a Venda (ICMS + PIS + COFINS + CSLL + IRPJ)
  let aliquotaIcmsVendaPct = 0;
  if (aliquotaSaidaOverride !== null && aliquotaSaidaOverride !== '' && !isNaN(aliquotaSaidaOverride)) {
    aliquotaIcmsVendaPct = Number(aliquotaSaidaOverride);
  } else {
    if (regimeTributario === 'Simples Nacional') {
      aliquotaIcmsVendaPct = atividade === 'Servico' ? 15 : 8.5;
    } else {
      aliquotaIcmsVendaPct = obterAliquotaInterna(ufDestino, tabelaIcmsCustom) * 100;
    }
  }

  const pPis = Number(pisPct) || 0;
  const pCofins = Number(cofinsPct) || 0;
  const pCsll = Number(csllPct) || 0;
  const pIrpj = Number(irpjPct) || 0;

  const cargaTributariaSaidaPct = aliquotaIcmsVendaPct + pPis + pCofins + pCsll + pIrpj;
  const cargaTributariaSaida = cargaTributariaSaidaPct / 100;

  // 7. Preço de Venda (Markup Divisor / Gross Up)
  const denominador = 1 - (despesasVariaveis + margemLucroDesejada + cargaTributariaSaida);

  let precoVenda = 0;
  if (denominador > 0) {
    precoVenda = custoLiquido / denominador;
  } else {
    precoVenda = custoLiquido * 2;
  }

  // 8. Valores Monetários Finais (R$)
  const impostosSaidaValor = precoVenda * cargaTributariaSaida;
  const icmsSaidaValor = precoVenda * (aliquotaIcmsVendaPct / 100);
  const pisSaidaValor = precoVenda * (pPis / 100);
  const cofinsSaidaValor = precoVenda * (pCofins / 100);
  const csllSaidaValor = precoVenda * (pCsll / 100);
  const irpjSaidaValor = precoVenda * (pIrpj / 100);

  const despesasVariaveisValor = precoVenda * despesasVariaveis;
  const lucroLiquidoValor = precoVenda * margemLucroDesejada;

  const markupSobreCustoBruto = custoBase > 0 ? (precoVenda / custoBase) : 0;
  const markupSobreCustoLiquido = custoLiquido > 0 ? (precoVenda / custoLiquido) : 0;

  // 9. Demonstrativo de Apuração Fiscal (Entrada x Saída)
  const saldoIcmsRecolher = Math.max(0, icmsSaidaValor - creditoIcmsEntrada);

  return {
    produto,
    atividade,
    regimeTributario,
    ufOrigem,
    ufDestino,
    
    // Entrada detalhada
    entrada: {
      custoCompra: Number(custoBase.toFixed(4)),
      fretePct: Number(fretePct),
      frete: Number(freteValor.toFixed(4)),
      ipiPct: Number(ipiPct),
      ipi: Number(valorIpi.toFixed(4)),
      outrasDespesasEntrada: Number(outrasDespesasEntradaValor.toFixed(4)),
      desconto: Number(descontoValor.toFixed(4)),
      baseCalculoEntrada: Number(baseCalculoEntrada.toFixed(4)),
      aliquotaEntradaPct: Number((aliquotaEntradaEfetiva * 100).toFixed(2)),
      creditoIcmsEntrada: Number(creditoIcmsEntrada.toFixed(4)),
      aliquotaAntecipacaoPct: Number((aliquotaAntecipacao * 100).toFixed(2)),
      antecipacaoParcial: Number(antecipacaoParcial.toFixed(4)),
      custoLiquido: Number(custoLiquido.toFixed(4))
    },
    
    // Saída detalhada
    saida: {
      aliquotaIcmsVendaPct: Number(aliquotaIcmsVendaPct.toFixed(2)),
      pisPct: Number(pPis.toFixed(2)),
      cofinsPct: Number(pCofins.toFixed(2)),
      csllPct: Number(pCsll.toFixed(2)),
      irpjPct: Number(pIrpj.toFixed(2)),
      
      icmsSaidaValor: Number(icmsSaidaValor.toFixed(2)),
      pisSaidaValor: Number(pisSaidaValor.toFixed(2)),
      cofinsSaidaValor: Number(cofinsSaidaValor.toFixed(2)),
      csllSaidaValor: Number(csllSaidaValor.toFixed(2)),
      irpjSaidaValor: Number(irpjSaidaValor.toFixed(2)),

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

    // Demonstrativo Fiscal Sintético (visão do contador)
    demonstrativoFiscal: {
      creditoEntrada: Number(creditoIcmsEntrada.toFixed(4)),
      antecipacaoParcialRecolhida: Number(antecipacaoParcial.toFixed(4)),
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
