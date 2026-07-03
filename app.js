const STORAGE_KEYS = {
  landlord: "rental-contract-landlord-v1",
  draft: "rental-contract-draft-v1",
  templates: "rental-contract-templates-v1",
};

const builtInTemplates = [
  {
    id: "residencial-simples-v1",
    name: "Contrato residencial simples",
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

let templates = loadTemplates();
let selectedTemplate = templates[0];
let formData = loadJson(STORAGE_KEYS.draft, {});

const elements = {
  templateSelect: document.querySelector("#templateSelect"),
  templateFile: document.querySelector("#templateFile"),
  contractForm: document.querySelector("#contractForm"),
  preview: document.querySelector("#preview"),
  contractNotes: document.querySelector("#contractNotes"),
  saveLandlordButton: document.querySelector("#saveLandlordButton"),
  loadLandlordButton: document.querySelector("#loadLandlordButton"),
  clearAllButton: document.querySelector("#clearAllButton"),
  downloadExampleButton: document.querySelector("#downloadExampleButton"),
  downloadTxtButton: document.querySelector("#downloadTxtButton"),
  copyButton: document.querySelector("#copyButton"),
  printButton: document.querySelector("#printButton"),
  createEditableCopyButton: document.querySelector("#createEditableCopyButton"),
  clearEditableCopyButton: document.querySelector("#clearEditableCopyButton"),
  finalTextEditor: document.querySelector("#finalTextEditor"),
  fieldTemplate: document.querySelector("#fieldTemplate"),
};

init();

function init() {
  renderTemplateOptions();
  renderForm();
  renderPreview();
  bindEvents();
}

function bindEvents() {
  elements.templateSelect.addEventListener("change", () => {
    selectedTemplate = templates.find((template) => template.id === elements.templateSelect.value);
    renderForm();
    renderPreview();
  });

  elements.templateFile.addEventListener("change", importTemplateFile);

  elements.contractForm.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    formData[field] = event.target.value;
    saveJson(STORAGE_KEYS.draft, formData);
    renderPreview();
  });

  elements.contractNotes.addEventListener("input", () => {
    formData["contrato.observacao_especifica"] = elements.contractNotes.value;
    saveJson(STORAGE_KEYS.draft, formData);
    renderPreview();
  });

  elements.finalTextEditor.addEventListener("input", () => {
    formData.__finalTextOverride = elements.finalTextEditor.value;
    saveJson(STORAGE_KEYS.draft, formData);
    renderPreview();
  });

  elements.saveLandlordButton.addEventListener("click", () => {
    const landlordData = Object.fromEntries(
      Object.entries(formData).filter(([key]) => key.startsWith("locador."))
    );
    saveJson(STORAGE_KEYS.landlord, landlordData);
    alert("Dados do locador salvos neste navegador.");
  });

  elements.loadLandlordButton.addEventListener("click", () => {
    formData = { ...formData, ...loadJson(STORAGE_KEYS.landlord, {}) };
    saveJson(STORAGE_KEYS.draft, formData);
    renderForm();
    renderPreview();
  });

  elements.clearAllButton.addEventListener("click", () => {
    if (!confirm("Deseja apagar rascunho, locador salvo e templates importados neste navegador?")) return;
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    templates = [...builtInTemplates];
    selectedTemplate = templates[0];
    formData = {};
    renderTemplateOptions();
    renderForm();
    renderPreview();
  });

  elements.downloadExampleButton.addEventListener("click", () => {
    downloadFile("template-exemplo.txt", builtInTemplates[0].body);
  });

  elements.downloadTxtButton.addEventListener("click", () => {
    downloadFile("contrato-gerado.txt", getOutputText());
  });

  elements.copyButton.addEventListener("click", async () => {
    await copyText(getOutputText());
    alert("Texto copiado.");
  });

  elements.printButton.addEventListener("click", () => window.print());

  elements.createEditableCopyButton.addEventListener("click", () => {
    formData.__finalTextOverride = getOutputText();
    saveJson(STORAGE_KEYS.draft, formData);
    renderFinalTextEditor();
    renderPreview();
  });

  elements.clearEditableCopyButton.addEventListener("click", () => {
    delete formData.__finalTextOverride;
    saveJson(STORAGE_KEYS.draft, formData);
    renderFinalTextEditor();
    renderPreview();
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
      label.textContent = formatFieldLabel(field);
      label.htmlFor = field;
      input.id = field;
      input.name = field;
      input.dataset.field = field;
      input.value = formData[field] || "";
      input.autocomplete = field.startsWith("locador.") ? "on" : "off";
      elements.contractForm.append(node);
    });
  });

  elements.contractNotes.value = formData["contrato.observacao_especifica"] || "";
  renderFinalTextEditor();
}

function renderPreview() {
  elements.preview.textContent = getOutputText();
}

function renderFinalTextEditor() {
  elements.finalTextEditor.value = formData.__finalTextOverride || "";
}

function getOutputText() {
  return formData.__finalTextOverride || buildContractText();
}

function buildContractText() {
  const withData = selectedTemplate.body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, field) => {
    const value = formData[field];
    return value && value.trim() ? value : `[${formatFieldLabel(field)}]`;
  });

  if (
    !selectedTemplate.body.includes("{{contrato.observacao_especifica}}") &&
    formData["contrato.observacao_especifica"]
  ) {
    return `${withData}\n\nOBSERVAÇÃO ESPECÍFICA DESTE CONTRATO:\n${formData["contrato.observacao_especifica"]}`;
  }

  return withData;
}

function extractFields(templateBody) {
  const matches = templateBody.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g);
  return [...new Set([...matches].map((match) => match[1]))].sort();
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
    locatario: "Dados do locatário",
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
    .replace("Iptu", "IPTU");
}

async function importTemplateFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const body = await file.text();
  const importedTemplate = {
    id: `importado-${Date.now()}`,
    name: file.name.replace(/\.(txt|md)$/i, ""),
    body,
  };

  templates = [...templates, importedTemplate];
  selectedTemplate = importedTemplate;
  saveJson(STORAGE_KEYS.templates, templates.filter((template) => !builtInTemplates.some((item) => item.id === template.id)));
  renderTemplateOptions();
  renderForm();
  renderPreview();
  event.target.value = "";
}

function loadTemplates() {
  return [...builtInTemplates, ...loadJson(STORAGE_KEYS.templates, [])];
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

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
