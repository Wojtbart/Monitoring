import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "./api";
import dayjs from "dayjs";
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
} from "@mui/material";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Card from "@mui/material/Card";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import GasMeterIcon from "@mui/icons-material/GasMeter";
import SensorDoorIcon from "@mui/icons-material/SensorDoor";
import WaterIcon from "@mui/icons-material/Water";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

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

const Settings = () => {
    const accessToken = localStorage.getItem("JWT");
    const navigate = useNavigate();
    const location = useLocation();

    const [id, setId] = useState(null);
    const [recordingSeconds, setRecordingSeconds] = useState("");
    const [morningTime, setMorningTime] = useState(dayjs().hour(8).minute(0));
    const [eveningTime, setEveningTime] = useState(dayjs().hour(20).minute(0));
    const [isLoading, setIsLoading] = useState(true);
    const [settingsStatus, setSettingsStatus] = useState(null);

    const [envData, setEnvData] = useState({
        motion: false, fire: false, gas: false, door: false, water: false,
    });

    const [emailGroups, setEmailGroups] = useState([]);
    const [newEmailGroupName, setNewEmailGroupName] = useState("");
    const [newEmailByGroup, setNewEmailByGroup] = useState({});
    const [emailGroupStatus, setEmailGroupStatus] = useState(null);

    const [smsGroups, setSmsGroups] = useState([]);
    const [newSmsGroupName, setNewSmsGroupName] = useState("");
    const [newPhoneByGroup, setNewPhoneByGroup] = useState({});
    const [smsGroupStatus, setSmsGroupStatus] = useState(null);

    const [rules, setRules] = useState([]);
    const [rulesStatus, setRulesStatus] = useState(null);

    const EVENT_TYPE_LABELS = { fire: "Pożar", gas: "Gaz/Dym", water: "Zalanie", door: "Drzwi otwarte", device_threshold: "Próg temp./wilgotności szafy" };

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
            navigate("/loginPage");
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
                setMorningTime(dayjs(settings.morning_test_time, "HH:mm:ss"));
                setEveningTime(dayjs(settings.evening_test_time, "HH:mm:ss"));
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
                const [egRes, sgRes, rulesRes] = await Promise.all([
                    axios.get(`${API_BASE}/email-groups`),
                    axios.get(`${API_BASE}/sms-groups`),
                    axios.get(`${API_BASE}/notification-rules`),
                ]);
                setEmailGroups(egRes.data.groups);
                setSmsGroups(sgRes.data.groups);
                setRules(rulesRes.data.rules);
            } catch (_) {}
        };
        fetchNotifications();
    }, []);

    useEffect(() => {
        if (location.hash === "#powiadomienia") {
            document.getElementById("powiadomienia")?.scrollIntoView({ behavior: "smooth" });
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
                    morning_test_time: dayjs(morningTime).format("HH:mm:ss"),
                    evening_test_time: dayjs(eveningTime).format("HH:mm:ss"),
                },
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            setSettingsStatus({ type: "success", message: "Ustawienia zapisane." });
        } catch (error) {
            setSettingsStatus({
                type: "error",
                message: error.response?.data?.message || "Błąd zapisu ustawień.",
            });
        }
        setTimeout(() => setSettingsStatus(null), 2500);
    };

    const handleAddEmailGroup = async () => {
        if (!newEmailGroupName.trim()) return;
        try {
            await axios.post(`${API_BASE}/email-groups`, { name: newEmailGroupName }, { headers: { Authorization: `Bearer ${accessToken}` } });
            const { data } = await axios.get(`${API_BASE}/email-groups`);
            setEmailGroups(data.groups);
            setNewEmailGroupName("");
            setEmailGroupStatus({ type: "success", message: "Grupa dodana." });
        } catch (error) {
            setEmailGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd dodawania grupy." });
        }
        setTimeout(() => setEmailGroupStatus(null), 2500);
    };

    const handleDeleteEmailGroup = async (groupId) => {
        if (!window.confirm("Usunąć tę grupę mailową wraz z adresami?")) return;
        try {
            await axios.delete(`${API_BASE}/email-groups/${groupId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
            setEmailGroups(prev => prev.filter(g => g.id !== groupId));
            setEmailGroupStatus({ type: "success", message: "Grupa usunięta." });
        } catch (error) {
            setEmailGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd usuwania grupy." });
        }
        setTimeout(() => setEmailGroupStatus(null), 2500);
    };

    const handleAddEmailRecipient = async (groupId) => {
        const email = (newEmailByGroup[groupId] || "").trim();
        if (!email) return;
        try {
            const { data } = await axios.post(`${API_BASE}/email-groups/${groupId}/recipients`, { email }, { headers: { Authorization: `Bearer ${accessToken}` } });
            setEmailGroups(prev => prev.map(g => g.id === groupId
                ? { ...g, recipients: [...g.recipients, { id: data.id, email }] }
                : g));
            setNewEmailByGroup(prev => ({ ...prev, [groupId]: "" }));
            setEmailGroupStatus({ type: "success", message: "Adres dodany." });
        } catch (error) {
            setEmailGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd dodawania adresu." });
        }
        setTimeout(() => setEmailGroupStatus(null), 2500);
    };

    const handleDeleteEmailRecipient = async (groupId, recipientId) => {
        try {
            await axios.delete(`${API_BASE}/email-groups/${groupId}/recipients/${recipientId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
            setEmailGroups(prev => prev.map(g => g.id === groupId
                ? { ...g, recipients: g.recipients.filter(r => r.id !== recipientId) }
                : g));
        } catch (error) {
            setEmailGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd usuwania adresu." });
        }
        setTimeout(() => setEmailGroupStatus(null), 2500);
    };

    const handleAddSmsGroup = async () => {
        if (!newSmsGroupName.trim()) return;
        try {
            await axios.post(`${API_BASE}/sms-groups`, { name: newSmsGroupName }, { headers: { Authorization: `Bearer ${accessToken}` } });
            const { data } = await axios.get(`${API_BASE}/sms-groups`);
            setSmsGroups(data.groups);
            setNewSmsGroupName("");
            setSmsGroupStatus({ type: "success", message: "Grupa dodana." });
        } catch (error) {
            setSmsGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd dodawania grupy." });
        }
        setTimeout(() => setSmsGroupStatus(null), 2500);
    };

    const handleDeleteSmsGroup = async (groupId) => {
        if (!window.confirm("Usunąć tę grupę SMS wraz z numerami?")) return;
        try {
            await axios.delete(`${API_BASE}/sms-groups/${groupId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
            setSmsGroups(prev => prev.filter(g => g.id !== groupId));
            setSmsGroupStatus({ type: "success", message: "Grupa usunięta." });
        } catch (error) {
            setSmsGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd usuwania grupy." });
        }
        setTimeout(() => setSmsGroupStatus(null), 2500);
    };

    const handleAddSmsRecipient = async (groupId) => {
        const phoneNumber = (newPhoneByGroup[groupId] || "").trim();
        if (!phoneNumber) return;
        try {
            const { data } = await axios.post(`${API_BASE}/sms-groups/${groupId}/recipients`, { phone_number: phoneNumber }, { headers: { Authorization: `Bearer ${accessToken}` } });
            setSmsGroups(prev => prev.map(g => g.id === groupId
                ? { ...g, recipients: [...g.recipients, { id: data.id, phone_number: phoneNumber }] }
                : g));
            setNewPhoneByGroup(prev => ({ ...prev, [groupId]: "" }));
            setSmsGroupStatus({ type: "success", message: "Numer dodany." });
        } catch (error) {
            setSmsGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd dodawania numeru." });
        }
        setTimeout(() => setSmsGroupStatus(null), 2500);
    };

    const handleDeleteSmsRecipient = async (groupId, recipientId) => {
        try {
            await axios.delete(`${API_BASE}/sms-groups/${groupId}/recipients/${recipientId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
            setSmsGroups(prev => prev.map(g => g.id === groupId
                ? { ...g, recipients: g.recipients.filter(r => r.id !== recipientId) }
                : g));
        } catch (error) {
            setSmsGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd usuwania numeru." });
        }
        setTimeout(() => setSmsGroupStatus(null), 2500);
    };

    const updateRule = (eventType, patch) => {
        setRules(prev => prev.map(r => r.event_type === eventType ? { ...r, ...patch } : r));
    };

    const handleSaveRules = async () => {
        try {
            await axios.put(`${API_BASE}/notification-rules`, { rules }, { headers: { Authorization: `Bearer ${accessToken}` } });
            setRulesStatus({ type: "success", message: "Reguły zapisane." });
        } catch (error) {
            setRulesStatus({ type: "error", message: error.response?.data?.message || "Błąd zapisu reguł." });
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
                        Ustawienia
                    </Typography>
                </Box>

                <SectionCard icon={<PersonIcon />} title="Monitoring środowiskowy serwerowni">
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanSensorCard
                                icon={<PersonIcon />}
                                label="Ruch w pomieszczeniu"
                                value={envData.motion}
                                alertLabel="Wykryto ruch"
                                okLabel="Brak ruchu"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanSensorCard
                                icon={<LocalFireDepartmentIcon />}
                                label="Czujnik pożaru"
                                value={envData.fire}
                                alertLabel="OGIEŃ!"
                                okLabel="Brak"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanSensorCard
                                icon={<GasMeterIcon />}
                                label="Czujnik gazu/dymu"
                                value={envData.gas}
                                alertLabel="GAZ/DYM!"
                                okLabel="Brak"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanSensorCard
                                icon={<SensorDoorIcon />}
                                label="Drzwi wejściowe"
                                value={envData.door}
                                alertLabel="Otwarte"
                                okLabel="Zamknięte"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanSensorCard
                                icon={<WaterIcon />}
                                label="Czujnik wody"
                                value={envData.water}
                                alertLabel="WODA!"
                                okLabel="Brak"
                            />
                        </Grid>
                    </Grid>
                </SectionCard>

                <SectionCard icon={<AccessTimeIcon />} title="Ustawienia nagrywania i testów">
                    {isLoading ? (
                        <Typography color="text.secondary">Ładowanie...</Typography>
                    ) : (
                        <>
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        label="Czas do zatrzymania nagrywania (s)"
                                        type="number"
                                        fullWidth
                                        size="small"
                                        value={recordingSeconds}
                                        onChange={(e) => setRecordingSeconds(e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                                        <TimePicker
                                            label="Godzina testu porannego"
                                            value={morningTime}
                                            onChange={(time) => setMorningTime(time)}
                                            ampm={false}
                                            slotProps={{ textField: { fullWidth: true, size: "small" } }}
                                        />
                                    </LocalizationProvider>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                                        <TimePicker
                                            label="Godzina testu wieczornego"
                                            value={eveningTime}
                                            onChange={(time) => setEveningTime(time)}
                                            ampm={false}
                                            slotProps={{ textField: { fullWidth: true, size: "small" } }}
                                        />
                                    </LocalizationProvider>
                                </Grid>
                            </Grid>
                            <Button variant="contained" color="success" onClick={handleSaveSettings}>
                                Zapisz zmiany
                            </Button>
                            {settingsStatus && (
                                <Alert severity={settingsStatus.type} sx={{ mt: 2 }} onClose={() => setSettingsStatus(null)}>
                                    {settingsStatus.message}
                                </Alert>
                            )}
                        </>
                    )}
                </SectionCard>

                <SectionCard id="powiadomienia" icon={<NotificationsActiveIcon />} title="Powiadomienia">
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Grupy mailowe</Typography>
                    {emailGroups.map(group => (
                        <Box key={group.id} sx={{ mb: 2, p: 1.5, border: "1px solid #e0e0e0", borderRadius: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                                <Typography fontWeight="bold">{group.name}</Typography>
                                <IconButton size="small" onClick={() => handleDeleteEmailGroup(group.id)}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
                                {group.recipients.map(r => (
                                    <Chip key={r.id} label={r.email} onDelete={() => handleDeleteEmailRecipient(group.id, r.id)} size="small" />
                                ))}
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <TextField
                                    size="small" placeholder="adres@przyklad.pl"
                                    value={newEmailByGroup[group.id] || ""}
                                    onChange={e => setNewEmailByGroup(prev => ({ ...prev, [group.id]: e.target.value }))}
                                    onKeyDown={e => e.key === "Enter" && handleAddEmailRecipient(group.id)}
                                />
                                <Button size="small" variant="outlined" onClick={() => handleAddEmailRecipient(group.id)}>Dodaj adres</Button>
                            </Box>
                        </Box>
                    ))}
                    <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
                        <TextField size="small" label="Nazwa nowej grupy mailowej" value={newEmailGroupName} onChange={e => setNewEmailGroupName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddEmailGroup()} />
                        <Button variant="contained" size="small" onClick={handleAddEmailGroup}>Nowa grupa</Button>
                    </Box>
                    {emailGroupStatus && <Alert severity={emailGroupStatus.type} sx={{ mb: 3 }} onClose={() => setEmailGroupStatus(null)}>{emailGroupStatus.message}</Alert>}

                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Grupy SMS</Typography>
                    {smsGroups.map(group => (
                        <Box key={group.id} sx={{ mb: 2, p: 1.5, border: "1px solid #e0e0e0", borderRadius: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                                <Typography fontWeight="bold">{group.name}</Typography>
                                <IconButton size="small" onClick={() => handleDeleteSmsGroup(group.id)}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
                                {group.recipients.map(r => (
                                    <Chip key={r.id} label={r.phone_number} onDelete={() => handleDeleteSmsRecipient(group.id, r.id)} size="small" />
                                ))}
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <TextField
                                    size="small" placeholder="+48123456789"
                                    value={newPhoneByGroup[group.id] || ""}
                                    onChange={e => setNewPhoneByGroup(prev => ({ ...prev, [group.id]: e.target.value }))}
                                    onKeyDown={e => e.key === "Enter" && handleAddSmsRecipient(group.id)}
                                />
                                <Button size="small" variant="outlined" onClick={() => handleAddSmsRecipient(group.id)}>Dodaj numer</Button>
                            </Box>
                        </Box>
                    ))}
                    <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
                        <TextField size="small" label="Nazwa nowej grupy SMS" value={newSmsGroupName} onChange={e => setNewSmsGroupName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddSmsGroup()} />
                        <Button variant="contained" size="small" onClick={handleAddSmsGroup}>Nowa grupa</Button>
                    </Box>
                    {smsGroupStatus && <Alert severity={smsGroupStatus.type} sx={{ mb: 3 }} onClose={() => setSmsGroupStatus(null)}>{smsGroupStatus.message}</Alert>}

                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Reguły powiadomień</Typography>
                    {rules.map(rule => (
                        <Box key={rule.event_type} sx={{ display: "flex", alignItems: "center", gap: 2, py: 1, borderBottom: "1px solid #f0f0f0", flexWrap: "wrap" }}>
                            <Typography sx={{ minWidth: 130 }} fontWeight="bold">{EVENT_TYPE_LABELS[rule.event_type]}</Typography>
                            <FormControlLabel
                                control={<Checkbox checked={rule.email_enabled} onChange={e => updateRule(rule.event_type, { email_enabled: e.target.checked })} />}
                                label="E-mail"
                            />
                            <Select size="small" displayEmpty sx={{ minWidth: 160 }}
                                value={rule.email_group_id ?? ""}
                                disabled={!rule.email_enabled}
                                onChange={e => updateRule(rule.event_type, { email_group_id: e.target.value === "" ? null : e.target.value })}
                            >
                                <MenuItem value=""><em>Wybierz grupę</em></MenuItem>
                                {emailGroups.map(g => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                            </Select>
                            <FormControlLabel
                                control={<Checkbox checked={rule.sms_enabled} onChange={e => updateRule(rule.event_type, { sms_enabled: e.target.checked })} />}
                                label="SMS"
                            />
                            <Select size="small" displayEmpty sx={{ minWidth: 160 }}
                                value={rule.sms_group_id ?? ""}
                                disabled={!rule.sms_enabled}
                                onChange={e => updateRule(rule.event_type, { sms_group_id: e.target.value === "" ? null : e.target.value })}
                            >
                                <MenuItem value=""><em>Wybierz grupę</em></MenuItem>
                                {smsGroups.map(g => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                            </Select>
                        </Box>
                    ))}
                    <Button variant="contained" color="success" sx={{ mt: 2 }} onClick={handleSaveRules}>Zapisz reguły</Button>
                    {rulesStatus && <Alert severity={rulesStatus.type} sx={{ mt: 2 }} onClose={() => setRulesStatus(null)}>{rulesStatus.message}</Alert>}
                </SectionCard>
            </Box>
        </Layout>
    );
};

export default Settings;
