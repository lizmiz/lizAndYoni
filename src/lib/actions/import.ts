"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

type ParsedRow = {
  transactionDate: Date;
  vendorName: string;
  maxCategory: string;
  last4: string;
  amount: number;
  chargeDate: Date | null;
  notes: string | null;
};

const HEADER_MAP: Record<string, keyof ParsedRow | "originalAmount" | "skip"> = {
  "תאריך עסקה": "transactionDate",
  "שם בית העסק": "vendorName",
  "קטגוריה": "maxCategory",
  "4 ספרות אחרונות של כרטיס האשראי": "last4",
  "סכום חיוב": "amount",
  // Not-yet-posted rows ("עסקאות שאושרו וטרם נקלטו") have no "סכום חיוב" yet — fall back to this.
  "סכום עסקה מקורי": "originalAmount",
  "תאריך חיוב": "chargeDate",
  "הערות": "notes",
};

function parseIsraeliDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }
  if (typeof value === "number") {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + value * 86400000);
  }
  return null;
}

function normalizeVendorName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "");
}

/** Parses one MAX-style sheet (array-of-arrays) into rows, starting after the header row. */
function parseSheet(rows: unknown[][]): { rows: ParsedRow[]; fileTotal: number | null } {
  let headerRowIndex = -1;
  let columnIndex: Partial<Record<keyof ParsedRow | "originalAmount", number>> = {};

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row) continue;
    const idx: Partial<Record<keyof ParsedRow | "originalAmount", number>> = {};
    row.forEach((cell, colIdx) => {
      const key = HEADER_MAP[String(cell ?? "").trim()];
      if (key && key !== "skip") idx[key] = colIdx;
    });
    if (idx.transactionDate !== undefined && idx.vendorName !== undefined) {
      headerRowIndex = i;
      columnIndex = idx;
      break;
    }
  }
  if (headerRowIndex === -1) return { rows: [], fileTotal: null };

  const out: ParsedRow[] = [];
  let fileTotal: number | null = null;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const vendorRaw = columnIndex.vendorName !== undefined ? row[columnIndex.vendorName] : undefined;
    const vendorName = String(vendorRaw ?? "").trim();
    if (!vendorName || vendorName.startsWith("סה") || vendorName.startsWith("סך")) {
      // The grand-total value sits alone in the first cell of the row right after this label.
      const totalRow = rows[i + 1];
      const totalRaw = totalRow?.[0];
      const parsed = parseFloat(String(totalRaw ?? "").replace(/[^\d.-]/g, ""));
      if (!Number.isNaN(parsed) && parsed > 0) fileTotal = parsed;
      continue;
    }

    const dateRaw = columnIndex.transactionDate !== undefined ? row[columnIndex.transactionDate] : undefined;
    const transactionDate = parseIsraeliDate(dateRaw);
    if (!transactionDate) continue;

    let amountRaw = columnIndex.amount !== undefined ? row[columnIndex.amount] : undefined;
    if ((amountRaw === undefined || amountRaw === null || amountRaw === "") && columnIndex.originalAmount !== undefined) {
      amountRaw = row[columnIndex.originalAmount];
    }
    const amount = typeof amountRaw === "number" ? amountRaw : parseFloat(String(amountRaw ?? "").replace(/[^\d.-]/g, ""));
    if (!amount || Number.isNaN(amount)) continue;

    out.push({
      transactionDate,
      vendorName,
      maxCategory: columnIndex.maxCategory !== undefined ? String(row[columnIndex.maxCategory] ?? "").trim() : "",
      last4: columnIndex.last4 !== undefined ? String(row[columnIndex.last4] ?? "").trim() : "",
      amount,
      chargeDate: columnIndex.chargeDate !== undefined ? parseIsraeliDate(row[columnIndex.chargeDate]) : null,
      notes: columnIndex.notes !== undefined ? String(row[columnIndex.notes] ?? "").trim() || null : null,
    });
  }
  return { rows: out, fileTotal };
}

export type ImportResult = {
  ok: boolean;
  error?: string;
  imported?: number;
  duplicatesSkipped?: number;
  uncategorized?: number;
  pendingImported?: number;
  billedAmount?: number;
  matchedAmount?: number;
  period?: string;
  cardName?: string;
};

export async function importCreditCardFile(_prev: ImportResult, formData: FormData): Promise<ImportResult> {
  const file = formData.get("file") as File | null;
  const fallbackCardId = formData.get("creditCardId") as string;
  if (!file || file.size === 0) return { ok: false, error: "יש לבחור קובץ" };
  if (!fallbackCardId) return { ok: false, error: "יש לבחור כרטיס" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

  const cards = await prisma.creditCard.findMany();
  const cardByLast4 = new Map(cards.map((c) => [c.last4, c]));
  const fallbackCard = cards.find((c) => c.id === fallbackCardId);
  if (!fallbackCard) return { ok: false, error: "כרטיס לא נמצא" };

  const committedSheetName = workbook.SheetNames.find((n) => n.includes("במועד החיוב")) ?? workbook.SheetNames[0];
  const pendingSheetName = workbook.SheetNames.find((n) => n.includes("אושרו וטרם")) ?? workbook.SheetNames[1];

  const committedParsed = committedSheetName
    ? parseSheet(XLSX.utils.sheet_to_json(workbook.Sheets[committedSheetName], { header: 1 }) as unknown[][])
    : { rows: [], fileTotal: null };
  const pendingParsed = pendingSheetName
    ? parseSheet(XLSX.utils.sheet_to_json(workbook.Sheets[pendingSheetName], { header: 1 }) as unknown[][])
    : { rows: [], fileTotal: null };
  const committedRows = committedParsed.rows;
  const pendingRows = pendingParsed.rows;

  let imported = 0;
  let duplicatesSkipped = 0;
  let uncategorized = 0;
  let pendingImported = 0;
  let matchedAmount = 0;
  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const cardsTouched = new Set<string>();

  async function upsertVendorAndInsert(row: ParsedRow, status: "ACTUAL" | "EXPECTED") {
    const card = cardByLast4.get(row.last4) ?? fallbackCard!;
    cardsTouched.add(card.id);

    const normalized = normalizeVendorName(row.vendorName);
    const vendor = await prisma.vendor.upsert({
      where: { normalizedName: normalized },
      update: {},
      create: { name: row.vendorName, normalizedName: normalized },
    });

    const existing = await prisma.transaction.findFirst({
      where: {
        creditCardId: card.id,
        transactionDate: row.transactionDate,
        amount: Math.abs(row.amount),
        vendorId: vendor.id,
      },
    });
    if (existing) {
      duplicatesSkipped++;
      return;
    }

    const isRefund = row.amount < 0;
    const scopeId = vendor.defaultScopeId ?? (await prisma.financialScope.findFirstOrThrow({ where: { key: "HOME" } })).id;

    await prisma.transaction.create({
      data: {
        transactionDate: row.transactionDate,
        chargeDate: row.chargeDate ?? undefined,
        amount: Math.abs(row.amount),
        direction: isRefund ? "INCOME" : "EXPENSE",
        economicEffect: isRefund ? "REFUND" : "REAL_EXPENSE",
        status,
        scopeId,
        categoryId: vendor.defaultCategoryId ?? undefined,
        vendorId: vendor.id,
        creditCardId: card.id,
        bankAccountId: card.bankAccountId,
        description: row.vendorName,
        notes: row.notes ?? undefined,
        source: "EXCEL",
      },
    });

    if (status === "ACTUAL") {
      imported++;
      matchedAmount += Math.abs(row.amount);
      if (!vendor.defaultCategoryId) uncategorized++;
    } else {
      pendingImported++;
    }
  }

  for (const row of committedRows) await upsertVendorAndInsert(row, "ACTUAL");
  for (const row of pendingRows) await upsertVendorAndInsert(row, "EXPECTED");

  // Reconciliation: one statement per card touched, this period. The file's own "סך הכל" total
  // (authoritative — what the card company actually billed) is only trustworthy when the whole
  // committed sheet belongs to a single card; a bundled multi-card file falls back to the sum found.
  for (const cardId of cardsTouched) {
    const cardTx = await prisma.transaction.findMany({
      where: { creditCardId: cardId, status: "ACTUAL" },
    });
    const matched = cardTx.reduce((s, t) => s + Number(t.amount) * (t.direction === "EXPENSE" ? 1 : -1), 0);
    const billed = cardsTouched.size === 1 && committedParsed.fileTotal !== null ? committedParsed.fileTotal : matched;
    const uncategorizedCount = cardTx.filter((t) => !t.categoryId).length;
    const isBalanced = Math.abs(billed - matched) < 0.5;

    const statement = await prisma.creditCardStatement.upsert({
      where: { creditCardId_period: { creditCardId: cardId, period } },
      update: {
        billedAmount: billed,
        matchedAmount: matched,
        transactionsCount: cardTx.length,
        uncategorizedCount,
        status: !isBalanced ? "UNMATCHED" : uncategorizedCount === 0 ? "MATCHED" : "PARTIAL",
      },
      create: {
        creditCardId: cardId,
        period,
        billedAmount: billed,
        matchedAmount: matched,
        transactionsCount: cardTx.length,
        uncategorizedCount,
        status: !isBalanced ? "UNMATCHED" : uncategorizedCount === 0 ? "MATCHED" : "PARTIAL",
      },
    });

    await prisma.transaction.updateMany({
      where: { creditCardId: cardId, status: "ACTUAL" },
      data: { statementId: statement.id },
    });
  }

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");

  return {
    ok: true,
    imported,
    duplicatesSkipped,
    uncategorized,
    pendingImported,
    billedAmount: matchedAmount,
    matchedAmount,
    period,
    cardName: fallbackCard.name,
  };
}
