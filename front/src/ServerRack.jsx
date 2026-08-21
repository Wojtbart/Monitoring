import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import {
    Box, Typography, Button, TextField, Select, MenuItem,
    Chip, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, Alert, FormControl, InputLabel, Switch, FormControlLabel,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import NetworkPingIcon from "@mui/icons-material/NetworkPing";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import RackVisual3D, { DEVICE_TYPES } from "./RackVisual3D";

const RACK_PRESETS = [16, 32, 42];

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

const wouldOverlap = (currentSlots, editUnit, height) => {
    const end = editUnit + height;
    return currentSlots.some(s =>
        s.unit !== editUnit &&
        s.type !== "empty" &&
        s.unit < end &&
        editUnit < s.unit + (s.height || 1)
    );
};

const getStatus = (sensor, slot) => {
    if (slot.type === "empty") return null;
    if (sensor.fire || sensor.gas || sensor.water) return "critical";
    if (sensor.temperature > 35 || sensor.temperature < 15 ||
        sensor.humidity > 80 || sensor.humidity < 20) return "warning";
    return "ok";
};

const STATUS_CONFIG = {
    ok:       { color: "#4caf50", label: "OK",    glow: "0 0 6px #4caf50" },
    warning:  { color: "#ff9800", label: "WARN",  glow: "0 0 6px #ff9800" },
    critical: { color: "#f44336", label: "ALARM", glow: "0 0 8px #f44336" },
};

function LED({ status }) {
    if (!status) return <Box sx={{ width: 36 }} />;
    const cfg = STATUS_CONFIG[status];
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: cfg.color, boxShadow: cfg.glow }} />
            <Typography sx={{ color: cfg.color, fontWeight: "bold", fontSize: "0.62rem", fontFamily: "monospace" }}>
                {cfg.label}
            </Typography>
        </Box>
    );
}

const COLS = "44px 70px 1fr 68px 68px 72px 64px 108px";

const openManagement = address => {
    if (!address) return;
    const url = /^https?:\/\//i.test(address) ? address : `http://${address}`;
    window.open(url, "_blank", "noopener,noreferrer");
};

const extractHost = address => (address || "").split(":")[0].trim();

function RackHeader() {
    const cell = label => (
        <Typography variant="caption" sx={{ color: "#8b949e", fontWeight: "bold", fontSize: "0.68rem", letterSpacing: "0.05em" }}>
            {label}
        </Typography>
    );
    return (
        <Box sx={{ display: "grid", gridTemplateColumns: COLS, gap: 1, px: 2, py: 1, bgcolor: "#161b22", borderBottom: "1px solid #30363d" }}>
            {cell("UNIT")} {cell("TYP")} {cell("URZĄDZENIE")}
            {cell("TEMP")} {cell("WILG")} {cell("PING")} {cell("STATUS")} <Box />
        </Box>
    );
}

function RackSlot({ slot, sensor, onEdit, onDelete, pingState, onPing }) {
    const status  = getStatus(sensor, slot);
    const dtype   = DEVICE_TYPES[slot.type] || DEVICE_TYPES.empty;
    const isEmpty = slot.type === "empty";

    return (
        <Box sx={{
            display: "grid", gridTemplateColumns: COLS, gap: 1, px: 2, py: 0.65,
            borderBottom: "1px solid #21262d", alignItems: "center",
            bgcolor: slot.unit % 2 === 0 ? "#161b22" : "#0d1117",
            opacity: isEmpty ? 0.45 : 1,
            "&:hover": { bgcolor: "#1c2128" },
            transition: "all 0.15s",
        }}>
            <Typography sx={{ color: "#484f58", fontFamily: "monospace", fontSize: "0.7rem" }}>
                {(slot.height || 1) > 1
                    ? `${String(slot.unit).padStart(2, "0")}–${String(slot.unit + Math.ceil(slot.height) - 1).padStart(2, "0")}U`
                    : `${String(slot.unit).padStart(2, "0")}U`}
            </Typography>
            <Typography sx={{ color: dtype.color, fontSize: "0.68rem", fontWeight: "bold" }}>
                {dtype.label}
            </Typography>
            <Typography sx={{
                color: isEmpty ? "#484f58" : "#e6edf3",
                fontSize: "0.78rem", fontFamily: "monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
                {slot.name || (isEmpty ? "— puste —" : "bez nazwy")}
            </Typography>
            <Typography sx={{ color: isEmpty ? "#484f58" : "#ef5350", fontFamily: "monospace", fontSize: "0.72rem" }}>
                {isEmpty ? "—" : `${sensor.temperature}°C`}
            </Typography>
            <Typography sx={{ color: isEmpty ? "#484f58" : "#42a5f5", fontFamily: "monospace", fontSize: "0.72rem" }}>
                {isEmpty ? "—" : `${sensor.humidity}%`}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <IconButton
                    size="small"
                    disabled={isEmpty || !slot.management || pingState?.state === "loading"}
                    onClick={() => onPing(slot.unit, slot.management)}
                    sx={{
                        p: 0.3,
                        color: !isEmpty && slot.management ? "#c9d1d9" : "#3a4048",
                        "&:hover": { color: "#2196f3" },
                    }}
                    title={slot.management ? `Ping ${extractHost(slot.management)}` : "Brak adresu management"}
                >
                    <NetworkPingIcon sx={{ fontSize: "0.85rem" }} />
                </IconButton>
                {pingState?.state === "loading" && (
                    <Typography sx={{ color: "#8b949e", fontSize: "0.62rem", fontFamily: "monospace" }}>...</Typography>
                )}
                {pingState?.state === "ok" && (
                    <Typography sx={{ color: "#4caf50", fontSize: "0.62rem", fontFamily: "monospace", fontWeight: "bold" }}>OK</Typography>
                )}
                {pingState?.state === "fail" && (
                    <Typography sx={{ color: "#f44336", fontSize: "0.62rem", fontFamily: "monospace", fontWeight: "bold" }}>BRAK</Typography>
                )}
            </Box>
            <LED status={status} />

            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                <IconButton
                    size="small"
                    onClick={() => onEdit(slot)}
                    sx={{
                        color: isEmpty ? "#8b949e" : "#c9d1d9",
                        bgcolor: isEmpty ? "#1c2128" : "#30363d", borderRadius: 1, p: 0.4,
                        border: isEmpty ? "1px dashed #30363d" : "none",
                        "&:hover": { bgcolor: "#1f6feb", color: "#fff", border: "none" },
                    }}
                >
                    <EditIcon sx={{ fontSize: "0.85rem" }} />
                </IconButton>
                {!isEmpty && (
                    <IconButton
                        size="small"
                        disabled={!slot.management}
                        onClick={() => openManagement(slot.management)}
                        sx={{
                            color: slot.management ? "#c9d1d9" : "#484f58",
                            bgcolor: "#30363d", borderRadius: 1, p: 0.4,
                            "&:hover": { bgcolor: "#2196f3", color: "#fff" },
                            "&.Mui-disabled": { bgcolor: "#1c2128", color: "#3a4048" },
                        }}
                        title={slot.management || "Brak adresu management"}
                    >
                        <OpenInNewIcon sx={{ fontSize: "0.85rem" }} />
                    </IconButton>
                )}
                {!isEmpty && (
                    <IconButton
                        size="small"
                        onClick={() => onDelete(slot)}
                        sx={{
                            color: "#c9d1d9",
                            bgcolor: "#30363d", borderRadius: 1, p: 0.4,
                            "&:hover": { bgcolor: "#f44336", color: "#fff" },
                        }}
                    >
                        <DeleteIcon sx={{ fontSize: "0.85rem" }} />
                    </IconButton>
                )}
            </Box>
        </Box>
    );
}

export default function ServerRack() {
    const { rackId } = useParams();
    const navigate   = useNavigate();
    const STORAGE_KEY = `rack_layout_${rackId}`;
    const rackNum     = (parseInt(rackId?.replace("A", "") ?? "0") + 1);
    const rackLabel   = `Szafa ${rackNum}`;

    const accessToken = localStorage.getItem("JWT");
    const [rackSize, setRackSize] = useState(42);
    const [slots, setSlots]       = useState(() => makeSlots(42));
    const [sensor, setSensor]     = useState({
        temperature: 0, humidity: 0,
        fire: false, gas: false, water: false, motion: false, door: false,
    });
    const [pingStatus, setPingStatus] = useState({});
    const [editSlot, setEditSlot]     = useState(null);
    const [editName, setEditName]     = useState("");
    const [editType, setEditType]     = useState("server");
    const [editHeight, setEditHeight] = useState(1);
    const [editManagement, setEditManagement] = useState("");
    const [editError, setEditError]   = useState("");
    const [saving, setSaving]     = useState(false);
    const [savedAt, setSavedAt]   = useState(null);

    useEffect(() => {
        const fetch = async () => {
            try { const { data } = await axios.get(`${API_BASE}/real-time-data`); setSensor(data); }
            catch (_) {}
        };
        fetch();
        const iv = setInterval(fetch, 5000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        const id = localStorage.getItem(STORAGE_KEY);
        if (!id) return;
        axios.get(`${API_BASE}/layouts/${id}`)
            .then(({ data }) => {
                if (data.type !== "rack" || data.rackId !== rackId) {
                    // Stale/mismatched id (points at a layout of a different
                    // type or a different rack) — drop it so the next save
                    // creates a fresh record instead of overwriting someone
                    // else's.
                    localStorage.removeItem(STORAGE_KEY);
                    return;
                }
                const size = data.rackSize || data.slots?.length || 42;
                setRackSize(size);
                setSlots(makeSlots(size, data.slots || []));
            })
            .catch(() => {});
    }, [rackId]);

    const handleRackSizeChange = newSize => {
        setRackSize(newSize);
        setSlots(prev => makeSlots(newSize, prev));
    };

    const saveLayout = async () => {
        setSaving(true);
        const payload = { type: "rack", rackId, rackSize, slots };
        const headers = { Authorization: `Bearer ${accessToken}` };
        try {
            const id = localStorage.getItem(STORAGE_KEY);
            if (id) {
                try {
                    await axios.put(`${API_BASE}/layouts/${id}`, payload, { headers });
                    setSavedAt(new Date()); setSaving(false); return;
                } catch (_) {}
            }
            const { data } = await axios.post(`${API_BASE}/layouts`, payload, { headers });
            localStorage.setItem(STORAGE_KEY, data.id);
            setSavedAt(new Date());
        } catch (_) { alert("Błąd zapisu konfiguracji szafy"); }
        setSaving(false);
    };

    const openEdit = slot => {
        setEditSlot(slot.unit);
        setEditName(slot.name);
        setEditType(slot.type);
        setEditHeight(slot.height || 1);
        setEditManagement(slot.management || "");
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
            { unit: editSlot, name: editName, type: editType, active: true, height, management: editManagement },
        ]));
        setEditSlot(null);
        setEditError("");
    };

    const deleteSlot = slot => {
        setSlots(prev => makeSlots(rackSize, prev.filter(s => s.unit !== slot.unit)));
    };

    const handlePing = async (unit, address) => {
        const host = extractHost(address);
        if (!host) return;
        setPingStatus(prev => ({ ...prev, [unit]: { state: "loading" } }));
        try {
            const { data } = await axios.get(`${API_BASE}/ping/${host}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const ok = (data.messages || []).some(m => /reply/i.test(m));
            setPingStatus(prev => ({ ...prev, [unit]: { state: ok ? "ok" : "fail" } }));
        } catch (_) {
            setPingStatus(prev => ({ ...prev, [unit]: { state: "fail" } }));
        }
    };

    const criticalAlert = sensor.fire || sensor.gas || sensor.water;
    const warnAlert     = !criticalAlert && (sensor.temperature > 35 || sensor.temperature < 15);
    const activeDevices = slots.filter(s => s.type !== "empty").length;

    return (
        <Layout>
            <Box sx={{ p: 2, maxWidth: 1230, mx: "auto", display: "flex", gap: 2, alignItems: "flex-start" }}>
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
                <Box sx={{ flex: 1, minWidth: 0 }}>
                {/* Header */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <IconButton size="small" onClick={() => navigate("/rzut")}>
                            <ArrowBackIcon fontSize="small" />
                        </IconButton>
                        <Box>
                            <Typography variant="h5" fontWeight="bold" sx={{ color: "#1a1a2e" }}>
                                {rackLabel}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {activeDevices}/{rackSize}U zajęte · odświeżanie co 5s
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                            <InputLabel>Rozmiar rack</InputLabel>
                            <Select value={rackSize} label="Rozmiar rack"
                                onChange={e => handleRackSizeChange(Number(e.target.value))}>
                                {RACK_PRESETS.map(u => <MenuItem key={u} value={u}>{u}U</MenuItem>)}
                            </Select>
                        </FormControl>
                        {savedAt && (
                            <Typography variant="caption" color="text.secondary">
                                Zapisano {savedAt.toLocaleTimeString()}
                            </Typography>
                        )}
                        <Button variant="contained" size="small" startIcon={<SaveIcon />}
                            onClick={saveLayout} disabled={saving}>
                            Zapisz układ
                        </Button>
                    </Box>
                </Box>

                {criticalAlert && (
                    <Alert severity="error" sx={{ mb: 1.5 }}>
                        ALARM KRYTYCZNY:{" "}
                        {sensor.fire && "🔥 Ogień  "}
                        {sensor.gas && "💨 Gaz/Dym  "}
                        {sensor.water && "💧 Woda  "}
                    </Alert>
                )}
                {warnAlert && (
                    <Alert severity="warning" sx={{ mb: 1.5 }}>
                        Temperatura poza zakresem: {sensor.temperature}°C
                    </Alert>
                )}

                {/* Sensor bar */}
                <Box sx={{ display: "flex", gap: 1.5, mb: 2, px: 2, py: 1.25, bgcolor: "#1a1a2e", borderRadius: 1.5, flexWrap: "wrap" }}>
                    <Chip icon={<ThermostatIcon />} label={`${sensor.temperature}°C`} size="small"
                        sx={{ bgcolor: "#c62828", color: "white", fontWeight: "bold" }} />
                    <Chip icon={<WaterDropIcon />} label={`${sensor.humidity}%`} size="small"
                        sx={{ bgcolor: "#1565c0", color: "white", fontWeight: "bold" }} />
                    {sensor.motion && <Chip label="Ruch" size="small" color="warning" />}
                    {sensor.door   && <Chip label="Drzwi otwarte" size="small" color="warning" />}
                    {!sensor.motion && !sensor.door && !criticalAlert && !warnAlert && (
                        <Chip label="Wszystkie systemy OK" size="small" sx={{ bgcolor: "#2e7d32", color: "white" }} />
                    )}
                </Box>

                {/* Rack */}
                <Box sx={{ bgcolor: "#0d1117", border: "3px solid #30363d", borderRadius: 2, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
                        <Box sx={{ bgcolor: "#21262d", px: 2, py: 0.75, display: "flex", alignItems: "center", gap: 1, borderBottom: "2px solid #30363d" }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#ef5350" }} />
                            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#ffca28" }} />
                            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#66bb6a" }} />
                            <Typography sx={{ ml: 1, color: "#8b949e", fontSize: "0.7rem", fontFamily: "monospace" }}>
                                {rackLabel.toUpperCase()} — {rackSize}U
                            </Typography>
                        </Box>
                        <RackHeader />
                        {slots.map(slot => (
                            <RackSlot key={slot.unit} slot={slot} sensor={sensor}
                                onEdit={openEdit} onDelete={deleteSlot}
                                pingState={pingStatus[slot.unit]} onPing={handlePing} />
                        ))}
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "right" }}>
                    Kliknij ikonę edycji aby zmienić typ/nazwę urządzenia
                </Typography>
                </Box>
            </Box>

            {/* Edit dialog */}
            <Dialog open={editSlot !== null} onClose={() => { setEditSlot(null); setEditError(""); }} maxWidth="xs" fullWidth disablePortal>
                <DialogTitle>Slot {editSlot}U</DialogTitle>
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
                    {editType !== "empty" && (
                        <TextField
                            label="Adres management"
                            value={editManagement}
                            onChange={e => setEditManagement(e.target.value)}
                            size="small" fullWidth
                            onKeyDown={e => e.key === "Enter" && confirmEdit()}
                            placeholder="np. 172.16.0.8:3004"
                        />
                    )}
                    {editError && <Alert severity="error">{editError}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setEditSlot(null); setEditError(""); }}>Anuluj</Button>
                    <Button onClick={confirmEdit} variant="contained">Zapisz</Button>
                </DialogActions>
            </Dialog>
        </Layout>
    );
}
