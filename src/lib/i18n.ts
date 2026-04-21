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
      landing: {
        heroSubtitle: "Factures, devis, clients, paiements. Conçu pour la France — pensé pour l'international.",
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
        sideQuote: "« Une facturation française rigoureuse, pour des entrepreneurs sereins. »",
        sideTags: "Multi-tenant · Conforme · Mobile-first",
        accountCreated: "Compte créé",
      },
      onboarding: {
        title: "Configurons votre espace",
        step1: "Créer votre espace de travail",
        step2: "Choisir la langue de l'interface",
        step3: "Profil de l'entreprise",
        workspaceName: "Nom de l'espace de travail",
        continue: "Continuer",
        skip: "Plus tard",
        companyProfileNote: "Le formulaire complet de profil entreprise (forme juridique, SIREN/SIRET, régime TVA, mentions légales) est prêt côté données et sera connecté à l'étape suivante.",
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
        getStartedTitle: "Démarrez votre activité",
        getStartedDescription: "Configurez votre entreprise et créez votre première facture.",
      },
      placeholders: {
        invoices: "Le module de facturation arrive à l'étape suivante.",
        clients: "Le module clients arrive à l'étape suivante.",
        items: "Le catalogue d'articles/services arrive à l'étape suivante.",
        activities: "La gestion des activités déclarées arrive à l'étape suivante.",
        company: "Le profil entreprise détaillé (SIREN/SIRET, régime TVA, mentions légales) arrive à l'étape suivante.",
        settings: "Les paramètres d'espace arrivent à l'étape suivante.",
      },
      superadmin: {
        console: "Console plateforme",
        backToApp: "← Retour à l'app tenant",
        nav: { overview: "Vue d'ensemble", tenants: "Tenants", plans: "Plans & fonctionnalités", audit: "Journaux d'audit" },
        overview: {
          title: "Vue d'ensemble plateforme",
          description: "Santé et métriques de haut niveau",
          tenants: "Tenants", users: "Utilisateurs", subs: "Abonnements actifs",
          emptyTitle: "Diagnostics bientôt disponibles",
          emptyDescription: "Liste des tenants, plans/usage, outils de support et journaux d'audit sont préparés.",
        },
        tenants: {
          title: "Tenants", description: "Tous les espaces de travail de la plateforme",
          emptyTitle: "Aucun tenant",
          emptyDescription: "Les tenants apparaîtront ici lorsque les utilisateurs créeront des espaces.",
        },
        plans: {
          title: "Plans & fonctionnalités", description: "Monétisation par entitlements",
          plans: "Plans", features: "Fonctionnalités", active: "actif", inactive: "inactif",
        },
        audit: {
          title: "Journaux d'audit", description: "Actions tenant et plateforme",
          emptyTitle: "Aucun événement",
          emptyDescription: "Les actions sensibles (connexions, changements de rôles, opérations super_admin) apparaîtront ici.",
        },
      },
      notFound: { message: "Oups ! Page introuvable", back: "Retour à l'accueil" },
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
      landing: {
        heroSubtitle: "Invoices, quotes, clients, payments. Built for France — designed for international.",
      },
      auth: {
        signIn: "Sign in", signUp: "Create account", email: "Email", password: "Password",
        fullName: "Full name", noAccount: "No account yet?", haveAccount: "Already registered?",
        createAccount: "Create my account", welcome: "Welcome back",
        startTitle: "Set up your invoicing workspace",
        sideQuote: "“Rigorous French invoicing, for serene entrepreneurs.”",
        sideTags: "Multi-tenant · Compliant · Mobile-first",
        accountCreated: "Account created",
      },
      onboarding: {
        title: "Let's set up your workspace",
        step1: "Create your workspace", step2: "Choose interface language",
        step3: "Company profile", workspaceName: "Workspace name",
        continue: "Continue", skip: "Later",
        companyProfileNote: "The full company profile form (legal form, SIREN/SIRET, VAT regime, legal mentions) is data-ready and will be wired in the next step.",
      },
      dashboard: {
        welcome: "Welcome", revenue: "Revenue", unpaid: "Unpaid", clients: "Clients",
        recentActivity: "Recent activity", empty: "No recent activity.",
        quickActions: "Quick actions", newInvoice: "New invoice", newClient: "New client",
        completeProfile: "Complete company profile",
        getStartedTitle: "Get your business started",
        getStartedDescription: "Set up your company and create your first invoice.",
      },
      placeholders: {
        invoices: "The invoicing module is coming in the next step.",
        clients: "The clients module is coming in the next step.",
        items: "The items/services catalog is coming in the next step.",
        activities: "Declared activities management is coming in the next step.",
        company: "The detailed company profile (SIREN/SIRET, VAT regime, legal mentions) is coming in the next step.",
        settings: "Workspace settings are coming in the next step.",
      },
      superadmin: {
        console: "Platform console",
        backToApp: "← Back to tenant app",
        nav: { overview: "Overview", tenants: "Tenants", plans: "Plans & features", audit: "Audit logs" },
        overview: {
          title: "Platform overview", description: "Health and high-level metrics",
          tenants: "Tenants", users: "Users", subs: "Active subscriptions",
          emptyTitle: "Diagnostics coming soon",
          emptyDescription: "Tenant list, plan/usage visibility, support tools and platform audit logs are scaffolded.",
        },
        tenants: {
          title: "Tenants", description: "All workspaces on the platform",
          emptyTitle: "No tenants yet",
          emptyDescription: "Tenants will appear here as users sign up and create workspaces.",
        },
        plans: {
          title: "Plans & features", description: "Entitlement-based monetization",
          plans: "Plans", features: "Features", active: "active", inactive: "inactive",
        },
        audit: {
          title: "Audit logs", description: "Tenant and platform actions",
          emptyTitle: "No events yet",
          emptyDescription: "Sensitive actions (sign-ins, role changes, super_admin operations) will appear here.",
        },
      },
      notFound: { message: "Oops! Page not found", back: "Return to Home" },
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
      landing: {
        heroSubtitle: "Счета, сметы, клиенты, платежи. Создано для Франции — с прицелом на мир.",
      },
      auth: {
        signIn: "Войти", signUp: "Создать аккаунт", email: "Эл. почта", password: "Пароль",
        fullName: "Полное имя", noAccount: "Нет аккаунта?", haveAccount: "Уже есть аккаунт?",
        createAccount: "Создать аккаунт", welcome: "С возвращением",
        startTitle: "Создайте рабочее пространство",
        sideQuote: "«Строгий французский биллинг — для спокойных предпринимателей.»",
        sideTags: "Мульти-тенант · Соответствие · Mobile-first",
        accountCreated: "Аккаунт создан",
      },
      onboarding: {
        title: "Настроим рабочее пространство",
        step1: "Создать рабочее пространство", step2: "Выбрать язык интерфейса",
        step3: "Профиль компании", workspaceName: "Название рабочего пространства",
        continue: "Продолжить", skip: "Позже",
        companyProfileNote: "Полная форма профиля компании (юр. форма, SIREN/SIRET, режим НДС, юр. упоминания) готова на уровне данных и будет подключена на следующем шаге.",
      },
      dashboard: {
        welcome: "Добро пожаловать", revenue: "Выручка", unpaid: "Не оплачено", clients: "Клиенты",
        recentActivity: "Последняя активность", empty: "Нет недавней активности.",
        quickActions: "Быстрые действия", newInvoice: "Новый счёт", newClient: "Новый клиент",
        completeProfile: "Заполнить профиль компании",
        getStartedTitle: "Начните свою деятельность",
        getStartedDescription: "Настройте компанию и создайте первый счёт.",
      },
      placeholders: {
        invoices: "Модуль выставления счетов появится на следующем шаге.",
        clients: "Модуль клиентов появится на следующем шаге.",
        items: "Каталог товаров/услуг появится на следующем шаге.",
        activities: "Управление видами деятельности появится на следующем шаге.",
        company: "Подробный профиль компании (SIREN/SIRET, режим НДС, юр. упоминания) появится на следующем шаге.",
        settings: "Настройки рабочего пространства появятся на следующем шаге.",
      },
      superadmin: {
        console: "Консоль платформы",
        backToApp: "← Назад в приложение",
        nav: { overview: "Обзор", tenants: "Тенанты", plans: "Тарифы и функции", audit: "Журналы аудита" },
        overview: {
          title: "Обзор платформы", description: "Состояние и ключевые метрики",
          tenants: "Тенанты", users: "Пользователи", subs: "Активные подписки",
          emptyTitle: "Диагностика скоро",
          emptyDescription: "Список тенантов, тарифы/использование, инструменты поддержки и журналы аудита подготовлены.",
        },
        tenants: {
          title: "Тенанты", description: "Все рабочие пространства платформы",
          emptyTitle: "Тенантов пока нет",
          emptyDescription: "Тенанты появятся здесь по мере регистрации пользователей.",
        },
        plans: {
          title: "Тарифы и функции", description: "Монетизация по entitlements",
          plans: "Тарифы", features: "Функции", active: "активен", inactive: "неактивен",
        },
        audit: {
          title: "Журналы аудита", description: "Действия тенанта и платформы",
          emptyTitle: "Событий пока нет",
          emptyDescription: "Чувствительные действия (входы, изменения ролей, операции super_admin) появятся здесь.",
        },
      },
      notFound: { message: "Упс! Страница не найдена", back: "На главную" },
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
