import { parseFiscalXml } from './lib/xmlParser.ts';

const xml = `
<cteProc xmlns="http://www.portalfiscal.inf.br/cte" versao="3.00">
  <CTe>
    <infCte>
      <vPrest>
        <vTPrest>6000.00</vTPrest>
      </vPrest>
      <infCTeNorm>
        <infCarga>
          <vCarga>288766.80</vCarga>
        </infCarga>
      </infCTeNorm>
    </infCte>
  </CTe>
</cteProc>
`;

const res = parseFiscalXml(xml);
console.log(res);
