const express = require('express');
const cors = require('cors');
const path = require('path');
const { 
  calcularPrecificacao, 
  ALIQUOTAS_ICMS_ESTADOS, 
  obterAliquotaInterestadual, 
  obterAliquotaInterna 
} = require('./services/taxCalculator');
const { parseNFeXml } = require('./services/nfeParser');
const { buscarNcm, obterNcmPorCodigo } = require('./services/ncmService');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limite para arquivos XML grandes
app.use(express.text({ type: ['text/xml', 'application/xml'], limit: '10mb' }));

// Servir arquivos estáticos do Painel de Testes (Playground)
app.use(express.static(path.join(__dirname, '../public')));

// Middleware de Autenticação (Apenas para rotas de API privadas da aplicação)
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== (process.env.API_KEY || 'dev-secret-key')) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  next();
};

// Rota Pública do Painel de Testes
app.post('/api/tax/calculate-public', (req, res) => {
  try {
    const inputData = req.body;
    const resultado = calcularPrecificacao(inputData);
    res.json({ success: true, data: resultado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota para consulta de NCM via BrasilAPI
app.get('/api/tax/ncm', async (req, res) => {
  try {
    const { search, code } = req.query;
    if (code) {
      const ncm = await obterNcmPorCodigo(code);
      return res.json({ success: true, data: ncm ? [ncm] : [] });
    }
    const ncms = await buscarNcm(search || '');
    res.json({ success: true, data: ncms });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota para Leitura e Parse de XML de NF-e
app.post('/api/tax/parse-xml', (req, res) => {
  try {
    let xmlString = '';
    if (typeof req.body === 'string') {
      xmlString = req.body;
    } else if (req.body && req.body.xml) {
      xmlString = req.body.xml;
    } else {
      return res.status(400).json({ success: false, error: 'XML não fornecido ou em formato inválido.' });
    }

    const resultado = parseNFeXml(xmlString);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para consultar a lista de Estados e Alíquotas Padrão de ICMS
app.get('/api/tax/states', (req, res) => {
  res.json({
    success: true,
    data: {
      aliquotasInternas: ALIQUOTAS_ICMS_ESTADOS,
      estados: Object.keys(ALIQUOTAS_ICMS_ESTADOS).sort()
    }
  });
});

// Helper de consulta de alíquota interestadual
app.get('/api/tax/icms-rate', (req, res) => {
  const { ufOrigem, ufDestino, importado } = req.query;
  const ehImportado = importado === 'true';
  const aliquotaInterestadual = obterAliquotaInterestadual(ufOrigem, ufDestino, ehImportado);
  const aliquotaInterna = obterAliquotaInterna(ufDestino);

  res.json({
    success: true,
    data: {
      ufOrigem,
      ufDestino,
      aliquotaInterestadualPct: Number((aliquotaInterestadual * 100).toFixed(2)),
      aliquotaInternaDestinoPct: Number((aliquotaInterna * 100).toFixed(2)),
      aliquotaAntecipacaoPct: Number((Math.max(0, aliquotaInterna - aliquotaInterestadual) * 100).toFixed(2))
    }
  });
});

// Rotas Autenticadas (Sistema Principal)
app.post('/api/tax/calculate', authenticate, (req, res) => {
  try {
    const inputData = req.body;
    const resultado = calcularPrecificacao(inputData);
    res.json({ success: true, data: resultado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tax/calculate-batch', authenticate, (req, res) => {
  try {
    const inputDataArray = req.body;
    if (!Array.isArray(inputDataArray)) {
      return res.status(400).json({ success: false, error: 'Expected an array of products' });
    }
    
    const results = inputDataArray.map(item => calcularPrecificacao(item));
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'centralsync-nfe-api' });
});

// Fallback SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Painel de Testes & API Tributária rodando na porta ${PORT}`);
  console.log(`🔗 Acesse no navegador: http://localhost:${PORT}`);
});
