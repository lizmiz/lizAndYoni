import type { PrismaClient, TransactionDirection } from "@prisma/client";

/**
 * Bootstraps the starter data every fresh install needs: scopes, the two real bank
 * accounts, credit cards, the category tree, vendor-learning defaults, and the fixed
 * income/expense items — all derived from the real Sheets/MAX analysis. Idempotent:
 * safe to call more than once, it no-ops once a FinancialScope already exists.
 *
 * Deliberately excludes demo transactions — those are dev-only (see prisma/seed.ts).
 */
export async function seedReferenceData(prisma: PrismaClient) {
  const already = await prisma.financialScope.count();
  if (already > 0) {
    return { ok: false as const, reason: "already-seeded" as const };
  }

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

  const sharedAccount = await prisma.bankAccount.create({
    data: { name: "חשבון משותף", bankName: "מזרחי טפחות", last4: "5979", primaryScopeId: home.id },
  });
  const yoniBizAccount = await prisma.bankAccount.create({
    data: { name: "חשבון עסקי יוני", bankName: "בנק לאומי", last4: "1088", primaryScopeId: yoni.id },
  });

  await prisma.creditCard.createMany({
    data: [
      { name: "MAX ליזי", network: "MAX", last4: "8595", bankAccountId: sharedAccount.id },
      { name: "כרטיס יוני", network: "MAX", last4: "8398", bankAccountId: sharedAccount.id },
      { name: "כ.א בנק לאומי", network: "Isracard", last4: "1088", bankAccountId: yoniBizAccount.id },
    ],
  });

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
    { name: "ילדים", icon: "🧒", children: [{ name: "חוגים, צהרונים וקייטנות", icon: "🎨" }] },
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

  return { ok: true as const };
}
