import { STORES, add, getAll, getCategories } from "./db.js";
import { todayStr, nowTimeStr } from "./dates.js";
import { toast } from "./ui.js";

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(h) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mapRow(headers, values) {
  const row = {};
  headers.forEach((h, i) => { row[h] = values[i] || ""; });
  return row;
}

async function resolveCategory(name, type, cats) {
  if (!name) {
    const other = cats.find((c) => c.name === "Other" && c.type === type);
    return other || cats[0];
  }
  let cat = cats.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.type === type);
  if (!cat) {
    const id = await add(STORES.CAT, {
      name, type, color: "#64748b", icon: "📦",
      budgetLimit: 0, isFavorite: false, rollover: 0, parentId: null, isTaxDeductible: false,
    });
    cat = { id, name, type };
    cats.push(cat);
  }
  return cat;
}

export async function importCSVText(text, merge = true) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one entry");

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map(normalizeHeader);
  const cats = await getAll(STORES.CAT);
  let imported = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (!values.some(Boolean)) continue;
    const row = mapRow(headers, values);

    const amount = parseFloat(row.amount || row.amt || row.value);
    if (!amount || amount <= 0) { skipped++; continue; }

    const type = (row.type || row.transactiontype || "expense").toLowerCase().includes("inc") ? "income" : "expense";
    const date = row.date || row.transactiondate || todayStr();
    const time = row.time || row.transactiontime || "12:00";
    const catName = row.category || row.categoryname || "";
    const cat = await resolveCategory(catName, type, cats);

    const record = {
      amount,
      type,
      date: date.slice(0, 10),
      time: time.length >= 5 ? time.slice(0, 5) : "12:00",
      categoryId: cat.id,
      categoryName: cat.name,
      merchant: row.merchant || row.payee || row.vendor || "",
      paymentMethod: row.payment || row.paymentmethod || "Cash",
      notes: row.notes || row.description || row.memo || "",
      tags: (row.tags || "").split(/[;,]/).map((t) => t.trim()).filter(Boolean),
      eventId: null,
      recurringId: null,
      splits: [],
      walletId: null,
      receiptThumb: null,
    };

    if (merge) {
      const existing = await getAll(STORES.TX);
      const dup = existing.find((t) =>
        t.amount === record.amount && t.date === record.date && t.categoryId === record.categoryId &&
        (t.merchant || "") === record.merchant
      );
      if (dup) { skipped++; continue; }
    }

    await add(STORES.TX, record);
    imported++;
  }

  toast(`Imported ${imported} rows${skipped ? ` (${skipped} skipped)` : ""}`, imported ? "success" : "info");
  return imported;
}

export async function importCSVFile(file, merge = true) {
  const text = await file.text();
  const n = await importCSVText(text, merge);
  if (n) window.dispatchEvent(new Event("refresh-app"));
  return n;
}
