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
    Divider,
    Typography,
    Grid,
    Paper,
} from "@mui/material";
import Chip from "@mui/material/Chip";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Card from "@mui/material/Card";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AccessAlarmOutlinedIcon from "@mui/icons-material/AccessAlarmOutlined";
import BedtimeOutlinedIcon from "@mui/icons-material/BedtimeOutlined";
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

const Settings = () => {
    const acccesToken = localStorage.getItem("JWT");
    const navigate = useNavigate();
    const [id, setId] = useState(0);
    const [timeForStopRecording, setTimeForStopRecording] = useState(0);
    const [morningTimeTest, setMorningTimeTest] = useState(
        dayjs().hour(0).minute(0)
    );
    const [eveningTimeTest, setEveningTimeTest] = useState(
        dayjs().hour(0).minute(0)
    );
    const [phoneNumbers, setPhoneNumbers] = useState([]);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [shouldUpdateSettings, setShouldUpdateSettings] = useState(false);
    const [shouldUpdatePhoneNumbers, setShouldUpdatePhoneNumbers] =
        useState(false);

    const [savedTimeForStopRecording, setSavedTimeForStopRecording] =
        useState(0);
    const [savedMorningTimeTest, setSavedMorningTimeTest] = useState(
        dayjs().hour(0).minute(0)
    );
    const [savedEveningTimeTest, setSavedEveningTimeTest] = useState(
        dayjs().hour(0).minute(0)
    );

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

    const zeroAM = dayjs().set("hour", 0).startOf("hour");
    const tvelveAm = dayjs().set("hour", 12).startOf("hour");

    const handleBackToHome = async () => {
        navigate("/");
    };

    const addPhoneNumber = async () => {
        try {
            const response = await axios.post(
                `${API_BASE}/phone-numbers`,
                {
                    phone_number: phoneNumber,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${acccesToken}`,
                    },
                }
            );
            console.log(response.data);
            return response.data;
        } catch (error) {
            console.error("Error: ", error);
        }
    };

    const saveSettings = async () => {
        try {
            const response = await axios.put(
                `${API_BASE}/settings`,
                {
                    id: id,
                    recording_seconds: timeForStopRecording,
                    morning_test_time:
                        dayjs(morningTimeTest).format("HH:mm:ss"),
                    evening_test_time:
                        dayjs(eveningTimeTest).format("HH:mm:ss"),
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${acccesToken}`,
                    },
                }
            );
            console.log(response.data);
            return response.data;
        } catch (error) {
            console.error("Error: ", error);
        }
    };

    const fetchSettingsAndPhoneNumbers = async () => {
        try {
            const response = await axios.get(
                `${API_BASE}/settings-and-phone-numbers`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${acccesToken}`,
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error("Error: ", error);
        }
    };

    useEffect(() => {
        if (acccesToken === null) {
            navigate("/loginPage");
            return;
        } else {
            const getSettings = async () => {
                const response = await fetchSettingsAndPhoneNumbers();
                if (response) {
                    const settings = response.settings[0];
                    setPhoneNumbers(response.phone_numbers);
                    setId(settings.id);
                    setSavedTimeForStopRecording(settings.recording_seconds);
                    setSavedMorningTimeTest(
                        dayjs(settings.morning_test_time, "HH:mm:ss")
                    );
                    setSavedEveningTimeTest(
                        dayjs(settings.evening_test_time, "HH:mm:ss")
                    );
                    setIsDataLoading(false);
                }
            };
            getSettings();
        }
    }, []);

    const deleteNumber = async (phoneNumber) => {
        try {
            const response = await axios.delete(
                `${API_BASE}/phone-numbers/${encodeURIComponent(phoneNumber)}`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${acccesToken}`,
                    },
                }
            );
            console.log(response.data);
            return response.data;
        } catch (error) {
            console.error("Error: ", error);
        }
    };

    const fetchPhoneNumbers = async () => {
        try {
            const response = await axios.get(
                `${API_BASE}/phone-numbers`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${acccesToken}`,
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error("Error: ", error);
        }
    };

    const fetchSettings = async () => {
        try {
            const response = await axios.get(
                `${API_BASE}/settings`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${acccesToken}`,
                    },
                }
            );
            return response.data.settings[0];
        } catch (error) {
            console.error("Error: ", error);
        }
    };

    useEffect(() => {
        if (shouldUpdatePhoneNumbers) {
            const getPhoneNumbers = async () => {
                const response = await fetchPhoneNumbers();

                if (response) {
                    setPhoneNumbers(response.phone_numbers);
                }
            };
            getPhoneNumbers();
            setShouldUpdatePhoneNumbers(false);
        }
    }, [shouldUpdatePhoneNumbers]);

    useEffect(() => {
        if (shouldUpdateSettings) {
            const getSettings = async () => {
                const response = await fetchSettings();
                if (response) {
                    setSavedTimeForStopRecording(response.recording_seconds);
                    setSavedMorningTimeTest(
                        dayjs(response.morning_test_time, "HH:mm:ss")
                    );
                    setSavedEveningTimeTest(
                        dayjs(response.evening_test_time, "HH:mm:ss")
                    );
                }
            };
            getSettings();
            setShouldUpdateSettings(false);
        }
    }, [shouldUpdateSettings]);

    const listOfPhoneNumbers = phoneNumbers.map((number) => (
        <Typography key={number} sx={{ py: 2 }}>
            <span style={{ fontWeight: "bold" }}>{number} </span>
            <Button
                variant="contained"
                color="error"
                onClick={() => {
                    const userConfirmed = window.confirm(
                        "Czy na pewno chcesz usunąć ten numer: " + number + " ?"
                    );
                    if (userConfirmed) {
                        deleteNumber(number);
                        setShouldUpdatePhoneNumbers(true);
                    }
                }}
                startIcon={<DeleteIcon />}
            >
                {" "}
                Usuń
            </Button>
        </Typography>
    ));

    return (
        <Layout>
            <Box>
                <Card
                    variant="outlined"
                    sx={{
                        padding: 2,
                        margin: "auto",
                        marginTop: 2,
                        borderRadius: 2,
                        marginBottom: 2,
                    }}
                >
                    <Typography variant="h3" gutterBottom>
                        Bieżące ustawienia
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={handleBackToHome}
                        sx={{ marginBottom: 2 }}
                    >
                        <ArrowBackIcon></ArrowBackIcon> Strona główna
                    </Button>

                    {isDataLoading ? (
                        <Typography>Ładowanie...</Typography>
                    ) : (
                        <div>
                            <Grid container spacing={3}>
                                <Grid item xs={5}>
                                    <AccessTimeIcon
                                        sx={{
                                            color: "black",
                                            verticalAlign: "bottom",
                                        }}
                                    />
                                    <span style={{ fontWeight: "bold" }}>
                                        {" "}
                                        Czas
                                    </span>{" "}
                                    do zatrzymania nagrywania:{" "}
                                    <Typography variant="h5">
                                        {savedTimeForStopRecording} s
                                    </Typography>
                                </Grid>
                                <Grid item xs={5}>
                                    <AccessAlarmOutlinedIcon
                                        sx={{
                                            color: "black",
                                            verticalAlign: "bottom",
                                        }}
                                    />
                                    <span style={{ fontWeight: "bold" }}>
                                        {" "}
                                        Godzina
                                    </span>{" "}
                                    testu porannego:{" "}
                                    <Typography variant="h5">
                                        {savedMorningTimeTest.format("HH:mm")}
                                    </Typography>
                                </Grid>

                                <Grid item xs={5}>
                                    <BedtimeOutlinedIcon
                                        sx={{
                                            color: "black",
                                            verticalAlign: "bottom",
                                        }}
                                    />
                                    <span style={{ fontWeight: "bold" }}>
                                        {" "}
                                        Godzina
                                    </span>{" "}
                                    testu wieczornego:{" "}
                                    <Typography variant="h5">
                                        {savedEveningTimeTest.format("HH:mm")}
                                    </Typography>
                                </Grid>

                                <Grid item xs={5}>
                                    <LocalPhoneOutlinedIcon
                                        sx={{
                                            color: "purple",
                                            verticalAlign: "bottom",
                                        }}
                                    ></LocalPhoneOutlinedIcon>
                                    Numery telefonów:{" "}
                                    {listOfPhoneNumbers || "Brak numerów"}
                                </Grid>
                            </Grid>
                        </div>
                    )}
                </Card>

                <Card
                    variant="outlined"
                    sx={{
                        padding: 2,
                        margin: "auto",
                        marginTop: 2,
                        borderRadius: 2,
                        marginBottom: 2,
                    }}
                >
                    <Typography variant="h5" gutterBottom>
                        Monitoring środowiskowy serwerowni
                    </Typography>
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
                </Card>

                <Paper
                    elevation={5}
                    sx={{
                        padding: 2,
                        margin: "auto",
                        marginTop: 2,
                        borderRadius: 2,
                        marginBottom: 2,
                    }}
                >
                    <Typography variant="h5" gutterBottom>
                        Ustaw parametry
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={3}>
                            <TextField
                                label="Czas do zatrzymania nagrywania (s)"
                                type="number"
                                onChange={(e) =>
                                    setTimeForStopRecording(e.target.value)
                                }
                                margin="normal"
                                InputLabelProps={{ style: { fontSize: 10 } }}
                            />
                        </Grid>

                        <Grid
                            item
                            xs={3}
                            sx={{ display: "flex", alignItems: "center" }}
                        >
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <TimePicker
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                    }}
                                    label="Godzina testu porannego"
                                    minTime={zeroAM}
                                    maxTime={dayjs().hour(12).minute(0)}
                                    onChange={(time) =>
                                        setMorningTimeTest(time)
                                    }
                                    ampm={false}
                                    margin="normal"
                                    InputLabelProps={{
                                        style: { fontSize: 13 },
                                    }}
                                />
                            </LocalizationProvider>
                        </Grid>

                        <Grid
                            item
                            xs={3}
                            sx={{ display: "flex", alignItems: "center" }}
                        >
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <TimePicker
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                    }}
                                    inputFormat="HH:mm:ss"
                                    label="Godzina testu wieczornego"
                                    minTime={tvelveAm}
                                    maxTime={dayjs().hour(23).minute(59)}
                                    onChange={(time) =>
                                        setEveningTimeTest(time)
                                    }
                                    ampm={false}
                                    InputLabelProps={{
                                        style: { fontSize: 13 },
                                    }}
                                />
                            </LocalizationProvider>
                        </Grid>
                    </Grid>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => {
                            saveSettings();
                            setShouldUpdateSettings(true);
                        }}
                        sx={{ marginBottom: 2 }}
                    >
                        Zapisz dane
                    </Button>
                    <Divider>
                        <Chip label="Numery telefonów" size="small" />
                    </Divider>

                    <TextField
                        label="Numer telefonu"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        fullWidth
                        margin="normal"
                        id="phone"
                        name="phone"
                    />
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => {
                            if (phoneNumber) {
                                setPhoneNumber("");
                                addPhoneNumber();
                                setShouldUpdatePhoneNumbers(true);
                            }
                        }}
                    >
                        Dodaj numer telefonu do listy
                    </Button>
                </Paper>
            </Box>
        </Layout>
    );
};
export default Settings;
