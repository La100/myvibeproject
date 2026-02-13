# 🚀 Instalacja Chrome Extension - React

## Szybka instalacja

### 1. Zbuduj wtyczkę

```bash
cd apps/chrome-extension-react
pnpm install
pnpm build
```

### 2. Załaduj w Chrome

1. Otwórz Chrome
2. Przejdź do `chrome://extensions/`
3. Włącz **"Developer mode"** (przełącznik w prawym górnym rogu)
4. Kliknij **"Load unpacked"**
5. Wybierz folder `apps/chrome-extension-react/dist/`

### 3. Gotowe! 🎉

Wtyczka jest teraz zainstalowana. Ikona powinna pojawić się na pasku narzędzi Chrome.

## Test funkcjonalności

1. **Otwórz dowolną stronę e-commerce** (np. Allegro, Amazon)
2. **Kliknij ikonę wtyczki** lub naciśnij `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`)
3. **Popup otworzy się** z formularzem do dodawania produktu
4. **Produkt zostanie wykryty automatycznie** (jeśli strona jest obsługiwana)

## Skróty klawiszowe

- `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`) - Otwórz clipper
- `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`) - Zapisz produkt
- `Ctrl+Shift+Q` (Mac: `Cmd+Shift+Q`) - Tryb zrzutu ekranu
- `Ctrl+Shift+Z` (Mac: `Cmd+Shift+Z`) - Wyczyść dane

## Debugowanie

Jeśli wtyczka nie działa:

1. **Sprawdź konsolę:**
   - Kliknij prawym na ikonę wtyczki → "Inspect popup"
   - Przejdź do `chrome://extensions/` → "Inspect views: service worker"

2. **Sprawdź uprawnienia:**
   - Upewnij się że wtyczka ma dostęp do strony
   - Kliknij na ikonę i sprawdź czy są błędy

3. **Przeładuj wtyczkę:**
   - Przejdź do `chrome://extensions/`
   - Kliknij przycisk odświeżania przy wtyczce

## Rozwój

```bash
# Uruchom w trybie dev (z hot reload)
pnpm dev

# Sprawdź błędy TypeScript  
pnpm type-check

# Uruchom linter
pnpm lint
```

---

**Więcej informacji w [README.md](./README.md)** 