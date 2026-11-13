import { openExternalLink } from "@/lib/app-links";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { cloudSignIn, useAccounts } from "./AccountMenu";

/** The one direct Cloud sign-in in the sidebar. The account menu itself lives on the right, with the apps. */
export function SidebarCloudLogin({ className, compact = false }: { className?: string; compact?: boolean }) {
  const accounts = useAccounts();
  if (!accounts.view || accounts.view.active) return null;
  return (
    <button
      type="button"
      data-sidebar-cloud-login=""
      aria-label={t("accounts.signIn")}
      title={t("accounts.signIn")}
      onClick={() => void cloudSignIn({ begin: window.ogb?.cloudAccount?.begin, openExternal: openExternalLink })}
      className={cn(
        compact
          ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-[12px] font-semibold text-white hover:opacity-90"
          : "flex min-h-9 items-center justify-center rounded-xl bg-accent px-3 text-[14px] font-medium text-white hover:opacity-90",
        className,
      )}
    >
      {compact ? "登" : t("accounts.signIn")}
    </button>
  );
}
