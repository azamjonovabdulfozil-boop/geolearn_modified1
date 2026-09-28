import { inflateSync, inflateRawSync } from "zlib";

// ── PDF matnini o'qish ────────────────────────────────────────────────────
// pdf-parse (pdf.js) brauzer API'lariga tayanadi va ularni "@napi-rs/canvas"
// native kutubxonasidan oladi. U ko'p muhitlarda (macOS imzo siyosati,
// Render/Vercel, boshqa platformalar) yuklanmaydi va natijada har qanday
// PDF "DOMMatrix is not defined" xatosi bilan o'qilmay qolardi.
//
// Yechim ikki qavatli:
//   1) matn o'qish uchun yetarli bo'lgan sof JS polyfill (rasm chizish
//      kerak emas — bizga faqat matn kerak);
//   2) shunda ham bo'lmasa — PDF ning ichki oqimlarini o'zimiz ochib
//      matnni ajratamiz (zlib + PDF matn operatorlari).

/** pdf.js kutadigan brauzer obyektlarining yengil o'rnini bosuvchilari. */
function ensurePdfPolyfills() {
  if (globalThis.__geoPdfPolyfilled) return;
  globalThis.__geoPdfPolyfilled = true;

  class Matrix {
    constructor(init) {
      let a = 1, b = 0, c = 0, d = 1, e = 0, f = 0;
      if (typeof init === "string") {
        const nums = init.match(/-?\d*\.?\d+/g)?.map(Number);
        if (nums?.length === 6) [a, b, c, d, e, f] = nums;
      } else if (Array.isArray(init)) {
        if (init.length === 6) [a, b, c, d, e, f] = init;
        else if (init.length === 16) { a = init[0]; b = init[1]; c = init[4]; d = init[5]; e = init[12]; f = init[13]; }
      } else if (init && typeof init === "object") {
        ({ a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 } = init);
      }
      this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
      this.m11 = a; this.m12 = b; this.m13 = 0; this.m14 = 0;
      this.m21 = c; this.m22 = d; this.m23 = 0; this.m24 = 0;
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
      this.m41 = e; this.m42 = f; this.m43 = 0; this.m44 = 1;
      this.is2D = true;
      this.isIdentity = a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0;
    }
    static fromMatrix(o) { return new Matrix(o); }
    static fromFloat32Array(a) { return new Matrix(Array.from(a)); }
    static fromFloat64Array(a) { return new Matrix(Array.from(a)); }
    multiply(o) {
      const x = o instanceof Matrix ? o : new Matrix(o);
      return new Matrix([
        this.a * x.a + this.c * x.b,
        this.b * x.a + this.d * x.b,
        this.a * x.c + this.c * x.d,
        this.b * x.c + this.d * x.d,
        this.a * x.e + this.c * x.f + this.e,
        this.b * x.e + this.d * x.f + this.f,
      ]);
    }
    multiplySelf(o) { return this.multiply(o); }
    preMultiplySelf(o) { return new Matrix(o).multiply(this); }
    translate(tx = 0, ty = 0) { return this.multiply(new Matrix([1, 0, 0, 1, tx, ty])); }
    translateSelf(tx, ty) { return this.translate(tx, ty); }
    scale(sx = 1, sy = sx) { return this.multiply(new Matrix([sx, 0, 0, sy, 0, 0])); }
    scaleSelf(sx, sy) { return this.scale(sx, sy); }
    rotate(deg = 0) {
      const r = (deg * Math.PI) / 180;
      return this.multiply(new Matrix([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]));
    }
    rotateSelf(deg) { return this.rotate(deg); }
    inverse() {
      const det = this.a * this.d - this.b * this.c;
      if (!det) return new Matrix();
      return new Matrix([
        this.d / det, -this.b / det, -this.c / det, this.a / det,
        (this.c * this.f - this.d * this.e) / det,
        (this.b * this.e - this.a * this.f) / det,
      ]);
    }
    invertSelf() { return this.inverse(); }
    transformPoint(p = { x: 0, y: 0 }) {
      return { x: this.a * (p.x || 0) + this.c * (p.y || 0) + this.e,
               y: this.b * (p.x || 0) + this.d * (p.y || 0) + this.f, z: 0, w: 1 };
    }
    toFloat32Array() { return new Float32Array([this.a, this.b, 0, 0, this.c, this.d, 0, 0, 0, 0, 1, 0, this.e, this.f, 0, 1]); }
    toFloat64Array() { return new Float64Array(this.toFloat32Array()); }
    toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; }
  }

  class PathStub {
    constructor() {}
    addPath() {} moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {}
    closePath() {} rect() {} roundRect() {} arc() {} arcTo() {} ellipse() {}
  }

  class ImageDataStub {
    constructor(w = 1, h = 1) {
      if (w instanceof Uint8ClampedArray) { this.data = w; this.width = h || 1; this.height = 1; return; }
      this.width = w; this.height = h;
      this.data = new Uint8ClampedArray(Math.max(1, w * h * 4));
    }
  }

  globalThis.DOMMatrix ??= Matrix;
  globalThis.DOMMatrixReadOnly ??= Matrix;
  globalThis.WebKitCSSMatrix ??= Matrix;
  globalThis.DOMPoint ??= class { constructor(x = 0, y = 0, z = 0, w = 1) { Object.assign(this, { x, y, z, w }); } };
  globalThis.DOMRect ??= class { constructor(x = 0, y = 0, width = 0, height = 0) { Object.assign(this, { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height }); } };
  globalThis.Path2D ??= PathStub;
  globalThis.ImageData ??= ImageDataStub;
}

// ── 2-qavat: PDF ni o'zimiz ochib matn ajratish ───────────────────────────
// pdf.js umuman ishlamagan holat uchun zaxira. PDF ichidagi siqilgan
// oqimlar (FlateDecode) ochiladi va matn operatorlari (Tj, TJ, ', ")
// bo'yicha matn yig'iladi.


/** PDF ichidagi barcha oqimlarni ochib, matnli bo'lganlarini qaytaradi. */
function decodeStreams(buffer) {
  const bin = buffer.toString("latin1");
  const out = [];
  let pos = 0;

  while (pos < bin.length && out.length < 5000) {
    const idx = bin.indexOf("stream", pos);
    if (idx === -1) break;
    // "endstream" ni "stream" deb olib qo'ymaymiz
    if (bin.slice(idx - 3, idx) === "end") { pos = idx + 6; continue; }

    let start = idx + 6;
    if (bin[start] === "\r") start++;
    if (bin[start] === "\n") start++;
    const end = bin.indexOf("endstream", start);
    if (end === -1) break;
    pos = end + 9;

    const dict = bin.slice(Math.max(0, idx - 600), idx);
    if (/\/Image\b|\/DCTDecode|\/JPXDecode|\/CCITTFaxDecode/.test(dict)) continue;

    const raw = buffer.subarray(start, end);
    let data = null;
    if (/\/FlateDecode/.test(dict)) {
      for (const fn of [inflateSync, inflateRawSync]) {
        try { data = fn(raw); break; } catch {}
      }
      if (!data) continue;
    } else if (/\/Filter/.test(dict)) {
      continue;                       // LZW, ASCII85 va h.k. — qo'llab-quvvatlanmaydi
    } else {
      data = raw;
    }

    const text = data.toString("latin1");
    if (/\bBT\b/.test(text) && /T[Jj]/.test(text)) out.push(text);
  }
  return out;
}

/** PDF hex-satrini matnga aylantiradi (Identity-H uchun UTF-16BE). */
function hexToText(hex) {
  const h = hex.replace(/[^0-9A-Fa-f]/g, "");
  if (!h.length) return "";
  if (h.length % 4 === 0) {
    let s = "";
    let looksUtf16 = false;
    for (let i = 0; i < h.length; i += 4) {
      const code = parseInt(h.slice(i, i + 4), 16);
      if (code > 0xff) looksUtf16 = true;
      s += String.fromCharCode(code);
    }
    // Ko'p PDF larda 4 xonali kodlar UTF-16BE bo'ladi; aks holda bayt-bayt
    if (looksUtf16 || /^(00[0-9A-Fa-f]{2})+$/.test(h)) return s;
  }
  let s = "";
  for (let i = 0; i + 1 < h.length; i += 2) s += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  return s;
}

const ESCAPES = { n: "\n", r: "\n", t: " ", b: "", f: "", "(": "(", ")": ")", "\\": "\\" };

/** Oqim ichidagi matn operatorlarini o'qib, matnni yig'adi. */
function textFromStream(s) {
  let out = "";
  let pending = [];
  let nums = [];
  let lastY = null;
  let i = 0;

  const flush = (newline) => {
    if (pending.length) { out += pending.join(""); pending = []; }
    if (newline && !out.endsWith("\n")) out += "\n";
  };

  while (i < s.length) {
    const ch = s[i];

    // ( ... ) satri — ichkarida qavslar bo'lishi mumkin
    if (ch === "(") {
      let depth = 1, j = i + 1, str = "";
      while (j < s.length && depth > 0) {
        const c = s[j];
        if (c === "\\") {
          const nxt = s[j + 1];
          if (nxt >= "0" && nxt <= "7") {
            const oct = s.slice(j + 1, j + 4).match(/^[0-7]{1,3}/)?.[0] || "0";
            str += String.fromCharCode(parseInt(oct, 8));
            j += 1 + oct.length;
          } else if (nxt === "\n" || nxt === "\r") { j += 2; }
          else { str += ESCAPES[nxt] ?? nxt; j += 2; }
          continue;
        }
        if (c === "(") depth++;
        else if (c === ")") { depth--; if (!depth) { j++; break; } }
        str += c;
        j++;
      }
      pending.push(str);
      i = j;
      continue;
    }

    // << ... >> lug'ati — matn emas
    if (ch === "<" && s[i + 1] === "<") { i += 2; continue; }

    // <hex> satri
    if (ch === "<") {
      const j = s.indexOf(">", i);
      if (j === -1) break;
      pending.push(hexToText(s.slice(i + 1, j)));
      i = j + 1;
      continue;
    }

    // Raqamlar — TJ ichidagi katta oraliq so'z ajratgichi bo'ladi
    if (ch === "-" || ch === "." || (ch >= "0" && ch <= "9")) {
      let j = i;
      while (j < s.length && /[-.\d]/.test(s[j])) j++;
      const n = parseFloat(s.slice(i, j));
      if (!Number.isNaN(n)) {
        nums.push(n);
        if (nums.length > 6) nums.shift();
        if (pending.length && n <= -120) pending.push(" ");
      }
      i = j;
      continue;
    }

    // Operator
    if (/[A-Za-z'"*]/.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9*'"]/.test(s[j])) j++;
      const op = s.slice(i, j);
      i = j;

      if (op === "Tj" || op === "TJ") { flush(false); }
      else if (op === "'" || op === '"') { flush(true); }
      else if (op === "T*" || op === "TD") { flush(true); }
      else if (op === "Td") {
        // Faqat satr o'zgarganda yangi qator (bir qatordagi so'zlar birga qolsin)
        const ty = nums.at(-1) ?? 0;
        flush(Math.abs(ty) > 0.6);
        if (Math.abs(ty) <= 0.6) pending.push(" ");
      }
      else if (op === "Tm") {
        const y = nums.at(-1);
        const moved = lastY === null || (typeof y === "number" && Math.abs(y - lastY) > 0.6);
        flush(moved);
        if (typeof y === "number") lastY = y;
      }
      else if (op === "ET" || op === "BT") { flush(true); }
      nums = [];
      continue;
    }

    i++;
  }
  flush(false);
  return out;
}

/** Matn haqiqiy so'zlardan iboratmi (buzuq kodlash emasmi)? */
function looksLikeText(text) {
  const letters = (text.match(/\p{L}/gu) || []).length;
  if (letters < 40) return false;
  const words = text.match(/\p{L}{3,}/gu) || [];
  return letters / text.length > 0.35 && words.length >= 15;
}

/** Zaxira yo'l: PDF oqimlaridan matnni o'zimiz ajratamiz. */
export function rawPdfPages(buffer) {
  const pages = decodeStreams(buffer)
    .map(textFromStream)
    .map(t => t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean);
  const joined = pages.join("\n");
  return looksLikeText(joined) ? pages : [];
}

// ── Asosiy kirish nuqtasi ────────────────────────────────────────────────

/**
 * PDF dan sahifa matnlarini o'qiydi.
 * @returns {Promise<{pages: string[], method: string, error: string|null}>}
 */
export async function readPdf(buffer) {
  ensurePdfPolyfills();

  let error = null;
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const pages = Array.isArray(result?.pages) && result.pages.length
        ? result.pages.map(p => String(p?.text || ""))
        : String(result?.text || "").split(/\n\s*--\s*\d+\s+of\s+\d+\s*--\s*\n/);
      const clean = pages.map(p => p.replace(/\r/g, "\n")).filter(p => p.trim());
      if (clean.join("").trim().length >= 30) return { pages: clean, method: "pdfjs", error: null };
      error = "empty";           // matn qatlami yo'q (skaner qilingan PDF)
    } finally {
      await parser.destroy().catch(() => {});
    }
  } catch (e) {
    error = e?.message || String(e);
    console.log("pdf.js o'qiy olmadi:", error);
  }

  // Zaxira: oqimlarni o'zimiz ochamiz
  try {
    const pages = rawPdfPages(buffer);
    if (pages.length) return { pages, method: "raw", error: null };
  } catch (e) {
    console.log("Zaxira PDF o'qish xatosi:", e.message);
  }

  return { pages: [], method: "none", error };
}

/** Eski interfeys — faqat sahifalar ro'yxati. */
export async function extractPdfPages(buffer) {
  const { pages } = await readPdf(buffer);
  return pages;
}
