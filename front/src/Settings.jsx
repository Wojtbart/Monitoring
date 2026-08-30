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
} from "@mui/material";
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EmailIcon from "@mui/icons-material/Email";
import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";

const DAY_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

function ScheduleEditor({ schedule, onChange }) {
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
                <Button size="small" onClick={() => setAll("1")}>Zaznacz wszystko</Button>
                <Button size="small" onClick={() => setAll("0")}>Odznacz wszystko</Button>
            </Box>
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

const Settings = () => {
    const accessToken = localStorage.getItem("JWT");
    const navigate = useNavigate();
    const location = useLocation();

    const [id, setId] = useState(null);
    const [recordingSeconds, setRecordingSeconds] = useState("");
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

    const [smtpSettings, setSmtpSettings] = useState({
        host: "", port: 587, username: "", password: "", from_address: "", use_tls: true,
    });
    const [smtpStatus, setSmtpStatus] = useState(null);
    const [smtpTestAddress, setSmtpTestAddress] = useState("");
    const [smtpTestStatus, setSmtpTestStatus] = useState(null);

    const [backupStatus, setBackupStatus] = useState(null);
    const [restoreStatus, setRestoreStatus] = useState(null);

    const EVENT_TYPE_LABELS = { fire: "Pożar", gas: "Gaz/Dym", water: "Zalanie", door: "Drzwi otwarte", device_threshold: "Próg temp./wilgotności szafy", voltage: "Napięcie zasilania" };

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

    const handleSaveSmtp = async () => {
        try {
            const { data } = await axios.put(`${API_BASE}/smtp-settings`, smtpSettings, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setSmtpSettings(prev => ({ ...prev, ...data }));
            setSmtpStatus({ type: "success", message: "Ustawienia SMTP zapisane." });
        } catch (error) {
            setSmtpStatus({ type: "error", message: error.response?.data?.message || "Błąd zapisu ustawień SMTP." });
        }
        setTimeout(() => setSmtpStatus(null), 2500);
    };

    const handleTestSmtp = async () => {
        if (!smtpTestAddress.trim()) return;
        try {
            await axios.post(`${API_BASE}/smtp-settings/test`, { to_address: smtpTestAddress }, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setSmtpTestStatus({ type: "success", message: "Wysłano testową wiadomość (sprawdź skrzynkę i logi backendu)." });
        } catch (error) {
            setSmtpTestStatus({ type: "error", message: error.response?.data?.message || "Błąd wysyłki testowej." });
        }
        setTimeout(() => setSmtpTestStatus(null), 3000);
    };

    const handleUpdateEmailSchedule = async (groupId, schedule) => {
        setEmailGroups(prev => prev.map(g => g.id === groupId ? { ...g, schedule } : g));
        try {
            await axios.put(`${API_BASE}/email-groups/${groupId}/schedule`, { schedule }, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
        } catch (_) {}
    };

    const handleUpdateSmsSchedule = async (groupId, schedule) => {
        setSmsGroups(prev => prev.map(g => g.id === groupId ? { ...g, schedule } : g));
        try {
            await axios.put(`${API_BASE}/sms-groups/${groupId}/schedule`, { schedule }, {
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
            setBackupStatus({ type: "error", message: error.response?.data?.message || "Błąd pobierania konfiguracji." });
            setTimeout(() => setBackupStatus(null), 3000);
        }
    };

    const handleRestoreBackup = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!window.confirm("To nadpisze bieżące ustawienia, progi, grupy i reguły powiadomień danymi z pliku. Kontynuować?")) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            await axios.post(`${API_BASE}/config-backup/restore`, parsed, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setRestoreStatus({ type: "success", message: "Konfiguracja przywrócona. Odśwież stronę żeby zobaczyć zmiany." });
        } catch (error) {
            setRestoreStatus({ type: "error", message: error.response?.data?.message || "Błąd przywracania konfiguracji (nieprawidłowy plik?)." });
        }
        setTimeout(() => setRestoreStatus(null), 5000);
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

                <SectionCard icon={<AccessTimeIcon />} title="Ustawienia nagrywania">
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

                <SectionCard icon={<EmailIcon />} title="SMTP (wysyłka e-mail)">
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
                        <TextField size="small" label="Serwer SMTP" sx={{ minWidth: 220 }}
                            value={smtpSettings.host}
                            onChange={e => setSmtpSettings(prev => ({ ...prev, host: e.target.value }))} />
                        <TextField size="small" label="Port" type="number" sx={{ width: 100 }}
                            value={smtpSettings.port}
                            onChange={e => setSmtpSettings(prev => ({ ...prev, port: Number(e.target.value) }))} />
                        <FormControlLabel
                            control={<Checkbox checked={smtpSettings.use_tls}
                                onChange={e => setSmtpSettings(prev => ({ ...prev, use_tls: e.target.checked }))} />}
                            label="STARTTLS"
                        />
                    </Box>
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
                        <TextField size="small" label="Użytkownik" sx={{ minWidth: 200 }}
                            value={smtpSettings.username}
                            onChange={e => setSmtpSettings(prev => ({ ...prev, username: e.target.value }))} />
                        <TextField size="small" label="Hasło" type="password" sx={{ minWidth: 200 }}
                            value={smtpSettings.password}
                            onChange={e => setSmtpSettings(prev => ({ ...prev, password: e.target.value }))} />
                        <TextField size="small" label="Adres nadawcy" sx={{ minWidth: 220 }}
                            value={smtpSettings.from_address}
                            onChange={e => setSmtpSettings(prev => ({ ...prev, from_address: e.target.value }))} />
                    </Box>
                    <Button variant="contained" color="success" size="small" onClick={handleSaveSmtp}>
                        Zapisz ustawienia SMTP
                    </Button>
                    {smtpStatus && <Alert severity={smtpStatus.type} sx={{ mt: 2 }} onClose={() => setSmtpStatus(null)}>{smtpStatus.message}</Alert>}

                    <Box sx={{ display: "flex", gap: 2, alignItems: "center", mt: 3, flexWrap: "wrap" }}>
                        <TextField size="small" label="Adres testowy" placeholder="ja@przyklad.pl" sx={{ minWidth: 220 }}
                            value={smtpTestAddress} onChange={e => setSmtpTestAddress(e.target.value)} />
                        <Button variant="outlined" size="small" onClick={handleTestSmtp}>Wyślij testowy e-mail</Button>
                    </Box>
                    {smtpTestStatus && <Alert severity={smtpTestStatus.type} sx={{ mt: 2 }} onClose={() => setSmtpTestStatus(null)}>{smtpTestStatus.message}</Alert>}
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
                            <Accordion sx={{ mt: 1, boxShadow: "none", border: "1px solid #eee" }} disableGutters>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="caption">Harmonogram wysyłki (kiedy grupa aktywna)</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <ScheduleEditor
                                        schedule={group.schedule}
                                        onChange={s => handleUpdateEmailSchedule(group.id, s)}
                                    />
                                </AccordionDetails>
                            </Accordion>
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
                            <Accordion sx={{ mt: 1, boxShadow: "none", border: "1px solid #eee" }} disableGutters>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="caption">Harmonogram wysyłki (kiedy grupa aktywna)</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <ScheduleEditor
                                        schedule={group.schedule}
                                        onChange={s => handleUpdateSmsSchedule(group.id, s)}
                                    />
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                    ))}
                    <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
                        <TextField size="small" label="Nazwa nowej grupy SMS" value={newSmsGroupName} onChange={e => setNewSmsGroupName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddSmsGroup()} />
                        <Button variant="contained" size="small" onClick={handleAddSmsGroup}>Nowa grupa</Button>
                    </Box>
                    {smsGroupStatus && <Alert severity={smsGroupStatus.type} sx={{ mb: 3 }} onClose={() => setSmsGroupStatus(null)}>{smsGroupStatus.message}</Alert>}

                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Reguły powiadomień</Typography>
                    {rules.map(rule => (
                        <Box key={rule.event_type} sx={{ py: 1, borderBottom: "1px solid #f0f0f0" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
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
                                <TextField
                                    size="small" type="number" label="Powtarzaj po (min)"
                                    sx={{ width: 150 }}
                                    value={rule.notify_again_minutes ?? 30}
                                    onChange={e => updateRule(rule.event_type, { notify_again_minutes: Number(e.target.value) })}
                                />
                                <FormControlLabel
                                    control={<Checkbox checked={rule.notify_on_return_enabled}
                                        onChange={e => updateRule(rule.event_type, { notify_on_return_enabled: e.target.checked })} />}
                                    label="Powiadom o powrocie do normy"
                                />
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", pl: "146px", mt: 0.5 }}>
                                <FormControlLabel
                                    control={<Checkbox checked={rule.sms_custom_enabled} disabled={!rule.sms_enabled}
                                        onChange={e => updateRule(rule.event_type, { sms_custom_enabled: e.target.checked })} />}
                                    label="Własny tekst SMS"
                                />
                                <TextField
                                    size="small" label="Treść SMS" sx={{ minWidth: 280, flexGrow: 1 }}
                                    disabled={!rule.sms_enabled || !rule.sms_custom_enabled}
                                    value={rule.sms_custom_message ?? ""}
                                    onChange={e => updateRule(rule.event_type, { sms_custom_message: e.target.value })}
                                />
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", pl: "146px", mt: 0.5 }}>
                                <FormControlLabel
                                    control={<Checkbox checked={rule.email_custom_subject_enabled} disabled={!rule.email_enabled}
                                        onChange={e => updateRule(rule.event_type, { email_custom_subject_enabled: e.target.checked })} />}
                                    label="Własny temat e-mail"
                                />
                                <TextField
                                    size="small" label="Temat e-mail" sx={{ minWidth: 280, flexGrow: 1 }}
                                    disabled={!rule.email_enabled || !rule.email_custom_subject_enabled}
                                    value={rule.email_custom_subject ?? ""}
                                    onChange={e => updateRule(rule.event_type, { email_custom_subject: e.target.value })}
                                />
                                <FormControlLabel
                                    control={<Checkbox checked={rule.email_attach_camera} disabled={!rule.email_enabled}
                                        onChange={e => updateRule(rule.event_type, { email_attach_camera: e.target.checked })} />}
                                    label="Załącz zdjęcie z kamery"
                                />
                            </Box>
                        </Box>
                    ))}
                    <Button variant="contained" color="success" sx={{ mt: 2 }} onClick={handleSaveRules}>Zapisz reguły</Button>
                    {rulesStatus && <Alert severity={rulesStatus.type} sx={{ mt: 2 }} onClose={() => setRulesStatus(null)}>{rulesStatus.message}</Alert>}
                </SectionCard>

                <SectionCard icon={<SettingsBackupRestoreIcon />} title="Kopia zapasowa konfiguracji">
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Obejmuje ustawienia, progi alarmowe, grupy powiadomień i reguły. Nie obejmuje kont użytkowników, logów ani historii odczytów. Hasło SMTP nie jest eksportowane — po przywróceniu zostaje to, które jest już zapisane.
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                        <Button variant="contained" onClick={handleDownloadBackup}>Pobierz konfigurację</Button>
                        <Button variant="outlined" color="warning" component="label">
                            Przywróć konfigurację
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
