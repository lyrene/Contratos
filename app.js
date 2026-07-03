const STORAGE_KEYS = {
  draft: "rental-contract-draft-v2",
  templates: "rental-contract-templates-v2",
  recentValues: "rental-contract-recent-values-v1",
};

const builtInTemplates = [
  {
    id: "residencial-simples-v1",
    name: "Contrato residencial simples",
    format: "text",
    body: `CONTRATO DE LOCAÇÃO RESIDENCIAL

LOCADOR(A): {{locador.nome}}, CPF/CNPJ {{locador.cpf_cnpj}}, residente em {{locador.endereco}}, telefone {{locador.telefone}}.

LOCATÁRIO(A): {{locatario.nome}}, CPF/CNPJ {{locatario.cpf_cnpj}}, residente em {{locatario.endereco}}, telefone {{locatario.telefone}}.

IMÓVEL: {{imovel.endereco}}, tipo {{imovel.tipo}}, com a seguinte descrição: {{imovel.descricao}}.

VALOR E PRAZO: O aluguel mensal será de {{contrato.valor_aluguel}}, com vencimento todo dia {{contrato.dia_vencimento}}. O contrato começa em {{contrato.data_inicio}} e termina em {{contrato.data_fim}}.

GARANTIA: {{contrato.garantia}}.

ENCARGOS: Condomínio: {{contrato.condominio}}. IPTU: {{contrato.iptu}}.

CLÁUSULA COMPLEMENTAR DESTE CONTRATO:
{{contrato.observacao_especifica}}

As partes declaram que leram e concordam com os termos deste contrato.

Local e data: {{contrato.local_data}}

____________________________________
LOCADOR(A)

____________________________________
LOCATÁRIO(A)`,
  },
];

const bundledTemplateFiles = [
  {
    id: "contrato-locacao-imovel-v1",
    name: "Contrato de locação de imóvel",
    format: "text",
    url: "./contrato-locacao-imovel-template.txt",
  },
  {
    id: "aditivo-mudanca-locador-v1",
    name: "Aditivo - mudança de locador",
    format: "text",
    url: "./aditivo-mudanca-locador-template.txt",
  },
  {
    id: "aditivo-renovacao-locacao-v1",
    name: "Aditivo - renovação de locação",
    format: "text",
    url: "./aditivo-renovacao-locacao-template.txt",
  },
];

let templates = loadTemplates();
let selectedTemplate = templates[0];
let formData = loadJson(STORAGE_KEYS.draft, {});
let recentValues = loadJson(STORAGE_KEYS.recentValues, {});
let finalTextEdited = Boolean(formData.__finalTextOverride);

const elements = {
  templateSelect: document.querySelector("#templateSelect"),
  templateFile: document.querySelector("#templateFile"),
  contractForm: document.querySelector("#contractForm"),
  clearFormButton: document.querySelector("#clearFormButton"),
  downloadExampleButton: document.querySelector("#downloadExampleButton"),
  downloadDocxButton: document.querySelector("#downloadDocxButton"),
  printButton: document.querySelector("#printButton"),
  finalEditor: document.querySelector("#finalEditor"),
  fieldTemplate: document.querySelector("#fieldTemplate"),
};

init();

async function init() {
  await loadBundledTemplates();
  renderTemplateOptions();
  renderForm();
  syncFinalEditor({ force: true });
  bindEvents();
}

async function loadBundledTemplates() {
  for (const templateFile of bundledTemplateFiles) {
    if (templates.some((template) => template.id === templateFile.id)) continue;

    try {
      const response = await fetch(templateFile.url);
      if (!response.ok) continue;
      const body = await response.text();
      templates.push({ ...templateFile, body });
    } catch {
      // Local file opening can block fetch. Manual import still works.
    }
  }
}

function bindEvents() {
  elements.templateSelect.addEventListener("change", () => {
    selectedTemplate = templates.find((template) => template.id === elements.templateSelect.value) || templates[0];
    finalTextEdited = false;
    delete formData.__finalTextOverride;
    saveDraft();
    renderForm();
    syncFinalEditor({ force: true });
  });

  elements.templateFile.addEventListener("change", importTemplateFile);

  elements.contractForm.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    if (!field) return;

    formData[field] = event.target.value;
    rememberRecentValue(field, event.target.value);
    saveDraft();
    syncFinalEditor();
  });

  elements.finalEditor.addEventListener("input", () => {
    finalTextEdited = true;
    formData.__finalTextOverride = getEditorText();
    saveDraft();
  });

  elements.clearFormButton.addEventListener("click", () => {
    if (!confirm("Limpar os campos deste formulário? As sugestões recentes continuarão disponíveis.")) return;
    formData = {};
    finalTextEdited = false;
    localStorage.removeItem(STORAGE_KEYS.draft);
    renderForm();
    syncFinalEditor({ force: true });
  });

  elements.downloadExampleButton.addEventListener("click", () => {
    downloadBlob("template-exemplo.txt", new Blob([builtInTemplates[0].body], { type: "text/plain;charset=utf-8" }));
  });

  elements.downloadDocxButton.addEventListener("click", async () => {
    const blob = await buildDocxBlob();
    downloadBlob(`${buildGeneratedFilename()}.docx`, blob);
  });

  elements.printButton.addEventListener("click", () => {
    const originalTitle = document.title;
    document.title = buildGeneratedFilename();
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  });
}

function renderTemplateOptions() {
  elements.templateSelect.innerHTML = "";
  templates.forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    elements.templateSelect.append(option);
  });
  elements.templateSelect.value = selectedTemplate.id;
}

function renderForm() {
  const fields = extractFields(selectedTemplate.body);
  const groupedFields = groupFields(fields);
  elements.contractForm.innerHTML = "";

  Object.entries(groupedFields).forEach(([group, groupFields]) => {
    const heading = document.createElement("h3");
    heading.className = "field-group-title";
    heading.textContent = formatGroupLabel(group);
    elements.contractForm.append(heading);

    groupFields.forEach((field) => {
      const node = elements.fieldTemplate.content.cloneNode(true);
      const label = node.querySelector("label");
      const input = node.querySelector("input");
      const datalist = buildDatalist(field);

      label.textContent = formatFieldLabel(field);
      label.htmlFor = field;
      input.id = field;
      input.name = field;
      input.dataset.field = field;
      input.value = formData[field] || "";
      input.placeholder = exampleForField(field);
      input.autocomplete = "on";

      if (datalist) {
        input.setAttribute("list", datalist.id);
        node.querySelector(".field").append(datalist);
      }

      elements.contractForm.append(node);
    });
  });
}

function syncFinalEditor({ force = false } = {}) {
  if (finalTextEdited && !force) return;
  elements.finalEditor.innerHTML = buildContractHtml();
}

function buildContractText() {
  return selectedTemplate.body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, field) => {
    const value = formData[field];
    return value && value.trim() ? value : `[${formatFieldLabel(field)}]`;
  });
}

function buildContractHtml() {
  const lines = selectedTemplate.body.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim());

  return lines.map((line, index) => {
    if (!line.trim()) return '<div class="doc-blank-line"><br></div>';

    const className = index === firstContentIndex ? "doc-line doc-title" : "doc-line";
    return `<div class="${className}">${templateLineToHtml(line)}</div>`;
  }).join("");
}

function templateLineToHtml(line) {
  let cursor = 0;
  let html = "";
  const matches = line.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g);

  for (const match of matches) {
    html += escapeHtml(line.slice(cursor, match.index));
    const field = match[1];
    const value = formData[field];
    const text = value && value.trim() ? value : `[${formatFieldLabel(field)}]`;
    const className = value && value.trim() ? "filled-value" : "missing-value";
    html += `<span class="${className}" data-field="${escapeHtml(field)}">${escapeHtml(text)}</span>`;
    cursor = match.index + match[0].length;
  }

  html += escapeHtml(line.slice(cursor));
  return html;
}

function getEditorText() {
  return elements.finalEditor.innerText.replace(/\n{3,}/g, "\n\n").trimEnd();
}

function extractFields(templateBody) {
  const matches = templateBody.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g);
  return [...new Set([...matches].map((match) => match[1]))];
}

function groupFields(fields) {
  return fields.reduce((groups, field) => {
    const [group = "geral"] = field.split(".");
    groups[group] ||= [];
    groups[group].push(field);
    return groups;
  }, {});
}

function formatGroupLabel(group) {
  const labels = {
    locador: "Dados do locador",
    locador_original: "Dados do locador original",
    novo_locador: "Dados do novo locador",
    locatario: "Dados do locatário",
    fiador: "Dados do fiador",
    imovel: "Dados do imóvel",
    contrato: "Condições do contrato",
  };
  return labels[group] || humanize(group);
}

function formatFieldLabel(field) {
  return humanize(field.split(".").slice(1).join(" ") || field);
}

function humanize(value) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Cpf Cnpj", "CPF/CNPJ")
    .replace("Cnpj", "CNPJ")
    .replace("Cpf", "CPF")
    .replace("Iptu", "IPTU");
}

function exampleForField(field) {
  const examples = {
    "locador.nome": "Ex.: Imobiliária Silva Ltda.",
    "locador.cnpj": "Ex.: 12.345.678/0001-90",
    "locador.cpf_cnpj": "Ex.: 123.456.789-00",
    "locador.endereco": "Ex.: Rua das Flores, 123, Centro",
    "locador.telefone": "Ex.: (84) 99999-0000",
    "locador.representante_nome": "Ex.: Maria Silva",
    "locador.representante_cpf": "Ex.: 123.456.789-00",
    "locador_original.nome": "Ex.: José Almeida",
    "locador_original.cpf": "Ex.: 123.456.789-00",
    "novo_locador.nome": "Ex.: Imobiliária Silva Ltda.",
    "novo_locador.cnpj": "Ex.: 12.345.678/0001-90",
    "novo_locador.endereco": "Ex.: Rua das Flores, 123, Centro",
    "novo_locador.representante_nome": "Ex.: Maria Silva",
    "novo_locador.representante_cpf": "Ex.: 123.456.789-00",
    "locatario.nome": "Ex.: João Souza",
    "locatario.profissao": "Ex.: professor",
    "locatario.cpf": "Ex.: 987.654.321-00",
    "locatario.cpf_cnpj": "Ex.: 987.654.321-00",
    "locatario.endereco": "Ex.: Av. Brasil, 100, Mossoró/RN",
    "fiador.nome": "Ex.: Ana Oliveira",
    "fiador.profissao": "Ex.: comerciante",
    "fiador.cpf": "Ex.: 111.222.333-44",
    "fiador.cpf_cnpj": "Ex.: 111.222.333-44",
    "fiador.endereco": "Ex.: Rua Principal, 45, Mossoró/RN",
    "imovel.endereco": "Ex.: Rua Projetada, 50, Mossoró/RN",
    "imovel.identificacao": "Ex.: apartamento 302, bloco B",
    "imovel.destinacao_uso": "Ex.: residencial",
    "contrato.valor_aluguel": "Ex.: 1.500,00",
    "contrato.valor_aluguel_extenso": "Ex.: mil e quinhentos reais",
    "contrato.dia_vencimento": "Ex.: 10",
    "contrato.prazo_meses": "Ex.: 12",
    "contrato.novo_prazo_meses": "Ex.: 12",
    "contrato.novo_prazo_extenso": "Ex.: doze",
    "contrato.data_inicio_extenso": "Ex.: 01 de agosto de 2026",
    "contrato.data_fim_extenso": "Ex.: 31 de julho de 2027",
    "contrato.nova_data_inicio_extenso": "Ex.: 01 de agosto de 2026",
    "contrato.nova_data_fim_extenso": "Ex.: 31 de julho de 2027",
    "contrato.data_original_extenso": "Ex.: 01 de agosto de 2025",
    "contrato.garantia": "Ex.: fiança",
    "contrato.local_assinatura": "Ex.: Mossoró",
    "contrato.uf_assinatura": "Ex.: RN",
    "contrato.data_assinatura_extenso": "Ex.: 03 de julho de 2026",
    "contrato.observacao_especifica": "Ex.: Permitido um animal de pequeno porte",
  };
  return examples[field] || `Ex.: ${formatFieldLabel(field).toLowerCase()}`;
}

function buildDatalist(field) {
  const values = recentValues[field] || [];
  if (!values.length) return null;

  const datalist = document.createElement("datalist");
  datalist.id = `suggestions-${field.replace(/[^\w-]/g, "-")}`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    datalist.append(option);
  });
  return datalist;
}

function rememberRecentValue(field, value) {
  const cleanValue = value.trim();
  if (!cleanValue) return;

  const current = recentValues[field] || [];
  recentValues[field] = [cleanValue, ...current.filter((item) => item !== cleanValue)].slice(0, 5);
  saveJson(STORAGE_KEYS.recentValues, recentValues);
}

async function importTemplateFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const importedTemplate = file.name.toLowerCase().endsWith(".docx")
      ? await importDocxTemplate(file)
      : await importTextTemplate(file);

    templates = [...templates, importedTemplate];
    selectedTemplate = importedTemplate;
    finalTextEdited = false;
    delete formData.__finalTextOverride;
    saveJson(STORAGE_KEYS.templates, templates.filter((template) => !isBundledTemplate(template)).map(serializeTemplate));
    saveDraft();
    renderTemplateOptions();
    renderForm();
    syncFinalEditor({ force: true });
  } catch (error) {
    alert(`Não foi possível importar o template: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

async function importTextTemplate(file) {
  return {
    id: `importado-${Date.now()}`,
    name: file.name.replace(/\.(txt|md)$/i, ""),
    format: "text",
    body: await file.text(),
  };
}

async function importDocxTemplate(file) {
  const arrayBuffer = await file.arrayBuffer();
  const entries = await readZipEntries(arrayBuffer);
  const documentEntry = entries.find((entry) => entry.name === "word/document.xml");

  if (!documentEntry) {
    throw new Error("o arquivo .docx não contém word/document.xml");
  }

  const documentXml = decodeText(documentEntry.data);
  const body = documentXmlToText(documentXml);

  if (!extractFields(body).length && !documentXml.includes("{{")) {
    throw new Error("inclua marcadores como {{locador.nome}} dentro do .docx");
  }

  return {
    id: `docx-${Date.now()}`,
    name: file.name.replace(/\.docx$/i, ""),
    format: "docx",
    body,
    entries,
  };
}

function loadTemplates() {
  return [...builtInTemplates, ...loadJson(STORAGE_KEYS.templates, [])];
}

function isBundledTemplate(template) {
  return builtInTemplates.some((item) => item.id === template.id) ||
    bundledTemplateFiles.some((item) => item.id === template.id);
}

function serializeTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    format: "text",
    body: template.body,
  };
}

function saveDraft() {
  saveJson(STORAGE_KEYS.draft, formData);
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function buildDocxBlob() {
  const text = getEditorText() || buildContractText();

  if (finalTextEdited) {
    return createSimpleDocxFromEditor();
  }

  if (selectedTemplate.format === "docx" && selectedTemplate.entries && !finalTextEdited) {
    let rawDocumentXmlHadMarkers = false;
    const replacedEntries = selectedTemplate.entries.map((entry) => {
      if (entry.name !== "word/document.xml") return entry;
      const xml = decodeText(entry.data);
      rawDocumentXmlHadMarkers = xml.includes("{{");
      const replacedXml = styleFirstParagraphXml(replaceTemplateFieldsInDocxXml(xml));
      return { ...entry, data: encodeText(replacedXml) };
    });
    const documentEntry = replacedEntries.find((entry) => entry.name === "word/document.xml");

    if (rawDocumentXmlHadMarkers && documentEntry && !decodeText(documentEntry.data).includes("{{")) {
      return new Blob([writeZipEntries(replacedEntries)], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    }

    return createSimpleDocx(text);
  }

  if (!finalTextEdited) {
  return createSimpleDocxFromTemplate(selectedTemplate.body);
}

  return createSimpleDocx(text);
}

function replaceTemplateFieldsInDocxXml(text) {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, field) => {
    const value = formData[field] || "";
    if (!value.trim()) return "";
    return `</w:t></w:r><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r><w:r><w:t xml:space="preserve">`;
  });
}

function styleFirstParagraphXml(xml) {
  const firstParagraph = xml.match(/<w:p\b[\s\S]*?<\/w:p>/);
  if (!firstParagraph) return xml;

  let styledParagraph = firstParagraph[0];
  if (styledParagraph.includes("<w:pPr>")) {
    styledParagraph = styledParagraph.replace("<w:pPr>", '<w:pPr><w:jc w:val="center"/>');
  } else {
    styledParagraph = styledParagraph.replace(/<w:p\b([^>]*)>/, '<w:p$1><w:pPr><w:jc w:val="center"/></w:pPr>');
  }

  styledParagraph = styledParagraph.replace(/<w:r>/g, "<w:r><w:rPr><w:b/><w:bCs/></w:rPr>");
  return xml.replace(firstParagraph[0], styledParagraph);
}

function createSimpleDocxFromTemplate(templateBody) {
  const documentXml = buildDocumentXmlFromTemplate(templateBody);
  return createDocxFromDocumentXml(documentXml);
}

function createSimpleDocxFromEditor() {
  const documentXml = buildDocumentXmlFromEditor();
  return createDocxFromDocumentXml(documentXml);
}

function createSimpleDocx(text) {
  const documentXml = buildDocumentXml(text);
  return createDocxFromDocumentXml(documentXml);
}

function createDocxFromDocumentXml(documentXml) {
  const entries = [
    {
      name: "[Content_Types].xml",
      data: encodeText(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
    },
    {
      name: "_rels/.rels",
      data: encodeText(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
    },
    {
      name: "word/document.xml",
      data: encodeText(documentXml),
    },
  ];

  return new Blob([writeZipEntries(entries)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function buildDocumentXml(text) {
  const lines = text.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim());
  const paragraphs = lines.map((line, index) => buildParagraphXml([
    { text: line, underline: false },
  ], index === firstContentIndex)).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
  </w:body>
</w:document>`;
}

function buildDocumentXmlFromEditor() {
  const blocks = [...elements.finalEditor.childNodes]
    .map((node) => editorNodeToRuns(node))
    .filter((runs) => runs.length);
  const firstContentIndex = blocks.findIndex((runs) => runs.some((run) => run.text.trim()));
  const paragraphs = blocks.map((runs, index) => buildParagraphXml(runs, index === firstContentIndex)).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
  </w:body>
</w:document>`;
}

function buildDocumentXmlFromTemplate(templateBody) {
  const lines = templateBody.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim());
  const paragraphs = lines.map((line, index) => {
    return buildParagraphXml(templateLineToRuns(line), index === firstContentIndex);
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
  </w:body>
</w:document>`;
}

function templateLineToRuns(line) {
  const runs = [];
  let cursor = 0;
  const matches = line.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g);

  for (const match of matches) {
    if (match.index > cursor) {
      runs.push({ text: line.slice(cursor, match.index), underline: false });
    }

    const field = match[1];
    const value = formData[field];
    runs.push({
      text: value && value.trim() ? value : `[${formatFieldLabel(field)}]`,
      underline: Boolean(value && value.trim()),
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < line.length) {
    runs.push({ text: line.slice(cursor), underline: false });
  }

  return runs.length ? runs : [{ text: "", underline: false }];
}

function buildParagraphXml(runs, isTitle = false) {
  if (!runs.some((run) => run.text.trim())) return "<w:p/>";

  const paragraphProperties = isTitle
    ? '<w:pPr><w:jc w:val="center"/><w:spacing w:after="80" w:before="0" w:line="240" w:lineRule="auto"/></w:pPr>'
    : '<w:pPr><w:spacing w:after="40" w:before="0" w:line="220" w:lineRule="auto"/></w:pPr>';

  const runXml = runs.map((run) => {
    const properties = [
      isTitle ? "<w:b/><w:bCs/>" : "",
      run.underline ? '<w:u w:val="single"/>' : "",
    ].join("");
    const runProperties = properties ? `<w:rPr>${properties}</w:rPr>` : "";
    return `<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
  }).join("");

  return `<w:p>${paragraphProperties}${runXml}</w:p>`;
}

function editorNodeToRuns(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return [{ text: node.textContent || "", underline: false }];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const element = node;
  if (element.matches("br")) return [{ text: "", underline: false }];

  const runs = [];
  element.childNodes.forEach((child) => collectRuns(child, runs, element.classList.contains("filled-value")));
  return runs.length ? runs : [{ text: element.innerText || "", underline: element.classList.contains("filled-value") }];
}

function collectRuns(node, runs, inheritedUnderline = false) {
  if (node.nodeType === Node.TEXT_NODE) {
    runs.push({ text: node.textContent || "", underline: inheritedUnderline });
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node;
  const underline = inheritedUnderline || element.classList.contains("filled-value") || getComputedStyle(element).textDecorationLine.includes("underline");
  element.childNodes.forEach((child) => collectRuns(child, runs, underline));
}

function buildGeneratedFilename() {
  const type = getDocumentTypeSlug();
  const cpf = sanitizeFilenamePart(formData["locatario.cpf"] || formData["locatario.cpf_cnpj"] || "SemCPF");
  const startDate = normalizeDateForFilename(
    formData["contrato.data_inicio_extenso"] ||
    formData["contrato.nova_data_inicio_extenso"] ||
    formData["contrato.data_original_extenso"] ||
    formData["contrato.data_assinatura_extenso"] ||
    "SemData"
  );

  return `${type}_${cpf}_${startDate}`;
}

function getDocumentTypeSlug() {
  if (selectedTemplate.id.includes("mudanca-locador") || selectedTemplate.name.toLowerCase().includes("locador")) {
    return "AditivoLocador";
  }

  if (selectedTemplate.id.includes("aditivo") || selectedTemplate.name.toLowerCase().includes("aditivo")) {
    return "AditivoAluguel";
  }

  return "ContratoAluguel";
}

function sanitizeFilenamePart(value) {
  const text = String(value || "").trim();
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 5) return digits;
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "").slice(0, 40) || "SemInfo";
}

function normalizeDateForFilename(value) {
  const text = String(value || "").trim().toLowerCase();
  const numeric = text.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/);
  if (numeric) return formatDateParts(numeric[1], numeric[2], numeric[3]);

  const months = {
    janeiro: "01",
    fevereiro: "02",
    marco: "03",
    março: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };
  const written = text.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{2,4})/);
  if (written && months[written[2]]) return formatDateParts(written[1], months[written[2]], written[3]);

  return sanitizeFilenamePart(value || "SemData");
}

function formatDateParts(day, month, year) {
  const yyyy = String(year).length === 2 ? `20${year}` : String(year);
  return `${yyyy.padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function documentXmlToText(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return [...doc.getElementsByTagName("w:p")]
    .map((paragraph) => [...paragraph.getElementsByTagName("w:t")].map((text) => text.textContent).join(""))
    .filter((line) => line.trim().length > 0)
    .join("\n\n");
}

async function readZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entries = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("zip inválido");

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = decodeText(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = bytes.slice(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? compressedData : await inflateRaw(compressedData, method);

    entries.push({ name, data });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(bytes) {
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (
      bytes[index] === 0x50 &&
      bytes[index + 1] === 0x4b &&
      bytes[index + 2] === 0x05 &&
      bytes[index + 3] === 0x06
    ) {
      return index;
    }
  }
  throw new Error("arquivo .docx inválido");
}

async function inflateRaw(data, method) {
  if (method !== 8 || typeof DecompressionStream === "undefined") {
    throw new Error("este .docx usa uma compressão não suportada neste navegador");
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function writeZipEntries(entries) {
  const fileParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encodeText(entry.name);
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);

    fileParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectorySize, true);
  endView.setUint32(16, offset, true);

  return concatUint8Arrays([...fileParts, ...centralParts, endHeader]);
}

function concatUint8Arrays(parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = [];
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function encodeText(value) {
  return new TextEncoder().encode(value);
}

function decodeText(value) {
  return new TextDecoder("utf-8").decode(value);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
