---
id: interior-renovation-management
name: Zarzadzanie Projektem Remontu Wnetrz
description: Planowanie, budzet, harmonogram i koordynacja remontu w jednym workflow.
icon: checklist
category: planning
requiredFileTypes:
  - image
  - pdf
  - document
fileRequired: false
estimatedMinutes: 25
steps:
  - id: project-brief
    name: Brief Projektu
    prompt: |
      Zbierz podstawowe informacje o projekcie remontu:
      
      1. Typ wnetrza (mieszkanie/dom/lokal) i lista pomieszczen
      2. Glowne cele (funkcjonalnosc, estetyka, sprzedaz, wynajem)
      3. Ograniczenia (mieszkanie w trakcie remontu, dzieci/zwierzeta, halas, dostep)
      4. Zakres budzetu (min/max) oraz priorytety wydatkow
      5. Termin startu i oczekiwany termin zakonczenia
      6. Inspiracje stylu (kolory, materialy, przyklady)
      
      Zapisz brief jako notatke. Jesli uzytkownik ma rzut/zdjecia/umowy, popros o upload.
    description: Ustal cele, zakres i ograniczenia projektu.
    enabledTools:
      - create_item
  - id: scope-structure
    name: Zakres i Struktura Prac
    prompt: |
      Na podstawie briefu zdefiniuj zakres prac:
      
      1. Podziel remont na pomieszczenia i branze (budowlane, elektryka, hydraulika, wykonczenie)
      2. Dla kazdej czesci zaproponuj liste konkretnych zadan
      3. Wskaz zaleznosci (np. instalacje przed wykonczeniem)
      
      Utworz zadania dla kluczowych prac w odpowiedniej kolejnosci.
    description: Rozbij projekt na zadania i zaleznosci.
    enabledTools:
      - create_item
      - create_multiple_items
  - id: budget-procurement
    name: Budzet i Zakupy
    prompt: |
      Zbuduj wstepny plan budzetowy i zakupowy:
      
      1. Podziel budzet na kategorie (materialy, robocizna, meble, AGD, rezerwa)
      2. Wskaz pozycje z dlugim czasem dostawy
      3. Zaproponuj priorytety zakupowe
      
      Dodaj sekcje zakupowe i wstepne pozycje z orientacyjnymi kosztami.
    description: Ustal budzet i wstepna liste zakupow.
    enabledTools:
      - create_shopping_section
      - create_multiple_items
      - create_item
  - id: schedule-milestones
    name: Harmonogram i Kamienie Milowe
    prompt: |
      Zaproponuj harmonogram prac:
      
      1. Uporzadkuj zadania etapami (demontaz, instalacje, wykonczenie, montaz)
      2. Okresl czas trwania etapow i przerwy technologiczne
      3. Zdefiniuj kamienie milowe (np. zakonczenie instalacji, gotowosc pod montaz mebli)
      
      Zaktualizuj daty zadan zgodnie z harmonogramem.
    description: Ustal realny harmonogram i kamienie milowe.
    enabledTools:
      - update_item
      - update_multiple_items
  - id: team-contracts
    name: Ekipa i Umowy
    prompt: |
      Zaplanuj kwestie wykonawcze:
      
      1. Ktore prace DIY, a ktore dla wykonawcow?
      2. Ile ofert/wycen trzeba zebrac i od kogo?
      3. Jakie dokumenty/umowy sa potrzebne (zakres, terminy, gwarancje)?
      4. Czy wymagane sa zgody administracyjne lub projekt?
      
      Dodaj zadania zwiazane z wyborami wykonawcow i dokumentami.
    description: Przygotuj plan wspolpracy z wykonawcami.
    enabledTools:
      - create_item
      - create_multiple_items
      - create_item
  - id: risk-quality
    name: Ryzyka i Kontrola Jakosci
    prompt: |
      Zidentyfikuj ryzyka i plan kontroli:
      
      1. Najwieksze ryzyka (opoznienia, przekroczenie budzetu, brak dostepnosci materialow)
      2. Jak im przeciwdzialac (rezerwa czasowa i finansowa, plan B)
      3. Punkty kontroli jakosci (odbior instalacji, wilgotnosc, poziomy)
      4. Lista odbioru koncowego (tzw. punch list)
      
      Utworz zadania dla kontroli jakosci i odbiorow.
    description: Zabezpiecz projekt i zaplanuj odbiory.
    enabledTools:
      - create_item
      - create_multiple_items
      - create_item
---

# Zarzadzanie Projektem Remontu Wnetrz

Workflow do przejscia od briefu do harmonogramu i zarzadzania realizacja.

## Co otrzymasz?

- Uporzadkowany zakres prac i liste zadan
- Wstepny budzet i liste zakupow
- Harmonogram z kamieniami milowymi
- Plan wspolpracy z wykonawcami
- Liste ryzyk i kontroli jakosci
