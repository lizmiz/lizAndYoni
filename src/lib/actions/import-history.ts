"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import type { EconomicEffect, TransactionDirection } from "@prisma/client";

/**
 * Imports the historical ledger from the family's Google Sheets export ("הוצאות הכל
 * ונכסים"). Each monthly tab holds up to 9 side-by-side tables (vendor/date/amount);
 * we only import the 6 that represent real cash movement — see architecture doc
 * section 05. The two "not really income/expense, nets to zero" client-transfer
 * blocks and the computed totals block are intentionally skipped, as is the batch of
 * oldest tabs (roughly Feb–Nov 2024) that use an incompatible older layout.
 */

type BlockKind = "HOME_EXPENSE" | "YONI_EXPENSE" | "CLIENT_EXPENSE" | "HOME_INCOME" | "LIZMIZ_INCOME" | "YONI_INCOME";

const BLOCK_META: Record<BlockKind, { direction: TransactionDirection; effect: EconomicEffect; scopeKey: "HOME" | "YONI" | "LIZMIZ"; account: "shared" | "business" }> = {
  HOME_EXPENSE: { direction: "EXPENSE", effect: "REAL_EXPENSE", scopeKey: "HOME", account: "shared" },
  YONI_EXPENSE: { direction: "EXPENSE", effect: "REAL_EXPENSE", scopeKey: "YONI", account: "business" },
  CLIENT_EXPENSE: { direction: "EXPENSE", effect: "CLIENT_EXPENSE", scopeKey: "YONI", account: "business" },
  HOME_INCOME: { direction: "INCOME", effect: "REAL_INCOME", scopeKey: "HOME", account: "shared" },
  LIZMIZ_INCOME: { direction: "INCOME", effect: "REAL_INCOME", scopeKey: "LIZMIZ", account: "shared" },
  YONI_INCOME: { direction: "INCOME", effect: "REAL_INCOME", scopeKey: "YONI", account: "business" },
};

function isMonthTab(name: string) {
  return /\d{2}\.\d{4}/.test(name);
}

function classifyBlock(title: string | null): BlockKind | "TOTALS_SKIP" | "CLIENT_NOCARD_SKIP" | null {
  if (!title) return null;
  if (title.includes("585979") || (title.includes("פרטי") && title.includes("הוצאות"))) return "HOME_EXPENSE";
  if (title.includes("שכר טרחה")) return "CLIENT_EXPENSE";
  if (title.includes("621088")) return "YONI_EXPENSE";
  if (title.includes("בית כללי")) return "HOME_INCOME";
  if (title.includes("הכנסות ליזי")) return "LIZMIZ_INCOME";
  if (title.includes("הכנסות יוני")) return "YONI_INCOME";
  if (title.includes('סה"כ')) return "TOTALS_SKIP";
  if (title.includes("הוצאות לקוח") || title.includes("נכנס לא הכנסה")) return "CLIENT_NOCARD_SKIP";
  return null;
}

function parseIsraeliDateShort(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (m) {
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      return new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    }
  }
  if (typeof v === "number") {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + v * 86400000);
  }
  return null;
}

type ParsedItem = { vendor: string; date: Date | null; amount: number };
type ParsedBlock = { kind: BlockKind; items: ParsedItem[] };

function parseTab(sheet: XLSX.WorkSheet): ParsedBlock[] {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  if (rows.length < 3) return [];

  const titleRow = rows[0] ?? [];
  const headerRow = rows[1] ?? [];

  const blockStarts: number[] = [];
  headerRow.forEach((cell, idx) => {
    if (typeof cell === "string" && cell.trim().startsWith("סוג")) blockStarts.push(idx);
  });

  const blocks: { col: number; kind: BlockKind }[] = [];
  for (const col of blockStarts) {
    let title: string | null = null;
    for (let w = -2; w <= 3; w++) {
      const c = titleRow[col + w];
      if (typeof c === "string" && c.trim()) {
        title = c.trim();
        break;
      }
    }
    const kind = classifyBlock(title);
    const secondHeader = String(headerRow[col + 1] ?? "").trim();
    if (!kind || kind === "TOTALS_SKIP" || kind === "CLIENT_NOCARD_SKIP" || secondHeader.startsWith('סה"כ')) continue;
    blocks.push({ col, kind });
  }

  const results: ParsedBlock[] = [];
  for (const block of blocks) {
    const items: ParsedItem[] = [];
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const nameRaw = row[block.col];
      const name = typeof nameRaw === "string" ? nameRaw.trim() : nameRaw;
      if (!name) continue;
      if (typeof name === "string" && (name.startsWith("סה") || name.startsWith("סך"))) break;

      const col2 = row[block.col + 1];
      const col3 = row[block.col + 2];
      let date: Date | null = null;
      let amount: number | null = null;
      if (typeof col3 === "number") {
        date = parseIsraeliDateShort(col2);
        amount = col3;
      } else if (typeof col2 === "number") {
        amount = col2;
      }
      if (amount === null || Number.isNaN(amount) || amount === 0) continue;

      items.push({ vendor: String(name), date, amount });
    }
    results.push({ kind: block.kind, items });
  }
  return results;
}

// Lightweight keyword categorizer for fixed/recognizable expense types — the source
// sheet has no category column at all, so this only helps the clearly-labeled items;
// everything else lands uncategorized for manual review, same as the credit-card import.
const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/משכנתא/, "משכנתא / שכירות"],
  [/ארנונה/, "ארנונה"],
  [/חשמל/, "חשמל"],
  [/(^|\s)מים(\s|$)/, "מים"],
  [/ועד בית/, "ועד בית"],
  [/ביטוח|כלל ביטוח|הראל|מנורה.*ביטוח|איי אי ג'י/, "ביטוחים"],
  [/פנסיה|השתלמות|קופת גמל|גמל/, "פנסיה וקרן השתלמות"],
  [/דלק|פנגו|כביש ?6|חניה/, "דלק"],
  [/מס הכנסה|מע"?מ|ביטוח לאומי.*עצמאי/, "מיסים"],
  [/שכירות משרד|רואה חשבון|עורך ?דין/, "הוצאות עסקיות"],
];

function guessCategoryName(vendor: string): string | null {
  for (const [re, cat] of CATEGORY_KEYWORDS) {
    if (re.test(vendor)) return cat;
  }
  return null;
}

function normalizeVendorName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "");
}

export type HistoryImportResult = {
  ok: boolean;
  error?: string;
  tabsProcessed?: number;
  tabsSkipped?: string[];
  imported?: number;
  duplicatesSkipped?: number;
  statusFixed?: number;
  uncategorized?: number;
  byKind?: Record<string, number>;
};

export async function importHistoricalLedger(_prev: HistoryImportResult, formData: FormData): Promise<HistoryImportResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "יש לבחור קובץ" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

  const scopes = await prisma.financialScope.findMany();
  const scopeByKey = new Map(scopes.map((s) => [s.key, s]));
  const accounts = await prisma.bankAccount.findMany();
  const sharedAccount = accounts.find((a) => a.name === "חשבון משותף");
  const yoniAccount = accounts.find((a) => a.name === "חשבון עסקי יוני");
  if (!sharedAccount || !yoniAccount || scopeByKey.size < 3) {
    return { ok: false, error: "יש להריץ קודם את אתחול נתוני הבסיס בעמוד ההגדרות." };
  }

  const categories = await prisma.category.findMany();
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  const allTabs = workbook.SheetNames.filter(isMonthTab);
  const tabsSkipped: string[] = [];
  let imported = 0;
  let duplicatesSkipped = 0;
  let statusFixed = 0;
  let uncategorized = 0;
  const byKind: Record<string, number> = {};

  for (const tabName of allTabs) {
    const m = tabName.match(/(\d{2})\.(\d{4})/);
    if (!m) continue;
    const tabMonth = parseInt(m[1], 10);
    const tabYear = parseInt(m[2], 10);
    const tabFallbackDate = new Date(tabYear, tabMonth - 1, 15);

    const blocks = parseTab(workbook.Sheets[tabName]);
    if (blocks.length === 0) {
      tabsSkipped.push(tabName);
      continue;
    }

    for (const block of blocks) {
      const meta = BLOCK_META[block.kind];
      const scope = scopeByKey.get(meta.scopeKey);
      if (!scope) continue;
      const bankAccountId = meta.account === "shared" ? sharedAccount.id : yoniAccount.id;

      for (const item of block.items) {
        // A row with no date in the source means the sheet's own green/orange
        // convention marks it "still pending" — not yet actually received/paid.
        // Must be captured before the fallback below replaces a missing date with
        // an estimate, which would otherwise erase that signal.
        const status: "ACTUAL" | "EXPECTED" = item.date ? "ACTUAL" : "EXPECTED";

        let date = item.date;
        if (!date || Math.abs(date.getTime() - tabFallbackDate.getTime()) > 45 * 86400000) {
          date = tabFallbackDate;
        }

        const normalized = normalizeVendorName(item.vendor);
        const guessedCategory = guessCategoryName(item.vendor);

        const existingVendor = await prisma.vendor.findUnique({ where: { normalizedName: normalized } });
        const vendor =
          existingVendor ??
          (await prisma.vendor.create({
            data: {
              name: item.vendor,
              normalizedName: normalized,
              defaultCategoryId: guessedCategory ? categoryIdByName.get(guessedCategory) : undefined,
              defaultScopeId: scope.id,
            },
          }));

        const categoryId = vendor.defaultCategoryId ?? (guessedCategory ? categoryIdByName.get(guessedCategory) : undefined);
        if (!categoryId) uncategorized++;

        const existingTx = await prisma.transaction.findFirst({
          where: { scopeId: scope.id, transactionDate: date, amount: item.amount, vendorId: vendor.id },
        });
        if (existingTx) {
          duplicatesSkipped++;
          if (existingTx.status !== status) {
            await prisma.transaction.update({ where: { id: existingTx.id }, data: { status } });
            statusFixed++;
          }
          continue;
        }

        await prisma.transaction.create({
          data: {
            transactionDate: date,
            amount: item.amount,
            direction: meta.direction,
            economicEffect: meta.effect,
            status,
            scopeId: scope.id,
            bankAccountId,
            vendorId: vendor.id,
            categoryId: categoryId ?? undefined,
            description: item.vendor,
            source: "EXCEL",
          },
        });
        imported++;
        byKind[block.kind] = (byKind[block.kind] ?? 0) + 1;
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/transactions");

  return {
    ok: true,
    tabsProcessed: allTabs.length - tabsSkipped.length,
    tabsSkipped,
    imported,
    duplicatesSkipped,
    statusFixed,
    uncategorized,
    byKind,
  };
}
