import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { STORAGE_KEYS } from "./storageKeys";

const locales = ["en", "pl"] as const;
type Locale = (typeof locales)[number];

const messages = {
  en: {
    active: "active",
    activeProject: "Active project",
    addProductsHeadline: "Add products\nwithout leaving the page.",
    addProductsIntro:
      "Connect the extension to MyVibeProject and start clipping automatically.",
    addToShoppingList: "Add to shopping list",
    additionalInformation: "Additional information",
    alternativeFor: "Alternative for",
    areaCaptureCancelled: "Area capture cancelled.",
    areaCaptureFailed: "Area capture failed. Try again.",
    areaPickerActive: "Area picker active",
    back: "Back",
    captureArea: "Capture area",
    catalogNumber: "Catalog number",
    catalogNumberPlaceholder: "e.g. BU1K367PH-3BC1",
    chooseTeam: "Choose a team",
    clickImageSelect: "Click an image on the page to select it.",
    close: "Close",
    couldNotConnectServer: "Could not connect to the server.",
    couldNotStartAreaCapture: "Could not start area capture.",
    couldNotStartAreaCapturePage: "Could not start area capture on this page.",
    couldNotStartImagePicker: "Could not start image picker on this page.",
    couldNotStartSignIn: "Could not start sign-in.",
    dragCaptureArea: "Drag on the page to capture an area.",
    finishSignIn: "Finish sign-in in the newly opened tab.",
    imagePickerActive: "Image picker active",
    imageUpdated: "Image updated.",
    invalidServerResponse: "Invalid server response.",
    loadingData: "Loading data...",
    noAlternativesDefault: "No alternatives (default)",
    noImageSelected: "No image selected",
    noProjectsFound: "No projects found",
    noProjectsFoundDescription: "This team does not have any active projects yet.",
    noSelectableImages: "No selectable images found on this page.",
    noTeamsFound: "No teams found",
    noTeamsFoundDescription:
      "You must belong to at least one team to use this extension.",
    notes: "Notes",
    notesPlaceholder: "Additional details",
    openMainApp: "Open MyVibeProject",
    pickExisting: "Pick existing",
    price: "Price",
    product: "Product",
    productDetails: "Product details",
    productDetectionHttpOnly:
      "Product detection works only on http/https pages.",
    productImage: "Product image",
    productLink: "Product link",
    productName: "Product name *",
    productNameRequired: "Product name is required.",
    productNamePlaceholder: "e.g. Ceramic tiles",
    productSaved: "Product added to shopping list.",
    projectsCount: "{count} projects",
    quantity: "Quantity",
    refreshData: "Refresh data",
    saving: "Saving...",
    sectionCount: "{count} shopping list sections",
    selectedProject: "Selected project: {name}",
    sessionExpired: "Session expired. Please sign in again.",
    signIn: "Sign In",
    signInDescription: "Authentication is handled by the main app.",
    signInFailed: "Sign-in failed. Please sync your session again.",
    signInTimedOut: "Sign-in timed out. Please click Sync session again.",
    signedIn: "Signed in successfully.",
    signOut: "Sign out",
    signedOut: "Signed out.",
    shoppingListSection: "Shopping list section",
    supplier: "Supplier",
    supplierName: "Supplier name",
    syncSession: "Sync session",
    switchLanguage: "Switch language",
    teamProjects: "Team projects",
    teamsCount: "{count} teams",
    unknownError: "Unknown error",
    uncategorizedDefault: "Uncategorized (default)",
    yourTeams: "Your teams",
  },
  pl: {
    active: "aktywnych",
    activeProject: "Aktywny projekt",
    addProductsHeadline: "Dodawaj produkty\nbez opuszczania strony.",
    addProductsIntro:
      "Połącz wtyczkę z MyVibeProject i zapisuj produkty automatycznie.",
    addToShoppingList: "Dodaj do listy zakupów",
    additionalInformation: "Dodatkowe informacje",
    alternativeFor: "Alternatywa dla",
    areaCaptureCancelled: "Przechwytywanie obszaru anulowane.",
    areaCaptureFailed: "Nie udało się przechwycić obszaru. Spróbuj ponownie.",
    areaPickerActive: "Wybór obszaru aktywny",
    back: "Wróć",
    captureArea: "Zaznacz obszar",
    catalogNumber: "Numer katalogowy",
    catalogNumberPlaceholder: "np. BU1K367PH-3BC1",
    chooseTeam: "Wybierz zespół",
    clickImageSelect: "Kliknij obraz na stronie, aby go wybrać.",
    close: "Zamknij",
    couldNotConnectServer: "Nie udało się połączyć z serwerem.",
    couldNotStartAreaCapture: "Nie udało się uruchomić przechwytywania obszaru.",
    couldNotStartAreaCapturePage:
      "Nie udało się uruchomić przechwytywania obszaru na tej stronie.",
    couldNotStartImagePicker: "Nie udało się uruchomić wyboru obrazu na tej stronie.",
    couldNotStartSignIn: "Nie udało się rozpocząć logowania.",
    dragCaptureArea: "Przeciągnij na stronie, aby przechwycić obszar.",
    finishSignIn: "Dokończ logowanie w nowo otwartej karcie.",
    imagePickerActive: "Wybór obrazu aktywny",
    imageUpdated: "Obraz zaktualizowany.",
    invalidServerResponse: "Nieprawidłowa odpowiedź serwera.",
    loadingData: "Ładowanie danych...",
    noAlternativesDefault: "Bez alternatyw (domyślnie)",
    noImageSelected: "Nie wybrano obrazu",
    noProjectsFound: "Nie znaleziono projektów",
    noProjectsFoundDescription: "Ten zespół nie ma jeszcze aktywnych projektów.",
    noSelectableImages: "Nie znaleziono obrazów do wyboru na tej stronie.",
    noTeamsFound: "Nie znaleziono zespołów",
    noTeamsFoundDescription:
      "Musisz należeć do co najmniej jednego zespołu, aby używać tej wtyczki.",
    notes: "Notatki",
    notesPlaceholder: "Dodatkowe szczegóły",
    openMainApp: "Otwórz MyVibeProject",
    pickExisting: "Wybierz obraz",
    price: "Cena",
    product: "Produkt",
    productDetails: "Szczegóły produktu",
    productDetectionHttpOnly:
      "Wykrywanie produktu działa tylko na stronach http/https.",
    productImage: "Obraz produktu",
    productLink: "Link do produktu",
    productName: "Nazwa produktu *",
    productNameRequired: "Nazwa produktu jest wymagana.",
    productNamePlaceholder: "np. płytki ceramiczne",
    productSaved: "Produkt dodany do listy zakupów.",
    projectsCount: "{count} projektów",
    quantity: "Ilość",
    refreshData: "Odśwież dane",
    saving: "Zapisywanie...",
    sectionCount: "{count} sekcji listy zakupów",
    selectedProject: "Wybrany projekt: {name}",
    sessionExpired: "Sesja wygasła. Zaloguj się ponownie.",
    signIn: "Zaloguj się",
    signInDescription: "Uwierzytelnianie odbywa się w głównej aplikacji.",
    signInFailed: "Logowanie nie powiodło się. Zsynchronizuj sesję ponownie.",
    signInTimedOut:
      "Logowanie przekroczyło limit czasu. Kliknij ponownie Synchronizuj sesję.",
    signedIn: "Zalogowano pomyślnie.",
    signOut: "Wyloguj",
    signedOut: "Wylogowano.",
    shoppingListSection: "Sekcja listy zakupów",
    supplier: "Dostawca",
    supplierName: "Nazwa dostawcy",
    syncSession: "Synchronizuj sesję",
    switchLanguage: "Zmień język",
    teamProjects: "Projekty zespołu",
    teamsCount: "{count} zespołów",
    unknownError: "Nieznany błąd",
    uncategorizedDefault: "Bez kategorii (domyślnie)",
    yourTeams: "Twoje zespoły",
  },
} satisfies Record<Locale, Record<string, string>>;

type MessageKey = keyof (typeof messages)["en"];

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

function getInitialLocale(): Locale {
  const chromeLocale = chrome.i18n?.getUILanguage?.().toLowerCase();
  if (chromeLocale?.startsWith("pl")) return "pl";

  const browserLocale = navigator.language?.toLowerCase();
  if (browserLocale?.startsWith("pl")) return "pl";

  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    let isMounted = true;

    void chrome.storage.local.get(STORAGE_KEYS.LOCALE).then((stored) => {
      const storedLocale = stored[STORAGE_KEYS.LOCALE];
      if (isMounted && isLocale(storedLocale)) {
        setLocaleState(storedLocale);
      }
    });

    const storageListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local") {
        return;
      }

      const localeChange = changes[STORAGE_KEYS.LOCALE];
      if (isLocale(localeChange?.newValue)) {
        setLocaleState(localeChange.newValue);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      isMounted = false;
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    void chrome.storage.local.set({ [STORAGE_KEYS.LOCALE]: nextLocale });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, values) => {
        const template = messages[locale][key] ?? messages.en[key] ?? key;

        if (!values) return template;

        return template.replace(/\{(\w+)\}/g, (match, valueKey: string) =>
          Object.prototype.hasOwnProperty.call(values, valueKey)
            ? String(values[valueKey])
            : match,
        );
      },
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return context;
}

export function translateForLocale(
  key: MessageKey,
  localeValue?: string,
): string {
  const locale = isLocale(localeValue) ? localeValue : getInitialLocale();
  return messages[locale][key] ?? messages.en[key] ?? key;
}
