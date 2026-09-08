import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "./api";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "./Layout";

import {
    TextField,
    Box,
    Button,
    Typography,
    Grid,
    Chip,
    Alert,
    IconButton,
    Select,
    MenuItem,
    Checkbox,
    FormControlLabel,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Card from "@mui/material/Card";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SaveIcon from "@mui/icons-material/Save";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import GasMeterIcon from "@mui/icons-material/GasMeter";
import SensorDoorIcon from "@mui/icons-material/SensorDoor";
import WaterIcon from "@mui/icons-material/Water";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EmailIcon from "@mui/icons-material/Email";
import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";
import BoltIcon from "@mui/icons-material/Bolt";
import DeviceThermostatIcon from "@mui/icons-material/DeviceThermostat";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SmsIcon from "@mui/icons-material/Sms";
import { useLang } from "./translation";

function ScheduleEditor({ schedule, onChange }) {
    const { t } = useLang();
    const DAY_LABELS = [t("day_mon"), t("day_tue"), t("day_wed"), t("day_thu"), t("day_fri"), t("day_sat"), t("day_sun")];
    const bits = schedule.split("");
    const toggle = (day, hour) => {
        const index = day * 24 + hour;
        const next = bits.slice();
        next[index] = next[index] === "1" ? "0" : "1";
        onChange(next.join(""));
    };
    const setAll = (value) => onChange(value.repeat(168));
    return (
        <Box>
            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <Button size="small" onClick={() => setAll("1")}>{t("select_all")}</Button>
                <Button size="small" onClick={() => setAll("0")}>{t("deselect_all")}</Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                {t("schedule_grid_help")}
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "40px repeat(24, 16px)", gap: "2px", width: "fit-content" }}>
                    <Box />
                    {Array.from({ length: 24 }, (_, h) => (
                        <Typography key={h} sx={{ fontSize: "0.55rem", textAlign: "center", color: "text.secondary" }}>
                            {h}
                        </Typography>
                    ))}
                    {DAY_LABELS.map((day, d) => (
                        <Box key={d} sx={{ display: "contents" }}>
                            <Typography sx={{ fontSize: "0.65rem", alignSelf: "center" }}>{day}</Typography>
                            {Array.from({ length: 24 }, (_, h) => {
                                const on = bits[d * 24 + h] === "1";
                                return (
                                    <Box
                                        key={h}
                                        onClick={() => toggle(d, h)}
                                        sx={{
                                            width: 16, height: 16, borderRadius: 0.5, cursor: "pointer",
                                            bgcolor: on ? "#2e7d32" : "#e0e0e0",
                                            "&:hover": { opacity: 0.8 },
                                        }}
                                    />
                                );
                            })}
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
}

function BooleanSensorCard({ icon, label, value, alertLabel, okLabel }) {
    return (
        <Card variant="outlined" sx={{
            p: 2, borderRadius: 2, display: "flex", flexDirection: "column", gap: 0.75,
            borderColor: value ? "#f44336" : "#e0e0e0",
            bgcolor: value ? "#fff5f5" : "white",
            transition: "all 0.3s",
        }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ color: value ? "#f44336" : "text.secondary", display: "flex" }}>
                    {icon}
                </Box>
                <Typography variant="caption" color={value ? "error" : "text.secondary"} fontWeight="bold">
                    {label}
                </Typography>
            </Box>
            <Chip
                size="small"
                icon={value ? <WarningAmberIcon /> : <CheckCircleIcon />}
                label={value ? alertLabel : okLabel}
                color={value ? "error" : "success"}
                sx={{ width: "fit-content", fontWeight: "bold" }}
            />
        </Card>
    );
}

function SectionCard({ icon, title, children, id }) {
    return (
        <Card id={id} variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>
                <Typography variant="h6" fontWeight="bold">{title}</Typography>
            </Box>
            {children}
        </Card>
    );
}

function InfoTip({ text }) {
    return (
        <Tooltip title={text} arrow placement="top">
            <InfoOutlinedIcon sx={{ fontSize: 16, color: "text.disabled", cursor: "help", verticalAlign: "middle", ml: 0.5 }} />
        </Tooltip>
    );
}

const Settings = () => {
    const accessToken = localStorage.getItem("JWT");
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLang();

    const [id, setId] = useState(null);
    const [recordingSeconds, setRecordingSeconds] = useState("");
    const [autoSaveLayout, setAutoSaveLayout] = useState(false);
    const [recordingOnMotionEnabled, setRecordingOnMotionEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [settingsStatus, setSettingsStatus] = useState(null);

    const [envData, setEnvData] = useState({
        motion: false, fire: false, gas: false, door: false, water: false,
    });

    const [groups, setGroups] = useState([]);
    const [newGroupName, setNewGroupName] = useState("");
    const [newRecipientByGroup, setNewRecipientByGroup] = useState({});
    const [groupStatus, setGroupStatus] = useState(null);

    const [rules, setRules] = useState([]);
    const [rulesStatus, setRulesStatus] = useState(null);

    const [smtpSettings, setSmtpSettings] = useState({
        host: "", port: 587, username: "", password: "", from_address: "", use_tls: true,
    });
    const [smtpStatus, setSmtpStatus] = useState(null);
    const [smtpTestAddress, setSmtpTestAddress] = useState("");
    const [smtpTestStatus, setSmtpTestStatus] = useState(null);
    const [smsTestNumber, setSmsTestNumber] = useState("");
    const [smsTestStatus, setSmsTestStatus] = useState(null);

    const [backupStatus, setBackupStatus] = useState(null);
    const [restoreStatus, setRestoreStatus] = useState(null);

    const EVENT_TYPE_LABELS = {
        fire: t("sensor_fire"), gas: t("sensor_gas"), water: t("sensor_water"),
        door: t("door_open_lower"), device_threshold: t("event_device_threshold"), voltage: t("event_voltage"),
    };
    const EVENT_TYPE_COLORS = { fire: "#e53935", gas: "#8e24aa", water: "#1e88e5", door: "#6d4c41", device_threshold: "#00695c", voltage: "#f9a825" };
    const GROUP_COLORS = ["#1565c0", "#2e7d32", "#e65100", "#6a1b9a", "#00838f", "#ad1457", "#4e342e"];
    const EVENT_TYPE_ICONS = {
        fire: LocalFireDepartmentIcon, gas: GasMeterIcon, water: WaterIcon,
        door: SensorDoorIcon, device_threshold: DeviceThermostatIcon, voltage: BoltIcon,
    };

    useEffect(() => {
        const fetchEnv = async () => {
            try {
                const res = await axios.get(`${API_BASE}/real-time-data`);
                setEnvData(res.data);
            } catch (_) {}
        };
        fetchEnv();
        const iv = setInterval(fetchEnv, 5000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        if (accessToken === null) {
            navigate("/login");
            return;
        }
        const fetchInitialData = async () => {
            try {
                const { data } = await axios.get(
                    `${API_BASE}/settings-and-phone-numbers`,
                    { headers: { Authorization: `Bearer ${accessToken}` } },
                );
                const settings = data.settings[0];
                setId(settings.id);
                setRecordingSeconds(String(settings.recording_seconds));
                setAutoSaveLayout(!!settings.auto_save_layout);
                setRecordingOnMotionEnabled(settings.recording_on_motion_enabled !== false);
            } catch (error) {
                console.error("Błąd pobierania ustawień:", error);
            }
            setIsLoading(false);
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const [groupsRes, rulesRes] = await Promise.all([
                    axios.get(`${API_BASE}/notification-groups`),
                    axios.get(`${API_BASE}/notification-rules`),
                ]);
                setGroups(groupsRes.data.groups);
                setRules(rulesRes.data.rules);
            } catch (_) {}
        };
        fetchNotifications();
    }, []);

    useEffect(() => {
        if (!accessToken) return;
        const fetchSmtp = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/smtp-settings`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                setSmtpSettings({
                    host: data.host || "", port: data.port ?? 587,
                    username: data.username || "", password: data.password || "",
                    from_address: data.from_address || "", use_tls: data.use_tls,
                });
            } catch (_) {}
        };
        fetchSmtp();
    }, [accessToken]);

    useEffect(() => {
        if (location.hash) {
            document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
        }
    }, [location]);

    const handleBackToHome = () => {
        navigate("/");
    };

    const handleSaveSettings = async () => {
        try {
            await axios.put(
                `${API_BASE}/settings`,
                {
                    id,
                    recording_seconds: Number(recordingSeconds),
                    auto_save_layout: autoSaveLayout,
                    recording_on_motion_enabled: recordingOnMotionEnabled,
                },
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            setSettingsStatus({ type: "success", message: t("settings_saved") });
        } catch (error) {
            setSettingsStatus({
                type: "error",
                message: error.response?.data?.message || t("settings_save_error"),
            });
        }
        setTimeout(() => setSettingsStatus(null), 2500);
    };

    const handleSaveSmtp = async () => {
        try {
            const { data } = await axios.put(`${API_BASE}/smtp-settings`, smtpSettings, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setSmtpSettings(prev => ({ ...prev, ...data }));
            setSmtpStatus({ type: "success", message: t("smtp_settings_saved") });
        } catch (error) {
            setSmtpStatus({ type: "error", message: error.response?.data?.message || t("smtp_settings_save_error") });
        }
        setTimeout(() => setSmtpStatus(null), 2500);
    };

    const handleTestSmtp = async () => {
        if (!smtpTestAddress.trim()) return;
        try {
            await axios.post(`${API_BASE}/smtp-settings/test`, { to_address: smtpTestAddress }, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setSmtpTestStatus({ type: "success", message: t("test_email_sent") });
        } catch (error) {
            setSmtpTestStatus({ type: "error", message: error.response?.data?.message || t("test_send_error") });
        }
        setTimeout(() => setSmtpTestStatus(null), 3000);
    };

    const handleTestSms = async () => {
        if (!smsTestNumber.trim()) return;
        try {
            const { data } = await axios.post(`${API_BASE}/sms-settings/test`, { to_number: smsTestNumber }, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setSmsTestStatus({ type: "success", message: data.message || t("sms_sent_default") });
        } catch (error) {
            setSmsTestStatus({ type: "error", message: error.response?.data?.message || t("test_send_error") });
        }
        setTimeout(() => setSmsTestStatus(null), 4000);
    };

    const handleUpdateGroupSchedule = async (groupId, schedule) => {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, schedule } : g));
        try {
            await axios.put(`${API_BASE}/notification-groups/${groupId}/schedule`, { schedule }, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
        } catch (_) {}
    };

    const handleDownloadBackup = async () => {
        try {
            const { data } = await axios.get(`${API_BASE}/config-backup`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `konfiguracja_${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            setBackupStatus({ type: "error", message: error.response?.data?.message || t("download_config_error") });
            setTimeout(() => setBackupStatus(null), 3000);
        }
    };

    const handleRestoreBackup = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!window.confirm(t("confirm_restore"))) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            await axios.post(`${API_BASE}/config-backup/restore`, parsed, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setRestoreStatus({ type: "success", message: t("config_restored") });
        } catch (error) {
            setRestoreStatus({ type: "error", message: error.response?.data?.message || t("restore_error") });
        }
        setTimeout(() => setRestoreStatus(null), 5000);
    };

    const handleAddGroup = async () => {
        if (!newGroupName.trim()) return;
        try {
            await axios.post(`${API_BASE}/notification-groups`, { name: newGroupName }, { headers: { Authorization: `Bearer ${accessToken}` } });
            const { data } = await axios.get(`${API_BASE}/notification-groups`);
            setGroups(data.groups);
            setNewGroupName("");
            setGroupStatus({ type: "success", message: t("group_added") });
        } catch (error) {
            setGroupStatus({ type: "error", message: error.response?.data?.message || t("group_add_error") });
        }
        setTimeout(() => setGroupStatus(null), 2500);
    };

    const handleDeleteGroup = async (groupId) => {
        if (!window.confirm(t("confirm_delete_group"))) return;
        try {
            await axios.delete(`${API_BASE}/notification-groups/${groupId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
            setGroups(prev => prev.filter(g => g.id !== groupId));
            setGroupStatus({ type: "success", message: t("group_deleted") });
        } catch (error) {
            setGroupStatus({ type: "error", message: error.response?.data?.message || t("group_delete_error") });
        }
        setTimeout(() => setGroupStatus(null), 2500);
    };

    const handleAddRecipient = async (groupId) => {
        const draft = newRecipientByGroup[groupId] || {};
        const email = (draft.email || "").trim();
        const phoneNumber = (draft.phone || "").trim();
        if (!email && !phoneNumber) return;
        try {
            const { data } = await axios.post(
                `${API_BASE}/notification-groups/${groupId}/recipients`,
                { email: email || undefined, phone_number: phoneNumber || undefined },
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            setGroups(prev => prev.map(g => g.id === groupId
                ? { ...g, recipients: [...g.recipients, { id: data.id, email: email || null, phone_number: phoneNumber || null }] }
                : g));
            setNewRecipientByGroup(prev => ({ ...prev, [groupId]: { email: "", phone: "" } }));
            setGroupStatus({ type: "success", message: t("recipient_added") });
        } catch (error) {
            setGroupStatus({ type: "error", message: error.response?.data?.message || t("recipient_add_error") });
        }
        setTimeout(() => setGroupStatus(null), 2500);
    };

    const handleDeleteRecipient = async (groupId, recipientId) => {
        try {
            await axios.delete(`${API_BASE}/notification-groups/${groupId}/recipients/${recipientId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
            setGroups(prev => prev.map(g => g.id === groupId
                ? { ...g, recipients: g.recipients.filter(r => r.id !== recipientId) }
                : g));
        } catch (error) {
            setGroupStatus({ type: "error", message: error.response?.data?.message || t("recipient_delete_error") });
        }
        setTimeout(() => setGroupStatus(null), 2500);
    };

    const updateRule = (eventType, patch) => {
        setRules(prev => prev.map(r => r.event_type === eventType ? { ...r, ...patch } : r));
    };

    const handleSaveRules = async () => {
        try {
            await axios.put(`${API_BASE}/notification-rules`, { rules }, { headers: { Authorization: `Bearer ${accessToken}` } });
            setRulesStatus({ type: "success", message: t("rules_saved") });
        } catch (error) {
            setRulesStatus({ type: "error", message: error.response?.data?.message || t("rules_save_error") });
        }
        setTimeout(() => setRulesStatus(null), 2500);
    };

    return (
        <Layout>
            <Box sx={{ p: 2, maxWidth: 960, mx: "auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
                    <IconButton size="small" onClick={handleBackToHome}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="h5" fontWeight="bold">
                        {t("page_title_settings")}
                    </Typography>
                </Box>

                <SectionCard icon={<PersonIcon />} title={t("section_env_monitoring")}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanSensorCard
                                icon={<PersonIcon />}
                                label={t("motion_in_room")}
                                value={envData.motion}
                                alertLabel={t("motion_detected")}
                                okLabel={t("no_motion")}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanSensorCard
                                icon={<LocalFireDepartmentIcon />}
                                label={t("fire_sensor")}
                                value={envData.fire}
                                alertLabel={t("fire_alert")}
                                okLabel={t("not_detected")}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanSensorCard
                                icon={<GasMeterIcon />}
                                label={t("gas_sensor")}
                                value={envData.gas}
                                alertLabel={t("gas_alert")}
                                okLabel={t("not_detected")}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanSensorCard
                                icon={<SensorDoorIcon />}
                                label={t("entry_door")}
                                value={envData.door}
                                alertLabel={t("open_word")}
                                okLabel={t("closed_word")}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanSensorCard
                                icon={<WaterIcon />}
                                label={t("water_sensor")}
                                value={envData.water}
                                alertLabel={t("water_alert")}
                                okLabel={t("not_detected")}
                            />
                        </Grid>
                    </Grid>
                </SectionCard>

                <SectionCard id="nagrywanie" icon={<AccessTimeIcon />} title={t("section_recording")}>
                    {isLoading ? (
                        <Typography color="text.secondary">{t("loading")}</Typography>
                    ) : (
                        <>
                            <FormControlLabel
                                sx={{ mb: 1, display: "block" }}
                                control={
                                    <Checkbox
                                        checked={recordingOnMotionEnabled}
                                        onChange={(e) => setRecordingOnMotionEnabled(e.target.checked)}
                                    />
                                }
                                label={t("record_on_motion_checkbox")}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                                {t("record_log_note")}
                            </Typography>
                            <TextField
                                label={t("recording_stop_time_label")}
                                type="number"
                                size="small"
                                sx={{ mb: 2, width: 320 }}
                                value={recordingSeconds}
                                onChange={(e) => setRecordingSeconds(e.target.value)}
                                helperText={t("recording_helper")}
                            />
                            <Box>
                                <Button variant="contained" color="success" onClick={handleSaveSettings}>
                                    {t("save_changes")}
                                </Button>
                            </Box>
                            {settingsStatus && (
                                <Alert severity={settingsStatus.type} sx={{ mt: 2 }} onClose={() => setSettingsStatus(null)}>
                                    {settingsStatus.message}
                                </Alert>
                            )}
                        </>
                    )}
                </SectionCard>

                <SectionCard icon={<SaveIcon />} title={t("section_autosave_layout")}>
                    {isLoading ? (
                        <Typography color="text.secondary">{t("loading")}</Typography>
                    ) : (
                        <>
                            <FormControlLabel
                                sx={{ mb: 2 }}
                                control={
                                    <Checkbox
                                        checked={autoSaveLayout}
                                        onChange={(e) => setAutoSaveLayout(e.target.checked)}
                                    />
                                }
                                label={t("autosave_checkbox_label")}
                            />
                            <Box>
                                <Button variant="contained" color="success" onClick={handleSaveSettings}>
                                    {t("save_changes")}
                                </Button>
                            </Box>
                            {settingsStatus && (
                                <Alert severity={settingsStatus.type} sx={{ mt: 2 }} onClose={() => setSettingsStatus(null)}>
                                    {settingsStatus.message}
                                </Alert>
                            )}
                        </>
                    )}
                </SectionCard>

                <SectionCard icon={<EmailIcon />} title={t("section_smtp")}>
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
                        <TextField size="small" label={t("smtp_server_label")} sx={{ minWidth: 220 }}
                            value={smtpSettings.host}
                            onChange={e => setSmtpSettings(prev => ({ ...prev, host: e.target.value }))} />
                        <TextField size="small" label={t("port_label")} type="number" sx={{ width: 100 }}
                            value={smtpSettings.port}
                            onChange={e => setSmtpSettings(prev => ({ ...prev, port: Number(e.target.value) }))} />
                        <FormControlLabel
                            control={<Checkbox checked={smtpSettings.use_tls}
                                onChange={e => setSmtpSettings(prev => ({ ...prev, use_tls: e.target.checked }))} />}
                            label={t("secure_connection_label")}
                        />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -1.5, mb: 2 }}>
                        {t("starttls_helper")}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
                        <TextField size="small" label={t("username_label")} sx={{ minWidth: 200 }}
                            value={smtpSettings.username}
                            onChange={e => setSmtpSettings(prev => ({ ...prev, username: e.target.value }))} />
                        <TextField size="small" label={t("password_label")} type="password" sx={{ minWidth: 200 }}
                            value={smtpSettings.password}
                            onChange={e => setSmtpSettings(prev => ({ ...prev, password: e.target.value }))} />
                        <TextField size="small" label={t("sender_address_label")} sx={{ minWidth: 220 }}
                            value={smtpSettings.from_address}
                            onChange={e => setSmtpSettings(prev => ({ ...prev, from_address: e.target.value }))} />
                    </Box>
                    <Button variant="contained" color="success" size="small" onClick={handleSaveSmtp}>
                        {t("save_smtp_settings")}
                    </Button>
                    {smtpStatus && <Alert severity={smtpStatus.type} sx={{ mt: 2 }} onClose={() => setSmtpStatus(null)}>{smtpStatus.message}</Alert>}

                    <Box sx={{ display: "flex", gap: 2, alignItems: "center", mt: 3, flexWrap: "wrap" }}>
                        <TextField size="small" label={t("test_address_label")} placeholder="ja@przyklad.pl" sx={{ minWidth: 220 }}
                            value={smtpTestAddress} onChange={e => setSmtpTestAddress(e.target.value)} />
                        <Button variant="outlined" size="small" onClick={handleTestSmtp}>{t("send_test_email")}</Button>
                    </Box>
                    {smtpTestStatus && <Alert severity={smtpTestStatus.type} sx={{ mt: 2 }} onClose={() => setSmtpTestStatus(null)}>{smtpTestStatus.message}</Alert>}
                </SectionCard>

                <SectionCard icon={<SmsIcon />} title={t("section_sms")}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                        {t("sms_config_note")}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                        <TextField size="small" label={t("test_number_label")} placeholder="+48123456789" sx={{ minWidth: 220 }}
                            value={smsTestNumber} onChange={e => setSmsTestNumber(e.target.value)} />
                        <Button variant="outlined" size="small" onClick={handleTestSms}>{t("send_test_sms")}</Button>
                    </Box>
                    {smsTestStatus && <Alert severity={smsTestStatus.type} sx={{ mt: 2 }} onClose={() => setSmsTestStatus(null)}>{smsTestStatus.message}</Alert>}
                </SectionCard>

                <SectionCard id="powiadomienia" icon={<NotificationsActiveIcon />} title={t("section_notifications")}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>{t("notif_groups_title")}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                        {t("notif_groups_desc")}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                        <TextField size="small" label={t("new_group_name_label")} value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddGroup()} />
                        <Button variant="contained" size="small" onClick={handleAddGroup}>{t("add_new_group")}</Button>
                    </Box>
                    {groupStatus && <Alert severity={groupStatus.type} sx={{ mb: 2 }} onClose={() => setGroupStatus(null)}>{groupStatus.message}</Alert>}
                    {groups.map((group, i) => {
                        const color = GROUP_COLORS[i % GROUP_COLORS.length];
                        return (
                        <Box key={group.id} sx={{ mb: 2, p: 1.5, borderRadius: 1.5, borderLeft: `4px solid ${color}`, bgcolor: `${color}0d` }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                                <Typography fontWeight="bold" sx={{ color }}>{group.name}</Typography>
                                <IconButton size="small" onClick={() => handleDeleteGroup(group.id)}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
                                {group.recipients.map(r => (
                                    <Chip
                                        key={r.id}
                                        label={[r.email, r.phone_number].filter(Boolean).join(" · ")}
                                        onDelete={() => handleDeleteRecipient(group.id, r.id)}
                                        size="small"
                                    />
                                ))}
                            </Box>
                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                <TextField
                                    size="small" placeholder="adres@przyklad.pl" label={t("email_label")}
                                    value={newRecipientByGroup[group.id]?.email || ""}
                                    onChange={e => setNewRecipientByGroup(prev => ({ ...prev, [group.id]: { ...prev[group.id], email: e.target.value } }))}
                                    onKeyDown={e => e.key === "Enter" && handleAddRecipient(group.id)}
                                />
                                <TextField
                                    size="small" placeholder="+48123456789" label={t("phone_label")}
                                    value={newRecipientByGroup[group.id]?.phone || ""}
                                    onChange={e => setNewRecipientByGroup(prev => ({ ...prev, [group.id]: { ...prev[group.id], phone: e.target.value } }))}
                                    onKeyDown={e => e.key === "Enter" && handleAddRecipient(group.id)}
                                />
                                <Button size="small" variant="outlined" onClick={() => handleAddRecipient(group.id)}>{t("add_recipient")}</Button>
                            </Box>
                            <Accordion defaultExpanded sx={{ mt: 1, boxShadow: "none", border: "1px solid #eee" }} disableGutters>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="caption">
                                        {t("schedule_accordion_title")}
                                        <InfoTip text={t("schedule_infotip")} />
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <ScheduleEditor
                                        schedule={group.schedule}
                                        onChange={s => handleUpdateGroupSchedule(group.id, s)}
                                    />
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                        );
                    })}

                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, mt: 3 }}>{t("notif_rules_title")}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                        {t("notif_rules_desc")} <InfoOutlinedIcon sx={{ fontSize: 14, verticalAlign: "middle" }} /> {t("hover_for_details")}
                    </Typography>
                    {rules.map(rule => {
                        const color = EVENT_TYPE_COLORS[rule.event_type] || "#666";
                        const EventIcon = EVENT_TYPE_ICONS[rule.event_type];
                        return (
                        <Box key={rule.event_type} sx={{
                            p: 1.5, mb: 1.5, borderRadius: 1.5,
                            borderLeft: `4px solid ${color}`,
                            bgcolor: `${color}0d`,
                        }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 190 }}>
                                    {EventIcon && <EventIcon sx={{ color, fontSize: 20 }} />}
                                    <Typography fontWeight="bold" sx={{ color }}>{EVENT_TYPE_LABELS[rule.event_type]}</Typography>
                                </Box>
                                <FormControlLabel
                                    control={<Checkbox checked={rule.email_enabled} onChange={e => updateRule(rule.event_type, { email_enabled: e.target.checked })} />}
                                    label={t("email_label")}
                                />
                                <FormControlLabel
                                    control={<Checkbox checked={rule.sms_enabled} onChange={e => updateRule(rule.event_type, { sms_enabled: e.target.checked })} />}
                                    label="SMS"
                                />
                                <Tooltip title={t("select_group_tooltip")}>
                                    <Select size="small" displayEmpty sx={{ minWidth: 160 }}
                                        value={rule.group_id ?? ""}
                                        disabled={!rule.email_enabled && !rule.sms_enabled}
                                        onChange={e => updateRule(rule.event_type, { group_id: e.target.value === "" ? null : e.target.value })}
                                    >
                                        <MenuItem value=""><em>{t("choose_group_placeholder")}</em></MenuItem>
                                        {groups.map(g => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                                    </Select>
                                </Tooltip>
                                <Tooltip title={t("repeat_after_tooltip")}>
                                    <TextField
                                        size="small" type="number" label={t("repeat_after_label")}
                                        sx={{ width: 150 }}
                                        value={rule.notify_again_minutes ?? 30}
                                        onChange={e => updateRule(rule.event_type, { notify_again_minutes: Number(e.target.value) })}
                                    />
                                </Tooltip>
                                <FormControlLabel
                                    control={<Checkbox checked={rule.notify_on_return_enabled}
                                        onChange={e => updateRule(rule.event_type, { notify_on_return_enabled: e.target.checked })} />}
                                    label={<>{t("notify_on_return_label")}<InfoTip text={t("notify_on_return_tip")} /></>}
                                />
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", pl: "214px", mt: 0.5 }}>
                                <FormControlLabel
                                    control={<Checkbox checked={rule.sms_custom_enabled} disabled={!rule.sms_enabled}
                                        onChange={e => updateRule(rule.event_type, { sms_custom_enabled: e.target.checked })} />}
                                    label={<>{t("custom_sms_label")}<InfoTip text={t("custom_sms_tip")} /></>}
                                />
                                <TextField
                                    size="small" label={t("sms_content_label")} sx={{ minWidth: 280, flexGrow: 1 }}
                                    disabled={!rule.sms_enabled || !rule.sms_custom_enabled}
                                    value={rule.sms_custom_message ?? ""}
                                    onChange={e => updateRule(rule.event_type, { sms_custom_message: e.target.value })}
                                />
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", pl: "214px", mt: 0.5 }}>
                                <FormControlLabel
                                    control={<Checkbox checked={rule.email_custom_subject_enabled} disabled={!rule.email_enabled}
                                        onChange={e => updateRule(rule.event_type, { email_custom_subject_enabled: e.target.checked })} />}
                                    label={<>{t("custom_subject_label")}<InfoTip text={t("custom_subject_tip")} /></>}
                                />
                                <TextField
                                    size="small" label={t("email_subject_label")} sx={{ minWidth: 280, flexGrow: 1 }}
                                    disabled={!rule.email_enabled || !rule.email_custom_subject_enabled}
                                    value={rule.email_custom_subject ?? ""}
                                    onChange={e => updateRule(rule.event_type, { email_custom_subject: e.target.value })}
                                />
                                <FormControlLabel
                                    control={<Checkbox checked={rule.email_attach_camera} disabled={!rule.email_enabled}
                                        onChange={e => updateRule(rule.event_type, { email_attach_camera: e.target.checked })} />}
                                    label={<>{t("attach_camera_label")}<InfoTip text={t("attach_camera_tip")} /></>}
                                />
                            </Box>
                        </Box>
                        );
                    })}
                    <Button variant="contained" color="success" sx={{ mt: 2 }} onClick={handleSaveRules}>{t("save_rules")}</Button>
                    {rulesStatus && <Alert severity={rulesStatus.type} sx={{ mt: 2 }} onClose={() => setRulesStatus(null)}>{rulesStatus.message}</Alert>}
                </SectionCard>

                <SectionCard icon={<SettingsBackupRestoreIcon />} title={t("section_backup")}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t("backup_desc")}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                        <Button variant="contained" onClick={handleDownloadBackup}>{t("download_config")}</Button>
                        <Button variant="outlined" color="warning" component="label">
                            {t("restore_config")}
                            <input type="file" accept="application/json" hidden onChange={handleRestoreBackup} />
                        </Button>
                    </Box>
                    {backupStatus && <Alert severity={backupStatus.type} sx={{ mt: 2 }} onClose={() => setBackupStatus(null)}>{backupStatus.message}</Alert>}
                    {restoreStatus && <Alert severity={restoreStatus.type} sx={{ mt: 2 }} onClose={() => setRestoreStatus(null)}>{restoreStatus.message}</Alert>}
                </SectionCard>
            </Box>
        </Layout>
    );
};

export default Settings;
