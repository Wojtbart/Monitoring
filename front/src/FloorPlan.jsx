import { useState, useEffect, useRef } from "react";
import { Stage, Layer, Line, Circle, Text, Group, Rect, Arc } from "react-konva";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import { useRealTimeData } from "./RealTimeDataContext";
import {
    Box, Button, Typography, Paper, Chip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

const FLOORPLAN_KEY = "floorplan_persp_id";

// ─── Perspective config ───────────────────────────────────────────────────────
const ROOM = { W: 7, D: 5, H: 2.8 };
const EYE  = { y: 1.5, z: -2 };
const FOCAL = 140;

function makeProj(vpX, vpY) {
    return (wx, wy, wz) => {
        const dz = Math.max(wz - EYE.z, 0.01);
        const s  = FOCAL / dz;
        return { x: vpX + wx * s, y: vpY - (wy - EYE.y) * s };
    };
}
function pts(arr) { return arr.flatMap(p => [p.x, p.y]); }

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
    bg:       "#0b1929",
    floor:    "#0d1924",
    ceil:     "#0a1520",
    wallL:    "#0c1825",
    wallR:    "#0c1825",
    wallBack: "#0e1c2c",
    grid:     "#152030",
    grid2:    "#0f1a28",
    rackFace: "#0d1b28",
    rackTop:  "#1c2d3e",
    rackBdr:  "#2a5a80",
    rackBdrA: "#c0392b",
    rackLed:  "#00e676",
    rackAmb:  "#ffb300",
    unitLine: "#0a1520",
    sensorOk: "#27ae60",
    sensorW:  "#f39c12",
    sensorE:  "#e74c3c",
    sensorBg: "#ffffffee",
    textBr:   "#7abcd8",
    lineHi:   "#1e3a55",
    door:     "#4a3728",
    doorOpen: "#7b1a1a",
    tempOk:   "#27ae60",
    tempWrn:  "#f39c12",
    tempErr:  "#e74c3c",
    tray:     "#1a2e44",
    trayLine: "#243d56",
    light:    "#f5f0dd",
};

// ─── Rack layout (single row) ─────────────────────────────────────────────────
const RACK_W = 0.45, RACK_D = 0.9, RACK_H = 1.9;
const ROW_Z  = 0.8;
const ALL_RACKS = [
    { id: "A0", cx: -2.8, z: ROW_Z },
    { id: "A4", cx: -1.5, z: ROW_Z },
    { id: "A1", cx: -0.5, z: ROW_Z },
    { id: "A2", cx:  0.5, z: ROW_Z },
    { id: "A5", cx:  1.5, z: ROW_Z },
    { id: "A3", cx:  2.8, z: ROW_Z },
];

const ICONS = { fire: "🔥", gas: "💨", water: "💧", motion: "👁", door: "🚪", temp: "🌡️", humidity: "💧" };

// Wysokość montażu (wy) wg wybranego wariantu — sufit, ściana (wysokość
// oczu) albo podłoga. Przy upuszczeniu nowego czujnika liczymy X i
// głębokość z punktu kliknięcia NA TEJ płaszczyźnie — dzięki temu można go
// postawić w dowolnym miejscu pokoju (nie tylko na jednej ustalonej
// "smudze" głębokości).
const MOUNT_HEIGHT = { ceiling: ROOM.H - 0.02, wall: ROOM.H - 1.3, floor: 0.05 };

// Warianty czujników dostępne do ręcznego dodania z paska nad rzutem —
// pożar/gaz/ruch mają wariant sufitowy i ścienny, zalanie tylko podłogowy.
const SENSOR_TYPE_LABELS = { fire: "Pożar", gas: "Gaz/Dym", water: "Zalanie", motion: "Ruch" };
const MOUNT_LABELS = { ceiling: "sufit", wall: "ściana", floor: "podłoga" };
const MOUNT_GLYPH = { ceiling: "⌃", wall: "▯", floor: "" };
// Grupowane po typie (nie po pojedynczej opcji) — żeby w pasku dało się od
// razu ogarnąć wzrokiem "to jest pożar, ma 2 warianty", zamiast siedmiu
// identycznie wyglądających ikonek pod rząd.
const ADDABLE_SENSOR_GROUPS = [
    { type: "fire", mounts: ["ceiling", "wall"] },
    { type: "gas", mounts: ["ceiling", "wall"] },
    { type: "motion", mounts: ["ceiling", "wall"] },
    { type: "water", mounts: ["floor"] },
];

// Czujniki podłogowe (zalanie) zawsze stoją na podłodze — pion ignorowany.
const effectiveSensorWy = def => def.floor ? 0.05 : (def.wy ?? ROOM.H - 0.02);

// ─── RackBox ──────────────────────────────────────────────────────────────────
function RackBox({ rack, proj, alert, temp, humidity, onClick, onDragStart, active, onTogglePower, onContextMenuRequest, onTempClick, onHumidityClick }) {
    const [hover, setHover] = useState(false);
    const { cx, z } = rack;
    const x0 = cx - RACK_W / 2, x1 = cx + RACK_W / 2;
    const z1 = z + RACK_D;

    const fbl = proj(x0, 0,      z);
    const fbr = proj(x1, 0,      z);
    const ftl = proj(x0, RACK_H, z);
    const ftr = proj(x1, RACK_H, z);
    const bbl = proj(x0, 0,      z1);
    const bbr = proj(x1, 0,      z1);
    const btl = proj(x0, RACK_H, z1);
    const btr = proj(x1, RACK_H, z1);

    const bdr    = hover ? "#5a9abf" : (alert ? C.rackBdrA : active ? C.rackBdr : "#2a3a45");
    const tColor = temp == null ? C.tempOk : temp > 35 ? C.tempErr : temp > 30 ? C.tempWrn : C.tempOk;
    const hColor = C.textBr;
    const pw     = Math.abs(ftr.x - ftl.x);
    const nUnits = 8;

    const smY = ftl.y + (fbl.y - ftl.y) * 0.5;
    const sR  = Math.max(3.5, pw * 0.17);
    // Temp/wilg. pod sobą (nie obok siebie) — obok siebie na wąskiej szafie
    // podpisy ("22.1°C"/"31.3%") zlepiały się w jeden nieczytelny napis.
    const smX     = (ftl.x + ftr.x) / 2;
    const smYTemp = smY - sR * 1.3 - 5;
    const smYHum  = smYTemp + sR * 2 + 10;

    const pwBtnX = fbl.x + 5;
    const pwBtnY = fbl.y - 6;
    const pwBtnR = 4;
    const pwColor = active ? "#4caf50" : "#546e7a";

    return (
        <Group
            onDblClick={active ? onClick : undefined}
            onMouseDown={e => { e.cancelBubble = true; onDragStart && onDragStart(e); }}
            onMouseEnter={e => { setHover(true); e.target.getStage().container().style.cursor = "grab"; }}
            onMouseLeave={e => { setHover(false); e.target.getStage().container().style.cursor = "default"; }}
            onContextMenu={e => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                onContextMenuRequest && onContextMenuRequest(e, rack);
            }}
        >
            {/* Top face */}
            <Line closed points={pts([ftl, ftr, btr, btl])}
                fill={hover ? "#243040" : active ? C.rackTop : "#101820"} stroke={bdr} strokeWidth={0.8} />

            {/* Side faces */}
            {cx < 0 && (
                <Line closed points={pts([fbr, bbr, btr, ftr])}
                    fill={active ? "#0a1825" : "#080f18"} stroke={bdr} strokeWidth={0.8} />
            )}
            {cx > 0 && (
                <Line closed points={pts([fbl, bbl, btl, ftl])}
                    fill={active ? "#0a1825" : "#080f18"} stroke={bdr} strokeWidth={0.8} />
            )}

            {/* Front face */}
            <Line closed points={pts([fbl, fbr, ftr, ftl])}
                fill={!active ? "#080f18" : hover ? "#182535" : C.rackFace} stroke={bdr} strokeWidth={1} />

            {/* Unit dividers */}
            {Array.from({ length: nUnits - 1 }, (_, i) => {
                const yl = RACK_H * (1 - (i + 1) / nUnits);
                const l = proj(x0, yl, z), r = proj(x1, yl, z);
                return <Line key={i} points={[l.x, l.y, r.x, r.y]} stroke={C.unitLine} strokeWidth={0.5} />;
            })}

            {/* LEDs */}
            <Circle x={ftr.x - 3} y={ftr.y + 3} radius={1.8}
                fill={!active ? "#263238" : alert ? C.rackBdrA : C.rackLed}
                shadowColor={active && !alert ? C.rackLed : "transparent"} shadowBlur={5} shadowOpacity={0.9} />
            <Circle x={ftr.x - 8} y={ftr.y + 3} radius={1.8}
                fill={active ? C.rackAmb : "#263238"} shadowColor={active ? C.rackAmb : "transparent"} shadowBlur={3} shadowOpacity={0.7} />

            {/* Temperatura i wilgotność szafy — dwa osobne, klikalne przyciski
                (jeden czujnik na całą szafę, nie per-urządzenie) prowadzące
                na stronę tego czujnika. */}
            {active && (
                <>
                    <Group
                        onMouseDown={e => e.cancelBubble = true}
                        onClick={e => { e.cancelBubble = true; onTempClick && onTempClick(); }}
                        onMouseEnter={e => { e.target.getStage().container().style.cursor = "pointer"; }}
                        onMouseLeave={e => { e.target.getStage().container().style.cursor = "grab"; }}
                    >
                        <Circle x={smX} y={smYTemp} radius={sR}
                            fill={C.sensorBg} stroke={tColor} strokeWidth={1}
                            shadowColor={tColor} shadowBlur={3} shadowOpacity={0.5} />
                        <Text text={ICONS.temp} x={smX - sR} y={smYTemp - sR + 1}
                            width={sR * 2} align="center" fontSize={Math.max(5, sR * 1.1)} />
                        {temp != null && (
                            <Text text={`${temp}°C`} x={smX - 12} y={smYTemp + sR + 2}
                                width={24} align="center" fontSize={5} fill={tColor} fontStyle="bold" />
                        )}
                    </Group>
                    <Group
                        onMouseDown={e => e.cancelBubble = true}
                        onClick={e => { e.cancelBubble = true; onHumidityClick && onHumidityClick(); }}
                        onMouseEnter={e => { e.target.getStage().container().style.cursor = "pointer"; }}
                        onMouseLeave={e => { e.target.getStage().container().style.cursor = "grab"; }}
                    >
                        <Circle x={smX} y={smYHum} radius={sR}
                            fill={C.sensorBg} stroke={hColor} strokeWidth={1}
                            shadowColor={hColor} shadowBlur={3} shadowOpacity={0.5} />
                        <Text text={ICONS.humidity} x={smX - sR} y={smYHum - sR + 1}
                            width={sR * 2} align="center" fontSize={Math.max(5, sR * 1.1)} />
                        {humidity != null && (
                            <Text text={`${humidity}%`} x={smX - 12} y={smYHum + sR + 2}
                                width={24} align="center" fontSize={5} fill={hColor} fontStyle="bold" />
                        )}
                    </Group>
                </>
            )}

            {/* Label */}
            <Text text={rack.label} x={ftl.x} y={fbl.y + 3}
                width={pw} align="center"
                fontSize={Math.max(6, pw * 0.2)} fill={active ? C.textBr : "#3a5060"} fontStyle="bold" />

            {/* Power button */}
            <Group
                onMouseDown={e => e.cancelBubble = true}
                onClick={e => { e.cancelBubble = true; onTogglePower && onTogglePower(rack.id); }}
                onMouseEnter={e => { e.target.getStage().container().style.cursor = "pointer"; }}
                onMouseLeave={e => { e.target.getStage().container().style.cursor = "grab"; }}
            >
                <Circle x={pwBtnX} y={pwBtnY} radius={pwBtnR + 2}
                    fill="#0a1520" stroke={pwColor} strokeWidth={1}
                    shadowColor={pwColor} shadowBlur={active ? 5 : 2} shadowOpacity={0.8} />
                <Arc x={pwBtnX} y={pwBtnY}
                    innerRadius={Math.max(pwBtnR - 1.4, 0.6)} outerRadius={pwBtnR - 0.4}
                    angle={300} rotation={-60} fill={pwColor} />
                <Line points={[pwBtnX, pwBtnY - pwBtnR, pwBtnX, pwBtnY - pwBtnR + 2.6]}
                    stroke={pwColor} strokeWidth={1.2} lineCap="round" />
            </Group>

        </Group>
    );
}

// ─── Sensor (domyślny lub dodany, oba przeciągalne) ────────────────────────────
function Sensor({ def, proj, alert, onDragStart, deletable, onContextMenuRequest }) {
    const wy = effectiveSensorWy(def);
    const sp = proj(def.wx, wy, def.wz);
    const color = alert ? C.sensorE : C.sensorOk;
    const R = 5;
    const hasLine = def.wy === undefined;
    const lineEndY = def.floor ? sp.y - 6 : sp.y + 6;
    const labelY = def.floor ? sp.y - R - 10 : sp.y + R + 2;
    return (
        <Group
            onMouseDown={e => { e.cancelBubble = true; onDragStart && onDragStart(e); }}
            onMouseEnter={e => { e.target.getStage().container().style.cursor = "grab"; }}
            onMouseLeave={e => { e.target.getStage().container().style.cursor = "default"; }}
            onContextMenu={e => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                if (deletable) onContextMenuRequest && onContextMenuRequest(e, def);
            }}
        >
            {hasLine && (
                <Line points={[sp.x, sp.y, sp.x, lineEndY]}
                    stroke={color} strokeWidth={0.8} dash={[2, 2]} />
            )}
            {alert && <Circle x={sp.x} y={sp.y} radius={R + 4} fill={color} opacity={0.2} />}
            <Circle x={sp.x} y={sp.y} radius={R}
                fill={C.sensorBg} stroke={color} strokeWidth={1.2}
                shadowColor={color} shadowBlur={alert ? 8 : 3} shadowOpacity={0.7} />
            <Text text={ICONS[def.type] || "●"} x={sp.x - R} y={sp.y - R + 1}
                width={R * 2} align="center" fontSize={6} />
            {def.label && (
                <Text text={def.label} x={sp.x - 20} y={labelY}
                    width={40} align="center" fontSize={5}
                    fill={color} fontStyle="bold" />
            )}
        </Group>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FloorPlan() {
    const navigate = useNavigate();
    const containerRef = useRef(null);
    const stageRef     = useRef(null);
    const dragRef      = useRef(null);

    const [stageSize, setStageSize] = useState({
        w: window.innerWidth,
        h: Math.max(window.innerHeight - 170, 300),
    });
    const sd = useRealTimeData();
    const [deviceReadings, setDeviceReadings] = useState({}); // { [rackId]: { temperature, humidity } }
    const [alarmStates, setAlarmStates] = useState({});
    const [pendingSensor, setPendingSensor] = useState(null);
    const [sensorContextMenu, setSensorContextMenu] = useState(null); // { x, y, sensor }
    const [rackContextMenu, setRackContextMenu] = useState(null); // { x, y, rack }
    const [rackNames, setRackNames] = useState({}); // { [rackId]: nazwa niestandardowa }
    const [renameDialog, setRenameDialog] = useState(null); // { rackId, draft }
    const [rackXPos, setRackXPos] = useState(() =>
        Object.fromEntries(ALL_RACKS.map(r => [r.id, r.cx]))
    );
    const [rackActive, setRackActive] = useState(() =>
        Object.fromEntries(ALL_RACKS.map(r => [r.id, true]))
    );
    const [rackRemoved, setRackRemoved] = useState({}); // { [rackId]: true } — szafa fizycznie usunięta z rzutu
    const [customSensors, setCustomSensors] = useState([]);
    const [saving, setSaving]   = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [autoSave, setAutoSave] = useState(false);
    const layoutLoadedRef = useRef(false);
    const autoSaveTimerRef = useRef(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
            const w = el.offsetWidth, h = el.offsetHeight;
            // Kontener bywa chwilowo 0x0 podczas przejścia SPA między trasami
            // (zanim layout się ustabilizuje) — Stage z width/height=0 wysadza
            // Konva przy drawImage na zerowym canvasie. Ignoruj taki odczyt,
            // zostań przy poprzednim (poprawnym) rozmiarze.
            if (w > 0 && h > 0) setStageSize({ w, h });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Temperatura/wilgotność KAŻDEJ szafy — jeden czujnik na całą szafę (nie
    // per-urządzenie), więc dociągamy je wszystkie osobno z /device-sensors.
    useEffect(() => {
        const fetchDeviceReadings = async () => {
            const results = await Promise.all(ALL_RACKS.map(r =>
                axios.get(`${API_BASE}/device-sensors/${r.id}`).then(({ data }) => [r.id, data]).catch(() => [r.id, null])
            ));
            setDeviceReadings(Object.fromEntries(results.filter(([, data]) => data)));
        };
        fetchDeviceReadings();
        const iv = setInterval(fetchDeviceReadings, 5000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        const fetchAlarms = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/alarm-states`);
                setAlarmStates(Object.fromEntries(data.states.map(s => [s.event_type, s.active])));
            } catch (_) {}
        };
        fetchAlarms();
        const iv = setInterval(fetchAlarms, 5000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        axios.get(`${API_BASE}/settings`)
            .then(({ data }) => setAutoSave(!!data.settings?.[0]?.auto_save_layout))
            .catch(() => {});
    }, []);

    useEffect(() => {
        const markLoaded = () => {
            // Odroczone do osobnego ticku — żeby efekt debounce'a auto-zapisu
            // (poniżej) zdążył zobaczyć layoutLoadedRef=false przy TEJ zmianie
            // stanu (wczytanie z serwera), a nie potraktował jej jako edycję
            // użytkownika do zapisania.
            setTimeout(() => { layoutLoadedRef.current = true; }, 0);
        };
        const id = localStorage.getItem(FLOORPLAN_KEY);
        if (!id) { markLoaded(); return; }
        axios.get(`${API_BASE}/layouts/${id}`)
            .then(({ data }) => {
                if (data.type !== "floorplan_persp") {
                    // Stale/mismatched id (points at a layout of a different
                    // type) — drop it so the next save creates a fresh
                    // record instead of overwriting someone else's.
                    localStorage.removeItem(FLOORPLAN_KEY);
                    return;
                }
                if (
                    data.rackXPos &&
                    ALL_RACKS.every(r => data.rackXPos[r.id] !== undefined) &&
                    ALL_RACKS.map(r => data.rackXPos[r.id]).sort((a, b) => a - b)
                        .every((v, i, arr) => i === 0 || v - arr[i - 1] >= RACK_W)
                ) {
                    // Zapis sprzed dodania A4/A5 (brak pozycji dla wszystkich
                    // szaf) albo zapis utrwalający wcześniejszy bug (szafy
                    // nachodzące na siebie) dałby zepsuty układ. Odrzucamy
                    // taki zapis w całości i zostajemy przy świeżych
                    // domyślnych pozycjach zamiast go stosować.
                    setRackXPos(data.rackXPos);
                }
                if (data.rackActive) setRackActive(data.rackActive);
                if (data.rackRemoved) setRackRemoved(data.rackRemoved);
                if (data.customSensors) setCustomSensors(data.customSensors);
            })
            .catch(() => {})
            .finally(markLoaded);
    }, []);

    // Niestandardowe nazwy szaf (ustawione tu albo na stronie szafy) — każda
    // szafa ma WŁASNY zapisany layout (rack_layout_<rackId> w localStorage,
    // ta sama konwencja co ServerRack.jsx), więc trzeba je doczytać osobno.
    useEffect(() => {
        ALL_RACKS.forEach(r => {
            const id = localStorage.getItem(`rack_layout_${r.id}`);
            if (!id) return;
            axios.get(`${API_BASE}/layouts/${id}`)
                .then(({ data }) => {
                    if (data.type === "rack" && data.rackId === r.id && data.name) {
                        setRackNames(prev => ({ ...prev, [r.id]: data.name }));
                    }
                })
                .catch(() => {});
        });
    }, []);

    useEffect(() => {
        if (!autoSave || !layoutLoadedRef.current) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => { saveLayout(); }, 1500);
        return () => clearTimeout(autoSaveTimerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoSave, rackXPos, rackActive, rackRemoved, customSensors]);

    const saveLayout = async () => {
        setSaving(true);
        const tok = localStorage.getItem("JWT");
        const payload = { type: "floorplan_persp", rackXPos, rackActive, rackRemoved, customSensors };
        const headers = { Authorization: `Bearer ${tok}` };
        try {
            const id = localStorage.getItem(FLOORPLAN_KEY);
            if (id) {
                try {
                    await axios.put(`${API_BASE}/layouts/${id}`, payload, { headers });
                    setSavedAt(new Date()); setSaving(false); return;
                } catch (_) {}
            }
            const { data } = await axios.post(`${API_BASE}/layouts`, payload, { headers });
            localStorage.setItem(FLOORPLAN_KEY, data.id);
            setSavedAt(new Date());
        } catch (_) { alert("Błąd zapisu"); }
        setSaving(false);
    };

    // ── Perspective setup ──────────────────────────────────────────────────────
    const { w: W, h: H } = stageSize;
    const vpX        = W / 2;
    const scaleFront = FOCAL / Math.abs(EYE.z);           // = 70
    const vpY        = H * 0.85 - EYE.y * scaleFront;
    const proj       = makeProj(vpX, vpY);

    // Fixed scale: room fills canvas (width or height limited)
    const fixedScale = Math.max(
        W / (ROOM.W * scaleFront),
        H / (ROOM.H * scaleFront)
    );
    const roomCenterY = vpY + (EYE.y - ROOM.H / 2) * scaleFront;
    const fixX = W / 2 * (1 - fixedScale);
    const fixY = H / 2 - roomCenterY * fixedScale;

    // ── Drag (szafy: tylko oś X; czujniki: X + głębokość na stałej wysokości) ──
    const stageXToWorld = (sx, wz) =>
        (sx - vpX) / (FOCAL / Math.max(wz - EYE.z, 0.01));
    // Odwrotny rzut punktu ekranu na płaszczyznę stałej wysokości (wy) —
    // zwraca X i głębokość (wz) tego punktu w świecie 3D. Używane przy
    // upuszczaniu nowego czujnika: klikasz gdziekolwiek na "suficie"/
    // "podłodze", a stąd wyliczamy zarówno pozycję poziomą jak i głębokość.
    const stageToWorldOnPlane = (sx, sy, wy) => {
        const denom = vpY - sy;
        const safeDenom = Math.abs(denom) < 1 ? (denom < 0 ? -1 : 1) : denom;
        const wz = EYE.z + (FOCAL * (wy - EYE.y)) / safeDenom;
        const clampedWz = Math.max(0.05, Math.min(ROOM.D - 0.05, wz));
        const s = FOCAL / Math.max(clampedWz - EYE.z, 0.01);
        const wx = (sx - vpX) / s;
        return { wx, wz: clampedWz };
    };

    const handleRackDragStart = (e, rack) => {
        const rect   = containerRef.current.getBoundingClientRect();
        const stageX = (e.evt.clientX - rect.left - fixX) / fixedScale;
        dragRef.current = {
            kind: "rack", id: rack.id, wz: rack.z,
            startStageX: stageX, startWorldX: rackXPos[rack.id],
        };
        setIsDragging(true);
    };

    // Czujniki: nie liczymy przesunięcia względnego, tylko na bieżąco
    // rzutujemy kursor na płaszczyznę wysokości montażu tego czujnika —
    // dzięki temu można go swobodnie przesuwać po całym pokoju (X i
    // głębokość naraz), nie tylko wzdłuż jednej zamrożonej linii głębokości.
    const handleSensorDragStart = (e, sensor) => {
        dragRef.current = {
            kind: "sensor", id: sensor.id, planeWy: effectiveSensorWy(sensor),
        };
        setIsDragging(true);
    };

    const handleMouseMove = e => {
        if (!dragRef.current) return;
        const rect   = containerRef.current.getBoundingClientRect();
        const stageX = (e.evt.clientX - rect.left - fixX) / fixedScale;
        const stageY = (e.evt.clientY - rect.top - fixY) / fixedScale;
        const { kind, id } = dragRef.current;

        if (kind === "rack") {
            const { wz, startStageX, startWorldX } = dragRef.current;
            const dx = stageXToWorld(stageX, wz) - stageXToWorld(startStageX, wz);
            const newCx = Math.max(-ROOM.W / 2 + RACK_W, Math.min(ROOM.W / 2 - RACK_W, startWorldX + dx));
            setRackXPos(prev => ({ ...prev, [id]: newCx }));
        } else {
            const { planeWy } = dragRef.current;
            const { wx: rawWx, wz } = stageToWorldOnPlane(stageX, stageY, planeWy);
            const newWx = Math.max(-ROOM.W / 2 + 0.02, Math.min(ROOM.W / 2 - 0.02, rawWx));
            setCustomSensors(prev => prev.map(s => s.id === id ? { ...s, wx: newWx, wz } : s));
        }
    };

    const handleMouseUp = () => {
        dragRef.current = null;
        setIsDragging(false);
    };

    const toggleRackPower = id => setRackActive(prev => ({ ...prev, [id]: !prev[id] }));

    const addSensor = (type, mount, wx, wz) => {
        const id = `custom-${type}-${Date.now()}`;
        const isFloor = mount === "floor";
        setCustomSensors(prev => [...prev, {
            id, type, wx, wz,
            wy: isFloor ? undefined : MOUNT_HEIGHT[mount],
            label: SENSOR_TYPE_LABELS[type],
            ...(isFloor ? { floor: true } : {}),
        }]);
    };

    const deleteCustomSensor = id =>
        setCustomSensors(prev => prev.filter(s => s.id !== id));

    const configureSensor = s =>
        navigate(s.type === "motion" ? "/settings#powiadomienia" : "/room-sensor/" + s.type);

    const handleSensorContextMenu = (e, sensor) => {
        setSensorContextMenu({ x: e.evt.clientX, y: e.evt.clientY, sensor });
    };

    const handleRackContextMenu = (e, rack) => {
        setRackContextMenu({ x: e.evt.clientX, y: e.evt.clientY, rack });
    };

    const openRenameDialog = rack => {
        setRenameDialog({ rackId: rack.id, draft: rackNames[rack.id] || rack.label });
    };

    // Lista szaf jest stała w kodzie (A0-A5), więc "usuń" nie kasuje danych,
    // tylko chowa szafę z rzutu (fizycznie zdemontowana) — cofalne przyciskiem
    // "Przywróć szafy" w pasku, dopóki nie zostanie nadpisane innym zapisem.
    const removeRack = rackId => {
        setRackRemoved(prev => ({ ...prev, [rackId]: true }));
        setRackContextMenu(null);
    };
    const restoreRacks = () => setRackRemoved({});

    // Każda szafa ma własny zapisany layout (rack_layout_<rackId>, ta sama
    // konwencja co ServerRack.jsx) — jeśli już istnieje, dopisujemy do niego
    // samą nazwę bez ruszania reszty (rozmiar/sloty); jeśli nie ma jeszcze
    // żadnego zapisu dla tej szafy, tworzymy minimalny.
    const renameRack = async (rackId, name) => {
        const key = `rack_layout_${rackId}`;
        const existingId = localStorage.getItem(key);
        const token = localStorage.getItem("JWT");
        const headers = { Authorization: `Bearer ${token}` };
        try {
            if (existingId) {
                const { data } = await axios.get(`${API_BASE}/layouts/${existingId}`);
                if (data.type === "rack" && data.rackId === rackId) {
                    await axios.put(`${API_BASE}/layouts/${existingId}`, { ...data, name }, { headers });
                    setRackNames(prev => ({ ...prev, [rackId]: name }));
                    return;
                }
            }
            const { data } = await axios.post(
                `${API_BASE}/layouts`,
                { type: "rack", rackId, rackSize: 42, slots: [], name },
                { headers },
            );
            localStorage.setItem(key, data.id);
            setRackNames(prev => ({ ...prev, [rackId]: name }));
        } catch (_) {
            alert("Błąd zapisu nazwy szafy");
        }
    };


    // Przeciąganie nowego czujnika z paska ikonek na scenę — trzymaj ikonkę,
    // przesuń kursor nad rzut, puść żeby postawić czujnik dokładnie tam.
    useEffect(() => {
        if (!pendingSensor) return;
        const handleMove = e => {
            setPendingSensor(prev => prev && { ...prev, clientX: e.clientX, clientY: e.clientY });
        };
        const handleUp = e => {
            const rect = containerRef.current.getBoundingClientRect();
            const inside = e.clientX >= rect.left && e.clientX <= rect.right
                && e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (inside) {
                const stageX = (e.clientX - rect.left - fixX) / fixedScale;
                const stageY = (e.clientY - rect.top - fixY) / fixedScale;
                const mountHeight = MOUNT_HEIGHT[pendingSensor.mount];
                const { wx: rawWx, wz } = stageToWorldOnPlane(stageX, stageY, mountHeight);
                const wx = Math.max(-ROOM.W / 2 + 0.02, Math.min(ROOM.W / 2 - 0.02, rawWx));
                addSensor(pendingSensor.type, pendingSensor.mount, wx, wz);
            }
            setPendingSensor(null);
        };
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
    }, [pendingSensor?.type, pendingSensor?.mount]);

    const effectiveRacks = ALL_RACKS
        .filter(r => !rackRemoved[r.id])
        .map(r => ({ ...r, cx: rackXPos[r.id] ?? r.cx }))
        .sort((a, b) => a.cx - b.cx)
        .map((r, i) => ({ ...r, label: rackNames[r.id] || `Szafa ${i + 1}` }));

    // ── Room geometry ──────────────────────────────────────────────────────────
    const ffl = proj(-ROOM.W / 2, 0,      0);
    const ffr = proj( ROOM.W / 2, 0,      0);
    const fcl = proj(-ROOM.W / 2, ROOM.H, 0);
    const fcr = proj( ROOM.W / 2, ROOM.H, 0);
    const bfl = proj(-ROOM.W / 2, 0,      ROOM.D);
    const bfr = proj( ROOM.W / 2, 0,      ROOM.D);
    const bcl = proj(-ROOM.W / 2, ROOM.H, ROOM.D);
    const bcr = proj( ROOM.W / 2, ROOM.H, ROOM.D);

    const floorLines = [];
    for (let xi = -ROOM.W / 2; xi <= ROOM.W / 2; xi += 2) {
        const a = proj(xi, 0, 0), b = proj(xi, 0, ROOM.D);
        floorLines.push([a.x, a.y, b.x, b.y]);
    }
    for (let zi = 0; zi <= ROOM.D; zi++) {
        const a = proj(-ROOM.W / 2, 0, zi), b = proj(ROOM.W / 2, 0, zi);
        floorLines.push([a.x, a.y, b.x, b.y]);
    }

    const ceilLines = [];
    for (let xi = -ROOM.W / 2; xi <= ROOM.W / 2; xi += 2) {
        const a = proj(xi, ROOM.H, 0), b = proj(xi, ROOM.H, ROOM.D);
        ceilLines.push([a.x, a.y, b.x, b.y]);
    }
    for (let zi = 0; zi <= ROOM.D; zi++) {
        const a = proj(-ROOM.W / 2, ROOM.H, zi), b = proj(ROOM.W / 2, ROOM.H, zi);
        ceilLines.push([a.x, a.y, b.x, b.y]);
    }

    const dL   = proj(-0.5, 0,   ROOM.D);
    const dR   = proj( 0.5, 0,   ROOM.D);
    const dTL  = proj(-0.5, 2.2, ROOM.D);
    const dTR  = proj( 0.5, 2.2, ROOM.D);
    const doorOpen = !!sd.door;

    const ct1 = proj(-0.2, ROOM.H - 0.06, 0.4);
    const ct2 = proj( 0.2, ROOM.H - 0.06, 0.4);
    const ct3 = proj( 0.2, ROOM.H - 0.06, ROOM.D - 0.4);
    const ct4 = proj(-0.2, ROOM.H - 0.06, ROOM.D - 0.4);

    const getAlert  = t => t === "motion" ? !!sd.motion : !!alarmStates[t];
    const rackAlert = !!(alarmStates.fire || alarmStates.gas || alarmStates.water || sd.temperature > 35);
    const anyAlert  = rackAlert || doorOpen;

    // door sensor circle
    const dsc    = proj(0, 1.1, ROOM.D);
    const dColor = alarmStates.door ? C.sensorE : C.sensorOk;

    return (
        <Layout>
            {pendingSensor && (
                <Box sx={{
                    position: "fixed", left: pendingSensor.clientX - 14, top: pendingSensor.clientY - 14,
                    fontSize: "1.75rem", pointerEvents: "none", zIndex: 2000, opacity: 0.85,
                }}>
                    {ICONS[pendingSensor.type]}{MOUNT_GLYPH[pendingSensor.mount]}
                </Box>
            )}

            {/* Keeps footer pinned at bottom */}
            <Box sx={{ height: "calc(100vh - 116px)" }} />

            <Box sx={{
                position: "fixed", top: "64px", left: 0, right: 0, bottom: "52px",
                borderBottom: "2px solid #1e3a55",
                display: "flex", flexDirection: "column", zIndex: 50,
            }}>
                {/* Toolbar */}
                <Paper elevation={2} sx={{ flexShrink: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, pt: 0.75, pb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight="bold">Serwerownia — widok</Typography>
                        {anyAlert && <Chip label="ALARM" color="error" size="small" icon={<WarningAmberIcon />} />}
                        <Box sx={{ flex: 1 }} />
                        <Chip size="small"
                            label={doorOpen ? "Drzwi OTWARTE" : "Drzwi zamknięte"}
                            color={doorOpen ? "error" : "success"} variant="outlined" />
                        {autoSave && <Chip size="small" variant="outlined" color="success" label="Auto-zapis" />}
                        {Object.values(rackRemoved).some(Boolean) && (
                            <Chip size="small" variant="outlined" onClick={restoreRacks}
                                label={`Przywróć usunięte szafy (${Object.values(rackRemoved).filter(Boolean).length})`} />
                        )}
                        {savedAt && (
                            <Typography variant="caption" color="text.secondary">
                                Zapisano {savedAt.toLocaleTimeString()}
                            </Typography>
                        )}
                        <Button size="small" variant="contained" startIcon={<SaveIcon />}
                            onClick={saveLayout} disabled={saving}>
                            Zapisz układ
                        </Button>
                    </Box>
                    <Box sx={{
                        display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap",
                        px: 2, pb: 0.75, pt: 0.25, borderTop: "1px solid #eee",
                    }}>
                        <Typography variant="caption" color="text.secondary">
                            Dodaj czujnik:
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            {ADDABLE_SENSOR_GROUPS.map(({ type, mounts }) => (
                                <Box key={type} sx={{
                                    display: "flex", alignItems: "center", gap: 0.5,
                                    border: "1px solid #ddd", borderRadius: 1.5, px: 0.75, py: 0.25,
                                }}>
                                    <Typography sx={{ fontSize: "1rem", lineHeight: 1 }}>{ICONS[type]}</Typography>
                                    <Typography variant="caption" fontWeight="bold" color="text.secondary">
                                        {SENSOR_TYPE_LABELS[type]}
                                    </Typography>
                                    {mounts.map(mount => (
                                        <Tooltip key={mount} title={`Przytrzymaj i przeciągnij na rzut: ${SENSOR_TYPE_LABELS[type]} (${MOUNT_LABELS[mount]})`}>
                                            <Chip
                                                size="small"
                                                label={MOUNT_LABELS[mount]}
                                                onMouseDown={e => setPendingSensor({ type, mount, clientX: e.clientX, clientY: e.clientY })}
                                                sx={{ height: 20, fontSize: "0.65rem", cursor: "grab" }}
                                            />
                                        </Tooltip>
                                    ))}
                                </Box>
                            ))}
                        </Box>
                        <Box sx={{ flex: 1 }} />
                        <Chip size="small" variant="outlined" label="🖱️ Przeciągnij = przesuń" />
                        <Chip size="small" variant="outlined" label="2×klik szafa = edycja" />
                        <Chip size="small" variant="outlined" label="PPM czujnik = menu" />
                    </Box>
                </Paper>

                {/* Canvas */}
                <Box ref={containerRef} sx={{ flex: 1, overflow: "hidden", bgcolor: C.bg }}>
                    <Stage ref={stageRef} width={W} height={H}
                        x={fixX} y={fixY} scaleX={fixedScale} scaleY={fixedScale}
                        onContextMenu={e => { e.evt.preventDefault(); setSensorContextMenu(null); setRackContextMenu(null); }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}>
                        <Layer>
                            <Rect x={-2000} y={-2000} width={W + 4000} height={H + 4000} fill={C.bg} />

                            {/* Floor */}
                            <Line closed points={pts([ffl, ffr, bfr, bfl])} fill={C.floor} stroke="transparent" />
                            {floorLines.map((l, i) => <Line key={i} points={l} stroke={C.grid} strokeWidth={0.5} />)}

                            {/* Walls */}
                            <Line closed points={pts([ffl, fcl, bcl, bfl])} fill={C.wallL} stroke={C.lineHi} strokeWidth={0.5} />
                            <Line closed points={pts([ffr, fcr, bcr, bfr])} fill={C.wallR} stroke={C.lineHi} strokeWidth={0.5} />
                            <Line closed points={pts([bfl, bfr, bcr, bcl])} fill={C.wallBack} stroke={C.lineHi} strokeWidth={1} />

                            {/* Door */}
                            <Line closed points={pts([dL, dR, dTR, dTL])}
                                fill={doorOpen ? C.doorOpen : C.door}
                                stroke={doorOpen ? "#e74c3c" : "#6d4c41"} strokeWidth={1} />
                            <Line points={[dTL.x, dTL.y, dTR.x, dTR.y]}
                                stroke={doorOpen ? "#e74c3c" : "#8d6e63"} strokeWidth={1} />

                            {/* Ceiling */}
                            <Line closed points={pts([fcl, fcr, bcr, bcl])} fill={C.ceil} stroke={C.lineHi} strokeWidth={0.5} />
                            {ceilLines.map((l, i) => <Line key={i} points={l} stroke={C.grid2} strokeWidth={0.4} />)}

                            {/* Cable tray */}
                            <Line closed points={pts([ct1, ct2, ct3, ct4])} fill={C.tray} stroke={C.trayLine} strokeWidth={1} />
                            {Array.from({ length: 6 }, (_, i) => {
                                const wz = 0.4 + (i + 1) / 7 * (ROOM.D - 0.8);
                                const l = proj(-0.2, ROOM.H - 0.06, wz), r = proj(0.2, ROOM.H - 0.06, wz);
                                return <Line key={i} points={[l.x, l.y, r.x, r.y]} stroke={C.trayLine} strokeWidth={0.8} />;
                            })}

                            {/* Ceiling lights */}
                            {[[-2, 0.6], [2, 0.6], [-2, 2.6], [2, 2.6]].map(([lx, lz], i) => {
                                const sp = proj(lx, ROOM.H - 0.04, lz);
                                return (
                                    <Group key={i}>
                                        <Rect x={sp.x - 8} y={sp.y - 3} width={16} height={4}
                                            fill={C.light} cornerRadius={1}
                                            shadowColor={C.light} shadowBlur={12} shadowOpacity={0.5} />
                                    </Group>
                                );
                            })}

                            {/* Racks (single row) */}
                            {effectiveRacks.map(rack => (
                                <RackBox key={rack.id} rack={rack} proj={proj}
                                    alert={rackAlert}
                                    temp={deviceReadings[rack.id]?.temperature}
                                    humidity={deviceReadings[rack.id]?.humidity}
                                    onClick={() => navigate("/rack/" + rack.id)}
                                    onDragStart={e => handleRackDragStart(e, rack)}
                                    active={rackActive[rack.id] !== false}
                                    onTogglePower={toggleRackPower}
                                    onContextMenuRequest={handleRackContextMenu}
                                    onTempClick={() => navigate(`/rack/${rack.id}/sensor/temperature`)}
                                    onHumidityClick={() => navigate(`/rack/${rack.id}/sensor/humidity`)} />
                            ))}

                            {/* Czujniki (przesuwalne + prawy klik = menu kontekstowe) —
                                rysowane NAD szafami, żeby przeciągnięty czujnik nigdy nie
                                znikał za rackiem */}
                            {customSensors.map(s => (
                                <Sensor key={s.id} def={s} proj={proj} alert={getAlert(s.type)}
                                    onDragStart={e => handleSensorDragStart(e, s)}
                                    deletable onContextMenuRequest={handleSensorContextMenu} />
                            ))}

                            {/* Door sensor circle */}
                            <Group onDblClick={() => navigate("/room-sensor/door")}>
                                {doorOpen && <Circle x={dsc.x} y={dsc.y} radius={9} fill={dColor} opacity={0.2} />}
                                <Circle x={dsc.x} y={dsc.y} radius={5}
                                    fill={C.sensorBg} stroke={dColor} strokeWidth={1.2}
                                    shadowColor={dColor} shadowBlur={doorOpen ? 8 : 2} shadowOpacity={0.8} />
                                <Text text={ICONS.door} x={dsc.x - 5} y={dsc.y - 5 + 1}
                                    width={10} align="center" fontSize={6} />
                                <Text text={doorOpen ? "OTWARTE" : "ZAMKN."}
                                    x={dsc.x - 14} y={dsc.y + 7} width={28} align="center"
                                    fontSize={5} fill={dColor} fontStyle="bold" />
                            </Group>

                            {/* Front frame edges */}
                            <Line points={[ffl.x, ffl.y, fcl.x, fcl.y]} stroke={C.lineHi} strokeWidth={1.5} />
                            <Line points={[ffr.x, ffr.y, fcr.x, fcr.y]} stroke={C.lineHi} strokeWidth={1.5} />
                            <Line points={[ffl.x, ffl.y, ffr.x, ffr.y]} stroke={C.lineHi} strokeWidth={1} />
                            <Line points={[fcl.x, fcl.y, fcr.x, fcr.y]} stroke={C.lineHi} strokeWidth={1} />
                        </Layer>
                    </Stage>
                </Box>
            </Box>

            <Menu
                open={!!sensorContextMenu}
                onClose={() => setSensorContextMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={sensorContextMenu ? { top: sensorContextMenu.y, left: sensorContextMenu.x } : undefined}
            >
                <MenuItem onClick={() => { configureSensor(sensorContextMenu.sensor); setSensorContextMenu(null); }}>
                    <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Konfiguruj</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { deleteCustomSensor(sensorContextMenu.sensor.id); setSensorContextMenu(null); }}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText sx={{ color: "error.main" }}>Usuń</ListItemText>
                </MenuItem>
            </Menu>

            <Menu
                open={!!rackContextMenu}
                onClose={() => setRackContextMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={rackContextMenu ? { top: rackContextMenu.y, left: rackContextMenu.x } : undefined}
            >
                <MenuItem onClick={() => { openRenameDialog(rackContextMenu.rack); setRackContextMenu(null); }}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Zmień nazwę</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => removeRack(rackContextMenu.rack.id)}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText sx={{ color: "error.main" }}>Usuń</ListItemText>
                </MenuItem>
            </Menu>

            <Dialog open={!!renameDialog} onClose={() => setRenameDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Zmień nazwę szafy</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus fullWidth margin="dense" label="Nazwa"
                        value={renameDialog?.draft || ""}
                        onChange={e => setRenameDialog(prev => ({ ...prev, draft: e.target.value }))}
                        onKeyDown={e => {
                            if (e.key === "Enter" && renameDialog?.draft.trim()) {
                                renameRack(renameDialog.rackId, renameDialog.draft.trim());
                                setRenameDialog(null);
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRenameDialog(null)}>Anuluj</Button>
                    <Button
                        variant="contained"
                        disabled={!renameDialog?.draft.trim()}
                        onClick={() => {
                            renameRack(renameDialog.rackId, renameDialog.draft.trim());
                            setRenameDialog(null);
                        }}
                    >
                        Zapisz
                    </Button>
                </DialogActions>
            </Dialog>
        </Layout>
    );
}
