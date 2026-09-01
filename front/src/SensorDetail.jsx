import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import { Box, Typography, IconButton, Chip, TextField, Button, Alert, Switch, FormControlLabel } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const TYPE_CONFIG = {
    temperature: { label: "Temperatura", unit: "°C", icon: ThermostatIcon, color: "#ef5350" },
    humidity:    { label: "Wilgotność",  unit: "%",  icon: WaterDropIcon,  color: "#42a5f5" },
};

const SEVERITIES = [
    { key: "non_critical", label: "Non-Critical (ostrzeżenie)", color: "#ff9800" },
    { key: "critical", label: "Critical (krytyczny)", color: "#e53935" },
];

const RANGE_OPTIONS = [
    { key: "live", label: "Na żywo (10 min)" },
    { key: "24h", label: "24 godziny" },
    { key: "week", label: "Ostatni tydzień" },
    { key: "month", label: "Ostatni miesiąc" },
];

function GaugeBar({ value, minCrit, maxCrit, minNonCrit, maxNonCrit, unit }) {
    if ([value, minCrit, maxCrit, minNonCrit, maxNonCrit].some(v => v == null)) return null;
    const span = (maxCrit - minCrit) || 1;
    const pct = v => Math.max(0, Math.min(100, ((v - minCrit) / span) * 100));
    const markerPct = pct(value);
    const zoneStart = pct(minNonCrit);
    const zoneEnd = pct(maxNonCrit);
    return (
        <Box sx={{ mb: 2 }}>
            <Box sx={{ position: "relative", height: 20, borderRadius: 1, overflow: "hidden", display: "flex" }}>
                <Box sx={{ width: `${zoneStart}%`, bgcolor: "#e53935" }} />
                <Box sx={{ width: `${zoneEnd - zoneStart}%`, bgcolor: "#2e7d32" }} />
                <Box sx={{ width: `${100 - zoneEnd}%`, bgcolor: "#e53935" }} />
                <Box sx={{
                    position: "absolute", left: `calc(${markerPct}% - 1px)`, top: -3, bottom: -3,
                    width: 2, bgcolor: "#1a1a2e",
                }} />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">{minCrit}{unit}</Typography>
                <Typography variant="caption" color="text.secondary">{maxCrit}{unit}</Typography>
            </Box>
        </Box>
    );
}

export default function SensorDetail() {
    const { rackId, type } = useParams();
    const navigate = useNavigate();
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.temperature;
    const Icon = cfg.icon;

    const [current, setCurrent] = useState(null);
    const [history, setHistory] = useState([]);
    const [minInput, setMinInput] = useState("");
    const [maxInput, setMaxInput] = useState("");
    const [minCritInput, setMinCritInput] = useState("");
    const [maxCritInput, setMaxCritInput] = useState("");
    const [delayInput, setDelayInput] = useState("");
    const [saveStatus, setSaveStatus] = useState(null);
    const [alarmStatus, setAlarmStatus] = useState(null);
    const [range, setRange] = useState("live");
    const [recordsStatus, setRecordsStatus] = useState(null);
    const [graphStatus, setGraphStatus] = useState(null);

    const fieldName = (severity) => {
        const suffix = severity === "critical" ? "_critical" : "";
        return {
            min: `min_${type}${suffix}`,
            max: `max_${type}${suffix}`,
        };
    };

    useEffect(() => {
        if (!current || current.enabled === false) return;
        const nc = fieldName("non_critical");
        const cr = fieldName("critical");
        setMinInput(String(current[nc.min]));
        setMaxInput(String(current[nc.max]));
        setMinCritInput(String(current[cr.min]));
        setMaxCritInput(String(current[cr.max]));
        setDelayInput(String(current.alert_delay_seconds));
    }, [current, type]);

    useEffect(() => {
        const fetchCurrent = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/device-sensors/${rackId}`);
                setCurrent(data);
            } catch (_) {}
        };
        fetchCurrent();
        const iv = setInterval(fetchCurrent, 5000);
        return () => clearInterval(iv);
    }, [rackId]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const params = range === "live" ? {} : { range };
                const { data } = await axios.get(`${API_BASE}/device-sensors/${rackId}/history`, { params });
                if (range === "live") {
                    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
                    setHistory(data.history.filter(row => new Date(row.recorded_at.replace(" ", "T")).getTime() >= tenMinutesAgo));
                } else {
                    setHistory(data.history);
                }
            } catch (_) {}
        };
        fetchHistory();
        const iv = setInterval(fetchHistory, 20000);
        return () => clearInterval(iv);
    }, [rackId, range]);

    const value = current ? current[type] : null;
    const min = current ? current[fieldName("non_critical").min] : null;
    const max = current ? current[fieldName("non_critical").max] : null;
    const minCrit = current ? current[fieldName("critical").min] : null;
    const maxCrit = current ? current[fieldName("critical").max] : null;
    const status = value == null ? null
        : (minCrit != null && maxCrit != null && (value < minCrit || value > maxCrit)) ? "crit"
        : (min != null && max != null && (value < min || value > max)) ? "warning"
        : "ok";

    const accessToken = localStorage.getItem("JWT");

    const handleSaveThresholds = async () => {
        const minVal = Number(minInput);
        const maxVal = Number(maxInput);
        const minCritVal = Number(minCritInput);
        const maxCritVal = Number(maxCritInput);
        const delayVal = Number(delayInput);
        if ([minVal, maxVal, minCritVal, maxCritVal, delayVal].some(Number.isNaN) || minVal >= maxVal || minCritVal >= maxCritVal) {
            setSaveStatus({ type: "error", message: "Wartość minimalna musi być mniejsza niż maksymalna." });
            return;
        }
        const other = type === "temperature" ? "humidity" : "temperature";
        const payload = {
            [`min_${type}`]: minVal, [`max_${type}`]: maxVal,
            [`min_${type}_critical`]: minCritVal, [`max_${type}_critical`]: maxCritVal,
            [`min_${other}`]: current[`min_${other}`], [`max_${other}`]: current[`max_${other}`],
            [`min_${other}_critical`]: current[`min_${other}_critical`], [`max_${other}_critical`]: current[`max_${other}_critical`],
            alert_delay_seconds: delayVal,
        };
        try {
            const { data } = await axios.put(
                `${API_BASE}/device-sensors/${rackId}/thresholds`,
                payload,
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            setCurrent(data);
            setSaveStatus({ type: "success", message: "Progi zapisane." });
            setTimeout(() => setSaveStatus(null), 2500);
        } catch (error) {
            setSaveStatus({ type: "error", message: error.response?.data?.message || "Błąd zapisu progów." });
        }
    };

    const chartData = history.map(row => ({
        time: range === "week" || range === "month" ? row.recorded_at.slice(5, 16) : row.recorded_at.slice(11, 19),
        value: row[type],
    }));

    const handleClearRecords = async () => {
        try {
            const { data } = await axios.delete(`${API_BASE}/device-sensors/${rackId}/records`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setCurrent(data);
            setRecordsStatus({ type: "success", message: "Rekordy wyczyszczone." });
        } catch (error) {
            setRecordsStatus({ type: "error", message: error.response?.data?.message || "Błąd czyszczenia rekordów." });
        }
        setTimeout(() => setRecordsStatus(null), 2500);
    };

    const handleClearGraph = async () => {
        if (!window.confirm("Usunąć historię wykresu dla tego czujnika?")) return;
        try {
            await axios.delete(`${API_BASE}/device-sensors/${rackId}/history`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setHistory([]);
            setGraphStatus({ type: "success", message: "Wykres wyczyszczony." });
        } catch (error) {
            setGraphStatus({ type: "error", message: error.response?.data?.message || "Błąd czyszczenia wykresu." });
        }
        setTimeout(() => setGraphStatus(null), 2500);
    };

    const alarmActive = (severity) => current ? current[`alarm_active_${type}_${severity}`] : false;
    const alarmAcknowledged = (severity) => current ? current[`alarm_acknowledged_${type}_${severity}`] : false;

    const handleToggleEnabled = async (event) => {
        const next = event.target.checked;
        try {
            await axios.put(
                `${API_BASE}/device-sensor-settings`,
                { enabled: next },
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            const { data } = await axios.get(`${API_BASE}/device-sensors/${rackId}`);
            setCurrent(data);
        } catch (error) {
            setAlarmStatus({ type: "error", message: error.response?.data?.message || "Błąd zapisu." });
            setTimeout(() => setAlarmStatus(null), 2500);
        }
    };

    const handleSimulate = async (severity) => {
        try {
            await axios.post(`${API_BASE}/device-sensors/${rackId}/${type}/${severity}/simulate`, {}, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setAlarmStatus({ type: "success", message: "Alarm testowy wywołany — sprawdź powiadomienia." });
        } catch (error) {
            setAlarmStatus({ type: "error", message: error.response?.data?.message || "Błąd wywołania testu." });
        }
        setTimeout(() => setAlarmStatus(null), 3000);
    };

    const handleAcknowledgeAlarm = async (severity) => {
        try {
            await axios.delete(`${API_BASE}/device-sensors/${rackId}/${type}/${severity}/acknowledge`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setCurrent(prev => prev && { ...prev, [`alarm_acknowledged_${type}_${severity}`]: true });
            setAlarmStatus({ type: "success", message: "Alarm potwierdzony." });
        } catch (error) {
            setAlarmStatus({ type: "error", message: error.response?.data?.message || "Błąd potwierdzania alarmu." });
        }
        setTimeout(() => setAlarmStatus(null), 2500);
    };

    return (
        <Layout>
            <Box sx={{ p: 2, maxWidth: 700, mx: "auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <IconButton size="small" onClick={() => navigate(`/rack/${rackId}`)}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Box>
                        <Typography variant="h5" fontWeight="bold" sx={{ color: "#1a1a2e" }}>
                            Szafa {rackId}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {cfg.label} · wartość co 5s · wykres odświeżany co 20s
                        </Typography>
                    </Box>
                </Box>

                <FormControlLabel
                    sx={{ mb: 2 }}
                    control={<Switch checked={current?.enabled !== false} onChange={handleToggleEnabled} />}
                    label="Czujnik podłączony"
                />

                {current?.enabled === false ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Czujnik nie jest podłączony. Włącz powyżej, gdy podłączysz realny czujnik.
                    </Alert>
                ) : (
                <>
                <Box sx={{
                    display: "flex", alignItems: "center", gap: 2, p: 2, mb: 2,
                    bgcolor: "#f0f2f8", border: "1px solid #d5dae5", borderRadius: 1.5,
                }}>
                    <Icon sx={{ color: cfg.color, fontSize: 40 }} />
                    <Typography variant="h3" sx={{ color: "#1a1a2e", fontWeight: "bold" }}>
                        {value != null ? `${value}${cfg.unit}` : "—"}
                    </Typography>
                    {status && (
                        <Chip
                            label={status === "ok" ? "OK" : status === "warning" ? "WARN" : "CRIT"}
                            size="small"
                            sx={{
                                bgcolor: status === "ok" ? "#2e7d32" : status === "warning" ? "#ff9800" : "#c62828",
                                color: "white", fontWeight: "bold",
                            }}
                        />
                    )}
                </Box>

                <GaugeBar
                    value={value} minCrit={minCrit} maxCrit={maxCrit} minNonCrit={min} maxNonCrit={max}
                    unit={cfg.unit}
                />

                <Box sx={{ bgcolor: "#f0f2f8", border: "1px solid #d5dae5", borderRadius: 1.5, p: 2, mb: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
                        <Box>
                            <Typography variant="caption" color="text.secondary">Najniższy odczyt</Typography>
                            <Typography fontWeight="bold">
                                {current?.[`lowest_${type}`] != null ? `${current[`lowest_${type}`]}${cfg.unit}` : "—"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {current?.[`lowest_${type}_at`] || ""}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary">Najwyższy odczyt</Typography>
                            <Typography fontWeight="bold">
                                {current?.[`highest_${type}`] != null ? `${current[`highest_${type}`]}${cfg.unit}` : "—"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {current?.[`highest_${type}_at`] || ""}
                            </Typography>
                        </Box>
                        <Button size="small" variant="outlined" onClick={handleClearRecords} sx={{ alignSelf: "center" }}>
                            Wyczyść rekordy
                        </Button>
                    </Box>
                    {recordsStatus && (
                        <Alert severity={recordsStatus.type} sx={{ mt: 1.5 }} onClose={() => setRecordsStatus(null)}>
                            {recordsStatus.message}
                        </Alert>
                    )}
                </Box>

                {SEVERITIES.map(sev => {
                    const active = alarmActive(sev.key);
                    const acknowledged = alarmAcknowledged(sev.key);
                    const f = fieldName(sev.key);
                    return (
                        <Box key={sev.key} sx={{ bgcolor: "#f0f2f8", border: "1px solid #d5dae5", borderRadius: 1.5, p: 2, mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ color: "#333", fontWeight: "bold", mb: 1 }}>
                                {sev.label}
                            </Typography>

                            <Box sx={{
                                p: 1.5, mb: 1.5, borderRadius: 1.5,
                                bgcolor: !active ? "#eaf6ec" : acknowledged ? "#fff8e1" : "#fdecea",
                                border: !active ? "1px solid #2e7d32" : acknowledged ? "1px solid #f9a825" : "1px solid #e53935",
                            }}>
                                <Typography fontWeight="bold" sx={{
                                    color: !active ? "#2e7d32" : acknowledged ? "#8a6d00" : "#c62828",
                                }}>
                                    {!active
                                        ? "Brak alarmu"
                                        : acknowledged
                                            ? "Potwierdzony — czeka na powrót do normy"
                                            : "ALARM — przekroczono próg, wymaga potwierdzenia"}
                                </Typography>
                            </Box>

                            <Box sx={{ display: "flex", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
                                <Button size="small" variant="outlined" onClick={() => handleSimulate(sev.key)}>
                                    Symuluj alarm (test)
                                </Button>
                                <Button size="small" variant="contained" color="error"
                                    onClick={() => handleAcknowledgeAlarm(sev.key)} disabled={!active || acknowledged}>
                                    Potwierdź alarm
                                </Button>
                            </Box>

                            <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                                <TextField
                                    label={`Min (${cfg.unit})`} type="number" size="small"
                                    value={sev.key === "critical" ? minCritInput : minInput}
                                    onChange={e => (sev.key === "critical" ? setMinCritInput : setMinInput)(e.target.value)}
                                    sx={{ width: 110, bgcolor: "white", borderRadius: 1 }}
                                />
                                <TextField
                                    label={`Max (${cfg.unit})`} type="number" size="small"
                                    value={sev.key === "critical" ? maxCritInput : maxInput}
                                    onChange={e => (sev.key === "critical" ? setMaxCritInput : setMaxInput)(e.target.value)}
                                    sx={{ width: 110, bgcolor: "white", borderRadius: 1 }}
                                />
                            </Box>
                        </Box>
                    );
                })}

                <Box sx={{ bgcolor: "#f0f2f8", border: "1px solid #d5dae5", borderRadius: 1.5, p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: "#333", fontWeight: "bold", mb: 1 }}>
                        Opóźnienie alarmu
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                        <TextField
                            label="Opóźnienie (s)" type="number" size="small" value={delayInput}
                            onChange={e => setDelayInput(e.target.value)}
                            sx={{ width: 140, bgcolor: "white", borderRadius: 1 }}
                            helperText="Ile sekund odczyt musi być poza progiem zanim alarm się włączy"
                        />
                        <Button variant="contained" size="small" onClick={handleSaveThresholds}>
                            Zapisz progi
                        </Button>
                    </Box>
                    {saveStatus && (
                        <Alert severity={saveStatus.type} sx={{ mt: 1.5 }} onClose={() => setSaveStatus(null)}>
                            {saveStatus.message}
                        </Alert>
                    )}
                </Box>

                {alarmStatus && (
                    <Alert severity={alarmStatus.type} sx={{ mb: 2 }} onClose={() => setAlarmStatus(null)}>
                        {alarmStatus.message}
                    </Alert>
                )}

                <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                    {RANGE_OPTIONS.map(opt => (
                        <Button
                            key={opt.key} size="small"
                            variant={range === opt.key ? "contained" : "outlined"}
                            onClick={() => setRange(opt.key)}
                        >
                            {opt.label}
                        </Button>
                    ))}
                    <Button size="small" color="error" variant="outlined" sx={{ ml: "auto" }} onClick={handleClearGraph}>
                        Wyczyść wykres
                    </Button>
                </Box>
                {graphStatus && (
                    <Alert severity={graphStatus.type} sx={{ mb: 1.5 }} onClose={() => setGraphStatus(null)}>
                        {graphStatus.message}
                    </Alert>
                )}

                <Box sx={{ bgcolor: "#0d1117", border: "3px solid #30363d", borderRadius: 2, p: 2, height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid stroke="#21262d" />
                            <XAxis dataKey="time" stroke="#8b949e" fontSize={10} />
                            <YAxis stroke="#8b949e" fontSize={10} domain={["auto", "auto"]} />
                            <Tooltip
                                contentStyle={{ background: "#161b22", border: "1px solid #30363d" }}
                                labelStyle={{ color: "#c9d1d9" }}
                                itemStyle={{ color: cfg.color }}
                                formatter={val => [`${val}${cfg.unit}`, "Wartość"]}
                            />
                            <Line type="monotone" dataKey="value" name="Wartość" stroke={cfg.color} dot={false} strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </Box>
                </>
                )}
            </Box>
        </Layout>
    );
}
