import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import { useRealTimeData } from "./RealTimeDataContext";
import { useLang } from "./translation";
import { Box, Typography, IconButton, Chip, TextField, Button, Alert, Switch, FormControlLabel } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BoltIcon from "@mui/icons-material/Bolt";

export default function VoltageDetail() {
    const navigate = useNavigate();
    const { t } = useLang();
    const accessToken = localStorage.getItem("JWT");

    const { voltage = null } = useRealTimeData();
    const [minInput, setMinInput] = useState("");
    const [maxInput, setMaxInput] = useState("");
    const [saveStatus, setSaveStatus] = useState(null);
    const [active, setActive] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);
    const [lastTriggeredAt, setLastTriggeredAt] = useState(null);
    const [alarmStatus, setAlarmStatus] = useState(null);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        const fetchState = async () => {
            try {
                const [thresholdRes, alarmRes] = await Promise.all([
                    axios.get(`${API_BASE}/voltage-threshold`),
                    axios.get(`${API_BASE}/alarm-states`),
                ]);
                setMinInput(String(thresholdRes.data.min_voltage));
                setMaxInput(String(thresholdRes.data.max_voltage));
                setEnabled(thresholdRes.data.enabled);
                const state = alarmRes.data.states.find(s => s.event_type === "voltage");
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
            setAlarmStatus({ type: "error", message: error.response?.data?.message || t("save_error") });
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
            setSaveStatus({ type: "error", message: t("err_min_lt_max") });
            return;
        }
        try {
            await axios.put(
                `${API_BASE}/voltage-threshold`,
                { min_voltage: minVal, max_voltage: maxVal },
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            setSaveStatus({ type: "success", message: t("thresholds_saved") });
            setTimeout(() => setSaveStatus(null), 2500);
        } catch (error) {
            setSaveStatus({ type: "error", message: error.response?.data?.message || t("save_thresholds_error") });
        }
    };

    const handleSimulate = async () => {
        try {
            await axios.post(`${API_BASE}/sensors/voltage/simulate`, {}, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setAlarmStatus({ type: "success", message: t("alarm_test_triggered") });
        } catch (error) {
            setAlarmStatus({ type: "error", message: error.response?.data?.message || t("test_trigger_error") });
        }
        setTimeout(() => setAlarmStatus(null), 3000);
    };

    const handleAcknowledge = async () => {
        try {
            await axios.delete(`${API_BASE}/sensors/voltage/acknowledge`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setAcknowledged(true);
            setAlarmStatus({ type: "success", message: t("alarm_acknowledged_msg") });
        } catch (error) {
            setAlarmStatus({ type: "error", message: error.response?.data?.message || t("ack_error") });
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
                    <Box>
                        <Typography variant="h5" fontWeight="bold" sx={{ color: "#1a1a2e" }}>
                            {t("nav_voltage")}
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

                <FormControlLabel
                    sx={{ mb: 2 }}
                    control={<Switch checked={enabled} onChange={handleToggleEnabled} />}
                    label={t("sensor_connected")}
                />

                {!enabled ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {t("voltage_not_connected_msg")}
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
                                        : t("alarm_exceeded_needs_ack")}
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

                        {alarmStatus && (
                            <Alert severity={alarmStatus.type} sx={{ mb: 2 }} onClose={() => setAlarmStatus(null)}>
                                {alarmStatus.message}
                            </Alert>
                        )}

                        <Box sx={{ bgcolor: "#f0f2f8", border: "1px solid #d5dae5", borderRadius: 1.5, p: 2, mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ color: "#333", fontWeight: "bold", mb: 1 }}>
                                {t("voltage_thresholds_title")}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                                <TextField
                                    label={t("min")} type="number" size="small" value={minInput}
                                    onChange={e => setMinInput(e.target.value)}
                                    sx={{ width: 110, bgcolor: "white", borderRadius: 1 }}
                                />
                                <TextField
                                    label={t("max")} type="number" size="small" value={maxInput}
                                    onChange={e => setMaxInput(e.target.value)}
                                    sx={{ width: 110, bgcolor: "white", borderRadius: 1 }}
                                />
                                <Button variant="contained" size="small" onClick={handleSaveThresholds}>
                                    {t("save_thresholds")}
                                </Button>
                            </Box>
                            {saveStatus && (
                                <Alert severity={saveStatus.type} sx={{ mt: 1.5 }} onClose={() => setSaveStatus(null)}>
                                    {saveStatus.message}
                                </Alert>
                            )}
                        </Box>
                    </>
                )}
            </Box>
        </Layout>
    );
}
