/**
 * Client-Side JavaScript para o Painel de Testes Tributários
 * CentralSync - Simulador de Precificação & Impostos com Carga Efetiva Ajustada (160 e poucos)
 */

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

let DEFAULT_ICMS_RATES = {
  AC: 19, AL: 19, AM: 20, AP: 18, BA: 20.5, CE: 20, DF: 20, ES: 17, GO: 19, MA: 22,
  MG: 18, MS: 17, MT: 17, PA: 19, PB: 20, PE: 20.5, PI: 21, PR: 19.5, RJ: 20, RN: 20,
  RO: 17.5, RR: 20, RS: 17, SC: 17, SE: 19, SP: 18, TO: 20
};

let currentCustomIcmsTable = { ...DEFAULT_ICMS_RATES };
let ncmSearchTimeout = null;
let lastCalculatedData = null;

document.addEventListener('DOMContentLoaded', async () => {
  populateStateSelects();
  loadStateFromURL();
  setupEventListeners();
  setupXmlDropzone();
  setupNcmSearch();
  setupModals();
  await updateCalculations();
});

function populateStateSelects() {
  const selectOrigem = document.getElementById('ufOrigem');
  const selectDestino = document.getElementById('ufDestino');

  selectOrigem.innerHTML = '';
  selectDestino.innerHTML = '';

  ESTADOS_BRASIL.forEach(uf => {
    const optO = document.createElement('option');
    optO.value = uf;
    optO.textContent = uf;
    if (uf === 'MG') optO.selected = true;
    selectOrigem.appendChild(optO);

    const optD = document.createElement('option');
    optD.value = uf;
    optD.textContent = uf;
    if (uf === 'BA') optD.selected = true;
    selectDestino.appendChild(optD);
  });
}

function setupEventListeners() {
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(input => {
    if (input.id === 'ncmInput' || input.id === 'fileXmlInput') return;
    input.addEventListener('input', () => {
      syncUrlParams();
      updateCalculations();
    });
  });

  document.getElementById('ufOrigem').addEventListener('change', fetchIcmsRates);
  document.getElementById('ufDestino').addEventListener('change', fetchIcmsRates);

  document.getElementById('btnShareLink').addEventListener('click', copyShareLink);
}

function setupModals() {
  document.getElementById('btnOpenConfigModal').addEventListener('click', openIcmsModal);
  document.getElementById('btnExportJson').addEventListener('click', openExportModal);
}

function openIcmsModal() {
  const grid = document.getElementById('icmsStateGrid');
  grid.innerHTML = '';

  ESTADOS_BRASIL.forEach(uf => {
    const box = document.createElement('div');
    box.className = 'state-input-box';
    box.innerHTML = `
      <label for="rate_${uf}">${uf} (%)</label>
      <input type="number" id="rate_${uf}" value="${currentCustomIcmsTable[uf] || 18}" step="0.5" min="0">
    `;
    grid.appendChild(box);
  });

  document.getElementById('modalIcmsConfig').style.display = 'flex';
}

function closeIcmsModal() {
  document.getElementById('modalIcmsConfig').style.display = 'none';
}

function saveCustomIcmsTable() {
  ESTADOS_BRASIL.forEach(uf => {
    const el = document.getElementById(`rate_${uf}`);
    if (el) {
      currentCustomIcmsTable[uf] = parseFloat(el.value) || 18;
    }
  });
  closeIcmsModal();
  fetchIcmsRates();
  updateCalculations();
  showToast('Alíquotas de ICMS por estado salvas!');
}

function resetIcmsTableToDefault() {
  currentCustomIcmsTable = { ...DEFAULT_ICMS_RATES };
  openIcmsModal();
}

function openExportModal() {
  const formData = getFormData();
  
  const apiPayload = {
    produto: formData.produto || 'Produto Exemplo',
    atividade: 'Comercio',
    regimeTributario: formData.regimeTributario,
    ufOrigem: formData.ufOrigem,
    ufDestino: formData.ufDestino,
    custoCompra: Number(formData.custoCompra || 0),
    fretePct: Number(formData.fretePct || 0),
    ipiPct: Number(formData.ipiPct || 0),
    desconto: Number(formData.desconto || 0),
    aliquotaIcmsEntradaOverride: formData.aliquotaIcmsEntradaOverride ? Number(formData.aliquotaIcmsEntradaOverride) : undefined,
    creditoIcmsEntradaOverride: formData.creditoIcmsEntradaOverride ? Number(formData.creditoIcmsEntradaOverride) : undefined,
    antecipacaoParcialPct: formData.antecipacaoParcialPct ? Number(formData.antecipacaoParcialPct) : undefined,
    aliquotaSaidaOverride: formData.aliquotaSaidaOverride ? Number(formData.aliquotaSaidaOverride) : undefined,
    pisPct: Number(formData.pisPct || 0),
    cofinsPct: Number(formData.cofinsPct || 0),
    csllPct: Number(formData.csllPct || 0),
    irpjPct: Number(formData.irpjPct || 0),
    comissaoVendaPct: Number(formData.comissaoVendaPct || 0),
    taxaCartaoPct: Number(formData.taxaCartaoPct || 0),
    taxaMarketplacePct: Number(formData.taxaMarketplacePct || 0),
    freteVendaPct: Number(formData.freteVendaPct || 0),
    montagemPct: Number(formData.montagemPct || 0),
    despesasVariaveisPct: Number(formData.despesasVariaveisPct || 0),
    margemLucroDesejadaPct: Number(formData.margemLucroDesejadaPct || 0)
  };

  const codeString = `// Exemplo de Chamada no Backend do seu Sistema
fetch('https://seu-dominio.com/api/tax/calculate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'dev-secret-key'
  },
  body: JSON.stringify(${JSON.stringify(apiPayload, null, 2)})
});`;

  document.getElementById('jsonExportCode').textContent = codeString;
  document.getElementById('modalExportJson').style.display = 'flex';
}

function closeExportModal() {
  document.getElementById('modalExportJson').style.display = 'none';
}

function copyJsonExportCode() {
  const code = document.getElementById('jsonExportCode').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showToast('Código JSON copiado para a área de transferência!');
  });
}

function setupXmlDropzone() {
  const dropzone = document.getElementById('dropzoneXml');
  const fileInput = document.getElementById('fileXmlInput');

  if (!dropzone || !fileInput) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleXmlFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleXmlFile(e.target.files[0]);
    }
  });
}

function handleXmlFile(file) {
  if (!file.name.toLowerCase().endsWith('.xml')) {
    alert('Por favor, selecione um arquivo XML de NF-e válido.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const xmlContent = e.target.result;
    try {
      const response = await fetch('/api/tax/parse-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xmlContent
      });

      const resJson = await response.json();
      if (resJson.success && resJson.nfe) {
        applyParsedNfeData(resJson.nfe);
        showToast(`NF-e importada! (${resJson.nfe.totalItens} item(ns))`);
      } else {
        alert('Não foi possível ler as informações deste XML de NF-e.');
      }
    } catch (err) {
      console.error('Erro ao enviar XML:', err);
      alert('Erro ao processar o arquivo XML.');
    }
  };
  reader.readAsText(file);
}

function applyParsedNfeData(nfe) {
  if (nfe.ufOrigem) {
    document.getElementById('ufOrigem').value = nfe.ufOrigem;
  }
  if (nfe.ufDestino) {
    document.getElementById('ufDestino').value = nfe.ufDestino;
  }

  const p = nfe.primeiroItem;
  if (p) {
    if (p.produto) document.getElementById('produto').value = p.produto;
    if (p.ncm) {
      document.getElementById('ncmInput').value = p.ncm;
      consultarNcmEspecifico(p.ncm);
    }
    if (p.custoCompra !== undefined) document.getElementById('custoCompra').value = p.custoCompra;
    if (p.frete !== undefined && p.custoCompra > 0) {
      const pctCalculado = ((p.frete / p.custoCompra) * 100).toFixed(2);
      document.getElementById('fretePct').value = pctCalculado;
    }
    if (p.desconto !== undefined) document.getElementById('desconto').value = p.desconto;
    if (p.ipiPct !== undefined) document.getElementById('ipiPct').value = p.ipiPct;
    if (p.aliquotaIcmsEntrada !== undefined) document.getElementById('aliquotaIcmsEntradaOverride').value = p.aliquotaIcmsEntrada;
    if (p.creditoIcmsEntrada !== undefined) document.getElementById('creditoIcmsEntradaOverride').value = p.creditoIcmsEntrada;
  }

  fetchIcmsRates();
  syncUrlParams();
  updateCalculations();
}

function setupNcmSearch() {
  const ncmInput = document.getElementById('ncmInput');
  const resultsDiv = document.getElementById('ncmResults');

  if (!ncmInput) return;

  ncmInput.addEventListener('input', () => {
    clearTimeout(ncmSearchTimeout);
    const q = ncmInput.value.trim();
    if (q.length < 2) {
      resultsDiv.style.display = 'none';
      return;
    }

    ncmSearchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tax/ncm?search=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          renderNcmSuggestions(json.data);
        } else {
          resultsDiv.style.display = 'none';
        }
      } catch (err) {
        console.error('Erro na busca de NCM:', err);
      }
    }, 350);
  });

  document.addEventListener('click', (e) => {
    if (!ncmInput.contains(e.target) && !resultsDiv.contains(e.target)) {
      resultsDiv.style.display = 'none';
    }
  });
}

function renderNcmSuggestions(items) {
  const resultsDiv = document.getElementById('ncmResults');
  resultsDiv.innerHTML = '';
  resultsDiv.style.display = 'block';

  items.slice(0, 8).forEach(item => {
    const div = document.createElement('div');
    div.className = 'autocomplete-item';
    div.innerHTML = `<strong>${item.codigo}</strong> - ${item.descricao}`;
    div.addEventListener('click', () => {
      document.getElementById('ncmInput').value = item.codigo;
      document.getElementById('ncmDesc').value = item.descricao;
      resultsDiv.style.display = 'none';
      syncUrlParams();
    });
    resultsDiv.appendChild(div);
  });
}

async function consultarNcmEspecifico(code) {
  try {
    const res = await fetch(`/api/tax/ncm?code=${encodeURIComponent(code)}`);
    const json = await res.json();
    if (json.success && json.data && json.data.length > 0) {
      document.getElementById('ncmDesc').value = json.data[0].descricao || '';
    }
  } catch (err) {
    console.error(err);
  }
}

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

      const aliquotaInternaCustom = currentCustomIcmsTable[ufDestino] || data.aliquotaInternaDestinoPct;

      if (ufOrigem === ufDestino) {
        hintEntrada.textContent = `Interno ${aliquotaInternaCustom}% (${ufOrigem})`;
        hintAntecipacao.textContent = `Operação interna (sem DIFAL)`;
      } else {
        hintEntrada.textContent = `Interestadual ${data.aliquotaInterestadualPct}% (${ufOrigem} → ${ufDestino})`;
        const difalPct = (aliquotaInternaCustom - data.aliquotaInterestadualPct).toFixed(1);
        hintAntecipacao.textContent = `DIFAL Entrada ${difalPct}% (${ufDestino} ${aliquotaInternaCustom}% - ${data.aliquotaInterestadualPct}%)`;
      }
    }
  } catch (err) {
    console.error('Erro ao buscar taxas:', err);
  }
}

function getFormData() {
  return {
    produto: document.getElementById('produto').value || 'Produto da NFe',
    regimeTributario: document.getElementById('regimeTributario').value,
    ufOrigem: document.getElementById('ufOrigem').value,
    ufDestino: document.getElementById('ufDestino').value,
    custoCompra: document.getElementById('custoCompra').value,
    fretePct: document.getElementById('fretePct').value,
    ipiPct: document.getElementById('ipiPct').value,
    desconto: document.getElementById('desconto').value,
    aliquotaIcmsEntradaOverride: document.getElementById('aliquotaIcmsEntradaOverride').value,
    creditoIcmsEntradaOverride: document.getElementById('creditoIcmsEntradaOverride').value,
    antecipacaoParcialPct: document.getElementById('antecipacaoParcialPct').value,
    aliquotaSaidaOverride: document.getElementById('aliquotaSaidaOverride').value,
    pisPct: document.getElementById('pisPct').value,
    cofinsPct: document.getElementById('cofinsPct').value,
    csllPct: document.getElementById('csllPct').value,
    irpjPct: document.getElementById('irpjPct').value,
    comissaoVendaPct: document.getElementById('comissaoVendaPct').value,
    taxaCartaoPct: document.getElementById('taxaCartaoPct').value,
    taxaMarketplacePct: document.getElementById('taxaMarketplacePct').value,
    freteVendaPct: document.getElementById('freteVendaPct').value,
    montagemPct: document.getElementById('montagemPct').value,
    despesasVariaveisPct: document.getElementById('despesasVariaveisPct').value,
    margemLucroDesejadaPct: document.getElementById('margemLucroDesejadaPct').value,
    tabelaIcmsCustom: currentCustomIcmsTable
  };
}

async function updateCalculations() {
  const formData = getFormData();

  if (!formData.custoCompra || Number(formData.custoCompra) === 0) {
    renderEmptyResults(formData);
    return;
  }

  try {
    const response = await fetch('/api/tax/calculate-public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json();
    if (result.success) {
      lastCalculatedData = result.data;
      renderResults(result.data);
    }
  } catch (error) {
    console.error('Erro ao calcular precificação:', error);
  }
}

function renderEmptyResults(formData) {
  document.getElementById('badgeRegime').textContent = formData.regimeTributario || 'Lucro Presumido';
  document.getElementById('resPrecoVenda').textContent = 'R$ 0,00';
  document.getElementById('resLucroLiquido').textContent = 'R$ 0,00 (0%)';
  document.getElementById('resCustoLiquido').textContent = 'R$ 0,00';
  document.getElementById('resMarkup').textContent = '0.00x';

  document.getElementById('barCusto').style.width = '0%';
  document.getElementById('barImpostos').style.width = '0%';
  document.getElementById('barDespesas').style.width = '0%';
  document.getElementById('barLucro').style.width = '0%';

  document.getElementById('legendCustoPct').textContent = '0%';
  document.getElementById('legendImpostosPct').textContent = '0%';
  document.getElementById('legendDespesasPct').textContent = '0%';
  document.getElementById('legendLucroPct').textContent = '0%';

  document.getElementById('tabCustoBruto').textContent = 'R$ 0,00';
  document.getElementById('tabFreteIpiDet').textContent = 'Frete: R$ 0,00 | IPI: R$ 0,00';
  document.getElementById('tabFreteIpi').textContent = 'R$ 0,00';
  if (document.getElementById('tabCustoFormado')) {
    document.getElementById('tabCustoFormado').textContent = 'R$ 0,00';
  }
  document.getElementById('tabSaidaDet').textContent = 'Aguardando dados...';
  document.getElementById('tabImpostoSaida').textContent = 'R$ 0,00';
  document.getElementById('tabCreditoDet').textContent = 'Aguardando Custo...';
  document.getElementById('tabCreditoIcms').textContent = '- R$ 0,00';
  document.getElementById('tabAntecipacaoDet').textContent = 'Aguardando Custo...';
  document.getElementById('tabAntecipacao').textContent = '+ R$ 0,00';
  
  document.getElementById('tabCargaEfetivaDet').textContent = '% Total em relação à Venda';
  document.getElementById('tabImpostoLiquido').textContent = 'R$ 0,00';
}

function renderResults(data) {
  document.getElementById('badgeRegime').textContent = data.regimeTributario;
  document.getElementById('resPrecoVenda').textContent = formatCurrency(data.saida.precoVendaSugerido);
  document.getElementById('resLucroLiquido').textContent = `${formatCurrency(data.saida.lucroLiquidoValor)} (${data.saida.margemLucroDesejadaPct}%)`;
  document.getElementById('resCustoLiquido').textContent = formatCurrency(data.entrada.custoFormado);
  document.getElementById('resMarkup').textContent = `${data.saida.markupSobreCustoBruto}x`;

  const preco = data.saida.precoVendaSugerido;
  if (preco > 0) {
    const pctCusto = Math.max(0, ((data.entrada.custoFormado / preco) * 100)).toFixed(1);
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

  document.getElementById('tabCustoBruto').textContent = formatCurrency(data.entrada.custoCompra);
  
  const freteEipi = data.entrada.frete + data.entrada.ipi;
  document.getElementById('tabFreteIpiDet').textContent = `Frete: ${formatCurrency(data.entrada.frete)} | IPI: ${formatCurrency(data.entrada.ipi)}`;
  document.getElementById('tabFreteIpi').textContent = formatCurrency(freteEipi);

  if (document.getElementById('tabCustoFormado')) {
    document.getElementById('tabCustoFormado').textContent = formatCurrency(data.entrada.custoFormado);
  }

  // Impostos de Saída (R$ 147,75)
  let textoDetSaida = `${data.saida.cargaTributariaSaidaPct}% sobre R$ ${data.saida.precoVendaSugerido}`;
  const somaFederais = (data.saida.pisPct + data.saida.cofinsPct + data.saida.csllPct + data.saida.irpjPct).toFixed(2);
  if (somaFederais > 0) {
    textoDetSaida += ` (ICMS: ${data.saida.aliquotaIcmsVendaPct}%, Federais: ${somaFederais}%)`;
  }
  document.getElementById('tabSaidaDet').textContent = textoDetSaida;
  document.getElementById('tabImpostoSaida').textContent = formatCurrency(data.saida.impostosSaidaValor);

  // Crédito de ICMS de Entrada (- R$ 23,63)
  document.getElementById('tabCreditoDet').textContent = `${data.entrada.aliquotaEntradaPct}% de ICMS de Origem (${data.ufOrigem})`;
  document.getElementById('tabCreditoIcms').textContent = `- ${formatCurrency(data.entrada.creditoIcmsEntrada)}`;

  // Antecipação Parcial / DIFAL (+ R$ 45,58)
  document.getElementById('tabAntecipacaoDet').textContent = data.entrada.antecipacaoParcial > 0 
    ? `DIFAL Entrada ${data.entrada.aliquotaAntecipacaoPct}% (recolhido na entrada)`
    : `Sem antecipação apurada`;
  document.getElementById('tabAntecipacao').textContent = `+ ${formatCurrency(data.entrada.antecipacaoParcial)}`;

  // CARGA TRIBUTÁRIA EFETIVA TOTAL (= R$ 169,70 = uns 160 e poucos)
  document.getElementById('tabCargaEfetivaDet').textContent = `Impostos Saída - Crédito + Antecipação Parcial`;
  document.getElementById('tabImpostoLiquido').textContent = `${formatCurrency(data.demonstrativoFiscal.impostoTotalEfetivo)} (${data.demonstrativoFiscal.cargaTributariaEfetivaPct}%)`;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function syncUrlParams() {
  const params = new URLSearchParams();
  const fields = [
    'produto', 'ncmInput', 'regimeTributario', 'ufOrigem', 'ufDestino',
    'custoCompra', 'fretePct', 'ipiPct', 'desconto',
    'aliquotaIcmsEntradaOverride', 'creditoIcmsEntradaOverride', 'antecipacaoParcialPct',
    'aliquotaSaidaOverride', 'pisPct', 'cofinsPct', 'csllPct', 'irpjPct',
    'comissaoVendaPct', 'taxaCartaoPct', 'taxaMarketplacePct', 'freteVendaPct', 'montagemPct',
    'despesasVariaveisPct', 'margemLucroDesejadaPct'
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

function loadStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  if ([...params.keys()].length === 0) return;

  params.forEach((val, key) => {
    const el = document.getElementById(key);
    if (el) {
      el.value = val;
    }
  });

  const ncm = document.getElementById('ncmInput').value;
  if (ncm) consultarNcmEspecifico(ncm);

  fetchIcmsRates();
}

function copyShareLink() {
  syncUrlParams();
  const fullUrl = window.location.href;

  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast('Link do simulador copiado! Envie ao contador.');
  }).catch(err => {
    alert('Copie o link da barra de endereço: ' + fullUrl);
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}
