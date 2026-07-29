import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import { Box, Typography, IconButton, Chip, TextField, Button, Alert } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const TYPE_CONFIG = {
    temperature: { label: "Temperatura", unit: "°C", icon: ThermostatIcon, color: "#ef5350" },
    humidity:    { label: "Wilgotność",  unit: "%",  icon: WaterDropIcon,  color: "#42a5f5" },
};

export default function SensorDetail() {
    const { rackId, unit, type } = useParams();
    const navigate = useNavigate();
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.temperature;
    const Icon = cfg.icon;

    const [current, setCurrent] = useState(null);
    const [history, setHistory] = useState([]);
    const [minInput, setMinInput] = useState("");
    const [maxInput, setMaxInput] = useState("");
    const [saveStatus, setSaveStatus] = useState(null);

    useEffect(() => {
        if (current) {
            setMinInput(String(type === "temperature" ? current.min_temperature : current.min_humidity));
            setMaxInput(String(type === "temperature" ? current.max_temperature : current.max_humidity));
        }
    }, [current, type]);

    useEffect(() => {
        const fetchCurrent = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/deviceSensors/${rackId}/${unit}`);
                setCurrent(data);
            } catch (_) {}
        };
        fetchCurrent();
        const iv = setInterval(fetchCurrent, 5000);
        return () => clearInterval(iv);
    }, [rackId, unit]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/deviceSensors/${rackId}/${unit}/history`);
                const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
                setHistory(data.history.filter(row => new Date(row.recorded_at.replace(" ", "T")).getTime() >= tenMinutesAgo));
            } catch (_) {}
        };
        fetchHistory();
        const iv = setInterval(fetchHistory, 20000);
        return () => clearInterval(iv);
    }, [rackId, unit]);

    const value = current ? current[type] : null;
    const min = current ? (type === "temperature" ? current.min_temperature : current.min_humidity) : null;
    const max = current ? (type === "temperature" ? current.max_temperature : current.max_humidity) : null;
    const status = value != null && min != null && max != null
        ? (value < min || value > max ? "warning" : "ok")
        : null;

    const accessToken = localStorage.getItem("JWT");

    const handleSaveThresholds = async () => {
        const minVal = Number(minInput);
        const maxVal = Number(maxInput);
        if (Number.isNaN(minVal) || Number.isNaN(maxVal) || minVal >= maxVal) {
            setSaveStatus({ type: "error", message: "Wartość minimalna musi być mniejsza niż maksymalna." });
            return;
        }
        const payload = type === "temperature"
            ? {
                min_temperature: minVal, max_temperature: maxVal,
                min_humidity: current.min_humidity, max_humidity: current.max_humidity,
            }
            : {
                min_temperature: current.min_temperature, max_temperature: current.max_temperature,
                min_humidity: minVal, max_humidity: maxVal,
            };
        try {
            const { data } = await axios.put(
                `${API_BASE}/deviceSensors/${rackId}/${unit}/thresholds`,
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

    const chartData = history.map(row => ({ time: row.recorded_at.slice(11, 19), value: row[type] }));

    return (
        <Layout>
            <Box sx={{ p: 2, maxWidth: 700, mx: "auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <IconButton size="small" onClick={() => navigate(`/rack/${rackId}`)}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Box>
                        <Typography variant="h5" fontWeight="bold" sx={{ color: "#1a1a2e" }}>
                            Szafa {rackId} — Unit {unit}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {cfg.label} · wartość co 5s · wykres (ostatnie 10 min) co 20s
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{
                    display: "flex", alignItems: "center", gap: 2, p: 2, mb: 2,
                    bgcolor: "#1a1a2e", borderRadius: 1.5,
                }}>
                    <Icon sx={{ color: cfg.color, fontSize: 40 }} />
                    <Typography variant="h3" sx={{ color: "white", fontWeight: "bold" }}>
                        {value != null ? `${value}${cfg.unit}` : "—"}
                    </Typography>
                    {status && (
                        <Chip
                            label={status === "ok" ? "OK" : "WARN"}
                            size="small"
                            sx={{ bgcolor: status === "ok" ? "#2e7d32" : "#ff9800", color: "white", fontWeight: "bold" }}
                        />
                    )}
                </Box>

                <Box sx={{ bgcolor: "#1a1a2e", borderRadius: 1.5, p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: "#c9d1d9", mb: 1 }}>
                        Progi alarmowe ({cfg.unit})
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

                <Box sx={{ bgcolor: "#0d1117", border: "3px solid #30363d", borderRadius: 2, p: 2, height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid stroke="#21262d" />
                            <XAxis dataKey="time" stroke="#8b949e" fontSize={10} />
                            <YAxis stroke="#8b949e" fontSize={10} domain={["auto", "auto"]} />
                            <Tooltip
                                contentStyle={{ background: "#161b22", border: "1px solid #30363d" }}
                                formatter={val => [`${val}${cfg.unit}`, "Wartość"]}
                            />
                            <Line type="monotone" dataKey="value" name="Wartość" stroke={cfg.color} dot={false} strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </Box>
            </Box>
        </Layout>
    );
}
