import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Interface language only. Document language is a separate concept and lives on
// tenant/company/document records — never mixed with UI translations.
const resources = {
  fr: {
    translation: {
      app: { name: "Facturly", tagline: "Facturation française, simple et structurée." },
      nav: {
        dashboard: "Tableau de bord",
        invoices: "Factures",
        clients: "Clients",
        company: "Entreprise",
        items: "Catalogue",
        activities: "Activités",
        settings: "Paramètres",
        signOut: "Se déconnecter",
        superadmin: "Superadmin",
      },
      auth: {
        signIn: "Se connecter",
        signUp: "Créer un compte",
        email: "E-mail",
        password: "Mot de passe",
        fullName: "Nom complet",
        noAccount: "Pas encore de compte ?",
        haveAccount: "Déjà inscrit ?",
        createAccount: "Créer mon compte",
        welcome: "Bon retour parmi nous",
        startTitle: "Créez votre espace de facturation",
      },
      onboarding: {
        title: "Configurons votre espace",
        step1: "Créer votre espace de travail",
        step2: "Choisir la langue de l'interface",
        step3: "Profil de l'entreprise",
        workspaceName: "Nom de l'espace de travail",
        continue: "Continuer",
        skip: "Plus tard",
      },
      dashboard: {
        welcome: "Bienvenue",
        revenue: "Chiffre d'affaires",
        unpaid: "Impayé",
        clients: "Clients",
        recentActivity: "Activité récente",
        empty: "Aucune activité récente.",
        quickActions: "Actions rapides",
        newInvoice: "Nouvelle facture",
        newClient: "Nouveau client",
        completeProfile: "Compléter le profil entreprise",
      },
      common: {
        loading: "Chargement…",
        save: "Enregistrer",
        cancel: "Annuler",
        comingSoon: "Bientôt disponible",
      },
    },
  },
  en: {
    translation: {
      app: { name: "Facturly", tagline: "French invoicing, simple and structured." },
      nav: {
        dashboard: "Dashboard", invoices: "Invoices", clients: "Clients",
        company: "Company", items: "Catalog", activities: "Activities",
        settings: "Settings", signOut: "Sign out", superadmin: "Superadmin",
      },
      auth: {
        signIn: "Sign in", signUp: "Create account", email: "Email", password: "Password",
        fullName: "Full name", noAccount: "No account yet?", haveAccount: "Already registered?",
        createAccount: "Create my account", welcome: "Welcome back",
        startTitle: "Set up your invoicing workspace",
      },
      onboarding: {
        title: "Let's set up your workspace",
        step1: "Create your workspace", step2: "Choose interface language",
        step3: "Company profile", workspaceName: "Workspace name",
        continue: "Continue", skip: "Later",
      },
      dashboard: {
        welcome: "Welcome", revenue: "Revenue", unpaid: "Unpaid", clients: "Clients",
        recentActivity: "Recent activity", empty: "No recent activity.",
        quickActions: "Quick actions", newInvoice: "New invoice", newClient: "New client",
        completeProfile: "Complete company profile",
      },
      common: { loading: "Loading…", save: "Save", cancel: "Cancel", comingSoon: "Coming soon" },
    },
  },
  ru: {
    translation: {
      app: { name: "Facturly", tagline: "Французский биллинг — просто и структурно." },
      nav: {
        dashboard: "Дашборд", invoices: "Счета", clients: "Клиенты",
        company: "Компания", items: "Каталог", activities: "Виды деятельности",
        settings: "Настройки", signOut: "Выйти", superadmin: "Суперадмин",
      },
      auth: {
        signIn: "Войти", signUp: "Создать аккаунт", email: "Эл. почта", password: "Пароль",
        fullName: "Полное имя", noAccount: "Нет аккаунта?", haveAccount: "Уже есть аккаунт?",
        createAccount: "Создать аккаунт", welcome: "С возвращением",
        startTitle: "Создайте рабочее пространство",
      },
      onboarding: {
        title: "Настроим рабочее пространство",
        step1: "Создать рабочее пространство", step2: "Выбрать язык интерфейса",
        step3: "Профиль компании", workspaceName: "Название рабочего пространства",
        continue: "Продолжить", skip: "Позже",
      },
      dashboard: {
        welcome: "Добро пожаловать", revenue: "Выручка", unpaid: "Не оплачено", clients: "Клиенты",
        recentActivity: "Последняя активность", empty: "Нет недавней активности.",
        quickActions: "Быстрые действия", newInvoice: "Новый счёт", newClient: "Новый клиент",
        completeProfile: "Заполнить профиль компании",
      },
      common: { loading: "Загрузка…", save: "Сохранить", cancel: "Отмена", comingSoon: "Скоро" },
    },
  },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem("facturly.lang") || "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

export const setInterfaceLanguage = (lang: "fr" | "en" | "ru") => {
  localStorage.setItem("facturly.lang", lang);
  void i18n.changeLanguage(lang);
};

export default i18n;
