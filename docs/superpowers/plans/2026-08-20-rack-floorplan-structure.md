# Rack/floorplan — struktura i wygląd — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać 2 szafy do rzutu serwerowni, ujednolicić styl wizualny widoku szczegółowego szafy ze stylem rzutu, zmienić zakres rozmiaru szafy, dodać zmienną wysokość urządzeń.

**Architecture:** Zmiany w dwóch istniejących plikach (`FloorPlan.jsx`, `ServerRack.jsx`) + jeden nowy współdzielony komponent wizualny (`RackVisual3D.jsx`) używany tylko przez widok szczegółowy szafy.

**Tech Stack:** React 18, react-konva (canvas), Material UI v6, brak frameworka testowego we frontendzie.

## Global Constraints

- **Nigdy nie uruchamiaj `git`/`gh`** — brak kroków commit w tym planie, użytkownik commituje sam.
- **Pytaj o zgodę przed każdym pojedynczym wywołaniem Bash** (esbuild, npm run build, npm run dev) — nie łącz komend bez potwierdzenia.
- Brak test runnera we frontendzie (brak jest/vitest) — weryfikacja przez `npx esbuild <plik> --bundle=false --loader:.jsx=jsx` (składnia) + `npm run build` (cały projekt) + manualne sprawdzenie w `npm run dev`, zamiast automatycznych testów.
- Komunikaty użytkownika (błędy walidacji w UI) po polsku.
- Zachować istniejące id szaf `A0`–`A3` bez zmian (powiązane dane: `DeviceSensor.rack_id`, `localStorage rack_layout_A*`).
- Kolory `DEVICE_TYPES` bez zmian wartości — tylko przeniesienie miejsca definicji.

---

### Task 1: FloorPlan.jsx — 6 szaf, etykieta po pozycji, zmiana napisu

**Files:**
- Modify: `front/src/FloorPlan.jsx`

**Interfaces:**
- Produces: `ALL_RACKS` — lista `{id, cx, z}` (6 wpisów), `effectiveRacks` — lista `{id, cx, z, label}` posortowana po `cx` z etykietą liczoną dynamicznie. Kolejne taski nie zależą od tego pliku.

- [ ] **Step 1: Zmień `ALL_RACKS` na jawną listę z 6 pozycjami**

Zamień (linie ok. 60-65):
```js
const ALL_RACKS = [-2.5, -0.85, 0.85, 2.5].map((cx, i) => ({
    id: `A${i}`, label: `Szafa ${i + 1}`, cx, z: ROW_Z,
}));
```
na:
```js
const ALL_RACKS = [
    { id: "A0", cx: -2.5, z: ROW_Z },
    { id: "A4", cx: -1.5, z: ROW_Z },
    { id: "A1", cx: -0.5, z: ROW_Z },
    { id: "A2", cx:  0.5, z: ROW_Z },
    { id: "A5", cx:  1.5, z: ROW_Z },
    { id: "A3", cx:  2.5, z: ROW_Z },
];
```

- [ ] **Step 2: Policz etykietę dynamicznie po pozycji x**

Zamień (funkcja `effectiveRacks`, obecnie tuż przed sekcją "Room geometry"):
```js
const effectiveRacks = ALL_RACKS.map(r => ({ ...r, cx: rackXPos[r.id] ?? r.cx }));
```
na:
```js
const effectiveRacks = ALL_RACKS
    .map(r => ({ ...r, cx: rackXPos[r.id] ?? r.cx }))
    .sort((a, b) => a.cx - b.cx)
    .map((r, i) => ({ ...r, label: `Szafa ${i + 1}` }));
```

- [ ] **Step 3: Zmień napis na pasku narzędzi**

Zamień:
```jsx
<Typography variant="caption" color="text.secondary">
    Przeciągnij szafę · 2×klik=widok serwera
</Typography>
```
na:
```jsx
<Typography variant="caption" color="text.secondary">
    Przeciągnij szafę · 2×klik = edycja szafy
</Typography>
```

- [ ] **Step 4: Weryfikacja składni**

Zapytaj o zgodę, potem: `npx esbuild front/src/FloorPlan.jsx --bundle=false --loader:.jsx=jsx`
Expected: brak błędów, plik wypisany na stdout.

- [ ] **Step 5: Weryfikacja builda**

Zapytaj o zgodę, potem: `cd front && npm run build`
Expected: `✓ built` bez błędów.

- [ ] **Step 6: Manualna weryfikacja (opcjonalnie, jeśli użytkownik chce)**

`npm run dev`, otwórz `/rzut` — sprawdź: 6 szaf w rzędzie, przeciąganie działa, etykiety "Szafa 1".."Szafa 6" idą lewo→prawo zgodnie z pozycją (nie z id), nowy napis na pasku.

---

### Task 2: ServerRack.jsx — zakres rozmiaru szafy + domyślny rozmiar

**Files:**
- Modify: `front/src/ServerRack.jsx`

**Interfaces:**
- Produces: `RACK_PRESETS = [12, 16, 20, 27, 32, 37, 42]`, domyślny `rackSize = 42`. Task 4 (walidacja wysokości vs `rackSize`) na tym się opiera.

- [ ] **Step 1: Zmień listę presetów**

Zamień:
```js
const RACK_PRESETS = [4, 8, 12, 16, 24, 42];
```
na:
```js
const RACK_PRESETS = [12, 16, 20, 27, 32, 37, 42];
```

- [ ] **Step 2: Zmień domyślny rozmiar (dwa miejsca)**

Zamień:
```js
const [rackSize, setRackSize] = useState(24);
const [slots, setSlots]       = useState(() => makeSlots(24));
```
na:
```js
const [rackSize, setRackSize] = useState(42);
const [slots, setSlots]       = useState(() => makeSlots(42));
```

Zamień (w efekcie ładującym zapisany layout):
```js
const size = data.rackSize || data.slots?.length || 24;
```
na:
```js
const size = data.rackSize || data.slots?.length || 42;
```

- [ ] **Step 3: Weryfikacja składni**

Zapytaj o zgodę, potem: `npx esbuild front/src/ServerRack.jsx --bundle=false --loader:.jsx=jsx`
Expected: brak błędów.

- [ ] **Step 4: Weryfikacja builda**

Zapytaj o zgodę, potem: `cd front && npm run build`
Expected: `✓ built` bez błędów.

---

### Task 3: Nowy komponent RackVisual3D + integracja w ServerRack.jsx

**Files:**
- Create: `front/src/RackVisual3D.jsx`
- Modify: `front/src/ServerRack.jsx`

**Interfaces:**
- Consumes (z Task 2): nic bezpośrednio, niezależne od presetów.
- Produces: `export default function RackVisual3D({ slots, rackSize, rackLabel, width, onUnitClick })` renderujący canvas (react-konva `Stage`); `export const DEVICE_TYPES` (przeniesione z `ServerRack.jsx`, ta sama zawartość). Task 4 rozszerza ten plik o obsługę `slot.height`.

- [ ] **Step 1: Utwórz `front/src/RackVisual3D.jsx`**

```jsx
import { Stage, Layer, Group, Line, Rect, Text } from "react-konva";

export const DEVICE_TYPES = {
    server:   { label: "Serwer",      color: "#1e88e5" },
    switch:   { label: "Switch",      color: "#43a047" },
    router:   { label: "Router",      color: "#8e24aa" },
    pdu:      { label: "PDU",         color: "#fb8c00" },
    patch:    { label: "Patch panel", color: "#546e7a" },
    ups:      { label: "UPS",         color: "#e53935" },
    firewall: { label: "Firewall",    color: "#f4511e" },
    empty:    { label: "Puste",       color: "#37474f" },
};

const ROW_H = 15;
const DEPTH = 12;

const C = {
    rackFace: "#0d1b28",
    rackTop:  "#1c2d3e",
    rackSide: "#0a1520",
    rackBdr:  "#2a5a80",
    unitLine: "#0a1520",
    textBr:   "#7abcd8",
};

function pts(arr) { return arr.flatMap(p => [p.x, p.y]); }

export default function RackVisual3D({ slots, rackSize, rackLabel, width = 190, onUnitClick }) {
    const bodyH = rackSize * ROW_H;
    const stageW = width + DEPTH + 4;
    const stageH = bodyH + DEPTH + 30;
    const ox = 2, oy = DEPTH + 20;

    const fl  = { x: ox,             y: oy };
    const fr  = { x: ox + width,     y: oy };
    const bl  = { x: ox + DEPTH,     y: oy - DEPTH };
    const br  = { x: ox + width + DEPTH, y: oy - DEPTH };
    const flB = { x: ox,             y: oy + bodyH };
    const frB = { x: ox + width,     y: oy + bodyH };
    const brB = { x: ox + width + DEPTH, y: oy + bodyH - DEPTH };

    return (
        <Stage width={stageW} height={stageH}>
            <Layer>
                {/* Top face */}
                <Line closed points={pts([fl, fr, br, bl])} fill={C.rackTop} stroke={C.rackBdr} strokeWidth={1} />
                {/* Side face */}
                <Line closed points={pts([fr, br, brB, frB])} fill={C.rackSide} stroke={C.rackBdr} strokeWidth={1} />
                {/* Front face */}
                <Rect x={fl.x} y={fl.y} width={width} height={bodyH} fill={C.rackFace} stroke={C.rackBdr} strokeWidth={1.5} />

                {/* Units */}
                {slots.map(slot => {
                    const dtype   = DEVICE_TYPES[slot.type] || DEVICE_TYPES.empty;
                    const isEmpty = slot.type === "empty";
                    const h       = (slot.height || 1) * ROW_H;
                    const y       = fl.y + (slot.unit - 1) * ROW_H;
                    return (
                        <Group key={slot.unit}>
                            <Rect x={fl.x + 1} y={y} width={width - 2} height={h}
                                fill={isEmpty ? "transparent" : dtype.color}
                                opacity={isEmpty ? 1 : 0.85} />
                            <Line points={[fl.x, y, fl.x + width, y]} stroke={C.unitLine} strokeWidth={0.5} />
                            {!isEmpty && (
                                <>
                                    <Group
                                        onClick={() => onUnitClick && onUnitClick(slot.unit, "temperature")}
                                        onTap={() => onUnitClick && onUnitClick(slot.unit, "temperature")}
                                    >
                                        <Text text="🌡️" x={fl.x + width - 34} y={y + h / 2 - 7}
                                            width={16} align="center" fontSize={11} />
                                    </Group>
                                    <Group
                                        onClick={() => onUnitClick && onUnitClick(slot.unit, "humidity")}
                                        onTap={() => onUnitClick && onUnitClick(slot.unit, "humidity")}
                                    >
                                        <Text text="💧" x={fl.x + width - 18} y={y + h / 2 - 7}
                                            width={16} align="center" fontSize={11} />
                                    </Group>
                                </>
                            )}
                        </Group>
                    );
                })}
                <Line points={[fl.x, flB.y, fl.x + width, flB.y]} stroke={C.rackBdr} strokeWidth={1} />

                {/* Label */}
                <Text text={rackLabel} x={fl.x} y={oy - DEPTH - 16}
                    width={width} align="center" fontSize={12} fill={C.textBr} fontStyle="bold" />
            </Layer>
        </Stage>
    );
}
```

- [ ] **Step 2: Usuń stary `DEVICE_TYPES` i `RackVisual` z `ServerRack.jsx`, zaimportuj nowy komponent**

Usuń z `ServerRack.jsx` (linie ok. 19-28):
```js
const DEVICE_TYPES = {
    server:  { label: "Serwer",      color: "#1e88e5" },
    switch:  { label: "Switch",      color: "#43a047" },
    router:  { label: "Router",      color: "#8e24aa" },
    pdu:     { label: "PDU",         color: "#fb8c00" },
    patch:   { label: "Patch panel", color: "#546e7a" },
    ups:     { label: "UPS",         color: "#e53935" },
    firewall:{ label: "Firewall",    color: "#f4511e" },
    empty:   { label: "Puste",       color: "#37474f" },
};
```

Usuń całą funkcję `RackVisual` (linie ok. 132-196, od `function RackVisual({ slots, rackLabel, rackSize, rackId }) {` do jej zamykającego `}`).

Dodaj import na górze pliku:
```js
import RackVisual3D, { DEVICE_TYPES } from "./RackVisual3D";
```

- [ ] **Step 3: Podmień użycie w JSX**

Zamień:
```jsx
<RackVisual slots={slots} rackLabel={rackLabel} rackSize={rackSize} rackId={rackId} />
```
na:
```jsx
<Box sx={{ width: 220, flexShrink: 0, mt: 7 }}>
    <RackVisual3D
        slots={slots}
        rackSize={rackSize}
        rackLabel={rackLabel}
        width={190}
        onUnitClick={(unit, type) => navigate(`/rack/${rackId}/unit/${unit}/sensor/${type}`)}
    />
    <Typography variant="caption" sx={{ display: "block", mt: 0.75, textAlign: "center", color: "text.secondary" }}>
        Widok wizualny serwera
    </Typography>
</Box>
```

- [ ] **Step 4: Weryfikacja składni**

Zapytaj o zgodę, potem:
```
npx esbuild front/src/RackVisual3D.jsx --bundle=false --loader:.jsx=jsx
npx esbuild front/src/ServerRack.jsx --bundle=false --loader:.jsx=jsx
```
Expected: brak błędów w obu.

- [ ] **Step 5: Weryfikacja builda**

Zapytaj o zgodę, potem: `cd front && npm run build`
Expected: `✓ built` bez błędów.

- [ ] **Step 6: Manualna weryfikacja**

`npm run dev`, otwórz `/rack/A0` — sprawdź: panel wizualny po lewej renderuje się jako canvas (nie stare kolorowe bloczki), liczba wierszy = `rackSize`, kliknięcie ikon 🌡️/💧 nawiguje do `/rack/A0/unit/<N>/sensor/<type>`. Jeśli ikony nachodzą na siebie lub są nieczytelne przy realnym `width=190`, zgłoś — to pierwszy raz renderowane w przeglądarce, może wymagać drobnej korekty odstępów.

---

### Task 4: Zmienna wysokość urządzeń (model, walidacja, dialog, renderowanie)

**Files:**
- Modify: `front/src/ServerRack.jsx`

**Interfaces:**
- Consumes: `RackVisual3D` z Task 3 — już obsługuje `slot.height` w rysowaniu (`h = (slot.height || 1) * ROW_H`, patrz Task 3 Step 1), więc ten task nie dotyka `RackVisual3D.jsx`.
- Produces: sloty z polem `height` (domyślnie `1`), funkcja walidująca nakładanie się urządzeń.

- [ ] **Step 1: Przepisz `makeSlots` żeby wspierało `height` i wielo-U urządzenia**

Zamień:
```js
const makeSlots = (count, existing = []) =>
    Array.from({ length: count }, (_, i) => {
        const unit = i + 1;
        return existing.find(s => s.unit === unit) || { unit, name: "", type: "empty", active: true };
    });
```
na:
```js
const makeSlots = (count, existing = []) => {
    const devices = existing.map(d => ({ height: 1, ...d }));
    const result = [];
    let unit = 1;
    while (unit <= count) {
        const device = devices.find(d => d.unit === unit);
        if (device) {
            result.push(device);
            unit += Math.ceil(device.height);
        } else {
            result.push({ unit, name: "", type: "empty", active: true, height: 1 });
            unit += 1;
        }
    }
    return result;
};
```

To zachowuje pełną kompatybilność wsteczną: stare zapisane układy (bez pola `height`) dostają `height: 1` przez `{ height: 1, ...d }`, więc pętla kroczy dokładnie tak jak dziś (po 1 jednostce).

- [ ] **Step 2: Dodaj funkcję walidującą nakładanie się urządzeń**

Dodaj obok `makeSlots`:
```js
const wouldOverlap = (currentSlots, editUnit, height) => {
    const end = editUnit + height;
    return currentSlots.some(s =>
        s.unit !== editUnit &&
        s.type !== "empty" &&
        s.unit < end &&
        editUnit < s.unit + (s.height || 1)
    );
};
```

- [ ] **Step 3: Dodaj stan wysokości i błędu edycji**

Zamień:
```js
const [editSlot, setEditSlot] = useState(null);
const [editName, setEditName] = useState("");
const [editType, setEditType] = useState("server");
```
na:
```js
const [editSlot, setEditSlot]   = useState(null);
const [editName, setEditName]   = useState("");
const [editType, setEditType]   = useState("server");
const [editHeight, setEditHeight] = useState(1);
const [editError, setEditError] = useState("");
```

- [ ] **Step 4: Zaktualizuj `openEdit` i `confirmEdit`**

Zamień:
```js
const openEdit = slot => {
    setEditSlot(slot.unit);
    setEditName(slot.name);
    setEditType(slot.type);
};

const confirmEdit = () => {
    setSlots(prev => prev.map(s => s.unit === editSlot ? { ...s, name: editName, type: editType } : s));
    setEditSlot(null);
};
```
na:
```js
const openEdit = slot => {
    setEditSlot(slot.unit);
    setEditName(slot.name);
    setEditType(slot.type);
    setEditHeight(slot.height || 1);
    setEditError("");
};

const confirmEdit = () => {
    const height = editType === "empty" ? 1 : editHeight;
    if (editType !== "empty" && height < 0.5) {
        setEditError("Wysokość minimum 0.5U");
        return;
    }
    if (editSlot + height - 1 > rackSize) {
        setEditError("Urządzenie wykracza poza szafę");
        return;
    }
    if (editType !== "empty" && wouldOverlap(slots, editSlot, height)) {
        setEditError("Zakres nachodzi na sąsiednie urządzenie");
        return;
    }
    setSlots(prev => makeSlots(rackSize, [
        ...prev.filter(s => s.unit !== editSlot),
        { unit: editSlot, name: editName, type: editType, active: true, height },
    ]));
    setEditSlot(null);
    setEditError("");
};
```

- [ ] **Step 5: Dodaj pole wysokości i alert błędu do dialogu edycji**

Zamień:
```jsx
<DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
    <Select value={editType} onChange={e => setEditType(e.target.value)} size="small" fullWidth>
        {Object.entries(DEVICE_TYPES).map(([key, val]) => (
            <MenuItem key={key} value={key}>{val.label}</MenuItem>
        ))}
    </Select>
    <TextField
        label="Nazwa urządzenia"
        value={editName}
        onChange={e => setEditName(e.target.value)}
        size="small" fullWidth autoFocus
        onKeyDown={e => e.key === "Enter" && confirmEdit()}
        placeholder={editType === "empty" ? "Opcjonalna etykieta" : "np. Dell PowerEdge R740"}
    />
</DialogContent>
```
na:
```jsx
<DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
    <Select value={editType} onChange={e => setEditType(e.target.value)} size="small" fullWidth>
        {Object.entries(DEVICE_TYPES).map(([key, val]) => (
            <MenuItem key={key} value={key}>{val.label}</MenuItem>
        ))}
    </Select>
    <TextField
        label="Nazwa urządzenia"
        value={editName}
        onChange={e => setEditName(e.target.value)}
        size="small" fullWidth autoFocus
        onKeyDown={e => e.key === "Enter" && confirmEdit()}
        placeholder={editType === "empty" ? "Opcjonalna etykieta" : "np. Dell PowerEdge R740"}
    />
    {editType !== "empty" && (
        <TextField
            label="Wysokość (U)"
            type="number"
            value={editHeight}
            onChange={e => setEditHeight(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
            inputProps={{ step: 0.5, min: 0.5 }}
            size="small" fullWidth
        />
    )}
    {editError && <Alert severity="error">{editError}</Alert>}
</DialogContent>
```

- [ ] **Step 6: Wyczyść błąd przy anulowaniu/zamknięciu dialogu**

Zamień:
```jsx
<Dialog open={editSlot !== null} onClose={() => setEditSlot(null)} maxWidth="xs" fullWidth disablePortal>
```
na:
```jsx
<Dialog open={editSlot !== null} onClose={() => { setEditSlot(null); setEditError(""); }} maxWidth="xs" fullWidth disablePortal>
```

Zamień:
```jsx
<Button onClick={() => setEditSlot(null)}>Anuluj</Button>
```
na:
```jsx
<Button onClick={() => { setEditSlot(null); setEditError(""); }}>Anuluj</Button>
```

- [ ] **Step 7: Pokaż zakres jednostek w tabeli dla urządzeń wielo-U**

W `RackSlot`, zamień:
```jsx
<Typography sx={{ color: "#484f58", fontFamily: "monospace", fontSize: "0.7rem" }}>
    {String(slot.unit).padStart(2, "0")}U
</Typography>
```
na:
```jsx
<Typography sx={{ color: "#484f58", fontFamily: "monospace", fontSize: "0.7rem" }}>
    {(slot.height || 1) > 1
        ? `${String(slot.unit).padStart(2, "0")}–${String(slot.unit + Math.ceil(slot.height) - 1).padStart(2, "0")}U`
        : `${String(slot.unit).padStart(2, "0")}U`}
</Typography>
```

- [ ] **Step 8: Weryfikacja składni**

Zapytaj o zgodę, potem: `npx esbuild front/src/ServerRack.jsx --bundle=false --loader:.jsx=jsx`
Expected: brak błędów.

- [ ] **Step 9: Weryfikacja builda**

Zapytaj o zgodę, potem: `cd front && npm run build`
Expected: `✓ built` bez błędów.

- [ ] **Step 10: Manualna weryfikacja**

`npm run dev`, otwórz `/rack/A0`:
1. Edytuj pusty slot np. 12U, ustaw typ "Router", wysokość 2.5U, zapisz — sprawdź że tabela pokazuje "12–14U", jednostki 13 i 14 znikają z listy jako osobne wiersze, panel wizualny pokazuje box wyższy niż standardowe 1U.
2. Spróbuj edytować slot 13U (powinien już nie istnieć jako osobny wiersz — potwierdź).
3. Spróbuj utworzyć urządzenie które nachodzi na istniejące (np. 11U wysokość 2U, nachodzi na 12-14U routera) — sprawdź komunikat błędu "Zakres nachodzi na sąsiednie urządzenie", zapis zablokowany.
4. Zmień typ routera z powrotem na "Puste" — sprawdź że jednostki 12,13,14 wracają jako osobne 1U wiersze.
5. Zapisz układ, odśwież stronę — sprawdź że wysokość 2.5U się utrzymała po przeładowaniu z backendu.

---

## Kolejność wykonania

Task 1 i Task 2 są całkowicie niezależne od siebie i od Task 3/4 — mogą iść w dowolnej kolejności. Task 3 musi iść przed Task 4 (Task 4 zakłada że `RackVisual3D`/`DEVICE_TYPES` już istnieją w `ServerRack.jsx` jako import).
