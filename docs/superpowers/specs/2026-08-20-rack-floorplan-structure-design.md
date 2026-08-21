# Rack/floorplan — struktura i wygląd (Podsystem A)

## Kontekst

Backlog użytkownika z 2026-08-20 obejmował 8 niezależnych zmian, rozbitych na 5 podsystemów (A–E). Ten dokument obejmuje **podsystem A**: strukturę i wygląd szaf/rzutu serwerowni. Pozostałe podsystemy (B — konfigurowalność czujników na głównym ekranie, C — czujnik ICMP, D — pole "management", E — moduł powiadomień email/SMS) mają dostać osobne specy, nie są tu ujęte.

## Cel

Cztery zmiany w `front/src/FloorPlan.jsx` i `front/src/ServerRack.jsx`:
1. Dodanie 2 szaf do rzutu serwerowni (6 szaf łącznie)
2. Ujednolicenie stylu wizualnego widoku szczegółowego szafy ze stylem rzutu głównego (pseudo-3D)
3. Zmiana zakresu rozmiaru szafy (12–42U, bez 24U) + zmiana napisu na pasku rzutu
4. Zmienna wysokość urządzeń w szafie (co 0.5U)

## 1. Dodanie 2 szaf

**Zachowanie istniejących id.** `DeviceSensor.rack_id` w backendzie i `localStorage` klucze (`rack_layout_A0` itd.) są kluczowane po string-id szafy (`"A0"`–`"A3"`). Renumeracja zniszczyłaby powiązanie istniejących odczytów/progów/historii z fizyczną szafą. Dlatego:

- Istniejące `A0, A1, A2, A3` **zostają bez zmian** (id, pozycje x w kodzie na razie takie same jak dziś: -2.5, -0.85, 0.85, 2.5 — patrz niżej, zostaną przeliczone).
- Nowe szafy dostają id `A4` (między A0 a A1) i `A5` (między A2 a A3).
- **Etykieta "Szafa N" liczona dynamicznie po pozycji x** (sortowanie rosnąco), nie po id — więc mimo że A4 ma "wyższe" id niż A1, wizualnie stojąc bardziej na lewo dostanie niższy numer w etykiecie.

**Nowe pozycje** (równomierny rozstaw na tej samej szerokości rzędu, target rozstaw x = -2.5 do 2.5):

| id | x |
|---|---|
| A0 | -2.5 |
| A4 | -1.5 |
| A1 | -0.5 |
| A2 | 0.5 |
| A5 | 1.5 |
| A3 | 2.5 |

Plik: `front/src/FloorPlan.jsx` — `ALL_RACKS` przestaje być generowane z `.map(cx => ...)` z jednej listy pozycji + indeksu; zamiast tego jawna lista `{id, cx}` par (bo id już nie jest 1:1 z kolejnością). Funkcja licząca etykietę: `effectiveRacks` (już istnieje, liczy `cx` po drag) dodatkowo sortuje kopię po `cx` i mapuje na `label`.

## 2. Ujednolicenie widoku wizualnego szafy (tylko widok szczegółowy)

**Zakres:** tylko `ServerRack.jsx` (widok szczegółowy po wejściu w szafę) przejmuje styl pseudo-3D z `FloorPlan.jsx`. Rzut główny (`FloorPlan.jsx`) **zostaje bez zmian** — nadal dekoracyjne 8 linii podziału, globalna temp/wilgotność z `/real-time-data`.

**Nowy współdzielony komponent:** `front/src/RackVisual3D.jsx` — wyciągnięty z logiki `RackBox` (obecnie w `FloorPlan.jsx`), ale:
- Niezależny od kamery pokoju — własna, stała pseudo-projekcja (bez `proj()` z `FloorPlan.jsx`, bo w widoku szczegółowym nie ma sceny 3D pokoju).
- Parametryzowany: `slots`/`devices`, `rackSize`, `width`, `onUnitClick(unit, sensorType)`.
- Liczba linii podziału = **realny `rackSize`** (nie hardcoded 8 jak dziś w `FloorPlan.jsx`).
- Każdy zajęty slot kolorowany wg `DEVICE_TYPES` (przeniesione z `ServerRack.jsx` do wspólnego miejsca, np. eksport z `RackVisual3D.jsx`, żeby `ServerRack.jsx` importował stamtąd zamiast trzymać własną kopię).
- Klikalne ikony 🌡️/💧 per zajęty slot (zachowanie z obecnego `RackVisual` w `ServerRack.jsx` — nawigacja do `/rack/:rackId/unit/:unit/sensor/:type`).

`FloorPlan.jsx`'s `RackBox` **zostaje osobnym komponentem** (różne wymagania: prawdziwa perspektywa 3D pokoju, drag, przycisk power) — nie jest reużywany 1:1, tylko wizualny styl (kolory, obramowania, LED-y, kąty faz) jest współdzielony/skopiowany do `RackVisual3D.jsx`.

## 3. Rozmiar szafy + napis

- `RACK_PRESETS` w `ServerRack.jsx`: `[4, 8, 12, 16, 24, 42]` → `[12, 16, 20, 27, 32, 37, 42]`
- Domyślny rozmiar nieskonfigurowanej szafy: `useState(24)` → `useState(42)`, analogicznie `makeSlots(24)` → `makeSlots(42)`
- `FloorPlan.jsx` toolbar: `"Przeciągnij szafę · 2×klik=widok serwera"` → `"Przeciągnij szafę · 2×klik = edycja szafy"`

## 4. Zmienna wysokość urządzeń

**Nowy kształt danych** (zamiast 1 slot = 1U):

```js
// stara struktura (per-unit, zawsze 1U):
{ unit: 12, name: "Dell R740", type: "server", active: true }

// nowa struktura (dodane pole height, domyślnie 1):
{ unit: 12, height: 2.5, name: "Router", type: "router", active: true }
```

- `unit` = jednostka **startowa** (najniższa jednostka zajmowana przez urządzenie)
- `height` = wysokość w U, krok 0.5 (min 0.5)
- Puste miejsce nadal reprezentowane jako pojedyncze 1U wpisy typu `"empty"` (bez zmian w tym zakresie) — nie trzeba nic dodatkowo konfigurować dla pustych jednostek

**Wsteczna kompatybilność:** stare zapisane układy (`slots` bez pola `height`) wczytują się z domyślnym `height: 1` — zero utraty danych, każdy stary wpis nadal reprezentuje pojedynczy 1U slot.

**Walidacja (przy zapisie edycji urządzenia):**
- Nowa/zmieniona wysokość nie może nachodzić na sąsiednie zajęte jednostki (sprawdzenie zakresu `[unit, unit + height)` przeciw wszystkim innym urządzeniom, z wyjątkiem edytowanego)
- Wysokość nie może wykroczyć poza górną granicę szafy (`unit + height - 1 <= rackSize`)
- Naruszenie → blokada zapisu + komunikat błędu po polsku w dialogu edycji (nie `alert()`, inline w `DialogContent`)

**UX edycji:**
- Kliknięcie edycji na pustym 1U wierszu → dialog z nowym polem "Wysokość (U)" (stepper/select co 0.5, zakres 0.5 do miejsca dostępnego do najbliższego zajętego sąsiada lub górnej granicy szafy) → tworzy nowe urządzenie od tej jednostki w górę
- Kliknięcie edycji na dowolnej jednostce zajętej przez istniejące urządzenie → dialog wypełniony danymi tego urządzenia (nazwa/typ/wysokość), edytowalny
- Zmiana typu na `"empty"` → zwalnia cały zakres z powrotem na pojedyncze 1U wpisy (`height` resetowany do 1 per wpis)

**Renderowanie (tabela `RackSlot`/`RackHeader` + nowy `RackVisual3D`):**
- Iteracja jednostek 1..rackSize odgórnie; napotkanie jednostki startowej urządzenia z `height > 1` → jeden wiersz/box wizualnie `height`-krotnie wyższy, pomija kolejne `height - 1` jednostek w iteracji (nie renderuje ich osobno)
- Tabela (`RackSlot`): wiersz urządzenia pokazuje zakres np. `"12–14U"` zamiast pojedynczego `"12U"`
- `RackVisual3D`: box o wysokości proporcjonalnej do `height * jednostkowa_wysokość_px`

## Pliki zmieniane

- `front/src/FloorPlan.jsx` — `ALL_RACKS` (6 pozycji, jawne id+x), etykieta po pozycji, napis na pasku
- `front/src/ServerRack.jsx` — `RACK_PRESETS`, domyślny rozmiar, model danych `slots`→urządzenia z `height`, walidacja nakładania, dialog edycji (pole wysokości), `RackSlot`/`RackHeader` renderowanie wielo-U, import `RackVisual3D` zamiast lokalnego `RackVisual`
- `front/src/RackVisual3D.jsx` (nowy) — wydzielony komponent pseudo-3D, współdzielony styl z `FloorPlan.jsx`'s `RackBox`, eksportuje też `DEVICE_TYPES` jako wspólne źródło prawdy dla kolorów typów urządzeń

## Poza zakresem (świadomie)

- Rzut główny nie zaczyna pokazywać realnych danych `slots`/`rackSize` per szafa (tylko widok szczegółowy)
- Backend bez zmian — `height` to czysto frontendowe pole w JSON-ie zapisywanym do `Layout.data` (już elastyczny `db.JSON`), nie wymaga migracji schematu
- Podsystemy B–E (czujniki na głównym ekranie, ICMP, management, powiadomienia) — osobne specy
