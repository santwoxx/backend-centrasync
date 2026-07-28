/**
 * Motor Tributário / Calculadora Fiscal Completa e Totalmente Configurável
 * Carga Tributária Efetiva = Impostos de Saída - Crédito ICMS Entrada + Antecipação Parcial DIFAL
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
    fretePct = 0,
    frete = 0,
    ipiPct = 3.25,
    ipi = 0,
    desconto = 0,
    outrasDespesasEntrada = 0,
    
    aliquotaIcmsEntradaOverride = null,
    creditoIcmsEntradaOverride = null,
    
    // Antecipação / DIFAL (%) ou Valor Manual
    antecipacaoParcialPct = null,
    antecipacaoParcialManual = null,
    
    // Saída (Venda) & Impostos sobre Venda
    aliquotaSaidaOverride = null,
    pisPct = 0.65,
    cofinsPct = 3,
    csllPct = 1.2,
    irpjPct = 2,

    // Despesas Variáveis sobre Venda (%)
    comissaoVendaPct = 5,
    taxaCartaoPct = 5,
    taxaMarketplacePct = 0,
    freteVendaPct = 0,
    montagemPct = 0,
    outrasDespesasVariaveisPct = 0,
    despesasVariaveisPct = 10,

    margemLucroDesejadaPct = 0
  } = input;

  const custoBase = Number(custoCompra) || 0;
  const descontoValor = Number(desconto) || 0;
  const outrasDespesasEntradaValor = Number(outrasDespesasEntrada) || 0;
  
  // 1. Frete e IPI da Compra
  const freteValor = frete ? Number(frete) : custoBase * (Number(fretePct) / 100);
  const valorIpi = ipi ? Number(ipi) : custoBase * (Number(ipiPct) / 100);

  // Custo Formado do Produto
  const custoFormado = custoBase + freteValor + valorIpi + outrasDespesasEntradaValor - descontoValor;

  // 2. Alíquotas e Lançamentos de ICMS Entrada (Crédito & DIFAL)
  const aliquotaInternaDestino = obterAliquotaInterna(ufDestino, tabelaIcmsCustom);
  const aliquotaInterestadual = obterAliquotaInterestadual(ufOrigem, ufDestino, ehImportado);
  
  let aliquotaEntradaEfetiva = 0;
  if (aliquotaIcmsEntradaOverride !== null && aliquotaIcmsEntradaOverride !== '' && !isNaN(aliquotaIcmsEntradaOverride)) {
    aliquotaEntradaEfetiva = Number(aliquotaIcmsEntradaOverride) / 100;
  } else {
    aliquotaEntradaEfetiva = (ufOrigem === ufDestino ? aliquotaInternaDestino : aliquotaInterestadual);
  }

  const baseCalculoEntrada = custoFormado;
  
  // Crédito de ICMS de Entrada
  let creditoIcmsEntrada = 0;
  if (creditoIcmsEntradaOverride !== null && creditoIcmsEntradaOverride !== '' && !isNaN(creditoIcmsEntradaOverride)) {
    creditoIcmsEntrada = Number(creditoIcmsEntradaOverride);
  } else {
    creditoIcmsEntrada = baseCalculoEntrada * aliquotaEntradaEfetiva;
  }

  // Antecipação Parcial / DIFAL de Entrada
  let aliquotaAntecipacao = 0;
  let antecipacaoParcial = 0;

  if (antecipacaoParcialManual !== null && antecipacaoParcialManual !== '' && !isNaN(antecipacaoParcialManual)) {
    antecipacaoParcial = Number(antecipacaoParcialManual);
    aliquotaAntecipacao = baseCalculoEntrada > 0 ? (antecipacaoParcial / baseCalculoEntrada) : 0;
  } else if (antecipacaoParcialPct !== null && antecipacaoParcialPct !== '' && !isNaN(antecipacaoParcialPct)) {
    aliquotaAntecipacao = Number(antecipacaoParcialPct) / 100;
    antecipacaoParcial = baseCalculoEntrada * aliquotaAntecipacao;
  } else if (ufOrigem !== ufDestino && aliquotaInternaDestino > aliquotaEntradaEfetiva) {
    aliquotaAntecipacao = aliquotaInternaDestino - aliquotaEntradaEfetiva;
    antecipacaoParcial = baseCalculoEntrada * aliquotaAntecipacao;
  }

  // Custo Líquido para Precificação
  const custoLiquidoReal = custoFormado;

  // 3. Despesas Variáveis sobre Venda
  const somaDespesasDetalhadas = Number(comissaoVendaPct) + Number(taxaCartaoPct) + Number(taxaMarketplacePct) + Number(freteVendaPct) + Number(montagemPct) + Number(outrasDespesasVariaveisPct);
  const despesasVariaveisFinalPct = somaDespesasDetalhadas > 0 ? somaDespesasDetalhadas : Number(despesasVariaveisPct);
  const despesasVariaveis = despesasVariaveisFinalPct / 100;

  const margemLucroDesejada = Number(margemLucroDesejadaPct) / 100;

  // 4. Impostos sobre a Venda (Saída)
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
  const aliquotaFederaisPct = pPis + pCofins + pCsll + pIrpj;

  const cargaTributariaSaidaPct = aliquotaIcmsVendaPct + aliquotaFederaisPct;
  const cargaTributariaSaida = cargaTributariaSaidaPct / 100;

  // 5. Preço de Venda (Markup Divisor / Gross Up)
  const denominador = 1 - (despesasVariaveis + margemLucroDesejada + cargaTributariaSaida);

  let precoVenda = 0;
  if (denominador > 0) {
    precoVenda = custoLiquidoReal / denominador;
  } else {
    precoVenda = custoLiquidoReal * 2;
  }

  // 6. Valores Monetários Finais (R$)
  const icmsSaidaBrutoValor = precoVenda * (aliquotaIcmsVendaPct / 100);
  const impostosFederaisBrutoValor = precoVenda * (aliquotaFederaisPct / 100);
  const impostosSaidaBrutoValor = icmsSaidaBrutoValor + impostosFederaisBrutoValor; // R$ 147.75

  const pisSaidaValor = precoVenda * (pPis / 100);
  const cofinsSaidaValor = precoVenda * (pCofins / 100);
  const csllSaidaValor = precoVenda * (pCsll / 100);
  const irpjSaidaValor = precoVenda * (pIrpj / 100);

  // 7. APURAÇÃO FISCAL E CARGA TRIBUTÁRIA EFETIVA TOTAL
  // Impostos de Saída (R$ 147,75) - Crédito ICMS Entrada (R$ 23,63) + Antecipação Parcial (R$ 45,58) = R$ 169,70 (~31,4%)
  const impostoLiquidoEfetivoRecolher = Math.max(0, impostosSaidaBrutoValor - creditoIcmsEntrada + antecipacaoParcial);
  const icmsAPagarSaida = Math.max(0, icmsSaidaBrutoValor - creditoIcmsEntrada);

  const despesasVariaveisValor = precoVenda * despesasVariaveis;
  const freteVendaValor = precoVenda * (Number(freteVendaPct) / 100);
  const montagemValor = precoVenda * (Number(montagemPct) / 100);
  const lucroLiquidoValor = precoVenda * margemLucroDesejada;

  const markupSobreCustoBruto = custoBase > 0 ? (precoVenda / custoBase) : 0;
  const markupSobreCustoLiquido = custoLiquidoReal > 0 ? (precoVenda / custoLiquidoReal) : 0;

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
      custoFormado: Number(custoFormado.toFixed(4)),
      baseCalculoEntrada: Number(baseCalculoEntrada.toFixed(4)),
      aliquotaEntradaPct: Number((aliquotaEntradaEfetiva * 100).toFixed(2)),
      creditoIcmsEntrada: Number(creditoIcmsEntrada.toFixed(4)),
      aliquotaAntecipacaoPct: Number((aliquotaAntecipacao * 100).toFixed(2)),
      antecipacaoParcial: Number(antecipacaoParcial.toFixed(4)),
      custoLiquido: Number(custoLiquidoReal.toFixed(4))
    },
    
    // Saída detalhada
    saida: {
      aliquotaIcmsVendaPct: Number(aliquotaIcmsVendaPct.toFixed(2)),
      aliquotaFederaisPct: Number(aliquotaFederaisPct.toFixed(2)),
      pisPct: Number(pPis.toFixed(2)),
      cofinsPct: Number(pCofins.toFixed(2)),
      csllPct: Number(pCsll.toFixed(2)),
      irpjPct: Number(pIrpj.toFixed(2)),
      
      icmsSaidaValor: Number(icmsSaidaBrutoValor.toFixed(2)),
      impostosFederaisValor: Number(impostosFederaisBrutoValor.toFixed(2)),
      pisSaidaValor: Number(pisSaidaValor.toFixed(2)),
      cofinsSaidaValor: Number(cofinsSaidaValor.toFixed(2)),
      csllSaidaValor: Number(csllSaidaValor.toFixed(2)),
      irpjSaidaValor: Number(irpjSaidaValor.toFixed(2)),

      comissaoVendaPct: Number(comissaoVendaPct),
      taxaCartaoPct: Number(taxaCartaoPct),
      taxaMarketplacePct: Number(taxaMarketplacePct),
      freteVendaPct: Number(freteVendaPct),
      freteVendaValor: Number(freteVendaValor.toFixed(2)),
      montagemPct: Number(montagemPct),
      montagemValor: Number(montagemValor.toFixed(2)),

      despesasVariaveisPct: Number(despesasVariaveisFinalPct.toFixed(2)),
      despesasVariaveisValor: Number(despesasVariaveisValor.toFixed(2)),
      margemLucroDesejadaPct: Number((margemLucroDesejada * 100).toFixed(2)),
      cargaTributariaSaidaPct: Number((cargaTributariaSaida * 100).toFixed(2)),
      impostosSaidaValor: Number(impostosSaidaBrutoValor.toFixed(2)),
      impostoLiquidoEfetivoRecolher: Number(impostoLiquidoEfetivoRecolher.toFixed(2)),
      precoVendaSugerido: Number(precoVenda.toFixed(2)),
      lucroLiquidoValor: Number(lucroLiquidoValor.toFixed(2)),
      markupSobreCustoBruto: Number(markupSobreCustoBruto.toFixed(2)),
      markupSobreCustoLiquido: Number(markupSobreCustoLiquido.toFixed(2)),
      denominador: Number(denominador.toFixed(4))
    },

    // Demonstrativo Fiscal Sintético (Saída - Crédito + Antecipação = ~ R$ 160 e poucos)
    demonstrativoFiscal: {
      custoFormado: Number(custoFormado.toFixed(4)),
      impostosSaidaBruto: Number(impostosSaidaBrutoValor.toFixed(2)), // 147.75
      creditoEntradaAbatido: Number(creditoIcmsEntrada.toFixed(4)), // 23.63
      antecipacaoParcialSomada: Number(antecipacaoParcial.toFixed(4)), // 45.58 ou 47.06
      impostoTotalEfetivo: Number(impostoLiquidoEfetivoRecolher.toFixed(2)), // 169.70 (uns 160 e poucos)
      cargaTributariaEfetivaPct: precoVenda > 0 ? Number(((impostoLiquidoEfetivoRecolher) / precoVenda * 100).toFixed(2)) : 0
    }
  };
}

module.exports = {
  calcularPrecificacao,
  obterAliquotaInterestadual,
  obterAliquotaInterna,
  ALIQUOTAS_ICMS_ESTADOS_PADRAO
};
