import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import { Box, Typography, IconButton, Chip } from "@mui/material";
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
    const [thresholds, setThresholds] = useState(null);

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

    useEffect(() => {
        axios.get(`${API_BASE}/settings`)
            .then(({ data }) => setThresholds(data.settings[0]))
            .catch(() => {});
    }, []);

    const value = current ? current[type] : null;
    const min = thresholds ? Number(type === "temperature" ? thresholds.min_temperature : thresholds.min_humidity) : null;
    const max = thresholds ? Number(type === "temperature" ? thresholds.max_temperature : thresholds.max_humidity) : null;
    const status = value != null && min != null && max != null
        ? (value < min || value > max ? "warning" : "ok")
        : null;

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
