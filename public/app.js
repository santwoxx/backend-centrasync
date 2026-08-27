/**
 * Client-Side JavaScript para o Painel de Testes Tributários
 * CentralSync - Simulador de Precificação & Impostos com Abatimentos de ICMS e DIFAL (R$ 47,06)
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

let nfeProductsQueue = [];
let totalItemsValue = 0;
let currentProductIndex = 0;
let savedProductsBatch = [];

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
      // updateCalculations(); <-- REMOVIDO: Agora é feito pelo botão calcular
    });
  });

  const btnCalcularManual = document.getElementById('btnCalcularManual');
  if (btnCalcularManual) {
    btnCalcularManual.addEventListener('click', () => {
      document.getElementById('panelResults').style.display = 'block';
      updateCalculations();
      window.scrollTo({ top: document.getElementById('panelResults').offsetTop, behavior: 'smooth' });
    });
  }

  document.getElementById('ufOrigem').addEventListener('change', fetchIcmsRates);
  document.getElementById('ufDestino').addEventListener('change', fetchIcmsRates);

  document.getElementById('btnShareLink').addEventListener('click', copyShareLink);
  
  const btnSaveNext = document.getElementById('btnSaveAndNext');
  if (btnSaveNext) {
    btnSaveNext.addEventListener('click', saveAndLoadNextProduct);
  }

  const btnExportBatch = document.getElementById('btnExportBatch');
  if (btnExportBatch) {
    btnExportBatch.addEventListener('click', () => {
      if (savedProductsBatch.length === 0) return alert('Nenhum produto salvo ainda.');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedProductsBatch, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "precificacao_lote.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    });
  }
}

function setupModals() {
  document.getElementById('btnOpenConfigModal').addEventListener('click', openIcmsModal);
  document.getElementById('btnExportJson').addEventListener('click', openExportModal);
  
  const btnOpenParam = document.getElementById('btnOpenParamModal');
  if (btnOpenParam) {
    btnOpenParam.addEventListener('click', () => {
      document.getElementById('modalParametrizacao').style.display = 'flex';
    });
  }
}

function closeParamModal() {
  document.getElementById('modalParametrizacao').style.display = 'none';
  showToast('Parâmetros salvos. Faça a importação do XML ou clique em Calcular.');
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

  if (nfe.produtos && nfe.produtos.length > 0) {
    nfeProductsQueue = nfe.produtos;
    currentProductIndex = 0;
    savedProductsBatch = [];
    
    // Mostra info
    const info = document.getElementById('nfeQueueInfo');
    const text = document.getElementById('nfeQueueText');
    if (info && text) {
      info.style.display = 'block';
      text.textContent = `NF-e Importada! Encontrados ${nfe.totalItens} produto(s). Configurando item 1 de ${nfe.totalItens}.`;
      text.style.color = '#0284c7';
      text.style.backgroundColor = 'transparent';
      text.style.borderColor = 'transparent';
    }
    
    // Mostra o botão e tabela
    document.getElementById('multiProductActions').style.display = 'block';
    document.getElementById('savedProductsSection').style.display = 'block';
    document.getElementById('savedProductsTable').querySelector('tbody').innerHTML = '';
    
    totalItemsValue = nfeProductsQueue.reduce((acc, curr) => acc + (curr.vProd || 0), 0);
    
    loadProductIntoForm(nfeProductsQueue[currentProductIndex]);
  } else {
    // Fallback original
    const p = nfe.primeiroItem;
    if (p) loadProductIntoForm(p);
  }

  fetchIcmsRates();
  syncUrlParams();
  document.getElementById('panelResults').style.display = 'none';
  showToast('XML carregado! Ajuste os dados e clique em Calcular.');
}

function loadProductIntoForm(p) {
  if (p.produto || p.xProd) document.getElementById('produto').value = p.produto || p.xProd;
  if (p.ncm) {
    document.getElementById('ncmInput').value = p.ncm;
    consultarNcmEspecifico(p.ncm);
  }
  
  // 1. Rateio do Valor da NF (Custo Base)
  let custo = p.custoCompra !== undefined ? p.custoCompra : p.vUnCom;
  if (custo !== undefined) {
    const pct = parseFloat(document.getElementById('paramNfPctVal').value) || 100;
    if (pct > 0) {
      custo = custo / (pct / 100);
    }
    document.getElementById('custoCompra').value = custo.toFixed(4);
  }
  
  // 2. Rateio do Frete
  const freteXml = p.frete !== undefined ? p.frete : p.vFrete;
  const paramFrete = document.querySelector('input[name="paramFrete"]:checked').value;
  
  document.getElementById('fretePct').value = 0;
  document.getElementById('frete').value = '';
  
  if (paramFrete === 'VALOR_NOTA' && freteXml !== undefined && custo > 0) {
    // Proporcional do XML
    const pctCalculado = ((freteXml / custo) * 100).toFixed(2);
    document.getElementById('fretePct').value = pctCalculado;
  } else if (paramFrete === 'PERCENTUAL') {
    const pct = parseFloat(document.getElementById('paramFretePctVal').value) || 0;
    document.getElementById('fretePct').value = pct;
  } else if (paramFrete === 'VALOR_REAL') {
    // Rateio global proporcional ao peso financeiro do item (valor total)
    const globalFrete = parseFloat(document.getElementById('paramFreteRealVal').value) || 0;
    const fraction = totalItemsValue > 0 ? ((p.vProd || 0) / totalItemsValue) : 0;
    const freteTotalProduto = globalFrete * fraction;
    const freteUnitario = freteTotalProduto / (p.qCom || 1);
    document.getElementById('frete').value = freteUnitario.toFixed(2);
  }
  
  // 3. Demais Despesas (Desconto e Outras)
  const desconto = p.desconto !== undefined ? p.desconto : p.vDesc;
  const paramDesp = document.querySelector('input[name="paramDespesas"]:checked').value;
  
  document.getElementById('desconto').value = 0;
  document.getElementById('outrasDespesasEntrada').value = 0;

  if (paramDesp === 'VALOR_NOTA') {
    if (desconto !== undefined) document.getElementById('desconto').value = desconto;
  } else if (paramDesp === 'VALOR_REAL') {
    // Rateio global proporcional ao peso financeiro do item (valor total)
    const globalDesp = parseFloat(document.getElementById('paramDespesasRealVal').value) || 0;
    const fraction = totalItemsValue > 0 ? ((p.vProd || 0) / totalItemsValue) : 0;
    const despTotalProduto = globalDesp * fraction;
    const despUnitario = despTotalProduto / (p.qCom || 1);
    document.getElementById('outrasDespesasEntrada').value = despUnitario.toFixed(2);
  }
  
  const ipiPct = p.ipiPct !== undefined ? p.ipiPct : p.pIPI;
  if (ipiPct !== undefined) document.getElementById('ipiPct').value = ipiPct;
  
  const icmsPct = p.aliquotaIcmsEntrada !== undefined ? p.aliquotaIcmsEntrada : p.pICMS;
  if (icmsPct !== undefined) document.getElementById('aliquotaIcmsEntradaOverride').value = icmsPct;
  
  const icmsVal = p.creditoIcmsEntrada !== undefined ? p.creditoIcmsEntrada : p.vICMS;
  if (icmsVal !== undefined) document.getElementById('creditoIcmsEntradaOverride').value = icmsVal;
  
  // Atualiza texto do botão
  const btnText = document.getElementById('btnSaveAndNextText');
  if (btnText) {
    btnText.textContent = `Salvar Produto (${currentProductIndex + 1}/${nfeProductsQueue.length}) e Próximo`;
    if (currentProductIndex === nfeProductsQueue.length - 1) {
      btnText.textContent = `Salvar Último Produto (${currentProductIndex + 1}/${nfeProductsQueue.length})`;
    }
  }
}

async function saveAndLoadNextProduct() {
  if (!lastCalculatedData) return;
  
  // Salva no batch
  savedProductsBatch.push(lastCalculatedData);
  
  // Atualiza tabela
  const tbody = document.getElementById('savedProductsTable').querySelector('tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${lastCalculatedData.produto}</td>
    <td>R$ ${lastCalculatedData.entrada.custoLiquido.toFixed(2)}</td>
    <td>R$ ${lastCalculatedData.saida.precoVendaSugerido.toFixed(2)}</td>
    <td>R$ ${lastCalculatedData.saida.lucroLiquidoValor.toFixed(2)} (${lastCalculatedData.saida.margemLucroDesejadaPct}%)</td>
  `;
  tbody.appendChild(tr);
  
  // Avança
  currentProductIndex++;
  if (currentProductIndex < nfeProductsQueue.length) {
    const text = document.getElementById('nfeQueueText');
    if (text) text.textContent = `Configurando item ${currentProductIndex + 1} de ${nfeProductsQueue.length}.`;
    
    loadProductIntoForm(nfeProductsQueue[currentProductIndex]);
    fetchIcmsRates();
    syncUrlParams();
    document.getElementById('panelResults').style.display = 'none'; // Oculta resultados até apertar Calcular
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // Terminou
    document.getElementById('multiProductActions').style.display = 'none';
    const text = document.getElementById('nfeQueueText');
    if (text) {
      text.textContent = '✅ Todos os produtos desta NF-e foram precificados!';
      text.style.color = '#15803d';
      text.parentNode.style.backgroundColor = '#dcfce7';
      text.parentNode.style.borderColor = '#bbf7d0';
    }
  }
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
        hintAntecipacao.textContent = `Difal (Antecipação Parcial ou Substituição Tributária) ${difalPct}% (${ufDestino} ${aliquotaInternaCustom}% - ${data.aliquotaInterestadualPct}%)`;
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
    frete: document.getElementById('frete').value,
    ipiPct: document.getElementById('ipiPct').value,
    desconto: document.getElementById('desconto').value,
    outrasDespesasEntrada: document.getElementById('outrasDespesasEntrada').value,
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
  if (document.getElementById('tabIcmsSaida')) {
    document.getElementById('tabIcmsSaidaDet').textContent = '0,00% sobre R$ 0,00';
    document.getElementById('tabIcmsSaida').textContent = 'R$ 0,00';
  }
  document.getElementById('tabCreditoDet').textContent = 'Aguardando Custo...';
  document.getElementById('tabCreditoIcms').textContent = '- R$ 0,00';
  document.getElementById('tabAntecipacaoDet').textContent = 'Aguardando Custo...';
  document.getElementById('tabAntecipacao').textContent = '- R$ 0,00';
  
  if (document.getElementById('tabIcmsEntradaInterna')) {
    document.getElementById('tabIcmsEntradaInternaDet').textContent = 'Base de Cálculo x Alíquota Interna Destino';
    document.getElementById('tabIcmsEntradaInterna').textContent = '- R$ 0,00';
  }
  
  if (document.getElementById('tabIcmsPagar')) {
    document.getElementById('tabIcmsPagar').textContent = 'R$ 0,00';
  }
  if (document.getElementById('tabFederaisVal')) {
    document.getElementById('tabFederaisVal').textContent = 'R$ 0,00';
  }
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

  // ICMS SOBRE VENDAS ISOLADO (20.5% = R$ 110,75)
  if (document.getElementById('tabIcmsSaida')) {
    const baseIcmsVenda = data.saida.baseIcmsSaidaValor !== undefined ? data.saida.baseIcmsSaidaValor : data.saida.precoVendaSugerido;
    const ipiForaDaBase = data.entrada.ipi > 0 ? ` (venda ${formatCurrency(data.saida.precoVendaSugerido)} - IPI ${formatCurrency(data.entrada.ipi)})` : '';
    document.getElementById('tabIcmsSaidaDet').textContent = `${data.saida.aliquotaIcmsVendaPct}% sobre R$ ${baseIcmsVenda}${ipiForaDaBase}`;
    document.getElementById('tabIcmsSaida').textContent = formatCurrency(data.saida.icmsSaidaValor);
  }

  document.getElementById('tabCreditoDet').textContent = `${data.entrada.aliquotaEntradaPct}% de ICMS de Origem (${data.ufOrigem})`;
  document.getElementById('tabCreditoIcms').textContent = `- ${formatCurrency(data.entrada.creditoIcmsEntrada)}`;

  // ICMS DE ENTRADA (Alíquota Interna Destino)
  if (document.getElementById('tabIcmsEntradaInterna')) {
    const dem = data.demonstrativoFiscal;
    if (dem && dem.aliquotaInternaDestinoPct !== undefined) {
      document.getElementById('tabIcmsEntradaInternaDet').textContent = `Custo Formado do Produto (${formatCurrency(dem.custoFormado)}) x Alíquota Interna Destino (${dem.aliquotaInternaDestinoPct}%)`;
      document.getElementById('tabIcmsEntradaInterna').textContent = `- ${formatCurrency(dem.icmsEntradaAliquotaInternaValor)}`;
    }
  }

  // ANTECIPAÇÃO PARCIAL (13.5% = R$ 47,06)
  document.getElementById('tabAntecipacaoDet').textContent = data.entrada.antecipacaoParcial > 0 
    ? `Difal (Antecipação Parcial ou Substituição Tributária) ${data.entrada.aliquotaAntecipacaoPct}%`
    : `Sem antecipação apurada`;
  document.getElementById('tabAntecipacao').textContent = `- ${formatCurrency(data.entrada.antecipacaoParcial)}`;

  // ICMS A PAGAR (110,75 - 23,63 - 47,06 = R$ 40,06)
  if (document.getElementById('tabIcmsPagar')) {
    document.getElementById('tabIcmsPagar').textContent = formatCurrency(data.demonstrativoFiscal.saldoIcmsRecolher);
  }

  // IMPOSTOS FEDERAIS (R$ 37,01)
  if (document.getElementById('tabFederaisVal')) {
    const somaFederais = (data.saida.pisPct + data.saida.cofinsPct + data.saida.csllPct + data.saida.irpjPct).toFixed(2);
    document.getElementById('tabFederaisDet').textContent = `${somaFederais}% sobre R$ ${data.saida.precoVendaSugerido}`;
    document.getElementById('tabFederaisVal').textContent = formatCurrency(data.saida.impostosFederaisValor);
  }

  // TOTAL DE IMPOSTOS A RECOLHER
  const hasAntecipacao = data.entrada.antecipacaoParcial > 0;
  document.getElementById('tabCargaEfetivaDet').textContent = hasAntecipacao ? `ICMS a Pagar + Impostos Federais + Antecipação Parcial` : `ICMS a Pagar + Impostos Federais`;
  document.getElementById('tabImpostoLiquido').textContent = `${formatCurrency(data.demonstrativoFiscal.totalImpostosRecolher)} (${data.demonstrativoFiscal.cargaTributariaEfetivaPct}%)`;
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
