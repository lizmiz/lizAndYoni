// Local dev seed: bootstraps the real reference data (shared with production's
// in-app "בסיסי נתונים" action) AND adds fake demo transactions across the last
// 4 months, purely so the dashboard/insights have numbers to look at while developing.
// The demo transactions are intentionally NOT part of seedReferenceData — production
// installs should start with real data, not fake Wolt charges.
import { PrismaClient, TransactionDirection } from "@prisma/client";
import { subMonths, setDate, startOfMonth } from "date-fns";
import { seedReferenceData } from "../src/lib/seed/reference-data";

const prisma = new PrismaClient();

async function main() {
  const result = await seedReferenceData(prisma);
  if (!result.ok) {
    console.log("DB already seeded — skipping (safe to run once on a fresh database).");
    return;
  }
  console.log("Reference data seeded. Adding demo transactions for local development…");

  const home = await prisma.financialScope.findUniqueOrThrow({ where: { key: "HOME" } });
  const lizmiz = await prisma.financialScope.findUniqueOrThrow({ where: { key: "LIZMIZ" } });
  const yoni = await prisma.financialScope.findUniqueOrThrow({ where: { key: "YONI" } });
  const sharedAccount = await prisma.bankAccount.findFirstOrThrow({ where: { name: "חשבון משותף" } });
  const yoniBizAccount = await prisma.bankAccount.findFirstOrThrow({ where: { name: "חשבון עסקי יוני" } });

  await prisma.bankAccount.update({
    where: { id: sharedAccount.id },
    data: { currentBalance: 12500, balanceAsOf: new Date() },
  });
  await prisma.bankAccount.update({
    where: { id: yoniBizAccount.id },
    data: { currentBalance: 8300, balanceAsOf: new Date() },
  });

  const categories = await prisma.category.findMany();
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));
  const vendorRows = await prisma.vendor.findMany();
  const vendorId = (name: string) => vendorRows.find((v) => v.name === name)!.id;
  const cardRows = await prisma.creditCard.findMany();
  const cardId = (name: string) => cardRows.find((c) => c.name === name)?.id;

  type TxSeed = {
    vendor: string;
    category: string;
    scope: typeof home;
    amount: number;
    day: number;
    direction: TransactionDirection;
    effect: "REAL_INCOME" | "REAL_EXPENSE" | "SAVINGS_INVESTMENT";
    account: "shared" | "business";
    card?: string;
  };

  // Baseline monthly pattern (used for the 3 comparison months), with August (current) intentionally
  // higher on "אוכל בחוץ" to give the insights engine something real to flag.
  const monthlyPattern: TxSeed[] = [
    { vendor: "רמי לוי", category: "סופר ומזון לבית", scope: home, amount: 640, day: 3, direction: "EXPENSE", effect: "REAL_EXPENSE", account: "shared", card: "MAX ליזי" },
    { vendor: "שופרסל", category: "סופר ומזון לבית", scope: home, amount: 510, day: 17, direction: "EXPENSE", effect: "REAL_EXPENSE", account: "shared", card: "MAX ליזי" },
    { vendor: "Wolt", category: "אוכל בחוץ", scope: home, amount: 180, day: 6, direction: "EXPENSE", effect: "REAL_EXPENSE", account: "shared", card: "MAX ליזי" },
    { vendor: "Wolt", category: "אוכל בחוץ", scope: home, amount: 210, day: 19, direction: "EXPENSE", effect: "REAL_EXPENSE", account: "shared", card: "MAX ליזי" },
    { vendor: "פנגו", category: "טסט וכבישי אגרה", scope: home, amount: 105, day: 20, direction: "EXPENSE", effect: "REAL_EXPENSE", account: "shared", card: "MAX ליזי" },
    { vendor: "כלל ביטוח", category: "ביטוחים", scope: home, amount: 305, day: 27, direction: "EXPENSE", effect: "REAL_EXPENSE", account: "shared", card: "MAX ליזי" },
    { vendor: "Netflix", category: "מנויים אישיים", scope: home, amount: 33, day: 22, direction: "EXPENSE", effect: "REAL_EXPENSE", account: "shared", card: "MAX ליזי" },
    { vendor: "Elementor", category: "תוכנות ומנויים עסקיים", scope: lizmiz, amount: 36, day: 5, direction: "EXPENSE", effect: "REAL_EXPENSE", account: "shared", card: "MAX ליזי" },
    { vendor: "Canva", category: "תוכנות ומנויים עסקיים", scope: lizmiz, amount: 50, day: 5, direction: "EXPENSE", effect: "REAL_EXPENSE", account: "shared", card: "MAX ליזי" },
    { vendor: "אנליסט השתלמות", category: "פנסיה וקרן השתלמות", scope: lizmiz, amount: 1710, day: 1, direction: "EXPENSE", effect: "SAVINGS_INVESTMENT", account: "shared" },
  ];

  const now = new Date();
  for (let monthsAgo = 3; monthsAgo >= 0; monthsAgo--) {
    const monthDate = startOfMonth(subMonths(now, monthsAgo));
    const isCurrent = monthsAgo === 0;
    for (const t of monthlyPattern) {
      if (isCurrent && t.day > now.getDate()) continue;
      let amount = t.amount;
      if (isCurrent && t.category === "אוכל בחוץ") amount = Math.round(amount * 1.55);

      await prisma.transaction.create({
        data: {
          transactionDate: setDate(monthDate, t.day),
          chargeDate: setDate(monthDate, t.day),
          amount,
          direction: t.direction,
          economicEffect: t.effect,
          status: "ACTUAL",
          scopeId: t.scope.id,
          bankAccountId: t.account === "shared" ? sharedAccount.id : yoniBizAccount.id,
          creditCardId: t.card ? cardId(t.card) : undefined,
          vendorId: vendorId(t.vendor),
          categoryId: categoryIdByName.get(t.category),
          description: t.vendor,
          source: "MANUAL",
        },
      });
    }

    await prisma.transaction.create({
      data: {
        transactionDate: setDate(monthDate, 10),
        amount: 4650,
        direction: "INCOME",
        economicEffect: "REAL_INCOME",
        status: "ACTUAL",
        scopeId: home.id,
        bankAccountId: sharedAccount.id,
        description: "שכר דירה בת ים",
        categoryId: categoryIdByName.get("אחר"),
        source: "MANUAL",
      },
    });

    if (!isCurrent || now.getDate() >= 15) {
      await prisma.transaction.create({
        data: {
          transactionDate: setDate(monthDate, 15),
          amount: 9000 + Math.round(Math.random() * 4000),
          direction: "INCOME",
          economicEffect: "REAL_INCOME",
          status: "ACTUAL",
          scopeId: yoni.id,
          bankAccountId: yoniBizAccount.id,
          description: "שכר טרחה — תיק לקוח",
          categoryId: categoryIdByName.get("הוצאות עסקיות"),
          source: "MANUAL",
        },
      });
    }
  }

  await prisma.transaction.create({
    data: {
      transactionDate: setDate(now, Math.min(now.getDate(), 28)),
      amount: 3200,
      direction: "INCOME",
      economicEffect: "REAL_INCOME",
      status: "EXPECTED",
      scopeId: lizmiz.id,
      bankAccountId: sharedAccount.id,
      description: "תשלום לקוח — פרויקט אתר",
      categoryId: categoryIdByName.get("אחר"),
      source: "MANUAL",
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
