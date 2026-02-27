---
id: material-estimation
name: Wycena Materiałów
description: Oblicz ilości i koszty materiałów budowlanych na podstawie wymiarów pomieszczenia.
icon: materials
category: planning
requiredFileTypes:
  - image
  - pdf
fileRequired: false
estimatedMinutes: 10
steps:
  - id: dimensions
    name: Wymiary Pomieszczenia
    prompt: |
      Zbierzmy informacje o pomieszczeniu do wyceny materiałów:
      
      **Wymiary podstawowe:**
      1. Długość pomieszczenia (w metrach)
      2. Szerokość pomieszczenia (w metrach)  
      3. Wysokość pomieszczenia (standardowo 2.5m lub 2.7m)
      
      **Otwory:**
      4. Ile okien i jakie wymiary? (np. 1.5m × 1.2m)
      5. Ile drzwi i jakie wymiary? (standardowe 0.9m × 2m)
      
      **Dodatkowe:**
      6. Czy są jakieś wnęki, skosy lub nietypowe elementy?
      
      Jeśli wgrałeś rzut/zdjęcie, przeanalizuję je i dopytam o szczegóły.
    description: Podaj wymiary pomieszczenia.
    requiresUpload: false
  - id: scope
    name: Zakres Prac
    prompt: |
      Jakie prace planujesz? Zaznacz wszystkie które dotyczą:
      
      **Ściany:**
      - [ ] Malowanie
      - [ ] Gładź/szpachlowanie
      - [ ] Tapetowanie
      - [ ] Płytki ceramiczne
      - [ ] Panele ścienne
      
      **Podłoga:**
      - [ ] Panele laminowane
      - [ ] Deska/parkiet
      - [ ] Płytki
      - [ ] Wykładzina
      - [ ] Wylewka samopoziomująca
      
      **Sufit:**
      - [ ] Malowanie
      - [ ] Sufit podwieszany (karton-gips)
      - [ ] Panele sufitowe
      
      **Instalacje:**
      - [ ] Elektryka (ile punktów?)
      - [ ] Oświetlenie (ile źródeł?)
      
      Zapisz zakres prac jako notatkę.
    description: Określ jakie prace będą wykonywane.
    enabledTools:
      - create_item
  - id: calculations
    name: Obliczenia Ilości
    prompt: |
      Na podstawie wymiarów i zakresu prac obliczę potrzebne ilości:
      
      **Wzory używane:**
      - Powierzchnia ścian = (2 × długość + 2 × szerokość) × wysokość - okna - drzwi
      - Powierzchnia podłogi = długość × szerokość
      - Powierzchnia sufitu = długość × szerokość
      
      **Dla materiałów:**
      - Farba: ~0.15L/m² (2 warstwy = 0.3L/m²)
      - Gładź: ~1.2kg/m² (grubość 2mm)
      - Klej do płytek: ~4kg/m²
      - Fuga: ~0.5kg/m² (dla płytek 30×30)
      - Panele: +10% na rozkrój
      - Płytki: +15% na rozkrój i zapas
      
      Przedstawię szczegółowe obliczenia z ilościami.
    description: AI obliczy potrzebne ilości materiałów.
    enabledTools:
      - create_item
  - id: shopping-list
    name: Lista Zakupów z Cenami
    prompt: |
      Stwórzmy listę zakupów z orientacyjnymi cenami:
      
      Dla każdego materiału podam:
      - Ilość z zapasem
      - Cenę jednostkową (zakres ekonomiczny/średni/premium)
      - Szacowany koszt całkowity
      
      **Kategorie:**
      1. Materiały podstawowe (farby, gładzie, kleje)
      2. Wykończenia (panele, płytki, listwy)
      3. Narzędzia i akcesoria (wałki, szpachle, taśmy)
      4. Instalacje (jeśli dotyczy)
      
      Na koniec podsumowanie całkowitego kosztu materiałów.
      
      Dodam wszystko do listy zakupów z podziałem na sekcje.
    description: Lista materiałów z cenami i kosztorys.
    enabledTools:
      - create_item
      - create_multiple_items
      - create_shopping_section
---

# Wycena Materiałów

Szybki kalkulator ilości i kosztów materiałów budowlanych.

## Jak to działa?

1. Podajesz wymiary pomieszczenia
2. Wybierasz zakres prac
3. AI oblicza ilości materiałów
4. Otrzymujesz listę zakupów z cenami

## Dokładność obliczeń

Obliczenia uwzględniają:
- **Zapas na rozkrój**: 10-15% w zależności od materiału
- **Straty technologiczne**: Naddatki na schnięcie, wchłanianie
- **Praktyczne opakowania**: Zaokrąglenia do standardowych wielkości opakowań

## Ceny orientacyjne

Podawane ceny są orientacyjne dla polskiego rynku i obejmują:
- **Ekonomiczny**: Markety budowlane (Castorama, Leroy Merlin)
- **Średni**: Hurtownie, lepsze marki
- **Premium**: Produkty profesjonalne, marki premium

## Wskazówki

- **Dokładne wymiary**: Im dokładniejsze wymiary, tym precyzyjniejsze obliczenia
- **Otwory**: Nie zapomnij o oknach i drzwiach - zmniejszają ilość materiału na ściany
- **Zapas**: Zawsze kup trochę więcej - lepiej mieć zapas niż dokupować z innej partii

## Przydatne przeliczniki

| Materiał | Zużycie na m² |
|----------|---------------|
| Farba (2 warstwy) | 0.25-0.35 L |
| Gładź | 1.0-1.5 kg |
| Klej do płytek | 3-5 kg |
| Fuga | 0.3-0.7 kg |
| Grunt | 0.1-0.15 L |



