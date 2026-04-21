import { ReactNode } from "react";
import { Link } from "react-router-dom";

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-primary text-primary-foreground">
        <Link to="/" className="font-serif text-2xl">Facturly</Link>
        <div>
          <p className="font-serif text-3xl leading-snug max-w-md">
            « Une facturation française rigoureuse, pour des entrepreneurs sereins. »
          </p>
          <p className="mt-4 text-sm opacity-70">Multi-tenant · Conforme · Mobile-first</p>
        </div>
        <div className="text-xs opacity-60">© Facturly</div>
      </div>
      <div className="flex flex-col">
        <div className="lg:hidden p-6 border-b border-border">
          <Link to="/" className="font-serif text-2xl">Facturly</Link>
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
