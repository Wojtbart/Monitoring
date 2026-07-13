import { useState, useEffect, useRef } from "react";
import { Stage, Layer, Line, Circle, Text, Group, Rect } from "react-konva";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import { Box, Button, Typography, Paper, Chip } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SaveIcon from "@mui/icons-material/Save";

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
const RACK_W = 0.6, RACK_D = 0.9, RACK_H = 2.1;
const ROW_Z  = 0.8;
const ALL_RACKS = [-2.5, -0.85, 0.85, 2.5].map((cx, i) => ({
    id: `A${i}`, label: `Szafa ${i + 1}`, cx, z: ROW_Z,
}));

// ─── Fixed sensors ────────────────────────────────────────────────────────────
const SENSOR_DEFS = [
    { id: "s1", type: "fire",  wx: -(ROOM.W / 2 - 0.3), wz: ROOM.D - 0.3,           label: "Pożar" },
    { id: "s2", type: "gas",   wx:  (ROOM.W / 2 - 0.3), wz: ROOM.D - 0.3,           label: "Gaz/Dym" },
    { id: "s4", type: "water", wx: -(ROOM.W / 2 - 0.3), wz: 0.12, floor: true,      label: "Zalanie" },
];

const ICONS = { fire: "🔥", gas: "💨", water: "💧", motion: "👁", door: "🚪", temp: "🌡️" };

// ─── RackBox ──────────────────────────────────────────────────────────────────
function RackBox({ rack, proj, alert, temp, humidity, onClick, onDragStart, active, onTogglePower }) {
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
    const tColor = !temp ? C.tempOk : temp > 35 ? C.tempErr : temp > 30 ? C.tempWrn : C.tempOk;
    const pw     = Math.abs(ftr.x - ftl.x);
    const nUnits = 8;

    const smX = (ftl.x + ftr.x) / 2;
    const smY = ftl.y + (fbl.y - ftl.y) * 0.5;
    const sR  = Math.max(4, pw * 0.14);

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

            {/* Temp/humidity sensor icon (only when active) */}
            {active && (
                <>
                    <Circle x={smX} y={smY} radius={sR}
                        fill={C.sensorBg} stroke={tColor} strokeWidth={1}
                        shadowColor={tColor} shadowBlur={3} shadowOpacity={0.5} />
                    <Text text={ICONS.temp} x={smX - sR} y={smY - sR + 1}
                        width={sR * 2} align="center" fontSize={Math.max(5, sR * 1.1)} />
                    {temp != null && (
                        <Text text={`${temp}°C`} x={smX - 12} y={smY + sR + 2}
                            width={24} align="center" fontSize={5} fill={tColor} fontStyle="bold" />
                    )}
                    {humidity != null && (
                        <Text text={`${humidity}%`} x={smX - 12} y={smY + sR + 8}
                            width={24} align="center" fontSize={5} fill={C.textBr} fontStyle="bold" />
                    )}
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
                <Text text="⏻" x={pwBtnX - pwBtnR - 1} y={pwBtnY - pwBtnR}
                    width={(pwBtnR + 1) * 2} align="center" fontSize={pwBtnR * 1.5} fill={pwColor} />
            </Group>

        </Group>
    );
}

// ─── Fixed sensor ─────────────────────────────────────────────────────────────
function Sensor({ def, proj, alert }) {
    const wy = def.floor ? 0.05 : (def.wy ?? ROOM.H - 0.02);
    const sp = proj(def.wx, wy, def.wz);
    const color = alert ? C.sensorE : C.sensorOk;
    const R = 5;
    const hasLine = def.wy === undefined;
    const lineEndY = def.floor ? sp.y - 6 : sp.y + 6;
    const labelY = def.floor ? sp.y - R - 10 : sp.y + R + 2;
    return (
        <Group>
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
    const [sd, setSd]           = useState({});
    const [rackXPos, setRackXPos] = useState(() =>
        Object.fromEntries(ALL_RACKS.map(r => [r.id, r.cx]))
    );
    const [rackActive, setRackActive] = useState(() =>
        Object.fromEntries(ALL_RACKS.map(r => [r.id, true]))
    );
    const [saving, setSaving]   = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() =>
            setStageSize({ w: el.offsetWidth, h: el.offsetHeight })
        );
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const fetch = async () => {
            try { const { data } = await axios.get(`${API_BASE}/realTimeData`); setSd(data); }
            catch (_) {}
        };
        fetch();
        const iv = setInterval(fetch, 5000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        const id = localStorage.getItem(FLOORPLAN_KEY);
        if (!id) return;
        axios.get(`${API_BASE}/getLayout/${id}`)
            .then(({ data }) => {
                if (data.rackXPos) setRackXPos(data.rackXPos);
                if (data.rackActive) setRackActive(data.rackActive);
            })
            .catch(() => {});
    }, []);

    const saveLayout = async () => {
        setSaving(true);
        const tok = localStorage.getItem("JWT");
        const payload = { type: "floorplan_persp", rackXPos, rackActive };
        const headers = { Authorization: `Bearer ${tok}` };
        try {
            const id = localStorage.getItem(FLOORPLAN_KEY);
            if (id) {
                try {
                    await axios.put(`${API_BASE}/updateLayout/${id}`, payload, { headers });
                    setSavedAt(new Date()); setSaving(false); return;
                } catch (_) {}
            }
            const { data } = await axios.post(`${API_BASE}/saveLayout`, payload, { headers });
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

    // ── Rack drag ──────────────────────────────────────────────────────────────
    const stageXToWorld = (sx, wz) =>
        (sx - vpX) / (FOCAL / Math.max(wz - EYE.z, 0.01));

    const handleRackDragStart = (e, rack) => {
        const rect   = containerRef.current.getBoundingClientRect();
        const stageX = (e.evt.clientX - rect.left - fixX) / fixedScale;
        dragRef.current = {
            id: rack.id, rackZ: rack.z,
            startStageX: stageX, startWorldX: rackXPos[rack.id],
        };
        setIsDragging(true);
    };

    const handleMouseMove = e => {
        if (!dragRef.current) return;
        const rect   = containerRef.current.getBoundingClientRect();
        const stageX = (e.evt.clientX - rect.left - fixX) / fixedScale;
        const { id, rackZ, startStageX, startWorldX } = dragRef.current;
        const dx    = stageXToWorld(stageX, rackZ) - stageXToWorld(startStageX, rackZ);
        const newCx = Math.max(-ROOM.W / 2 + RACK_W, Math.min(ROOM.W / 2 - RACK_W, startWorldX + dx));
        setRackXPos(prev => ({ ...prev, [id]: newCx }));
    };

    const handleMouseUp = () => { dragRef.current = null; setIsDragging(false); };

    const toggleRackPower = id => setRackActive(prev => ({ ...prev, [id]: !prev[id] }));

    const effectiveRacks = ALL_RACKS.map(r => ({ ...r, cx: rackXPos[r.id] ?? r.cx }));

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

    const getAlert  = t => ({ fire: !!sd.fire, gas: !!sd.gas, water: !!sd.water, motion: !!sd.motion }[t] ?? false);
    const rackAlert = !!(sd.fire || sd.gas || sd.water || sd.temperature > 35);
    const anyAlert  = rackAlert || doorOpen;

    // door sensor circle
    const dsc    = proj(0, 1.1, ROOM.D);
    const dColor = doorOpen ? C.sensorE : C.sensorOk;

    return (
        <Layout>
            {/* Keeps footer pinned at bottom */}
            <Box sx={{ height: "calc(100vh - 116px)" }} />

            <Box sx={{
                position: "fixed", top: "64px", left: 0, right: 0, bottom: "52px",
                borderBottom: "2px solid #1e3a55",
                display: "flex", flexDirection: "column", zIndex: 50,
            }}>
                {/* Toolbar */}
                <Paper elevation={2} sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.75, flexShrink: 0 }}>
                    <Typography variant="subtitle2" fontWeight="bold">Serwerownia — widok</Typography>
                    {anyAlert && <Chip label="ALARM" color="error" size="small" icon={<WarningAmberIcon />} />}
                    <Box sx={{ flex: 1 }} />
                    <Chip size="small"
                        label={doorOpen ? "Drzwi OTWARTE" : "Drzwi zamknięte"}
                        color={doorOpen ? "error" : "success"} variant="outlined" />
                    <Typography variant="caption" color="text.secondary">
                        Przeciągnij szafę · 2×klik=widok serwera
                    </Typography>
                    {savedAt && (
                        <Typography variant="caption" color="text.secondary">
                            Zapisano {savedAt.toLocaleTimeString()}
                        </Typography>
                    )}
                    <Button size="small" variant="contained" startIcon={<SaveIcon />}
                        onClick={saveLayout} disabled={saving}>
                        Zapisz układ
                    </Button>
                </Paper>

                {/* Canvas */}
                <Box ref={containerRef} sx={{ flex: 1, overflow: "hidden", bgcolor: C.bg }}>
                    <Stage ref={stageRef} width={W} height={H}
                        x={fixX} y={fixY} scaleX={fixedScale} scaleY={fixedScale}
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

                            {/* Fixed sensors */}
                            {SENSOR_DEFS.map(s => (
                                <Sensor key={s.id} def={s} proj={proj} alert={getAlert(s.type)} />
                            ))}

                            {/* Racks (single row) */}
                            {effectiveRacks.map(rack => (
                                <RackBox key={rack.id} rack={rack} proj={proj}
                                    alert={rackAlert} temp={sd.temperature} humidity={sd.humidity}
                                    onClick={() => navigate("/rack/" + rack.id)}
                                    onDragStart={e => handleRackDragStart(e, rack)}
                                    active={rackActive[rack.id] !== false}
                                    onTogglePower={toggleRackPower} />
                            ))}

                            {/* Door sensor circle */}
                            <Group>
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
        </Layout>
    );
}
