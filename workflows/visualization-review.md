---
id: visualization-review
name: Przegląd Wizualizacji
description: Przeanalizuj wizualizację wnętrza, zbierz feedback i stwórz listę zakupów na podstawie projektu.
icon: visualization
category: design
requiredFileTypes:
  - image
  - pdf
fileRequired: true
estimatedMinutes: 15
steps:
  - id: upload
    name: Wgraj Wizualizację
    prompt: null
    requiresUpload: true
    description: Wgraj wizualizację 3D lub projekt wnętrza (obraz lub PDF).
  - id: analysis
    name: Analiza Wizualizacji
    prompt: |
      Przeanalizuj wgraną wizualizację wnętrza:
      
      1. **Pomieszczenie**: Jakiego typu jest to wnętrze? (salon, sypialnia, kuchnia, etc.)
      
      2. **Styl**: Określ styl wnętrza:
         - Nowoczesny / Minimalistyczny
         - Skandynawski
         - Industrialny
         - Klasyczny / Hampton
         - Boho / Eklektyczny
         - Inny
      
      3. **Kolorystyka**: Opisz paletę kolorów:
         - Kolory dominujące
         - Akcenty kolorystyczne
         - Materiały i tekstury
      
      4. **Główne elementy**: Wymień widoczne elementy wyposażenia:
         - Meble
         - Oświetlenie
         - Dodatki dekoracyjne
         - Rośliny
      
      Przedstaw analizę w czytelnej formie.
    description: AI przeanalizuje wizualizację i zidentyfikuje elementy.
    enabledTools:
      - create_item
  - id: feedback
    name: Feedback i Uwagi
    prompt: |
      Pomóż zebrać feedback do wizualizacji:
      
      1. **Co się podoba?** - Zapytaj użytkownika jakie elementy projektu są trafione
      
      2. **Co zmienić?** - Jakie elementy wymagają poprawy lub zmiany:
         - Układ mebli
         - Kolorystyka
         - Oświetlenie
         - Konkretne meble/dodatki
      
      3. **Pytania do projektanta**: Sformułuj pytania/uwagi do przekazania projektantowi
      
      Stwórz notatkę z feedbackiem do projektu.
    description: Zbierz uwagi i sugestie zmian.
    enabledTools:
      - create_item
  - id: shopping-list
    name: Lista Zakupów
    prompt: |
      Na podstawie analizy wizualizacji, stwórz listę elementów do zakupu:
      
      **Dla każdego widocznego elementu podaj:**
      - Nazwa / opis produktu
      - Kategoria (meble, oświetlenie, tekstylia, dekoracje)
      - Przybliżony zakres cenowy
      - Gdzie szukać (typ sklepu: IKEA, premium, vintage, etc.)
      
      **Kategoryzuj elementy:**
      1. Meble główne (sofa, stół, łóżko)
      2. Meble pomocnicze (stoliki, regały, komody)
      3. Oświetlenie
      4. Tekstylia (dywany, zasłony, poduszki)
      5. Dekoracje i dodatki
      6. Rośliny
      
      Dodaj wszystkie elementy do listy zakupów z odpowiednimi sekcjami.
    description: Stwórz listę elementów wyposażenia do zakupu.
    enabledTools:
      - create_item
      - create_multiple_items
      - create_shopping_section
  - id: tasks
    name: Zadania Realizacyjne
    prompt: |
      Stwórz listę zadań potrzebnych do zrealizowania wizualizacji:
      
      1. **Przygotowanie**:
         - Wymiarowanie pomieszczenia
         - Zamówienie próbek materiałów
         - Wizyta w showroomach
      
      2. **Zamówienia**:
         - Meble z długim czasem realizacji (pierwsze!)
         - Oświetlenie
         - Tekstylia
         - Dekoracje
      
      3. **Realizacja**:
         - Ewentualne prace remontowe
         - Malowanie
         - Dostawa i montaż mebli
         - Aranżacja dodatków
      
      Utwórz zadania z proponowanymi terminami i kolejnością.
    description: Zaplanuj realizację projektu.
    enabledTools:
      - create_item
      - create_multiple_items
---

# Przegląd Wizualizacji

Workflow do analizy wizualizacji wnętrza i przekształcenia projektu w konkretną listę zakupów i zadań.

## Idealne do:

- Projektów od projektanta wnętrz
- Wizualizacji 3D z programów typu SketchUp, Blender
- Inspiracji z Pinterest/Instagram które chcesz odtworzyć
- Moodboardów i kolaży projektowych

## Co otrzymasz?

1. **Szczegółowa analiza** - Identyfikacja stylu, kolorystyki i elementów
2. **Zebrany feedback** - Notatki z uwagami do projektu
3. **Lista zakupów** - Wszystkie elementy wyposażenia z kategoriami
4. **Plan działania** - Zadania do realizacji projektu

## Wskazówki

- **Jakość obrazu**: Im lepsza jakość wizualizacji, tym dokładniejsza analiza
- **Wiele ujęć**: Jeśli masz kilka widoków tego samego pomieszczenia, wgraj je wszystkie
- **Kontekst**: Po wgraniu możesz dodać informacje o budżecie i preferencjach

## Formaty

Akceptujemy:
- Obrazy: JPG, PNG, WEBP
- Dokumenty: PDF (wiele stron = wiele wizualizacji)



