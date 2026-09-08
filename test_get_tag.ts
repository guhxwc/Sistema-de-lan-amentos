import { DOMParser } from '@xmldom/xmldom';
const parser = new DOMParser();
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
const doc = parser.parseFromString(xml, "text/xml");

const getTagFromPath = (path: string[], parent?: Element | Document): string | undefined => {
    let current: Element | Document = parent || doc;
    for (let i = 0; i < path.length; i++) {
        const tag = path[i];
        
        const nodes = Array.from(current.childNodes || []).filter(
            (n: any) => n.tagName === tag || n.localName === tag || n.nodeName === tag || n.nodeName.endsWith(`:${tag}`)
        );

        const elements = nodes.length > 0 ? nodes : (current.getElementsByTagName ? Array.from(current.getElementsByTagName(tag)) : []);
        
        if (elements.length === 0) return undefined;
        
        if (i === path.length - 1) {
            return elements[0].textContent || undefined;
        }
        current = elements[0] as Element;
    }
    return undefined;
};

console.log("vCarga:", getTagFromPath(["infCarga", "vCarga"]));
