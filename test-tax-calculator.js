const { calcularPrecificacao, obterAliquotaInterestadual, obterAliquotaInterna } = require('./src/services/taxCalculator');

console.log('--- TESTANDO MOTOR TRIBUTÁRIO & ICMS POR ESTADO ---');

// Teste 1: Compra SP -> BA (Interestadual 7%, Interna BA 20.5%)
const c1 = calcularPrecificacao({
  produto: 'Sofa 3 Lugares',
  regimeTributario: 'Simples Nacional',
  ufOrigem: 'SP',
  ufDestino: 'BA',
  custoCompra: 1200,
  frete: 90,
  ipiPct: 0,
  desconto: 0,
  aliquotaSaidaOverride: 8.5,
  despesasVariaveisPct: 8,
  margemLucroDesejadaPct: 18
});

console.log('\n[Cenário 1: SP -> BA]');
console.log('Custo Bruto:', c1.entrada.custoCompra);
console.log('Alíquota ICMS Entrada:', c1.entrada.aliquotaEntradaPct + '%');
console.log('Crédito ICMS Entrada:', c1.entrada.creditoIcmsEntrada);
console.log('Alíquota Antecipação Parcial:', c1.entrada.aliquotaAntecipacaoPct + '%');
console.log('Antecipação Parcial R$:', c1.entrada.antecipacaoParcial);
console.log('Custo Líquido Real:', c1.entrada.custoLiquido);
console.log('Preço de Venda Sugerido:', c1.saida.precoVendaSugerido);
console.log('Lucro Líquido R$:', c1.saida.lucroLiquidoValor);
console.log('Demonstrativo Fiscal (Contador):', c1.demonstrativoFiscal);

// Teste 2: Operação Interna SP -> SP
const c2 = calcularPrecificacao({
  produto: 'Mesa de Jantar',
  regimeTributario: 'Lucro Presumido',
  ufOrigem: 'SP',
  ufDestino: 'SP',
  custoCompra: 1000,
  frete: 50,
  ipiPct: 10,
  despesasVariaveisPct: 5,
  margemLucroDesejadaPct: 20
});

console.log('\n[Cenário 2: SP -> SP Operação Interna]');
console.log('Custo Líquido:', c2.entrada.custoLiquido);
console.log('Preço de Venda Sugerido:', c2.saida.precoVendaSugerido);
console.log('Demonstrativo Fiscal:', c2.demonstrativoFiscal);

console.log('\n✅ TODOS OS CÁLCULOS EXECUTADOS COM SUCESSO!');
