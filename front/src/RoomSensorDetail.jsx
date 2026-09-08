import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import { useRealTimeData } from "./RealTimeDataContext";
import { useLang } from "./translation";
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
    const { t } = useLang();
    const accessToken = localStorage.getItem("JWT");
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.fire;
    const Icon = cfg.icon;
    const sensorLabel = t("sensor_" + type);

    const realTimeData = useRealTimeData();
    const liveValue = realTimeData[type] ?? null;
    const [active, setActive] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);
    const [lastTriggeredAt, setLastTriggeredAt] = useState(null);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        const fetchState = async () => {
            try {
                const { data: alarmData } = await axios.get(`${API_BASE}/alarm-states`);
                const state = alarmData.states.find(s => s.event_type === type);
                if (state) {
                    setActive(state.active);
                    setAcknowledged(state.acknowledged);
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
            setStatus({ type: "success", message: t("alarm_test_triggered") });
        } catch (error) {
            setStatus({ type: "error", message: error.response?.data?.message || t("test_trigger_error") });
        }
        setTimeout(() => setStatus(null), 3000);
    };

    const handleAcknowledge = async () => {
        try {
            await axios.delete(`${API_BASE}/sensors/${type}/acknowledge`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setAcknowledged(true);
            setStatus({ type: "success", message: t("alarm_acknowledged_msg") });
        } catch (error) {
            setStatus({ type: "error", message: error.response?.data?.message || t("ack_error") });
        }
        setTimeout(() => setStatus(null), 2500);
    };

    return (
        <Layout>
            <Box sx={{ p: 2, maxWidth: 700, mx: "auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <IconButton size="small" onClick={() => navigate("/floor-plan")}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Box>
                        <Typography variant="h5" fontWeight="bold" sx={{ color: "#1a1a2e" }}>
                            {t("sensor_prefix")}: {sensorLabel}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            {t("live_reading_caption")}
                        </Typography>
                        <Typography
                            variant="body2" onClick={() => navigate("/settings#powiadomienia")}
                            sx={{
                                color: "#1565c0", fontWeight: "bold", cursor: "pointer", display: "inline-block",
                                fontSize: "0.95rem", mt: 0.5,
                                "&:hover": { textDecoration: "underline" },
                            }}
                        >
                            {t("configure_notifications_link")}
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{
                    display: "flex", alignItems: "center", gap: 2, p: 2, mb: 2,
                    bgcolor: "#f0f2f8", border: "1px solid #d5dae5", borderRadius: 1.5,
                }}>
                    <Icon sx={{ color: cfg.color, fontSize: 40 }} />
                    <Typography variant="h6" sx={{ color: "#1a1a2e" }}>
                        {t("live_reading_label")}: {liveValue === true ? t("detected") : liveValue === false ? t("not_detected") : "—"}
                    </Typography>
                </Box>

                <Box sx={{
                    p: 2, mb: 2, borderRadius: 1.5,
                    bgcolor: !active ? "#eaf6ec" : acknowledged ? "#fff8e1" : "#fdecea",
                    border: !active ? "1px solid #2e7d32" : acknowledged ? "1px solid #f9a825" : "1px solid #e53935",
                }}>
                    <Typography variant="h6" fontWeight="bold" sx={{
                        color: !active ? "#2e7d32" : acknowledged ? "#8a6d00" : "#c62828",
                    }}>
                        {!active
                            ? t("no_alarm")
                            : acknowledged
                                ? t("ack_waiting_normal")
                                : t("alarm_needs_ack")}
                    </Typography>
                    {lastTriggeredAt && (
                        <Typography variant="caption" color="text.secondary">
                            {t("last_triggered")}: {lastTriggeredAt}
                        </Typography>
                    )}
                </Box>

                <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
                    <Button variant="outlined" onClick={handleSimulate}>
                        {t("simulate_alarm_test")}
                    </Button>
                    <Button variant="contained" color="error" onClick={handleAcknowledge} disabled={!active || acknowledged}>
                        {t("acknowledge_alarm")}
                    </Button>
                </Box>

                {status && (
                    <Alert severity={status.type} sx={{ mb: 2 }} onClose={() => setStatus(null)}>
                        {status.message}
                    </Alert>
                )}
            </Box>
        </Layout>
    );
}
