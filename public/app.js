/**
 * Client-Side JavaScript para o Painel de Testes Tributários
 * CentralSync - Simulador de Precificação & Impostos
 */

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

document.addEventListener('DOMContentLoaded', async () => {
  populateStateSelects();
  loadStateFromURL();
  await updateCalculations();
  setupEventListeners();
});

/**
 * Preenche os selects de Estado de Origem e Destino
 */
function populateStateSelects() {
  const selectOrigem = document.getElementById('ufOrigem');
  const selectDestino = document.getElementById('ufDestino');

  selectOrigem.innerHTML = '';
  selectDestino.innerHTML = '';

  ESTADOS_BRASIL.forEach(uf => {
    const optO = document.createElement('option');
    optO.value = uf;
    optO.textContent = uf;
    if (uf === 'SP') optO.selected = true;
    selectOrigem.appendChild(optO);

    const optD = document.createElement('option');
    optD.value = uf;
    optD.textContent = uf;
    if (uf === 'BA') optD.selected = true;
    selectDestino.appendChild(optD);
  });
}

/**
 * Configura escutadores de eventos para todos os inputs
 */
function setupEventListeners() {
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      syncUrlParams();
      updateCalculations();
    });
  });

  // Mudança nos estados atualiza dica de ICMS
  document.getElementById('ufOrigem').addEventListener('change', fetchIcmsRates);
  document.getElementById('ufDestino').addEventListener('change', fetchIcmsRates);

  // Botão de Compartilhar Link com Contador
  document.getElementById('btnShareLink').addEventListener('click', copyShareLink);
}

/**
 * Busca alíquotas automáticas de ICMS ao mudar a UF
 */
async function fetchIcmsRates() {
  const ufOrigem = document.getElementById('ufOrigem').value;
  const ufDestino = document.getElementById('ufDestino').value;

  try {
    const res = await fetch(`/api/tax/icms-rate?ufOrigem=${ufOrigem}&ufDestino=${ufDestino}`);
    const json = await res.json();
    if (json.success) {
      const data = json.data;
      const hintEntrada = document.getElementById('hintIcmsEntrada');
      const hintAntecipacao = document.getElementById('hintAntecipacao');

      if (ufOrigem === ufDestino) {
        hintEntrada.textContent = `Interno ${data.aliquotaInternaDestinoPct}% (${ufOrigem})`;
        hintAntecipacao.textContent = `Operação interna (sem DIFAL)`;
      } else {
        hintEntrada.textContent = `Interestadual ${data.aliquotaInterestadualPct}% (${ufOrigem} → ${ufDestino})`;
        hintAntecipacao.textContent = `DIFAL Entrada ${data.aliquotaAntecipacaoPct}% (${ufDestino} ${data.aliquotaInternaDestinoPct}% - ${data.aliquotaInterestadualPct}%)`;
      }
    }
  } catch (err) {
    console.error('Erro ao buscar taxas:', err);
  }
}

/**
 * Coleta os valores do formulário e chama a API pública de cálculo
 */
async function updateCalculations() {
  const formData = {
    produto: document.getElementById('produto').value || 'Produto Sem Nome',
    regimeTributario: document.getElementById('regimeTributario').value,
    ufOrigem: document.getElementById('ufOrigem').value,
    ufDestino: document.getElementById('ufDestino').value,
    custoCompra: document.getElementById('custoCompra').value,
    frete: document.getElementById('frete').value,
    ipiPct: document.getElementById('ipiPct').value,
    desconto: document.getElementById('desconto').value,
    aliquotaIcmsEntradaOverride: document.getElementById('aliquotaIcmsEntradaOverride').value,
    antecipacaoParcialManual: document.getElementById('antecipacaoParcialManual').value,
    aliquotaSaidaOverride: document.getElementById('aliquotaSaidaOverride').value,
    despesasVariaveisPct: document.getElementById('despesasVariaveisPct').value,
    margemLucroDesejadaPct: document.getElementById('margemLucroDesejadaPct').value
  };

  try {
    const response = await fetch('/api/tax/calculate-public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json();
    if (result.success) {
      renderResults(result.data);
    }
  } catch (error) {
    console.error('Erro ao calcular precificação:', error);
  }
}

/**
 * Atualiza a interface com os resultados recebidos
 */
function renderResults(data) {
  // 1. Hero Cards
  document.getElementById('badgeRegime').textContent = data.regimeTributario;
  document.getElementById('resPrecoVenda').textContent = formatCurrency(data.saida.precoVendaSugerido);
  document.getElementById('resLucroLiquido').textContent = `${formatCurrency(data.saida.lucroLiquidoValor)} (${data.saida.margemLucroDesejadaPct}%)`;
  document.getElementById('resCustoLiquido').textContent = formatCurrency(data.entrada.custoLiquido);
  document.getElementById('resMarkup').textContent = `${data.saida.markupSobreCustoBruto}x`;

  // 2. Gráfico / Composição do Preço de Venda
  const preco = data.saida.precoVendaSugerido;
  if (preco > 0) {
    const pctCusto = ((data.entrada.custoLiquido / preco) * 100).toFixed(1);
    const pctImposto = data.saida.cargaTributariaSaidaPct.toFixed(1);
    const pctDespesas = data.saida.despesasVariaveisPct.toFixed(1);
    const pctLucro = data.saida.margemLucroDesejadaPct.toFixed(1);

    document.getElementById('barCusto').style.width = `${pctCusto}%`;
    document.getElementById('barImpostos').style.width = `${pctImposto}%`;
    document.getElementById('barDespesas').style.width = `${pctDespesas}%`;
    document.getElementById('barLucro').style.width = `${pctLucro}%`;

    document.getElementById('legendCustoPct').textContent = `${pctCusto}%`;
    document.getElementById('legendImpostosPct').textContent = `${pctImposto}%`;
    document.getElementById('legendDespesasPct').textContent = `${pctDespesas}%`;
    document.getElementById('legendLucroPct').textContent = `${pctLucro}%`;
  }

  // 3. Tabela de Apuração Fiscal (Contador)
  document.getElementById('tabCustoBruto').textContent = formatCurrency(data.entrada.custoCompra);
  
  const freteEipi = data.entrada.frete + data.entrada.ipi;
  document.getElementById('tabFreteIpiDet').textContent = `Frete: ${formatCurrency(data.entrada.frete)} | IPI: ${formatCurrency(data.entrada.ipi)}`;
  document.getElementById('tabFreteIpi').textContent = formatCurrency(freteEipi);

  document.getElementById('tabCreditoDet').textContent = `${data.entrada.aliquotaEntradaPct}% de ICMS de Origem (${data.ufOrigem})`;
  document.getElementById('tabCreditoIcms').textContent = `- ${formatCurrency(data.entrada.creditoIcmsEntrada)}`;

  document.getElementById('tabAntecipacaoDet').textContent = data.entrada.antecipacaoParcial > 0 
    ? `DIFAL/Antecipação Parcial (${data.entrada.aliquotaAntecipacaoPct}% para ${data.ufDestino})`
    : `Sem antecipação apurada`;
  document.getElementById('tabAntecipacao').textContent = `+ ${formatCurrency(data.entrada.antecipacaoParcial)}`;

  document.getElementById('tabCustoLiquidoReal').textContent = formatCurrency(data.entrada.custoLiquido);

  document.getElementById('tabSaidaDet').textContent = `${data.saida.cargaTributariaSaidaPct}% sobre R$ ${data.saida.precoVendaSugerido}`;
  document.getElementById('tabImpostoSaida').textContent = formatCurrency(data.saida.impostosSaidaValor);

  document.getElementById('tabCargaEfetivaDet').textContent = `Impostos Líquidos (Saída - Créditos) / Venda`;
  document.getElementById('tabCargaEfetiva').textContent = `${data.demonstrativoFiscal.cargaTributariaEfetivaPct}%`;
}

/**
 * Formata números para o padrão monetário BRL
 */
function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

/**
 * Atualiza os parâmetros na URL da página sem recarregar
 */
function syncUrlParams() {
  const params = new URLSearchParams();
  const fields = [
    'produto', 'regimeTributario', 'ufOrigem', 'ufDestino',
    'custoCompra', 'frete', 'ipiPct', 'desconto',
    'aliquotaIcmsEntradaOverride', 'antecipacaoParcialManual',
    'aliquotaSaidaOverride', 'despesasVariaveisPct', 'margemLucroDesejadaPct'
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value !== '') {
      params.set(id, el.value);
    }
  });

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}

/**
 * Carrega estado a partir dos parâmetros da URL
 */
function loadStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  if ([...params.keys()].length === 0) return;

  params.forEach((val, key) => {
    const el = document.getElementById(key);
    if (el) {
      el.value = val;
    }
  });

  fetchIcmsRates();
}

/**
 * Copia o link atual com parâmetros preenchidos para a área de transferência
 */
function copyShareLink() {
  syncUrlParams();
  const fullUrl = window.location.href;

  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast('Link do simulador copiado! Envie ao contador.');
  }).catch(err => {
    console.error('Falha ao copiar link: ', err);
    alert('Copie o link da barra de endereço: ' + fullUrl);
  });
}

/**
 * Exibe notificação flutuante (Toast)
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}
