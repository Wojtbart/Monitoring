import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "./api";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
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
} from "@mui/material";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Card from "@mui/material/Card";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
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

function SectionCard({ icon, title, children }) {
    return (
        <Card variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
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

    const [id, setId] = useState(null);
    const [recordingSeconds, setRecordingSeconds] = useState("");
    const [morningTime, setMorningTime] = useState(dayjs().hour(8).minute(0));
    const [eveningTime, setEveningTime] = useState(dayjs().hour(20).minute(0));
    const [isLoading, setIsLoading] = useState(true);
    const [settingsStatus, setSettingsStatus] = useState(null);

    const [phoneNumbers, setPhoneNumbers] = useState([]);
    const [newPhoneNumber, setNewPhoneNumber] = useState("");
    const [phoneStatus, setPhoneStatus] = useState(null);

    const [envData, setEnvData] = useState({
        motion: false, fire: false, gas: false, door: false, water: false,
    });

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
                setPhoneNumbers(data.phone_numbers);
            } catch (error) {
                console.error("Błąd pobierania ustawień:", error);
            }
            setIsLoading(false);
        };
        fetchInitialData();
    }, []);

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

    const handleAddPhoneNumber = async () => {
        if (!newPhoneNumber.trim()) return;
        try {
            await axios.post(
                `${API_BASE}/phone-numbers`,
                { phone_number: newPhoneNumber },
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            setPhoneNumbers(prev => [...prev, newPhoneNumber]);
            setNewPhoneNumber("");
            setPhoneStatus({ type: "success", message: "Numer dodany." });
        } catch (error) {
            setPhoneStatus({
                type: "error",
                message: error.response?.data?.message || "Błąd dodawania numeru.",
            });
        }
        setTimeout(() => setPhoneStatus(null), 2500);
    };

    const handleDeleteNumber = async (number) => {
        if (!window.confirm(`Usunąć numer "${number}"?`)) return;
        try {
            await axios.delete(
                `${API_BASE}/phone-numbers/${encodeURIComponent(number)}`,
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            setPhoneNumbers(prev => prev.filter(n => n !== number));
            setPhoneStatus({ type: "success", message: "Numer usunięty." });
        } catch (error) {
            setPhoneStatus({
                type: "error",
                message: error.response?.data?.message || "Błąd usuwania numeru.",
            });
        }
        setTimeout(() => setPhoneStatus(null), 2500);
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

                <SectionCard icon={<LocalPhoneOutlinedIcon />} title="Numery telefonów alarmowych">
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                        {phoneNumbers.length === 0 && (
                            <Typography color="text.secondary">Brak numerów.</Typography>
                        )}
                        {phoneNumbers.map((number) => (
                            <Chip
                                key={number}
                                label={number}
                                onDelete={() => handleDeleteNumber(number)}
                                color="primary"
                                variant="outlined"
                            />
                        ))}
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <TextField
                            label="Numer telefonu"
                            type="tel"
                            size="small"
                            value={newPhoneNumber}
                            onChange={(e) => setNewPhoneNumber(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddPhoneNumber()}
                        />
                        <Button variant="contained" onClick={handleAddPhoneNumber}>
                            Dodaj numer
                        </Button>
                    </Box>
                    {phoneStatus && (
                        <Alert severity={phoneStatus.type} sx={{ mt: 2 }} onClose={() => setPhoneStatus(null)}>
                            {phoneStatus.message}
                        </Alert>
                    )}
                </SectionCard>
            </Box>
        </Layout>
    );
};

export default Settings;
