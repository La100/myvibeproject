---
id: kitchen-renovation
name: Remont Kuchni
description: Kompletny przewodnik po remoncie kuchni - od planowania układu po listę zakupów.
icon: kitchen
category: renovation
requiredFileTypes:
  - image
  - pdf
fileRequired: false
estimatedMinutes: 20
steps:
  - id: current-state
    name: Stan Obecny
    prompt: |
      Pomóżmy zaplanować remont kuchni. Na początek zbierzmy informacje o obecnym stanie:
      
      Zapytaj użytkownika o:
      1. Wymiary kuchni (długość × szerokość)
      2. Obecny układ (aneks, oddzielna kuchnia, z wyspą)
      3. Co najbardziej przeszkadza w obecnej kuchni?
      4. Czy są jakieś elementy do zachowania (np. okno, drzwi, instalacje)?
      
      Jeśli użytkownik wgrał zdjęcie/rzut, przeanalizuj go i zadaj doprecyzowujące pytania.
    description: Opowiedz o obecnej kuchni i jej problemach.
    requiresUpload: false
  - id: layout-planning
    name: Planowanie Układu
    prompt: |
      Na podstawie zebranych informacji, zaproponuj optymalny układ kuchni:
      
      1. **Trójkąt roboczy**: Zaproponuj rozmieszczenie lodówki, zlewu i kuchenki
      2. **Strefa przechowywania**: Gdzie umieścić szafki górne i dolne
      3. **Blat roboczy**: Ile powierzchni roboczej będzie dostępne
      4. **AGD**: Gdzie zmieszczą się duże sprzęty (zmywarka, piekarnik, mikrofalówka)
      
      Stwórz notatkę z proponowanym układem.
    description: Zaplanuj nowy układ kuchni.
    enabledTools:
      - create_item
  - id: style-selection
    name: Wybór Stylu
    prompt: |
      Pomóż użytkownikowi wybrać styl wykończenia kuchni:
      
      1. **Fronty szafek**: 
         - Nowoczesne (gładkie, matowe/połysk)
         - Klasyczne (ramkowe, frezowane)
         - Skandynawskie (drewno, biel)
      
      2. **Blat**:
         - Laminat (ekonomiczny)
         - Konglomerat kwarcowy (trwały)
         - Drewno (naturalne, wymaga pielęgnacji)
         - Kamień naturalny (premium)
      
      3. **Płytki/ściana nad blatem**:
         - Klasyczne kafelki
         - Szkło hartowane
         - Panel ścienny
      
      Zapisz wybory użytkownika jako notatkę ze specyfikacją.
    description: Wybierz styl i materiały wykończeniowe.
    enabledTools:
      - create_item
  - id: appliances
    name: Sprzęt AGD
    prompt: |
      Przygotuj listę sprzętów AGD do kuchni:
      
      1. **Niezbędne**:
         - Płyta grzewcza (indukcja/gaz/elektryczna)
         - Piekarnik (do zabudowy/wolnostojący)
         - Okap (teleskopowy/wyspowy/do zabudowy)
         - Lodówka (do zabudowy/wolnostojąca)
         - Zmywarka
      
      2. **Opcjonalne**:
         - Mikrofalówka
         - Ekspres do kawy
         - Robot kuchenny
      
      Dodaj wybrane sprzęty do listy zakupów z orientacyjnymi cenami.
    description: Zaplanuj sprzęty AGD.
    enabledTools:
      - create_item
      - create_multiple_items
      - create_shopping_section
  - id: materials-budget
    name: Materiały i Budżet
    prompt: |
      Przygotuj kompletną listę materiałów i oszacuj budżet:
      
      1. **Meble kuchenne** (szafki, fronty, uchwyty)
      2. **Blaty**
      3. **Zlew i bateria**
      4. **Oświetlenie** (główne + podszafkowe)
      5. **Płytki/panele ścienne**
      6. **Farba/tapeta** (jeśli dotyczy)
      7. **Materiały instalacyjne** (elektryka, hydraulika)
      
      Dla każdej kategorii podaj szacunkowy koszt i dodaj do listy zakupów.
      Na koniec podsumuj całkowity budżet.
    description: Stwórz kompletną listę zakupów z budżetem.
    enabledTools:
      - create_item
      - create_multiple_items
      - create_shopping_section
  - id: tasks-schedule
    name: Zadania i Harmonogram
    prompt: |
      Stwórz listę zadań remontowych dla kuchni w odpowiedniej kolejności:
      
      1. **Przygotowanie** (1-2 dni):
         - Demontaż starych mebli
         - Zabezpieczenie podłóg i innych pomieszczeń
      
      2. **Instalacje** (3-5 dni):
         - Prace elektryczne (nowe punkty, oświetlenie)
         - Prace hydrauliczne (przesunięcia, nowe przyłącza)
      
      3. **Wykończenie ścian** (2-3 dni):
         - Gładzie/tynki
         - Malowanie/kafelkowanie
      
      4. **Montaż mebli** (1-2 dni):
         - Szafki dolne i górne
         - Blaty
      
      5. **AGD i wykończenie** (1-2 dni):
         - Podłączenie sprzętów
         - Montaż oświetlenia
         - Sprzątanie
      
      Utwórz zadania z przypisanymi datami.
    description: Zaplanuj prace i harmonogram.
    enabledTools:
      - create_item
      - create_multiple_items
---

# Remont Kuchni

Kompleksowy przewodnik który przeprowadzi Cię przez cały proces planowania remontu kuchni.

## Etapy workflow'u

1. **Stan obecny** - Analiza tego co masz i co chcesz zmienić
2. **Planowanie układu** - Optymalne rozmieszczenie elementów
3. **Wybór stylu** - Materiały i wykończenia
4. **Sprzęt AGD** - Lista potrzebnych urządzeń
5. **Materiały i budżet** - Kompletna lista zakupów z kosztami
6. **Harmonogram** - Plan prac krok po kroku

## Wskazówki

- **Zdjęcia pomagają**: Wgraj zdjęcie obecnej kuchni lub rzut - AI lepiej doradzi
- **Wymiary są kluczowe**: Im dokładniejsze wymiary podasz, tym precyzyjniejsze oszacowania
- **Budżet**: Miej orientacyjny budżet w głowie - pomoże to w doborze materiałów

## Typowe koszty remontu kuchni

- **Ekonomiczny**: 15,000 - 25,000 PLN
- **Średni standard**: 30,000 - 50,000 PLN  
- **Premium**: 60,000+ PLN

*Ceny orientacyjne dla kuchni 8-12m², bez AGD*



