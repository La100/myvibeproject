---
id: bathroom-renovation
name: Remont Łazienki
description: Od demontażu do wykończenia - zaplanuj remont łazienki krok po kroku.
icon: bathroom
category: renovation
requiredFileTypes:
  - image
  - pdf
fileRequired: false
estimatedMinutes: 20
steps:
  - id: assessment
    name: Ocena Stanu
    prompt: |
      Rozpocznijmy planowanie remontu łazienki. Zbierzmy informacje:
      
      1. **Wymiary**: Podaj wymiary łazienki (długość × szerokość × wysokość)
      2. **Obecne wyposażenie**: Co jest teraz? (wanna/prysznic, WC, umywalka, pralka?)
      3. **Instalacje**: Czy wiesz gdzie są piony kanalizacyjne i wodne?
      4. **Stan techniczny**: Czy są jakieś problemy (wilgoć, pleśń, przecieki)?
      5. **Co zostaje?**: Czy cokolwiek z obecnego wyposażenia zostaje?
      
      Jeśli wgrałeś zdjęcie lub rzut, przeanalizuję je i zadam dodatkowe pytania.
    description: Opowiedz o obecnej łazience.
    requiresUpload: false
  - id: layout
    name: Nowy Układ
    prompt: |
      Na podstawie informacji zaproponuję układ łazienki:
      
      1. **Strefa kąpielowa**: 
         - Wanna (klasyczna, narożna, wolnostojąca)
         - Kabina prysznicowa (walk-in, z brodzikiem, bez brodzika)
         - Kombinacja wanna + prysznic
      
      2. **Strefa WC**:
         - WC kompakt czy podwieszane?
         - Czy potrzebny bidet lub deska myjąca?
      
      3. **Strefa umywalkowa**:
         - Jedna czy dwie umywalki?
         - Szafka pod umywalkę
         - Lustro (zwykłe czy z oświetleniem?)
      
      4. **Dodatkowe**:
         - Pralka (w łazience czy osobno?)
         - Grzejnik (drabinkowy?)
         - Przechowywanie
      
      Stworzę notatkę z proponowanym układem.
    description: Zaplanuj nowy układ łazienki.
    enabledTools:
      - create_item
  - id: finishes
    name: Wykończenia
    prompt: |
      Wybierzmy materiały wykończeniowe:
      
      1. **Płytki podłogowe**:
         - Rozmiar (30x30, 60x60, inne)
         - Typ (gres, terakota)
         - Styl (imitacja drewna, kamienia, jednolite)
      
      2. **Płytki ścienne**:
         - Do jakiej wysokości kafelki? (do sufitu, 2m, półścianka)
         - Mozaika jako akcent?
      
      3. **Sufit**:
         - Malowanie
         - Panele PCV
         - Sufit podwieszany
      
      4. **Kolorystyka**:
         - Jasna/minimalistyczna
         - Ciemna/dramatyczna  
         - Ciepła/naturalna
      
      Zapiszę specyfikację wykończeń.
    description: Wybierz płytki i wykończenia.
    enabledTools:
      - create_item
  - id: fixtures
    name: Armatura i Ceramika
    prompt: |
      Przygotujmy listę armatury i ceramiki:
      
      **Ceramika**:
      - WC (marka, model, cena orientacyjna)
      - Umywalka/umywalki
      - Wanna lub brodzik
      
      **Armatura**:
      - Bateria umywalkowa
      - Bateria wannowa/prysznicowa
      - Deszczownica / słuchawka
      - Odpływy
      
      **Dodatki**:
      - Lustro
      - Szafka łazienkowa
      - Akcesoria (wieszaki, mydelniczki, uchwyt na papier)
      
      Dodam wszystko do listy zakupów z podziałem na kategorie.
    description: Wybierz armaturę i ceramikę sanitarną.
    enabledTools:
      - create_item
      - create_multiple_items
      - create_shopping_section
  - id: materials
    name: Materiały Budowlane
    prompt: |
      Lista materiałów budowlanych potrzebnych do remontu:
      
      **Przygotowanie podłoża**:
      - Klej do płytek (ile kg na m²)
      - Fuga (kolor, ilość)
      - Hydroizolacja (pod prysznic/wannę)
      - Zaprawa wyrównująca (jeśli potrzebna)
      
      **Instalacje**:
      - Rury (PEX/PP do wody)
      - Kanalizacja (rury, kolanka, redukcje)
      - Stelaż WC (jeśli podwieszany)
      - Przewody elektryczne (przekrój)
      
      **Wykończenie**:
      - Silikon sanitarny
      - Listwy/profile
      - Farba (jeśli sufit malowany)
      
      Obliczę ilości na podstawie wymiarów i dodam do listy zakupów.
    description: Lista materiałów budowlanych.
    enabledTools:
      - create_item
      - create_multiple_items
  - id: execution-plan
    name: Plan Wykonania
    prompt: |
      Stwórzmy szczegółowy harmonogram prac:
      
      **Etap 1: Demontaż** (1-2 dni)
      - Demontaż starej ceramiki
      - Skucie płytek
      - Wywóz gruzu
      
      **Etap 2: Instalacje** (2-4 dni)
      - Hydraulika (nowe punkty wodne i kanalizacyjne)
      - Elektryka (oświetlenie, wentylator, gniazdka)
      - Montaż stelaża WC
      
      **Etap 3: Hydroizolacja i tynki** (2-3 dni)
      - Wyrównanie ścian
      - Hydroizolacja strefy mokrej
      - Schnięcie
      
      **Etap 4: Płytki** (3-5 dni)
      - Układanie płytek ściennych
      - Układanie płytek podłogowych
      - Fugowanie
      
      **Etap 5: Montaż i wykończenie** (2-3 dni)
      - Biały montaż (ceramika, armatura)
      - Montaż mebli i akcesoriów
      - Sprzątanie i odbiór
      
      Stworzę zadania z terminami.
    description: Harmonogram prac remontowych.
    enabledTools:
      - create_item
      - create_multiple_items
---

# Remont Łazienki

Kompleksowy kreator który pomoże Ci zaplanować remont łazienki od A do Z.

## Co obejmuje ten workflow?

1. **Ocena stanu** - Analiza obecnej łazienki i Twoich potrzeb
2. **Nowy układ** - Optymalne rozmieszczenie elementów
3. **Wykończenia** - Wybór płytek i materiałów
4. **Armatura** - Ceramika sanitarna i baterie
5. **Materiały** - Lista materiałów budowlanych
6. **Harmonogram** - Plan prac krok po kroku

## Ważne informacje

### Instalacje
Łazienka to pomieszczenie z wieloma instalacjami. Upewnij się, że:
- Masz dostęp do pionów wod-kan (lub wiesz gdzie są)
- Wentylacja działa prawidłowo
- Instalacja elektryczna jest dostosowana do strefy mokrej

### Hydroizolacja
**KRYTYCZNE**: Strefa prysznica i wanny MUSI mieć wykonaną hydroizolację. To nie jest miejsce na oszczędności!

### Typowe koszty

- **Mała łazienka (3-4m²)**: 12,000 - 20,000 PLN
- **Średnia (5-7m²)**: 18,000 - 35,000 PLN
- **Duża (8m²+)**: 30,000 - 60,000 PLN

*Ceny robocizny + materiały, bez armatury i ceramiki premium*

## Wskazówki

- **Zdjęcia**: Wgraj zdjęcia obecnej łazienki - pomoże to w planowaniu
- **Wymiary**: Dokładne wymiary są kluczowe dla obliczeń materiałów
- **Budżet**: Zostaw 15-20% rezerwy na nieprzewidziane wydatki



