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
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Wiersze = dni tygodnia, kolumny (0–23) = godziny doby. Zielone pole = w tej godzinie danego dnia powiadomienia mogą wychodzić.
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

    const [id, setId] = useState(null);
    const [recordingSeconds, setRecordingSeconds] = useState("");
    const [autoSaveLayout, setAutoSaveLayout] = useState(false);
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

    const [backupStatus, setBackupStatus] = useState(null);
    const [restoreStatus, setRestoreStatus] = useState(null);

    const EVENT_TYPE_LABELS = { fire: "Pożar", gas: "Gaz/Dym", water: "Zalanie", door: "Drzwi otwarte", device_threshold: "Próg temp./wilgotności szafy", voltage: "Napięcie zasilania" };
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
                    auto_save_layout: autoSaveLayout,
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

    const handleAddGroup = async () => {
        if (!newGroupName.trim()) return;
        try {
            await axios.post(`${API_BASE}/notification-groups`, { name: newGroupName }, { headers: { Authorization: `Bearer ${accessToken}` } });
            const { data } = await axios.get(`${API_BASE}/notification-groups`);
            setGroups(data.groups);
            setNewGroupName("");
            setGroupStatus({ type: "success", message: "Grupa dodana." });
        } catch (error) {
            setGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd dodawania grupy." });
        }
        setTimeout(() => setGroupStatus(null), 2500);
    };

    const handleDeleteGroup = async (groupId) => {
        if (!window.confirm("Usunąć tę grupę wraz z odbiorcami?")) return;
        try {
            await axios.delete(`${API_BASE}/notification-groups/${groupId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
            setGroups(prev => prev.filter(g => g.id !== groupId));
            setGroupStatus({ type: "success", message: "Grupa usunięta." });
        } catch (error) {
            setGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd usuwania grupy." });
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
            setGroupStatus({ type: "success", message: "Odbiorca dodany." });
        } catch (error) {
            setGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd dodawania odbiorcy." });
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
            setGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd usuwania odbiorcy." });
        }
        setTimeout(() => setGroupStatus(null), 2500);
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
                            <TextField
                                label="Czas do zatrzymania nagrywania (s)"
                                type="number"
                                size="small"
                                sx={{ mb: 2, width: 320 }}
                                value={recordingSeconds}
                                onChange={(e) => setRecordingSeconds(e.target.value)}
                                helperText="Kamera nagrywa automatycznie po wykryciu ruchu. To nie jest długość nagrania — to czas ciszy (bez ruchu) po którym nagrywanie się zatrzyma. Dopóki ruch jest wykrywany, licznik odlicza od nowa i nagranie trwa dalej."
                            />
                            <Box>
                                <Button variant="contained" color="success" onClick={handleSaveSettings}>
                                    Zapisz zmiany
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

                <SectionCard icon={<SaveIcon />} title="Automatyczny zapis układu">
                    {isLoading ? (
                        <Typography color="text.secondary">Ładowanie...</Typography>
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
                                label="Automatyczny zapis układu (rzut serwerowni i widok szafy) — bez klikania „Zapisz układ” po każdej zmianie"
                            />
                            <Box>
                                <Button variant="contained" color="success" onClick={handleSaveSettings}>
                                    Zapisz zmiany
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
                            label="Bezpieczne połączenie (szyfrowanie)"
                        />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -1.5, mb: 2 }}>
                        Szyfruje połączenie z serwerem pocztowym (STARTTLS), żeby login i hasło nie leciały jawnym tekstem.
                        Zostaw włączone — prawie każdy dostawca poczty (Gmail, Outlook, firmowa poczta) tego wymaga na porcie 587.
                        Wyłącz tylko jeśli Twój serwer SMTP wyraźnie mówi, że działa bez szyfrowania.
                    </Typography>
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
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Grupy powiadomień</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                        Jedna grupa obsługuje oba kanały — każdy odbiorca może mieć adres e-mail i/lub numer telefonu.
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                        <TextField size="small" label="Nazwa nowej grupy" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddGroup()} />
                        <Button variant="contained" size="small" onClick={handleAddGroup}>Dodaj nową grupę</Button>
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
                                    size="small" placeholder="adres@przyklad.pl" label="E-mail"
                                    value={newRecipientByGroup[group.id]?.email || ""}
                                    onChange={e => setNewRecipientByGroup(prev => ({ ...prev, [group.id]: { ...prev[group.id], email: e.target.value } }))}
                                    onKeyDown={e => e.key === "Enter" && handleAddRecipient(group.id)}
                                />
                                <TextField
                                    size="small" placeholder="+48123456789" label="Telefon"
                                    value={newRecipientByGroup[group.id]?.phone || ""}
                                    onChange={e => setNewRecipientByGroup(prev => ({ ...prev, [group.id]: { ...prev[group.id], phone: e.target.value } }))}
                                    onKeyDown={e => e.key === "Enter" && handleAddRecipient(group.id)}
                                />
                                <Button size="small" variant="outlined" onClick={() => handleAddRecipient(group.id)}>Dodaj odbiorcę</Button>
                            </Box>
                            <Accordion defaultExpanded sx={{ mt: 1, boxShadow: "none", border: "1px solid #eee" }} disableGutters>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="caption">
                                        Harmonogram wysyłki (kiedy grupa aktywna)
                                        <InfoTip text="Alarm zawsze się loguje i włącza, niezależnie od tej siatki. Ale e-mail/SMS do tej grupy wyjdzie TYLKO w zaznaczonych (zielonych) godzinach. Jeśli zaznaczysz za mało pól, powiadomienia będą prawie zawsze wyciszone — dla większości przypadków zostaw „Zaznacz wszystko”." />
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

                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, mt: 3 }}>Reguły powiadomień</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                        Jedna reguła na typ zdarzenia. Zaznacz kanał (E-mail/SMS), wybierz grupę odbiorców, i tyle — powiadomienie
                        wyjdzie przy wykryciu zdarzenia, a kolejne dopiero po czasie z pola „Powtarzaj po” (żeby nie zasypać Cię
                        wiadomościami). „Potwierdź alarm” na stronie czujnika wycisza powiadomienia do czasu powrotu do normy —
                        to nie kasuje alarmu, tylko ucisza spam. Reszta pól niżej jest opcjonalna, najedź na <InfoOutlinedIcon sx={{ fontSize: 14, verticalAlign: "middle" }} /> po szczegóły.
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
                                    label="E-mail"
                                />
                                <FormControlLabel
                                    control={<Checkbox checked={rule.sms_enabled} onChange={e => updateRule(rule.event_type, { sms_enabled: e.target.checked })} />}
                                    label="SMS"
                                />
                                <Tooltip title="Do kogo lecą powiadomienia — e-mail do adresów, SMS do numerów zapisanych w tej grupie (patrz sekcja wyżej).">
                                    <Select size="small" displayEmpty sx={{ minWidth: 160 }}
                                        value={rule.group_id ?? ""}
                                        disabled={!rule.email_enabled && !rule.sms_enabled}
                                        onChange={e => updateRule(rule.event_type, { group_id: e.target.value === "" ? null : e.target.value })}
                                    >
                                        <MenuItem value=""><em>Wybierz grupę</em></MenuItem>
                                        {groups.map(g => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                                    </Select>
                                </Tooltip>
                                <Tooltip title="Jak długo od ostatniego powiadomienia trzeba odczekać, zanim to samo zdarzenie znów wyśle e-mail/SMS. Chroni przed zalaniem skrzynki przy alarmie który trwa długo.">
                                    <TextField
                                        size="small" type="number" label="Powtarzaj po (min)"
                                        sx={{ width: 150 }}
                                        value={rule.notify_again_minutes ?? 30}
                                        onChange={e => updateRule(rule.event_type, { notify_again_minutes: Number(e.target.value) })}
                                    />
                                </Tooltip>
                                <FormControlLabel
                                    control={<Checkbox checked={rule.notify_on_return_enabled}
                                        onChange={e => updateRule(rule.event_type, { notify_on_return_enabled: e.target.checked })} />}
                                    label={<>Powiadom o powrocie do normy<InfoTip text="Dodatkowy, osobny e-mail/SMS wysyłany gdy czujnik SAM wróci do normy (bez klikania czegokolwiek). Bez tego dostajesz tylko powiadomienie o wystąpieniu alarmu." /></>}
                                />
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", pl: "214px", mt: 0.5 }}>
                                <FormControlLabel
                                    control={<Checkbox checked={rule.sms_custom_enabled} disabled={!rule.sms_enabled}
                                        onChange={e => updateRule(rule.event_type, { sms_custom_enabled: e.target.checked })} />}
                                    label={<>Własny tekst SMS<InfoTip text="Bez tego SMS ma automatycznie wygenerowaną treść z opisem zdarzenia. Zaznacz i wpisz obok, żeby zawsze wysyłać dokładnie ten tekst." /></>}
                                />
                                <TextField
                                    size="small" label="Treść SMS" sx={{ minWidth: 280, flexGrow: 1 }}
                                    disabled={!rule.sms_enabled || !rule.sms_custom_enabled}
                                    value={rule.sms_custom_message ?? ""}
                                    onChange={e => updateRule(rule.event_type, { sms_custom_message: e.target.value })}
                                />
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", pl: "214px", mt: 0.5 }}>
                                <FormControlLabel
                                    control={<Checkbox checked={rule.email_custom_subject_enabled} disabled={!rule.email_enabled}
                                        onChange={e => updateRule(rule.event_type, { email_custom_subject_enabled: e.target.checked })} />}
                                    label={<>Własny temat e-mail<InfoTip text="Bez tego temat maila alarmowego to automatyczne 'Alarm: ...'. Zaznacz i wpisz obok, żeby zawsze używać tego tematu." /></>}
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
                                    label={<>Załącz zdjęcie z kamery<InfoTip text="Do maila alarmowego dołączy się zdjęcie zrobione kamerą w momencie wysyłki." /></>}
                                />
                            </Box>
                        </Box>
                        );
                    })}
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
