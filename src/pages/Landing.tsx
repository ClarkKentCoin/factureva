import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { setInterfaceLanguage } from "@/lib/i18n";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

export default function Landing() {
  const { t, i18n } = useTranslation();
  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 sm:px-8 h-16 flex items-center justify-between border-b border-border">
        <Link to="/" className="flex items-center" aria-label="Factureva">
          <img src={brandLogo} alt="Factureva" className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Globe className="h-4 w-4" />
                <span className="text-xs uppercase">{i18n.language}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setInterfaceLanguage("fr")}>Français</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInterfaceLanguage("en")}>English</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInterfaceLanguage("ru")}>Русский</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild variant="ghost"><Link to="/auth/sign-in">{t("auth.signIn")}</Link></Button>
          <Button asChild><Link to="/auth/sign-up">{t("auth.signUp")}</Link></Button>
        </div>
      </header>
      <section className="px-4 sm:px-8 py-16 sm:py-24 max-w-5xl mx-auto">
        <h1 className="font-serif text-4xl sm:text-6xl leading-tight">
          {t("app.tagline")}
        </h1>
        <p className="mt-6 text-muted-foreground max-w-xl text-lg">
          {t("landing.heroSubtitle")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/auth/sign-up">{t("auth.createAccount")}</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth/sign-in">{t("auth.signIn")}</Link></Button>
        </div>
      </section>
    </div>
  );
}
