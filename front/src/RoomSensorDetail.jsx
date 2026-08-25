import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import { Box, Typography, IconButton, Button, Alert } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import GasMeterIcon from "@mui/icons-material/GasMeter";
import WaterIcon from "@mui/icons-material/Water";
import SensorDoorIcon from "@mui/icons-material/SensorDoor";

const TYPE_CONFIG = {
    fire:  { label: "Pożar",    icon: LocalFireDepartmentIcon, color: "#e53935" },
    gas:   { label: "Gaz/Dym",  icon: GasMeterIcon,             color: "#8e24aa" },
    water: { label: "Zalanie",  icon: WaterIcon,                color: "#1e88e5" },
    door:  { label: "Drzwi",    icon: SensorDoorIcon,           color: "#6d4c41" },
};

export default function RoomSensorDetail() {
    const { type } = useParams();
    const navigate = useNavigate();
    const accessToken = localStorage.getItem("JWT");
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.fire;
    const Icon = cfg.icon;

    const [liveValue, setLiveValue] = useState(null);
    const [active, setActive] = useState(false);
    const [lastTriggeredAt, setLastTriggeredAt] = useState(null);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        const fetchState = async () => {
            try {
                const [rtRes, alarmRes] = await Promise.all([
                    axios.get(`${API_BASE}/real-time-data`),
                    axios.get(`${API_BASE}/alarm-states`),
                ]);
                setLiveValue(rtRes.data[type]);
                const state = alarmRes.data.states.find(s => s.event_type === type);
                if (state) {
                    setActive(state.active);
                    setLastTriggeredAt(state.last_triggered_at);
                }
            } catch (_) {}
        };
        fetchState();
        const iv = setInterval(fetchState, 5000);
        return () => clearInterval(iv);
    }, [type]);

    const handleSimulate = async () => {
        try {
            await axios.post(`${API_BASE}/sensors/${type}/simulate`, {}, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setStatus({ type: "success", message: "Alarm testowy wywołany — sprawdź powiadomienia." });
        } catch (error) {
            setStatus({ type: "error", message: error.response?.data?.message || "Błąd wywołania testu." });
        }
        setTimeout(() => setStatus(null), 3000);
    };

    const handleClear = async () => {
        try {
            await axios.delete(`${API_BASE}/sensors/${type}/clear`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setActive(false);
            setStatus({ type: "success", message: "Alarm skasowany." });
        } catch (error) {
            setStatus({ type: "error", message: error.response?.data?.message || "Błąd kasowania alarmu." });
        }
        setTimeout(() => setStatus(null), 2500);
    };

    return (
        <Layout>
            <Box sx={{ p: 2, maxWidth: 700, mx: "auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <IconButton size="small" onClick={() => navigate("/rzut")}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: "#1a1a2e" }}>
                        Czujnik: {cfg.label}
                    </Typography>
                </Box>

                <Box sx={{
                    display: "flex", alignItems: "center", gap: 2, p: 2, mb: 2,
                    bgcolor: "#f0f2f8", border: "1px solid #d5dae5", borderRadius: 1.5,
                }}>
                    <Icon sx={{ color: cfg.color, fontSize: 40 }} />
                    <Typography variant="h6" sx={{ color: "#1a1a2e" }}>
                        Żywy odczyt: {liveValue === true ? "Wykryto" : liveValue === false ? "Brak" : "—"}
                    </Typography>
                </Box>

                <Box sx={{
                    p: 2, mb: 2, borderRadius: 1.5,
                    bgcolor: active ? "#fdecea" : "#eaf6ec",
                    border: active ? "1px solid #e53935" : "1px solid #2e7d32",
                }}>
                    <Typography variant="h6" fontWeight="bold" sx={{ color: active ? "#c62828" : "#2e7d32" }}>
                        {active ? "ALARM — wymaga skasowania" : "Brak alarmu"}
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

                {status && (
                    <Alert severity={status.type} sx={{ mb: 2 }} onClose={() => setStatus(null)}>
                        {status.message}
                    </Alert>
                )}

                <Typography variant="body2">
                    <a href="/settings#powiadomienia">Skonfiguruj powiadomienia dla tego zdarzenia →</a>
                </Typography>
            </Box>
        </Layout>
    );
}
