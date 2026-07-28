const { parseNFeXml } = require('./src/services/nfeParser');

console.log('--- TESTANDO PARSER DE XML DE NFE ---');

const xmlExemplo = `
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe>
      <emit>
        <enderEmit>
          <UF>SP</UF>
        </enderEmit>
      </emit>
      <dest>
        <enderDest>
          <UF>BA</UF>
        </enderDest>
      </dest>
      <det nItem="1">
        <prod>
          <xProd>Xampu 350ml Capilar</xProd>
          <NCM>33051000</NCM>
          <vProd>150.00</vProd>
          <vFrete>12.00</vFrete>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <pICMS>7.00</pICMS>
              <vICMS>11.34</vICMS>
            </ICMS00>
          </ICMS>
          <IPI>
            <IPITrib>
              <pIPI>5.00</pIPI>
              <vIPI>7.50</vIPI>
            </IPITrib>
          </IPI>
        </imposto>
      </det>
    </infNFe>
  </NFe>
</nfeProc>
`;

const res = parseNFeXml(xmlExemplo);
console.log('UF Origem:', res.nfe.ufOrigem);
console.log('UF Destino:', res.nfe.ufDestino);
console.log('Produto:', res.nfe.primeiroItem.produto);
console.log('NCM:', res.nfe.primeiroItem.ncm);
console.log('Custo Compra:', res.nfe.primeiroItem.custoCompra);
console.log('Frete:', res.nfe.primeiroItem.frete);
console.log('IPI %:', res.nfe.primeiroItem.ipiPct);
console.log('ICMS Entrada %:', res.nfe.primeiroItem.aliquotaIcmsEntrada);

console.log('✅ TESTE DE XML CONCLUÍDO COM SUCESSO!');
