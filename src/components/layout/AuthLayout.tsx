import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import brandLogoLight from "@/assets/factureva-logo.png";
import brandIcon from "@/assets/factureva-icon.png";

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-primary text-primary-foreground">
        <Link to="/" className="inline-flex items-center gap-2" aria-label="Factureva">
          <img src={brandIcon} alt="" className="h-8 w-8 bg-primary-foreground rounded p-1" />
          <span className="font-serif text-2xl">Factureva</span>
        </Link>
        <div>
          <p className="font-serif text-3xl leading-snug max-w-md">
            {t("auth.sideQuote")}
          </p>
          <p className="mt-4 text-sm opacity-70">{t("auth.sideTags")}</p>
        </div>
        <div className="text-xs opacity-60">© Factureva</div>
      </div>
      <div className="flex flex-col">
        <div className="lg:hidden p-6 border-b border-border">
          <Link to="/" className="inline-flex items-center" aria-label="Factureva">
            <img src={brandLogoLight} alt="Factureva" className="h-7 w-auto" />
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <h1 className="font-serif text-3xl">{title}</h1>
            {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
