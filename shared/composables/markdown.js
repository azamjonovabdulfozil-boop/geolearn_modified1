// AI javoblari Markdown ko'rinishida keladi (**qalin**, ro'yxatlar, sarlavhalar).
// Tashqi kutubxonasiz, xavfsiz (HTML escape qilingan) minimal render.

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
}

function isTableRow(line) { return /^\s*\|.*\|\s*$/.test(line); }
function isTableDivider(line) { return /^\s*\|[\s:|-]+\|\s*$/.test(line); }
function tableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
}

export function renderMarkdown(text) {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let list = null; // "ul" | "ol" | null

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();

    if (!line.trim()) { closeList(); continue; }

    // Jadval: | a | b |
    if (isTableRow(line) && isTableRow(lines[i + 1] ?? "")) {
      closeList();
      const header = tableCells(line);
      let j = i + 1;
      if (isTableDivider(lines[j])) j++;
      const rows = [];
      while (j < lines.length && isTableRow(lines[j])) { rows.push(tableCells(lines[j])); j++; }
      out.push('<div class="md-table-wrap"><table>');
      out.push(`<thead><tr>${header.map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead>`);
      out.push(`<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`);
      out.push("</table></div>");
      i = j - 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      out.push(`<p class="md-h">${inline(heading[2])}</p>`);
      continue;
    }

    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ul) {
      if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (ol) {
      if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inline(ol[2])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join("");
}
