const express = require('express');
const cors = require('cors');
const path = require('path');
const { 
  calcularPrecificacao, 
  ALIQUOTAS_ICMS_ESTADOS, 
  obterAliquotaInterestadual, 
  obterAliquotaInterna 
} = require('./services/taxCalculator');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

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

// Rota Pública do Painel de Testes (Sem necessidade de API Key para o Contador/Usuário testar no navegador)
app.post('/api/tax/calculate-public', (req, res) => {
  try {
    const inputData = req.body;
    const resultado = calcularPrecificacao(inputData);
    res.json({ success: true, data: resultado });
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

// Fallback SPA - Serve index.html do Painel Web para o Contador
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Painel de Testes & API Tributária rodando na porta ${PORT}`);
  console.log(`🔗 Acesse no navegador: http://localhost:${PORT}`);
});
