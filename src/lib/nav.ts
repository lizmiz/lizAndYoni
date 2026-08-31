import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  Landmark,
  Repeat,
  LineChart,
  ShieldCheck,
  Sparkles,
  Upload,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean; // shown in mobile bottom bar
  children?: { href: string; label: string }[]; // shown nested under this item in the desktop sidebar
};

export const TRANSACTION_VIEWS = [
  { key: "income", label: "הכנסות" },
  { key: "expected", label: "עתיד להיכנס" },
  { key: "expense", label: "הוצאות" },
] as const;

export type TransactionViewKey = (typeof TRANSACTION_VIEWS)[number]["key"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ראשי", icon: LayoutDashboard, primary: true },
  {
    href: "/transactions",
    label: "תנועות",
    icon: ArrowLeftRight,
    primary: true,
    children: TRANSACTION_VIEWS.map((v) => ({ href: `/transactions?view=${v.key}`, label: v.label })),
  },
  { href: "/insights", label: "תובנות שלי", icon: Sparkles, primary: true },
  { href: "/accounts", label: "חשבונות וכרטיסים", icon: Landmark },
  { href: "/categories", label: "קטגוריות", icon: Tags },
  { href: "/recurring", label: "הכנסות והוצאות קבועות", icon: Repeat },
  { href: "/investments", label: "השקעות וחסכונות", icon: LineChart },
  { href: "/insurance", label: "ביטוחים", icon: ShieldCheck },
  { href: "/import", label: "ייבוא נתונים", icon: Upload },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

export const SCOPES = [
  { key: "all", label: "הכול", icon: "" },
  { key: "HOME", label: "בית", icon: "🏠" },
  { key: "LIZMIZ", label: "ליזמיז", icon: "💼" },
  { key: "YONI", label: "יוני", icon: "⚖️" },
] as const;

export type ScopeKeyParam = (typeof SCOPES)[number]["key"];
