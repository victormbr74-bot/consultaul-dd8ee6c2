import JSZip from "jszip";

import { readExcel, sheetToJson } from "@/lib/excelCompat";

export type KnowledgeBaseImportItem = {
  title: string;
  category: string | null;
  summary: string | null;
  tags: string[];
  content: string;
};

export type KnowledgeBaseRow = {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  content: string;
  tags: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const TEMPLATE_COLUMNS = [
  "Titulo",
  "Categoria",
  "Tela/Contexto",
  "Operadora",
  "Tipo",
  "Gatilhos",
  "Tags",
  "Resumo",
  "Procedimento",
];

const normalizeKey = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

export const normalizeKnowledgeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const firstFilled = (row: Record<string, unknown>, aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeKey);
  for (const [key, value] of Object.entries(row)) {
    if (!normalizedAliases.includes(normalizeKey(key))) continue;
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
};

export const parseKnowledgeTags = (...values: string[]) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => value.split(/[,;\n|]+/))
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );

const buildContent = ({
  context,
  operator,
  type,
  triggers,
  summary,
  procedure,
}: {
  context: string;
  operator: string;
  type: string;
  triggers: string;
  summary: string;
  procedure: string;
}) => {
  const blocks: string[] = [];
  if (summary) blocks.push(`Resumo:\n${summary}`);
  if (context || operator || type || triggers) {
    blocks.push(
      [
        context ? `Contexto: ${context}` : "",
        operator ? `Operadora: ${operator}` : "",
        type ? `Tipo: ${type}` : "",
        triggers ? `Gatilhos: ${triggers}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  blocks.push(`Procedimento:\n${procedure}`);
  return blocks.join("\n\n").trim();
};

const rowToImportItem = (row: Record<string, unknown>): KnowledgeBaseImportItem | null => {
  const title = firstFilled(row, ["Titulo", "Título", "Title", "Nome"]);
  const procedure = firstFilled(row, ["Procedimento", "Passo a passo", "Passos", "Content", "Conteudo", "Conteúdo"]);
  if (!title || !procedure) return null;

  const category = firstFilled(row, ["Categoria", "Category"]);
  const context = firstFilled(row, ["Tela/Contexto", "Tela", "Contexto", "Modulo", "Módulo"]);
  const operator = firstFilled(row, ["Operadora", "Operador", "Provider"]);
  const type = firstFilled(row, ["Tipo", "Tipo de procedimento", "Fluxo"]);
  const triggers = firstFilled(row, ["Gatilhos", "Palavras-chave", "Palavras chave", "Keywords"]);
  const summary = firstFilled(row, ["Resumo", "Descricao", "Descrição"]);

  return {
    title,
    category: category || null,
    summary: summary || null,
    tags: parseKnowledgeTags(firstFilled(row, ["Tags"]), context, operator, type, triggers),
    content: buildContent({ context, operator, type, triggers, summary, procedure }),
  };
};

export const parseKnowledgeBaseXlsx = async (file: File): Promise<KnowledgeBaseImportItem[]> => {
  const workbook = await readExcel(await file.arrayBuffer());
  const sheetName = workbook.SheetNames.find((name) => normalizeKnowledgeText(name).includes("proced")) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = sheetToJson<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map(rowToImportItem).filter(Boolean) as KnowledgeBaseImportItem[];
};

const extractDocxParagraphs = async (file: File) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("text");
  if (!documentXml) throw new Error("DOCX sem word/document.xml.");

  const doc = new DOMParser().parseFromString(documentXml, "application/xml");
  return Array.from(doc.getElementsByTagName("w:p"))
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagName("w:t"))
        .map((node) => node.textContent || "")
        .join(""),
    )
    .map((text) => text.trim())
    .filter(Boolean);
};

const parseDocxBlock = (block: string): KnowledgeBaseImportItem | null => {
  const values: Record<string, string> = {};
  const lines = block.split(/\n+/);
  let activeKey = "";

  for (const line of lines) {
    const match = line.match(/^([^:]{2,40}):\s*(.*)$/);
    if (match) {
      activeKey = normalizeKey(match[1]);
      values[activeKey] = match[2].trim();
      continue;
    }
    if (activeKey) values[activeKey] = [values[activeKey], line].filter(Boolean).join("\n");
  }

  return rowToImportItem({
    Titulo: values.titulo || values.title,
    Categoria: values.categoria || values.category,
    "Tela/Contexto": values.telacontexto || values.tela || values.contexto,
    Operadora: values.operadora,
    Tipo: values.tipo,
    Gatilhos: values.gatilhos || values.palavraschave,
    Tags: values.tags,
    Resumo: values.resumo,
    Procedimento: values.procedimento || values.passoapasso || values.passos,
  });
};

export const parseKnowledgeBaseDocx = async (file: File): Promise<KnowledgeBaseImportItem[]> => {
  const paragraphs = await extractDocxParagraphs(file);
  const blocks = paragraphs
    .join("\n")
    .split(/\n-{3,}\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map(parseDocxBlock).filter(Boolean) as KnowledgeBaseImportItem[];
};

export const parseKnowledgeBaseFile = async (file: File) => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return parseKnowledgeBaseXlsx(file);
  if (name.endsWith(".docx")) return parseKnowledgeBaseDocx(file);
  throw new Error("Formato nao suportado. Use .xlsx ou .docx.");
};

export const knowledgeBaseTemplateColumns = TEMPLATE_COLUMNS;
