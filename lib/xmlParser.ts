export interface MdfeCteRef {
  chCTe: string; // chave de acesso completa (44 dígitos)
  cte_number: string; // número do CT-e extraído da chave (sem zeros à esquerda)
}

export interface ParsedXmlData {
  type: "CTe" | "MDFe" | "NFe" | "Unknown";
  cte?: string;
  nfe?: string;
  mdfe?: string;
  mdfe_key?: string;
  date?: string;
  client?: string;
  origin?: string;
  destination?: string;
  uf_origin?: string;
  uf_destination?: string;
  toll_value?: number;
  cargo_value?: number;
  total_value?: number;
  contract_value?: number; // MDF-e: infANTT/infPag/vContrato — valor contratado com o transportador
  weight?: number;
  driver?: string;
  driver_cpf?: string;
  license_plate?: string;
  delivery_location?: string;
  company?: string;
  cte_list?: MdfeCteRef[]; // MDF-e: CT-e(s) referenciados no manifesto
}

// Extrai o número do CT-e (nCT) a partir da chave de acesso de 44 dígitos.
// Layout: cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nCT(9) + tpEmis(1) + cCT(8) + cDV(1)
export function getCteNumberFromChave(chave: string): string {
  const clean = (chave || "").replace(/\D/g, "");
  if (clean.length !== 44) return "";
  const nCT = clean.substring(25, 34);
  return String(parseInt(nCT, 10));
}

export function parseFiscalXml(xmlString: string): ParsedXmlData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  const data: ParsedXmlData = { type: "Unknown" };

  // Helper to safely get tag content without crashing if tag doesn't exist.
  // It searches globally in doc or locally if parent is provided.
  const getTagContent = (
    tagName: string,
    parent?: Element | Document,
  ): string | undefined => {
    const p = parent || doc;
    const elements = p.querySelectorAll(
      tagName.includes(":") ? tagName : `*[localName="${tagName}"], ${tagName}`,
    );
    if (elements.length > 0) return elements[0].textContent || undefined;
    return undefined;
  };

  // Navigate through path for safer local extractions
  const getTagFromPath = (
    path: string[],
    parent?: Element | Document,
  ): string | undefined => {
    let current: Element | Document = parent || doc;
    for (let i = 0; i < path.length; i++) {
      const tag = path[i];

      // Find children with this tag
      const nodes = Array.from(current.children || []).filter(
        (n) =>
          n.tagName === tag ||
          n.localName === tag ||
          n.nodeName === tag ||
          n.nodeName.endsWith(`:${tag}`),
      );

      // Fallback to elements by tag name if direct children not found
      // Only if we are not strict about path
      const elements =
        nodes.length > 0
          ? nodes
          : current.getElementsByTagName
            ? Array.from(current.getElementsByTagName(tag))
            : [];

      if (elements.length === 0) return undefined;

      if (i === path.length - 1) {
        return elements[0].textContent || undefined;
      }
      current = elements[0] as Element;
    }
    return undefined;
  };

  // Determine type
  if (
    doc.getElementsByTagName("infMDFe").length > 0 ||
    doc.getElementsByTagName("MDFe").length > 0
  ) {
    data.type = "MDFe";
  } else if (
    doc.getElementsByTagName("infCte").length > 0 ||
    doc.getElementsByTagName("CTe").length > 0
  ) {
    data.type = "CTe";
  } else if (
    doc.getElementsByTagName("infNFe").length > 0 ||
    doc.getElementsByTagName("NFe").length > 0
  ) {
    data.type = "NFe";
  }

  // -------------------------
  // Common
  // -------------------------
  const dhEmi = getTagContent("dhEmi");
  if (dhEmi) {
    data.date = dhEmi.split("T")[0];
  }

  // -------------------------
  // CTe Extraction
  // -------------------------
  if (data.type === "CTe") {
    data.cte = getTagContent("nCT");
    data.total_value = parseFloat(getTagContent("vTPrest") || "0") || 0;

    data.origin =
      getTagFromPath(["rem", "xMun"]) || getTagContent("xMunIni") || "";
    data.destination =
      getTagFromPath(["dest", "xMun"]) || getTagContent("xMunFim") || "";

    // UF de início/fim da prestação (usadas no cálculo de ICMS e seguro RCTR-C)
    data.uf_origin =
      (
        getTagContent("UFIni") ||
        getTagFromPath(["rem", "enderReme", "UF"]) ||
        ""
      ).toUpperCase() || undefined;
    data.uf_destination =
      (
        getTagContent("UFFim") ||
        getTagFromPath(["dest", "enderDest", "UF"]) ||
        ""
      ).toUpperCase() || undefined;

    // Pedágio: soma os componentes de vPrest cujo nome contenha "PEDAGIO"
    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
    const compNodes = Array.from(doc.getElementsByTagName("Comp"));
    let tollSum = 0;
    compNodes.forEach((comp) => {
      const xNome = comp.getElementsByTagName("xNome")[0]?.textContent || "";
      if (normalize(xNome).includes("PEDAGIO")) {
        const vComp = parseFloat(
          comp.getElementsByTagName("vComp")[0]?.textContent || "0",
        );
        if (!isNaN(vComp)) tollSum += vComp;
      }
    });
    if (tollSum > 0) data.toll_value = tollSum;

    // Resolve tomador (toma3 / toma4) - O cliente é o tomador do frete
    let tomadorName = "";

    // 1. Verificar se existe <toma4> (Tomador especificado diretamente)
    const toma4Nodes = doc.getElementsByTagName("toma4");
    if (toma4Nodes.length > 0) {
      const xNomeNode = toma4Nodes[0].getElementsByTagName("xNome")[0];
      if (xNomeNode && xNomeNode.textContent) {
        tomadorName = xNomeNode.textContent;
      }
    }

    // 2. Se não encontrou, verificar <toma3> que indica por código quem é o tomador
    if (!tomadorName) {
      const toma3Nodes = doc.getElementsByTagName("toma3");
      if (toma3Nodes.length > 0) {
        const tomaNode = toma3Nodes[0].getElementsByTagName("toma")[0];
        if (tomaNode && tomaNode.textContent) {
          const tomaCode = tomaNode.textContent.trim();
          if (tomaCode === "0") {
            // 0 - Remetente (rem)
            const remNodes = doc.getElementsByTagName("rem");
            if (remNodes.length > 0)
              tomadorName =
                remNodes[0].getElementsByTagName("xNome")[0]?.textContent || "";
          } else if (tomaCode === "1") {
            // 1 - Expedidor (exped)
            const expedNodes = doc.getElementsByTagName("exped");
            if (expedNodes.length > 0)
              tomadorName =
                expedNodes[0].getElementsByTagName("xNome")[0]?.textContent ||
                "";
          } else if (tomaCode === "2") {
            // 2 - Recebedor (receb)
            const recebNodes = doc.getElementsByTagName("receb");
            if (recebNodes.length > 0)
              tomadorName =
                recebNodes[0].getElementsByTagName("xNome")[0]?.textContent ||
                "";
          } else if (tomaCode === "3") {
            // 3 - Destinatário (dest)
            const destNodes = doc.getElementsByTagName("dest");
            if (destNodes.length > 0)
              tomadorName =
                destNodes[0].getElementsByTagName("xNome")[0]?.textContent ||
                "";
          }
        }

        // Se <toma3> possuir tag <xNome> diretamente
        if (!tomadorName) {
          tomadorName =
            toma3Nodes[0].getElementsByTagName("xNome")[0]?.textContent || "";
        }
      }
    }

    // 3. Fallbacks se não achou o tomador por código ou nome específico
    if (!tomadorName) {
      tomadorName =
        getTagFromPath(["dest", "xNome"]) ||
        getTagFromPath(["rem", "xNome"]) ||
        "";
    }

    data.client = tomadorName;
    data.company = getTagFromPath(["rem", "xNome"]);
    data.delivery_location =
      getTagFromPath(["receb", "xNome"]) || getTagFromPath(["dest", "xNome"]);

    const qCarga = getTagFromPath(["infQ", "qCarga"]);
    const pesoTags = Array.from(doc.getElementsByTagName("infQ"));
    const pesoBNode = pesoTags.find((el) => {
      const tpMed = el.getElementsByTagName("tpMed")[0];
      return tpMed && tpMed.textContent === "PESO BRUTO";
    });
    const pesoB = pesoBNode
      ? pesoBNode.getElementsByTagName("qCarga")[0]?.textContent
      : null;

    data.weight = parseFloat(pesoB || qCarga || "0");

    const infNFeElements = Array.from(doc.getElementsByTagName("infNFe"));
    const nfeNumbers: string[] = [];
    infNFeElements.forEach((infNFe) => {
      const chaveNode = infNFe.getElementsByTagName("chave")[0];
      if (chaveNode && chaveNode.textContent && chaveNode.textContent.length === 44) {
        const nNfe = chaveNode.textContent.substring(25, 34);
        nfeNumbers.push(parseInt(nNfe, 10).toString());
      }
    });

    if (nfeNumbers.length > 0) {
      data.nfe = nfeNumbers.join(", ");
    }

    const vCargaAverb = getTagFromPath(["infCarga", "vCargaAverb"]);
    const vCarga = getTagFromPath(["infCarga", "vCarga"]);
    const cargoValueRaw = vCarga || vCargaAverb;
    if (cargoValueRaw) {
      const parsedCargo = parseFloat(cargoValueRaw);
      if (!isNaN(parsedCargo) && parsedCargo > 0) {
        data.cargo_value = parsedCargo;
      }
    }
  }

  // -------------------------
  // NFe Extraction
  // -------------------------
  if (data.type === "NFe") {
    let nNf = getTagContent("nNF");
    if (nNf) data.nfe = parseInt(nNf, 10).toString();

    const vNF =
      parseFloat(getTagFromPath(["ICMSTot", "vNF"]) || "0") ||
      parseFloat(getTagContent("vNF") || "0");
    data.cargo_value = vNF;
    data.total_value = vNF;

    data.weight = parseFloat(
      getTagContent("pesoB") || getTagContent("pesoL") || "0",
    );

    data.company = getTagFromPath(["emit", "xNome"]);
    data.delivery_location = getTagFromPath(["dest", "xNome"]);
    data.origin = getTagFromPath(["emit", "xMun"]);
    data.destination = getTagFromPath(["dest", "xMun"]);
    data.client = getTagFromPath(["dest", "xNome"]);
  }

  // -------------------------
  // MDFe Extraction
  // -------------------------
  if (data.type === "MDFe") {
    data.mdfe = getTagContent("nMDF");
    data.mdfe_key =
      getTagContent("chMDFe") ||
      doc.getElementsByTagName("infMDFe")[0]?.getAttribute("Id")?.replace(/^MDFe/, "") ||
      undefined;
    data.origin = getTagContent("xMunCarrega") || "";
    data.destination = getTagContent("xMunDescarga") || "";

    data.uf_origin = (getTagContent("UFIni") || "").toUpperCase() || undefined;
    data.uf_destination = (getTagContent("UFFim") || "").toUpperCase() || undefined;

    data.driver =
      getTagFromPath(["condutor", "xNome"]) ||
      getTagFromPath(["moto", "xNome"]) ||
      getTagFromPath(["prop", "xNome"]);
    data.driver_cpf = getTagFromPath(["condutor", "CPF"]);
    data.license_plate =
      getTagFromPath(["veicTracao", "placa"]) ||
      getTagFromPath(["veic", "placa"]) ||
      getTagContent("placa");

    data.total_value = parseFloat(
      getTagFromPath(["tot", "vCarga"]) || getTagContent("vCarga") || "0",
    );
    data.weight = parseFloat(
      getTagFromPath(["tot", "qCarga"]) || getTagContent("qCarga") || "0",
    );

    // Data de início da viagem (usada como data do lançamento do frete de terceiro)
    const dhIniViagem = getTagContent("dhIniViagem");
    if (dhIniViagem) data.date = dhIniViagem.split("T")[0];

    // Pedágio: soma de todos os <disp><vValePed> dentro de valePed
    const dispNodes = Array.from(doc.getElementsByTagName("disp"));
    let tollSum = 0;
    dispNodes.forEach((disp) => {
      const v = parseFloat(disp.getElementsByTagName("vValePed")[0]?.textContent || "0");
      if (!isNaN(v)) tollSum += v;
    });
    if (tollSum > 0) data.toll_value = tollSum;

    // Valor contratado com o transportador (infANTT/infPag/vContrato) — sugestão para
    // o valor pago ao motorista/terceiro
    const vContrato = getTagFromPath(["infPag", "vContrato"]);
    if (vContrato) {
      const parsed = parseFloat(vContrato);
      if (!isNaN(parsed) && parsed > 0) data.contract_value = parsed;
    }

    // CT-e(s) referenciados no manifesto — podem existir vários <infMunDescarga>,
    // cada um com um ou mais <infCTe><chCTe>
    const chCteNodes = Array.from(doc.getElementsByTagName("chCTe"));
    const cteList: MdfeCteRef[] = [];
    chCteNodes.forEach((node) => {
      const chCTe = (node.textContent || "").trim();
      if (chCTe) {
        cteList.push({ chCTe, cte_number: getCteNumberFromChave(chCTe) });
      }
    });
    if (cteList.length > 0) data.cte_list = cteList;

    // Se houver informacoes do CTE no MDFe e a gente precisar como CTE
    // ou destinatario de MDF-e pode ter coisas
    const emissor = getTagFromPath(["emit", "xNome"]);
    if (!data.client) data.client = emissor;
  }

  return data;
}
