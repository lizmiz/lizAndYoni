import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <div className="text-4xl">🧭</div>
      <div>
        <h1 className="text-2xl font-bold text-ink">מצפן פיננסי משפחתי</h1>
        <p className="mt-2 text-ink-soft">מרכז שליטה פיננסי לבית, ליזמיז ולעסק של יוני</p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <Button type="submit" size="lg">
          התחברות עם Google
        </Button>
      </form>
      <p className="max-w-xs text-xs text-ink-faint">
        הגישה מוגבלת לחשבונות Google המורשים של בני המשפחה בלבד.
      </p>
    </div>
  );
}
