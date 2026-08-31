import { prisma } from "@/lib/prisma";

const COMPANY_KEYWORDS = [
  "כלל",
  "הראל",
  "מנורה",
  "הפניקס",
  "פניקס",
  "ליברה",
  "איי אי ג'י",
  "מגדל",
  "הכשרה",
  "שלמה",
  "AIG",
];

const TYPE_KEYWORDS: [RegExp, string][] = [
  [/רכב/, "רכב"],
  [/בריאות/, "בריאות"],
  [/(^|\s)חיים(\s|$)/, "חיים"],
  [/סיעוד/, "סיעודי"],
  [/דירה|דיור/, "דירה"],
  [/אובדן כושר/, "אובדן כושר עבודה"],
];

// Not private insurance policies at all — pension/retirement vehicles and government
// benefits that happen to share a company name or the word "ביטוח" with real policies.
const EXCLUDE_KEYWORDS = [
  "ביטוח לאומי", // National Insurance Institute — a government body, not a policy
  "פנסיה",
  "גמל",
  "השתלמות",
  "מנהלים", // "ביטוח מנהלים" is an executive pension product, not a standalone policy
];

function guessCompany(vendor: string): string {
  for (const kw of COMPANY_KEYWORDS) {
    if (vendor.includes(kw)) return kw;
  }
  return vendor;
}

function guessType(vendor: string): string {
  for (const [re, type] of TYPE_KEYWORDS) {
    if (re.test(vendor)) return type;
  }
  return "אחר";
}

export type InsuranceSuggestion = {
  company: string;
  type: string;
  cost: number;
  occurrences: number;
  sampleVendorNames: string[];
};

/**
 * Scans transaction history for recurring, insurance-flavored vendors (categorized
 * "ביטוחים" or matching a known insurer's name) and proposes InsurancePolicy drafts —
 * so structured insurance data doesn't have to be typed in by hand when it's already
 * sitting in the imported ledger. Excludes pension/retirement products and government
 * benefits that share a company name with real policies. Groups by (company, type)
 * rather than raw vendor text, since the source ledger's vendor names carry
 * inconsistent suffixes ("- יורד ב 10 לחודש" etc.) for what's really the same policy.
 * Only suggests a group that appears 2+ times and isn't already tracked.
 */
export async function getInsuranceSuggestions(): Promise<InsuranceSuggestion[]> {
  const [transactions, existingPolicies] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        OR: [
          { category: { name: "ביטוחים" } },
          { vendor: { name: { contains: "ביטוח" } } },
          ...COMPANY_KEYWORDS.map((kw) => ({ vendor: { name: { contains: kw } } })),
        ],
      },
      include: { vendor: true },
      orderBy: { transactionDate: "desc" },
    }),
    prisma.insurancePolicy.findMany(),
  ]);

  const existingCompanies = new Set(existingPolicies.map((p) => p.company));

  type Group = { company: string; type: string; amounts: number[]; vendorNames: Set<string> };
  const groups = new Map<string, Group>();

  for (const t of transactions) {
    const name = t.vendor?.name ?? t.description;
    if (!name) continue;
    if (EXCLUDE_KEYWORDS.some((kw) => name.includes(kw))) continue;

    const company = guessCompany(name);
    const type = guessType(name);
    const key = `${company}::${type}`;
    if (!groups.has(key)) groups.set(key, { company, type, amounts: [], vendorNames: new Set() });
    const g = groups.get(key)!;
    g.amounts.push(Number(t.amount));
    g.vendorNames.add(name);
  }

  const suggestions: InsuranceSuggestion[] = [];
  for (const g of groups.values()) {
    if (g.amounts.length < 2) continue;
    if (existingCompanies.has(g.company)) continue;
    suggestions.push({
      company: g.company,
      type: g.type,
      cost: g.amounts[0], // most recent (source query already sorted desc)
      occurrences: g.amounts.length,
      sampleVendorNames: [...g.vendorNames].slice(0, 2),
    });
  }

  return suggestions.sort((a, b) => b.occurrences - a.occurrences);
}
