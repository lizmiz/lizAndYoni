import { PrismaClient, TransactionDirection } from "@prisma/client";
import { subMonths, setDate, startOfMonth } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  const already = await prisma.financialScope.count();
  if (already > 0) {
    console.log("DB already seeded — skipping (safe to run once on a fresh database).");
    return;
  }

  console.log("Seeding scopes, accounts, categories, vendors…");

  // ── Financial scopes ────────────────────────────────────────
  const home = await prisma.financialScope.upsert({
    where: { key: "HOME" },
    update: {},
    create: { key: "HOME", name: "בית", icon: "🏠" },
  });
  const lizmiz = await prisma.financialScope.upsert({
    where: { key: "LIZMIZ" },
    update: {},
    create: { key: "LIZMIZ", name: "ליזמיז", icon: "💼" },
  });
  const yoni = await prisma.financialScope.upsert({
    where: { key: "YONI" },
    update: {},
    create: { key: "YONI", name: "העסק של יוני", icon: "⚖️" },
  });

  // ── Bank accounts ────────────────────────────────────────────
  const sharedAccount = await prisma.bankAccount.create({
    data: {
      name: "חשבון משותף",
      bankName: "מזרחי טפחות",
      last4: "5979",
      primaryScopeId: home.id,
      currentBalance: 12500,
      balanceAsOf: new Date(),
    },
  });
  const yoniBizAccount = await prisma.bankAccount.create({
    data: {
      name: "חשבון עסקי יוני",
      bankName: "בנק לאומי",
      last4: "1088",
      primaryScopeId: yoni.id,
      currentBalance: 8300,
      balanceAsOf: new Date(),
    },
  });

  // ── Credit cards ─────────────────────────────────────────────
  await prisma.creditCard.createMany({
    data: [
      { name: "MAX ליזי", network: "MAX", last4: "8595", bankAccountId: sharedAccount.id },
      { name: "כרטיס יוני", network: "MAX", last4: "8398", bankAccountId: sharedAccount.id },
      { name: "כ.א בנק לאומי", network: "Isracard", last4: "1088", bankAccountId: yoniBizAccount.id },
    ],
  });

  // ── Categories (parent → children) ──────────────────────────
  type CatSeed = { name: string; icon: string; children: { name: string; icon: string }[] };
  const tree: CatSeed[] = [
    {
      name: "מזון ובית",
      icon: "🛒",
      children: [
        { name: "סופר ומזון לבית", icon: "🛒" },
        { name: "אוכל בחוץ", icon: "🍽️" },
        { name: "משלוחים", icon: "🛵" },
      ],
    },
    {
      name: "דיור",
      icon: "🏠",
      children: [
        { name: "משכנתא / שכירות", icon: "🏦" },
        { name: "ארנונה", icon: "🏛️" },
        { name: "חשמל", icon: "💡" },
        { name: "מים", icon: "💧" },
        { name: "ועד בית", icon: "🧱" },
      ],
    },
    {
      name: "ילדים",
      icon: "🧒",
      children: [{ name: "חוגים, צהרונים וקייטנות", icon: "🎨" }],
    },
    {
      name: "רכב ותחבורה",
      icon: "🚗",
      children: [
        { name: "דלק", icon: "⛽" },
        { name: "ביטוח רכב", icon: "🚙" },
        { name: "טסט וכבישי אגרה", icon: "🛣️" },
      ],
    },
    {
      name: "ביטוח ובריאות",
      icon: "🛡️",
      children: [
        { name: "ביטוחים", icon: "🛡️" },
        { name: "בריאות", icon: "💊" },
      ],
    },
    {
      name: "פנאי וחופשות",
      icon: "🎉",
      children: [
        { name: "בילויים", icon: "🎬" },
        { name: "חופשות", icon: "✈️" },
        { name: "מנויים אישיים", icon: "📺" },
      ],
    },
    {
      name: "קניות",
      icon: "🛍️",
      children: [
        { name: "מוצרי חשמל", icon: "🔌" },
        { name: "קניות כלליות", icon: "🛍️" },
      ],
    },
    {
      name: "עסקי ומקצועי",
      icon: "💼",
      children: [
        { name: "תוכנות ומנויים עסקיים", icon: "💻" },
        { name: "בעלי מקצוע", icon: "🧑‍💻" },
        { name: "הוצאות עסקיות", icon: "🧾" },
        { name: "מיסים", icon: "🏛️" },
      ],
    },
    {
      name: "חיסכון והשקעה",
      icon: "📈",
      children: [
        { name: "פנסיה וקרן השתלמות", icon: "📈" },
        { name: "השקעות", icon: "💰" },
      ],
    },
  ];

  const categoryIdByName = new Map<string, string>();
  for (const parent of tree) {
    const parentRow = await prisma.category.create({ data: { name: parent.name, icon: parent.icon } });
    categoryIdByName.set(parent.name, parentRow.id);
    for (const child of parent.children) {
      const childRow = await prisma.category.create({
        data: { name: child.name, icon: child.icon, parentId: parentRow.id },
      });
      categoryIdByName.set(child.name, childRow.id);
    }
  }
  const otherCat = await prisma.category.create({ data: { name: "אחר", icon: "❓" } });
  categoryIdByName.set("אחר", otherCat.id);

  // ── Vendors — seeded from real learning found in the Sheets / MAX export ──
  const vendors: { name: string; category: string; scope: typeof home }[] = [
    { name: "Wolt", category: "אוכל בחוץ", scope: home },
    { name: "רמי לוי", category: "סופר ומזון לבית", scope: home },
    { name: "שופרסל", category: "סופר ומזון לבית", scope: home },
    { name: "סופר פארם", category: "בריאות", scope: home },
    { name: "Netflix", category: "מנויים אישיים", scope: home },
    { name: "Spotify", category: "מנויים אישיים", scope: home },
    { name: "פנגו", category: "טסט וכבישי אגרה", scope: home },
    { name: "Elementor", category: "תוכנות ומנויים עסקיים", scope: lizmiz },
    { name: "Canva", category: "תוכנות ומנויים עסקיים", scope: lizmiz },
    { name: "ChatGPT", category: "תוכנות ומנויים עסקיים", scope: lizmiz },
    { name: "Anthropic Claude", category: "תוכנות ומנויים עסקיים", scope: lizmiz },
    { name: "חשבונית ירוקה", category: "תוכנות ומנויים עסקיים", scope: lizmiz },
    { name: "כלל ביטוח", category: "ביטוחים", scope: home },
    { name: "הראל", category: "ביטוחים", scope: home },
    { name: "מנורה פנסיה", category: "פנסיה וקרן השתלמות", scope: yoni },
    { name: "אנליסט השתלמות", category: "פנסיה וקרן השתלמות", scope: home },
  ];
  for (const v of vendors) {
    await prisma.vendor.create({
      data: {
        name: v.name,
        normalizedName: v.name.toLowerCase().replace(/\s+/g, ""),
        defaultCategoryId: categoryIdByName.get(v.category),
        defaultScopeId: v.scope.id,
        isLearned: true,
      },
    });
  }

  // ── Recurring definitions — real fixed items from the ledger ──
  const recurring: {
    name: string;
    amount: number;
    day: number;
    direction: TransactionDirection;
    scope: typeof home;
    category: string;
    account: string;
  }[] = [
    { name: "משכנתא פועלים", amount: 5400, day: 15, direction: "EXPENSE", scope: home, category: "משכנתא / שכירות", account: "shared" },
    { name: "ארנונה", amount: 800, day: 10, direction: "EXPENSE", scope: home, category: "ארנונה", account: "shared" },
    { name: "חשמל", amount: 400, day: 20, direction: "EXPENSE", scope: home, category: "חשמל", account: "shared" },
    { name: "מים", amount: 260, day: 28, direction: "EXPENSE", scope: home, category: "מים", account: "shared" },
    { name: "ועד בית", amount: 480, day: 20, direction: "EXPENSE", scope: home, category: "ועד בית", account: "shared" },
    { name: "כלל ביטוח בריאות", amount: 478, day: 10, direction: "EXPENSE", scope: home, category: "ביטוחים", account: "shared" },
    { name: "אנליסט השתלמות ליזי", amount: 1710, day: 1, direction: "EXPENSE", scope: lizmiz, category: "פנסיה וקרן השתלמות", account: "shared" },
    { name: "מנורה פנסיה יוני", amount: 1316, day: 13, direction: "EXPENSE", scope: yoni, category: "פנסיה וקרן השתלמות", account: "shared" },
    { name: "שכר דירה בת ים", amount: 4650, day: 10, direction: "INCOME", scope: home, category: "אחר", account: "shared" },
    { name: "קצבת ילדים", amount: 276, day: 20, direction: "INCOME", scope: home, category: "אחר", account: "shared" },
    { name: "זיו שכירות משרד", amount: 2006, day: 1, direction: "EXPENSE", scope: yoni, category: "הוצאות עסקיות", account: "business" },
  ];
  for (const r of recurring) {
    await prisma.recurringDefinition.create({
      data: {
        name: r.name,
        amount: r.amount,
        expectedDay: r.day,
        direction: r.direction,
        scopeId: r.scope.id,
        bankAccountId: r.account === "shared" ? sharedAccount.id : yoniBizAccount.id,
        categoryId: categoryIdByName.get(r.category),
      },
    });
  }

  // ── Sample transactions — last 4 months, for real dashboard/insight numbers ──
  const vendorRows = await prisma.vendor.findMany();
  const vendorId = (name: string) => vendorRows.find((v) => v.name === name)!.id;

  type TxSeed = {
    vendor: string;
    category: string;
    scope: typeof home;
    amount: number;
    day: number;
    direction: TransactionDirection;
    effect:
      | "REAL_INCOME"
      | "REAL_EXPENSE"
      | "SAVINGS_INVESTMENT";
    account: "shared" | "business";
    card?: string;
  };

  // Baseline monthly pattern (used for the 3 comparison months), with August (current) intentionally
  // higher on "אוכל בחוץ" and "חופשות" to give the insights engine something real to flag.
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

  const cardRows = await prisma.creditCard.findMany();
  const cardId = (name: string) => cardRows.find((c) => c.name === name)?.id;

  const now = new Date();
  for (let monthsAgo = 3; monthsAgo >= 0; monthsAgo--) {
    const monthDate = startOfMonth(subMonths(now, monthsAgo));
    const isCurrent = monthsAgo === 0;
    for (const t of monthlyPattern) {
      // Skip rows dated later in the month than "today" for the current month (can't be ACTUAL yet).
      if (isCurrent && t.day > now.getDate()) continue;

      let amount = t.amount;
      if (isCurrent && (t.category === "אוכל בחוץ")) amount = Math.round(amount * 1.55);

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

    // Home income each month
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

    // Yoni business income each month (varies a bit)
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

  // A couple of still-pending items for the current month, so the forecast card has something real to show.
  await prisma.transaction.create({
    data: {
      transactionDate: setDate(now, Math.min(now.getDate() + 0, 28)),
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
