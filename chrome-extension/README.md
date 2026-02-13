# 🚀 Planner Web Clipper Pro - React Version

**Nowoczesna wtyczka Chrome zbudowana z React i TypeScript**

React-owa wersja profesjonalnego web clippera dla Planner shopping lists. Wykorzystuje najnowsze technologie do zapewnienia płynnego doświadczenia użytkownika.

## ✨ Funkcje

### 🛒 **Inteligentne wykrywanie produktów**
- Automatyczne wykrywanie produktów na popularnych stronach e-commerce
- Ekstraktowanie nazwy, ceny, obrazów i szczegółów produktu
- Inteligentne wypełnianie formularza wykrytymi danymi
- Fallback dla manualnego wprowadzania danych

### ⚡ **Szybkie akcje**
- **Ctrl+Shift+X** - Otwórz web clipper
- **Ctrl+Shift+S** - Zapisz bieżący produkt
- **Ctrl+Shift+Q** - Tryb zrzutu ekranu
- **Ctrl+Shift+Z** - Wyczyść dane clippera
- Menu kontekstowe dla zaznaczonego tekstu/obrazów

### 🎨 **Nowoczesny interfejs**
- Zbudowany z React i TypeScript
- Piękny interfejs Tailwind CSS
- Responsywny design działający na każdej stronie
- Płynne animacje i przejścia

### 🔗 **Bezproblemowa integracja**
- Bezpośrednia integracja z aplikacją Planner
- Zarządzanie organizacjami i sekcjami
- Śledzenie priorytetów i statusów
- Synchronizacja sesji dla uwierzytelniania

## 🛠️ Instalacja

### Ustawienia deweloperskie

1. **Zainstaluj zależności:**
   ```bash
   cd apps/chrome-extension-react
   pnpm install
   ```

2. **Zbuduj rozszerzenie:**
   ```bash
   pnpm build
   ```

3. **Załaduj rozszerzenie w Chrome:**
   - Otwórz Chrome i przejdź do `chrome://extensions/`
   - Włącz "Developer mode" (przełącznik w prawym górnym rogu)
   - Kliknij "Load unpacked"
   - Wybierz folder `dist` wygenerowany przez build

4. **Skonfiguruj rozszerzenie:**
   - Zaktualizuj `src/config/index.ts` z URL-em swojej aplikacji
   - Upewnij się, że Twoja aplikacja ma wymagane endpointy API

### Rozwój w trybie dev

```bash
# Uruchom w trybie deweloperskim (z hot reload)
pnpm dev

# Sprawdź błędy TypeScript
pnpm type-check

# Uruchom linter
pnpm lint
```

### Wymagane endpointy API

Twoja aplikacja Next.js potrzebuje tych endpointów:

```typescript
// Wymagane route API w aplikacji:
/api/extension/auth          // Sprawdzanie uwierzytelnienia + organizacje  
/api/extension/session-sync  // Synchronizacja sesji
/api/extension/sections      // Pobieranie sekcji dla organizacji
/api/shopping-list          // Dodawanie produktów do listy zakupów
```

## 📋 Użycie

### 1. **Pierwsza konfiguracja**
- Kliknij ikonę rozszerzenia w pasku narzędzi Chrome
- Kliknij "Sync with Planner App" aby się uwierzytelnić
- Twoje organizacje zostaną załadowane automatycznie

### 2. **Dodawanie produktów**
- Przejdź do strony z produktem
- Kliknij ikonę rozszerzenia lub naciśnij **Ctrl+Shift+X**
- Szczegóły produktu zostaną wykryte automatycznie
- Przejrzyj i edytuj jeśli potrzeba
- Wybierz organizację i sekcję
- Kliknij "Zapisz do listy zakupów"

### 3. **Manualne wprowadzanie**
- Użyj clippera na dowolnej stronie
- Wypełnij szczegóły produktu manualnie
- Ustaw ilość, cenę i notatki
- Wybierz priorytet i status
- Zapisz do swojej listy zakupów

## 🏗️ Architektura

### **Struktura React + TypeScript**
```
src/
├── components/
│   ├── App.tsx                 # Główny komponent aplikacji
│   ├── views/                  # Komponenty widoków
│   │   ├── LoginView.tsx       # Widok logowania
│   │   ├── OrganizationView.tsx # Wybór organizacji
│   │   └── ClipperView.tsx     # Główny clipper
│   └── ui/                     # Komponenty UI
│       └── Toast.tsx           # Powiadomienia
├── types/                      # Definicje TypeScript
├── config/                     # Konfiguracja aplikacji
├── utils/                      # Utilities
│   └── ProductDetector.ts      # Logika wykrywania produktów
├── background.ts               # Service worker
├── content.tsx                 # Content script z React
├── popup.tsx                   # Entry point popup
└── index.css                   # Style Tailwind
```

### **Kluczowe komponenty**

#### **Background Service Worker**
- Obsługuje uwierzytelnianie z aplikacją
- Zarządza wywołaniami API do backendu Next.js
- Komunikacja oparta na portach z content scripts
- Obsługa menu kontekstowego i skrótów klawiszowych

#### **Content Script React**
- Wstrzykuje interfejs React overlay
- Zaawansowane algorytmy wykrywania produktów
- Zarządzanie formularzami i walidacja
- Kalkulacje cen w czasie rzeczywistym

#### **Popup React**
- Nowoczesny dashboard ze statusem uwierzytelnienia
- Przyciski szybkich akcji
- Referencja skrótów klawiszowych
- Dostęp do ustawień i pomocy

### **Wykrywanie produktów**

Rozszerzenie zawiera zaawansowane selektory dla:

- **Ogólne strony e-commerce**: Uniwersalne selektory działające na różnych platformach
- **Reguły specyficzne dla stron**: Zoptymalizowane dla Allegro, Amazon, eBay, Ceneo
- **Wykrywanie fallback**: Manualne wprowadzanie gdy auto-wykrywanie zawiedzie

```typescript
// Przykład wykrywania dla Allegro.pl
'allegro.pl': {
  name: 'h1[data-testid="ad-title"]',
  price: '[data-testid="price-container"] span',
  image: '[data-testid="product-image"] img',
  supplier: '[data-testid="seller-name"]'
}
```

## 🔧 Konfiguracja

### **Zmienne środowiskowe**

Zaktualizuj te w `src/config/index.ts`:

```typescript
// Development
export const CONFIG = {
  API_BASE: 'http://localhost:3000/api',
  MAIN_APP_URL: 'http://localhost:3000'
}

// Production
export const CONFIG = {
  API_BASE: 'https://twoja-domena-planner.com/api',
  MAIN_APP_URL: 'https://twoja-domena-planner.com'
}
```

### **Uprawnienia**

Rozszerzenie wymaga tych uprawnień:
- `tabs` - Dostęp do informacji o bieżącej karcie
- `activeTab` - Wstrzykiwanie skryptów do aktywnej karty
- `storage` - Zapisywanie ustawień rozszerzenia
- `contextMenus` - Opcje menu po kliknięciu prawym przyciskiem
- `commands` - Skróty klawiszowe
- `<all_urls>` - Działanie na każdej stronie

## 🔐 Bezpieczeństwo

- Brak przechowywania wrażliwych danych w rozszerzeniu
- Uwierzytelnianie obsługiwane przez główną aplikację
- Synchronizacja sesji przez bezpieczne endpointy backendu
- Wymuszanie Content Security Policy

## 🐛 Debugowanie

### **Chrome DevTools**
1. Kliknij prawym przyciskiem na ikonę rozszerzenia → "Inspect popup"
2. Przejdź do `chrome://extensions/` → Kliknij "Inspect views: service worker"
3. Otwórz dowolną stronę → F12 → Sprawdź logi content script

### **Częste problemy**

**Rozszerzenie nie działa:**
- Sprawdź czy Twoja aplikacja Next.js jest uruchomiona
- Zweryfikuj czy endpointy API są dostępne
- Sprawdź konsolę pod kątem błędów CORS

**Wykrywanie produktów zawodzi:**
- Spróbuj trybu manualnego wprowadzania
- Sprawdź czy struktura strony się zmieniła
- Dodaj niestandardowe selektory dla nowych stron

**Problemy z uwierzytelnianiem:**
- Wyczyść storage rozszerzenia w DevTools
- Ponownie zsynchronizuj sesję z popup
- Sprawdź cookies sesji w głównej aplikacji

## 🚀 Deployment

Do produkcji:

1. **Zbuduj dla produkcji:**
   ```bash
   pnpm build
   ```

2. **Spakuj rozszerzenie:**
   ```bash
   cd dist
   zip -r chrome-extension-react.zip .
   ```

3. **Prześlij do Chrome Web Store:**
   - Przejdź do [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - Prześlij plik ZIP
   - Wypełnij szczegóły listingu
   - Prześlij do przeglądu

## 🎯 Różnice od wersji Vanilla JS

### **Zalety wersji React:**
- ✅ **Type Safety** - Pełny TypeScript dla lepszej jakości kodu
- ✅ **Component Architecture** - Modularna, reużywalna struktura
- ✅ **Modern Tooling** - Vite, hot reload, dev tools
- ✅ **State Management** - React hooks dla lepszego stanu aplikacji
- ✅ **Maintainability** - Łatwiejsza do utrzymania i rozwijania

### **Trade-offs:**
- ⚠️ **Bundle Size** - Nieco większy ze względu na React
- ⚠️ **Build Step** - Wymaga procesu budowania (vs. bezpośrednie pliki JS)
- ⚠️ **Complexity** - Więcej konfiguracji narzędzi deweloperskich

## 📝 Contributing

1. Fork repository
2. Stwórz branch dla feature (`git checkout -b feature/amazing-feature`)
3. Commit zmiany (`git commit -m 'Add amazing feature'`)
4. Push do branch (`git push origin feature/amazing-feature`)
5. Otwórz Pull Request

## 📄 Licencja

Ten projekt jest licencjonowany pod MIT License - zobacz plik [LICENSE](../../license.md) dla szczegółów.

---

**Stworzony z ❤️ używając React, TypeScript i Tailwind CSS** 