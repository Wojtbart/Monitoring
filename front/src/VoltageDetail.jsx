import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import { Box, Typography, IconButton, Chip, TextField, Button, Alert, Switch, FormControlLabel } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BoltIcon from "@mui/icons-material/Bolt";

export default function VoltageDetail() {
    const navigate = useNavigate();
    const accessToken = localStorage.getItem("JWT");

    const [voltage, setVoltage] = useState(null);
    const [minInput, setMinInput] = useState("");
    const [maxInput, setMaxInput] = useState("");
    const [saveStatus, setSaveStatus] = useState(null);
    const [active, setActive] = useState(false);
    const [lastTriggeredAt, setLastTriggeredAt] = useState(null);
    const [alarmStatus, setAlarmStatus] = useState(null);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        const fetchState = async () => {
            try {
                const [rtRes, thresholdRes, alarmRes] = await Promise.all([
                    axios.get(`${API_BASE}/real-time-data`),
                    axios.get(`${API_BASE}/voltage-threshold`),
                    axios.get(`${API_BASE}/alarm-states`),
                ]);
                setVoltage(rtRes.data.voltage);
                setMinInput(String(thresholdRes.data.min_voltage));
                setMaxInput(String(thresholdRes.data.max_voltage));
                setEnabled(thresholdRes.data.enabled);
                const state = alarmRes.data.states.find(s => s.event_type === "voltage");
                if (state) {
                    setActive(state.active);
                    setLastTriggeredAt(state.last_triggered_at);
                }
            } catch (_) {}
        };
        fetchState();
        const iv = setInterval(fetchState, 5000);
        return () => clearInterval(iv);
    }, []);

    const handleToggleEnabled = async (event) => {
        const next = event.target.checked;
        setEnabled(next);
        try {
            await axios.put(
                `${API_BASE}/voltage-enabled`,
                { enabled: next },
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
        } catch (error) {
            setEnabled(!next);
            setAlarmStatus({ type: "error", message: error.response?.data?.message || "Błąd zapisu." });
            setTimeout(() => setAlarmStatus(null), 2500);
        }
    };

    const min = Number(minInput);
    const max = Number(maxInput);
    const status = voltage != null && !Number.isNaN(min) && !Number.isNaN(max)
        ? (voltage < min || voltage > max ? "warning" : "ok")
        : null;

    const handleSaveThresholds = async () => {
        const minVal = Number(minInput);
        const maxVal = Number(maxInput);
        if (Number.isNaN(minVal) || Number.isNaN(maxVal) || minVal >= maxVal) {
            setSaveStatus({ type: "error", message: "Wartość minimalna musi być mniejsza niż maksymalna." });
            return;
        }
        try {
            await axios.put(
                `${API_BASE}/voltage-threshold`,
                { min_voltage: minVal, max_voltage: maxVal },
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            setSaveStatus({ type: "success", message: "Progi zapisane." });
            setTimeout(() => setSaveStatus(null), 2500);
        } catch (error) {
            setSaveStatus({ type: "error", message: error.response?.data?.message || "Błąd zapisu progów." });
        }
    };

    const handleSimulate = async () => {
        try {
            await axios.post(`${API_BASE}/sensors/voltage/simulate`, {}, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setAlarmStatus({ type: "success", message: "Alarm testowy wywołany — sprawdź powiadomienia." });
        } catch (error) {
            setAlarmStatus({ type: "error", message: error.response?.data?.message || "Błąd wywołania testu." });
        }
        setTimeout(() => setAlarmStatus(null), 3000);
    };

    const handleClear = async () => {
        try {
            await axios.delete(`${API_BASE}/sensors/voltage/clear`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setActive(false);
            setAlarmStatus({ type: "success", message: "Alarm skasowany." });
        } catch (error) {
            setAlarmStatus({ type: "error", message: error.response?.data?.message || "Błąd kasowania alarmu." });
        }
        setTimeout(() => setAlarmStatus(null), 2500);
    };

    return (
        <Layout>
            <Box sx={{ p: 2, maxWidth: 700, mx: "auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <IconButton size="small" onClick={() => navigate("/")}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: "#1a1a2e" }}>
                        Napięcie zasilania
                    </Typography>
                </Box>

                <FormControlLabel
                    sx={{ mb: 2 }}
                    control={<Switch checked={enabled} onChange={handleToggleEnabled} />}
                    label="Czujnik podłączony"
                />

                {!enabled ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Czujnik nie jest podłączony. Włącz powyżej, gdy podłączysz realny czujnik napięcia.
                    </Alert>
                ) : (
                    <>
                        <Box sx={{
                            display: "flex", alignItems: "center", gap: 2, p: 2, mb: 2,
                            bgcolor: "#f0f2f8", border: "1px solid #d5dae5", borderRadius: 1.5,
                        }}>
                            <BoltIcon sx={{ color: "#f9a825", fontSize: 40 }} />
                            <Typography variant="h3" sx={{ color: "#1a1a2e", fontWeight: "bold" }}>
                                {voltage != null ? `${voltage}V` : "—"}
                            </Typography>
                            {status && (
                                <Chip
                                    label={status === "ok" ? "OK" : "WARN"}
                                    size="small"
                                    sx={{ bgcolor: status === "ok" ? "#2e7d32" : "#ff9800", color: "white", fontWeight: "bold" }}
                                />
                            )}
                        </Box>

                        <Box sx={{
                            p: 2, mb: 2, borderRadius: 1.5,
                            bgcolor: active ? "#fdecea" : "#eaf6ec",
                            border: active ? "1px solid #e53935" : "1px solid #2e7d32",
                        }}>
                            <Typography variant="h6" fontWeight="bold" sx={{ color: active ? "#c62828" : "#2e7d32" }}>
                                {active ? "ALARM — przekroczono próg, wymaga skasowania" : "Brak alarmu"}
                            </Typography>
                            {lastTriggeredAt && (
                                <Typography variant="caption" color="text.secondary">
                                    Ostatnio wywołany: {lastTriggeredAt}
                                </Typography>
                            )}
                        </Box>

                        <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
                            <Button variant="outlined" onClick={handleSimulate}>
                                Symuluj alarm (test)
                            </Button>
                            <Button variant="contained" color="error" onClick={handleClear} disabled={!active}>
                                Skasuj alarm
                            </Button>
                        </Box>

                        {alarmStatus && (
                            <Alert severity={alarmStatus.type} sx={{ mb: 2 }} onClose={() => setAlarmStatus(null)}>
                                {alarmStatus.message}
                            </Alert>
                        )}

                        <Box sx={{ bgcolor: "#f0f2f8", border: "1px solid #d5dae5", borderRadius: 1.5, p: 2, mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ color: "#333", fontWeight: "bold", mb: 1 }}>
                                Progi alarmowe (V)
                            </Typography>
                            <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                                <TextField
                                    label="Min" type="number" size="small" value={minInput}
                                    onChange={e => setMinInput(e.target.value)}
                                    sx={{ width: 110, bgcolor: "white", borderRadius: 1 }}
                                />
                                <TextField
                                    label="Max" type="number" size="small" value={maxInput}
                                    onChange={e => setMaxInput(e.target.value)}
                                    sx={{ width: 110, bgcolor: "white", borderRadius: 1 }}
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

                        <Typography variant="body2">
                            <a href="/settings#powiadomienia">Skonfiguruj powiadomienia dla tego zdarzenia →</a>
                        </Typography>
                    </>
                )}
            </Box>
        </Layout>
    );
}
