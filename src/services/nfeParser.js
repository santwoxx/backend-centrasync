/**
 * Parser de XML de Nota Fiscal Eletrônica (NF-e)
 * Extrai emitente, destinatário, produtos e tributos (ICMS, IPI, PIS, COFINS, NCM)
 */

function extractTagValue(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function extractSection(xml, sectionName) {
  const regex = new RegExp(`<${sectionName}[^>]*>([\\s\\S]*?)</${sectionName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

function extractAllSections(xml, sectionName) {
  const regex = new RegExp(`<${sectionName}[^>]*>([\\s\\S]*?)</${sectionName}>`, 'gi');
  const matches = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

/**
 * Realiza o parse de um XML de NF-e string
 * @param {string} xmlContent 
 */
function parseNFeXml(xmlContent) {
  if (!xmlContent || typeof xmlContent !== 'string') {
    throw new Error('Conteúdo do XML inválido ou vazio.');
  }

  // 1. UF de Origem (Emitente)
  const emitSection = extractSection(xmlContent, 'emit');
  const enderEmit = extractSection(emitSection, 'enderEmit');
  const ufOrigem = extractTagValue(enderEmit, 'UF') || extractTagValue(emitSection, 'UF') || 'SP';

  // 2. UF de Destino (Destinatário)
  const destSection = extractSection(xmlContent, 'dest');
  const enderDest = extractSection(destSection, 'enderDest');
  const ufDestino = extractTagValue(enderDest, 'UF') || extractTagValue(destSection, 'UF') || 'BA';

  // 3. Itens/Produtos (<det>)
  const detSections = extractAllSections(xmlContent, 'det');
  const produtos = [];

  detSections.forEach((detXml, index) => {
    const prodSection = extractSection(detXml, 'prod');
    const impostoSection = extractSection(detXml, 'imposto');

    const xProd = extractTagValue(prodSection, 'xProd') || `Item ${index + 1}`;
    const ncm = extractTagValue(prodSection, 'NCM') || '';
    const vProd = parseFloat(extractTagValue(prodSection, 'vProd') || '0');
    const vFrete = parseFloat(extractTagValue(prodSection, 'vFrete') || '0');
    const vDesc = parseFloat(extractTagValue(prodSection, 'vDesc') || '0');
    const qCom = parseFloat(extractTagValue(prodSection, 'qCom') || '1');
    const vUnCom = parseFloat(extractTagValue(prodSection, 'vUnCom') || (vProd / (qCom || 1)).toString());

    // Valores unitários baseados na quantidade (qCom)
    const qtde = qCom || 1;
    const vFreteUnit = vFrete / qtde;
    const vDescUnit = vDesc / qtde;

    // Impostos
    // IPI
    const ipiSection = extractSection(impostoSection, 'IPI');
    const pIPI = parseFloat(extractTagValue(ipiSection, 'pIPI') || '0');
    const vIPI = parseFloat(extractTagValue(ipiSection, 'vIPI') || '0');
    const vIPIUnit = vIPI / qtde;

    // ICMS
    const icmsSection = extractSection(impostoSection, 'ICMS');
    const pICMS = parseFloat(extractTagValue(icmsSection, 'pICMS') || '0');
    const vICMS = parseFloat(extractTagValue(icmsSection, 'vICMS') || '0');
    const vICMSUnit = vICMS / qtde;
    const vICMSST = parseFloat(extractTagValue(icmsSection, 'vICMSST') || '0');
    const vICMSSTUnit = vICMSST / qtde;
    const pICMSST = parseFloat(extractTagValue(icmsSection, 'pICMSST') || '0');

    // PIS e COFINS
    const pisSection = extractSection(impostoSection, 'PIS');
    const pPIS = parseFloat(extractTagValue(pisSection, 'pPIS') || '0');
    const vPIS = parseFloat(extractTagValue(pisSection, 'vPIS') || '0');
    const vPISUnit = vPIS / qtde;

    const cofinsSection = extractSection(impostoSection, 'COFINS');
    const pCOFINS = parseFloat(extractTagValue(cofinsSection, 'pCOFINS') || '0');
    const vCOFINS = parseFloat(extractTagValue(cofinsSection, 'vCOFINS') || '0');
    const vCOFINSUnit = vCOFINS / qtde;

    produtos.push({
      itemNumber: index + 1,
      xProd,
      ncm,
      vProd, // total
      qCom,
      vUnCom, // unitário (custoCompra)
      vFrete: vFreteUnit,
      vDesc: vDescUnit,
      pIPI,
      vIPI: vIPIUnit,
      pICMS,
      vICMS: vICMSUnit,
      pICMSST,
      vICMSST: vICMSSTUnit,
      pPIS,
      vPIS: vPISUnit,
      pCOFINS,
      vCOFINS: vCOFINSUnit
    });
  });

  // Dados consolidados do primeiro item (para preenchimento automático fácil) ou lista completa
  const primeiroItem = produtos[0] || {};

  return {
    success: true,
    nfe: {
      ufOrigem,
      ufDestino,
      totalItens: produtos.length,
      primeiroItem: {
        produto: primeiroItem.xProd || 'Produto da NFe',
        ncm: primeiroItem.ncm || '',
        custoCompra: primeiroItem.vUnCom || 0,
        frete: primeiroItem.vFrete || 0,
        desconto: primeiroItem.vDesc || 0,
        ipiPct: primeiroItem.pIPI || 0,
        ipiValor: primeiroItem.vIPI || 0,
        aliquotaIcmsEntrada: primeiroItem.pICMS || 0,
        creditoIcmsEntrada: primeiroItem.vICMS || 0,
        pisEntradaPct: primeiroItem.pPIS || 0,
        pisEntradaValor: primeiroItem.vPIS || 0,
        cofinsEntradaPct: primeiroItem.pCOFINS || 0,
        cofinsEntradaValor: primeiroItem.vCOFINS || 0
      },
      produtos
    }
  };
}

module.exports = {
  parseNFeXml
};
