---
id: floor-plan-analysis
name: Analiza Rzutu Mieszkania
description: Kompleksowa analiza rzutu z identyfikacją pomieszczeń, wymiarów i generowaniem listy zadań remontowych.
icon: floor-plan
category: analysis
requiredFileTypes:
  - image
  - pdf
fileRequired: true
estimatedMinutes: 15
steps:
  - id: upload
    name: Wgraj Rzut
    prompt: null
    requiresUpload: true
    description: Wgraj plik z rzutem mieszkania (zdjęcie, skan lub PDF).
  - id: room-analysis
    name: Analiza Pomieszczeń
    prompt: |
      Przeanalizuj wgrany rzut mieszkania i zidentyfikuj:
      
      1. **Pomieszczenia**: Wymień wszystkie widoczne pomieszczenia z ich przybliżonymi wymiarami (jeśli skala jest widoczna).
      
      2. **Układ funkcjonalny**: Oceń rozkład pomieszczeń pod kątem:
         - Komunikacji między pomieszczeniami
         - Dostępu do światła naturalnego
         - Funkcjonalności dla rodziny
      
      3. **Potencjalne problemy**: Zidentyfikuj ewentualne problemy jak:
         - Ciasne przejścia
         - Brak wentylacji
         - Niewygodne połączenia funkcjonalne
      
      Przedstaw analizę w przejrzystej formie punktowej.
    description: AI przeanalizuje rzut i zidentyfikuje pomieszczenia.
    enabledTools:
      - create_item
  - id: renovation-scope
    name: Zakres Remontu
    prompt: |
      Na podstawie poprzedniej analizy rzutu, pomóż użytkownikowi określić zakres remontu:
      
      1. Zapytaj które pomieszczenia mają być remontowane
      2. Zaproponuj typowe prace dla każdego wybranego pomieszczenia:
         - Ściany (malowanie, tapetowanie, panele)
         - Podłogi (wymiana, cyklinowanie)
         - Instalacje (elektryka, hydraulika)
         - Stolarka (drzwi, okna)
      
      Stwórz wstępną listę zadań jako tasks w projekcie.
    description: Określ zakres prac remontowych dla wybranych pomieszczeń.
    enabledTools:
      - create_item
      - create_multiple_items
  - id: material-list
    name: Lista Materiałów
    prompt: |
      Na podstawie zdefiniowanego zakresu remontu, przygotuj wstępną listę materiałów:
      
      1. Dla każdego pomieszczenia i rodzaju prac wypisz potrzebne materiały
      2. Oszacuj ilości na podstawie przybliżonych wymiarów z rzutu
      3. Podziel materiały na kategorie (budowlane, wykończeniowe, elektryczne, hydrauliczne)
      
      Dodaj materiały do listy zakupów projektu z odpowiednimi sekcjami.
    description: Wygeneruj listę materiałów budowlanych i wykończeniowych.
    enabledTools:
      - create_item
      - create_multiple_items
      - create_shopping_section
  - id: schedule
    name: Harmonogram
    prompt: |
      Stwórz proponowany harmonogram prac remontowych:
      
      1. Uporządkuj zadania w logicznej kolejności (np. najpierw instalacje, potem wykończenia)
      2. Oszacuj czas trwania każdego etapu
      3. Uwzględnij czas schnięcia, wietrzenia itp.
      4. Zaproponuj podział na etapy tygodniowe
      
      Zaktualizuj daty w utworzonych wcześniej zadaniach aby odzwierciedlały harmonogram.
    description: Zaplanuj kolejność i terminy prac.
    enabledTools:
      - update_item
      - update_multiple_items
---

# Analiza Rzutu Mieszkania

Ten workflow pomoże Ci kompleksowo przeanalizować rzut mieszkania i zaplanować remont.

## Co otrzymasz?

- Szczegółową analizę pomieszczeń i ich funkcjonalności
- Listę zadań remontowych dopasowaną do Twojego rzutu
- Listę materiałów z oszacowanymi ilościami
- Proponowany harmonogram prac

## Wskazówki

- **Jakość rzutu**: Upewnij się, że rzut jest czytelny i w miarę możliwości zawiera wymiary lub skalę
- **Format**: Akceptujemy zdjęcia (JPG, PNG), skany oraz pliki PDF
- **Orientacja**: Jeśli rzut jest obrócony, AI sobie z tym poradzi, ale lepiej wgrać poprawnie zorientowany plik

## Typowy czas

Cały workflow zajmuje około 15-20 minut, w zależności od złożoności mieszkania i Twoich odpowiedzi.



