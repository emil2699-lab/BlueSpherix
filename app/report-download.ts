import { downloadFile } from "./download-file";

export type ReportTable = { title: string; columns: string[]; rows: string[][] };

export function downloadReport(title: string, context: string, tables: ReportTable[], format: "csv" | "html") {
  const file = format === "csv" ? csv(context, tables) : html(title, context, tables);
  downloadFile(file, format === "csv" ? "text/csv;charset=utf-8" : "text/html;charset=utf-8", `bluespherix-performance-demo.${format}`);
}

function csv(context: string, tables: ReportTable[]) {
  const rows = [[context], ...tables.flatMap(table => [[], [table.title], table.columns, ...table.rows])];
  return "\uFEFF" + rows.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(";")).join("\r\n");
}

function html(title: string, context: string, tables: ReportTable[]) {
  const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const body = tables.map(table => `<h2>${escape(table.title)}</h2><table><thead><tr>${table.columns.map(column => `<th scope="col">${escape(column)}</th>`).join("")}</tr></thead><tbody>${table.rows.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`).join("");
  return `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title><style>body{font:14px system-ui;margin:2rem auto;padding:0 1rem;max-width:70rem;color:#152830}table{border-collapse:collapse;width:100%;margin-bottom:2rem}td,th{border-bottom:1px solid #c8d6db;padding:.5rem;text-align:left}th{background:#edf4f5}@media print{tr{break-inside:avoid}}</style><h1>${escape(title)}</h1><p>${escape(context)}</p>${body}</html>`;
}
