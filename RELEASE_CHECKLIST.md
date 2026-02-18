# Checklista Go-Live (stan na 2026-02-17)

## 1) Build i jakość

- [x] `pnpm lint` przechodzi (root)
- [x] `pnpm build` przechodzi (root)
- [ ] Testy automatyczne (brak skryptu `test` w root)
- [ ] CI/CD pipeline (brak `.github/workflows`)
- [ ] Clean working tree przed releasem (obecnie dużo zmian lokalnych)

## 2) Bezpieczeństwo i zależności

- [ ] Root: `pnpm audit --audit-level high` bez `high/critical`
- [ ] Chrome extension: `pnpm -C chrome-extension audit --audit-level high` bez `high/critical`
- [ ] Aktualizacja `next` do wersji z łatkami bezpieczeństwa (co najmniej `15.2.9`)
- [ ] Plan na podatności `jspdf` (`2.5.2`) i `xlsx` (`0.18.5`)

## 3) API i hardening

- [ ] Ograniczyć `image-proxy` do allowlisty hostów + timeout + limit rozmiaru
- [ ] Dodać rate limiting dla endpointów publicznych (`/api/*`)
- [ ] Zweryfikować politykę publicznych tras API w middleware

## 4) Konfiguracja i operacje

- [ ] Dodać `.env.example` z wymaganymi zmiennymi (bez sekretów)
- [ ] Monitoring błędów produkcyjnych (np. Sentry)
- [ ] Alerting (5xx, opóźnienia, limity AI, błędy płatności)
- [ ] Plan backup/restore dla danych (Convex + pliki R2/S3)
- [ ] Rollback plan (deploy i migracje)

## 5) Chrome Extension

- [x] `pnpm -C chrome-extension run build` przechodzi
- [x] `pnpm -C chrome-extension run type-check` przechodzi
- [ ] `pnpm -C chrome-extension run lint` naprawione (`biome` missing)
- [ ] Uporządkować `node_modules` w repo (uniknąć commitów z `chrome-extension/node_modules`)

## 6) Product readiness

- [ ] UAT na krytycznych flow:
  - logowanie/onboarding
  - tworzenie projektu i zarządzanie taskami
  - shopping list / labor / estimations
  - AI chat i wizualizacje
  - płatności/subskrypcje Stripe
  - file upload + PDF parse
- [ ] Smoke test po deployu na produkcji
- [ ] Check legal pages (`/privacy`, `/terms`) i zgody

## Go/No-Go (minimum)

Do wypuszczenia live oznacz jako wymagane:

- [ ] Brak `critical` i brak nieakceptowalnych `high` w audycie
- [ ] CI + automatyczny build/lint na PR
- [ ] Hardened API (szczególnie `image-proxy`)
- [ ] Monitoring + alerting + rollback
- [ ] UAT krytycznych flow zakończony sukcesem
