import { useTranslation } from "react-i18next";
import { PageBody, PageHeader, EmptyState } from "@/components/layout/PageScaffold";

export function makePlaceholder(titleKey: string, body: string) {
  return function PlaceholderPage() {
    const { t } = useTranslation();
    return (
      <PageBody>
        <PageHeader title={t(titleKey)} />
        <EmptyState title={t("common.comingSoon")} description={body} />
      </PageBody>
    );
  };
}

export const InvoicesPage = makePlaceholder("nav.invoices", "Le module de facturation arrive à l'étape suivante.");
export const ClientsPage = makePlaceholder("nav.clients", "Le module clients arrive à l'étape suivante.");
export const ItemsPage = makePlaceholder("nav.items", "Le catalogue d'articles/services arrive à l'étape suivante.");
export const ActivitiesPage = makePlaceholder("nav.activities", "La gestion des activités déclarées arrive à l'étape suivante.");
export const CompanyPage = makePlaceholder("nav.company", "Le profil entreprise détaillé (SIREN/SIRET, régime TVA, mentions légales) arrive à l'étape suivante.");
export const SettingsPage = makePlaceholder("nav.settings", "Les paramètres d'espace arrivent à l'étape suivante.");
