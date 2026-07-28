/**
 * Serviço de Integração com BrasilAPI (Consulta de NCM)
 */

async function buscarNcm(query) {
  if (!query || typeof query !== 'string') {
    return [];
  }

  const cleanQuery = query.trim();
  try {
    // Se for busca genérica por termo ou código
    const url = `https://brasilapi.com.br/api/ncm/v1?search=${encodeURIComponent(cleanQuery)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro na BrasilAPI (${response.status})`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error('Erro ao buscar NCM na BrasilAPI:', error.message);
    return [];
  }
}

async function obterNcmPorCodigo(codigo) {
  if (!codigo) return null;
  const cleanCode = codigo.replace(/\D/g, ''); // remove pontos
  try {
    const url = `https://brasilapi.com.br/api/ncm/v1/${cleanCode}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Erro ao consultar NCM específico:', error.message);
    return null;
  }
}

module.exports = {
  buscarNcm,
  obterNcmPorCodigo
};
