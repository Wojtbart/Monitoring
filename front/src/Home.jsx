import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "./api";
import {
    Typography, Grid, TextField, Button, FormHelperText, FormControl,
    Card, Box, Chip, Alert,
} from "@mui/material";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import GasMeterIcon from "@mui/icons-material/GasMeter";
import PersonIcon from "@mui/icons-material/Person";
import WaterIcon from "@mui/icons-material/Water";
import SensorDoorIcon from "@mui/icons-material/SensorDoor";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Layout from "./Layout";
import "./Home.css";

const TEMP_MIN = 15;
const TEMP_MAX = 35;
const HUM_MIN = 20;
const HUM_MAX = 80;

function SensorCard({ icon, label, value, isAlert, unit = "" }) {
    return (
        <Card variant="outlined" sx={{
            p: 2, borderRadius: 2, display: "flex", flexDirection: "column", gap: 0.5,
            borderColor: isAlert ? "#f44336" : "#e0e0e0",
            bgcolor: isAlert ? "#fff5f5" : "white",
            transition: "all 0.3s",
        }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ color: isAlert ? "#f44336" : "text.secondary", display: "flex" }}>
                    {icon}
                </Box>
                <Typography variant="caption" color={isAlert ? "error" : "text.secondary"} fontWeight="bold">
                    {label}
                </Typography>
            </Box>
            <Typography variant="h5" fontWeight="bold" color={isAlert ? "error" : "text.primary"}>
                {value}{unit}
            </Typography>
        </Card>
    );
}

function BooleanCard({ icon, label, value, alertLabel, okLabel }) {
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

const Home = () => {
    const accessToken = localStorage.getItem("JWT");
    const [data, setData] = useState({
        temperature: 0, humidity: 0,
        motion: false, fire: false, gas: false, door: false, water: false,
    });
    const [pingAddress, setPingAddress] = useState("");
    const [pingResponses, setPingResponses] = useState([]);
    const [pinging, setPinging] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await axios.get(`${API_BASE}/realTimeData`);
                setData(res.data);
            } catch (_) {}
        };
        fetch();
        const iv = setInterval(fetch, 5000);
        return () => clearInterval(iv);
    }, []);

    const handlePing = async () => {
        if (!pingAddress.trim()) return;
        setPinging(true);
        try {
            const res = await axios.get(`${API_BASE}/ping/${pingAddress}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setPingResponses(res.data.messages || []);
        } catch (_) {
            setPingResponses(["Błąd połączenia"]);
        }
        setPinging(false);
    };

    const criticalAlert = data.fire || data.gas || data.water;
    const tempAlert = data.temperature < TEMP_MIN || data.temperature > TEMP_MAX;
    const humAlert = data.humidity < HUM_MIN || data.humidity > HUM_MAX;

    return (
        <Layout>
            <Box sx={{ maxWidth: 900, mx: "auto", p: 2 }}>

                {criticalAlert && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        ALARM:{" "}
                        {data.fire && "🔥 Wykryto ogień  "}
                        {data.gas && "💨 Wykryto gaz/dym  "}
                        {data.water && "💧 Wykryto wodę  "}
                    </Alert>
                )}

                <Card variant="outlined" sx={{ p: 3, mb: 2, borderRadius: 3, bgcolor: "#fafafa" }}>
                    <Typography variant="h5" fontWeight="bold" gutterBottom>
                        Monitoring środowiskowy serwerowni
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={4}>
                            <SensorCard
                                icon={<ThermostatIcon />}
                                label="Temperatura"
                                value={data.temperature}
                                unit=" °C"
                                isAlert={tempAlert}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <SensorCard
                                icon={<WaterDropIcon />}
                                label="Wilgotność"
                                value={data.humidity}
                                unit=" %"
                                isAlert={humAlert}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanCard
                                icon={<PersonIcon />}
                                label="Ruch w pomieszczeniu"
                                value={data.motion}
                                alertLabel="Wykryto ruch"
                                okLabel="Brak ruchu"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanCard
                                icon={<LocalFireDepartmentIcon />}
                                label="Czujnik pożaru"
                                value={data.fire}
                                alertLabel="OGIEŃ!"
                                okLabel="Brak"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanCard
                                icon={<GasMeterIcon />}
                                label="Czujnik gazu/dymu"
                                value={data.gas}
                                alertLabel="GAZ/DYM!"
                                okLabel="Brak"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanCard
                                icon={<SensorDoorIcon />}
                                label="Drzwi wejściowe"
                                value={data.door}
                                alertLabel="Otwarte"
                                okLabel="Zamknięte"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <BooleanCard
                                icon={<WaterIcon />}
                                label="Czujnik wody"
                                value={data.water}
                                alertLabel="WODA!"
                                okLabel="Brak"
                            />
                        </Grid>
                    </Grid>
                </Card>

                <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                    <Typography variant="h6" gutterBottom>Test urządzenia (ping)</Typography>
                    <FormControl sx={{ width: "100%", maxWidth: 400 }}>
                        <TextField
                            label="Adres IP lub hostname"
                            variant="outlined"
                            size="small"
                            value={pingAddress}
                            onChange={e => setPingAddress(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handlePing()}
                        />
                        <FormHelperText>Test urządzenia w sieci lokalnej lub zewnętrznej</FormHelperText>
                        <Button
                            variant="contained"
                            onClick={handlePing}
                            disabled={pinging || !pingAddress.trim()}
                            sx={{ mt: 1, width: "fit-content" }}
                        >
                            {pinging ? "Pingowanie..." : "Ping"}
                        </Button>
                    </FormControl>
                    {pingResponses.length > 0 && (
                        <Box sx={{ mt: 2, p: 1.5, bgcolor: "#1a1a2e", borderRadius: 1 }}>
                            <Typography variant="caption" sx={{ color: "#8b949e", fontFamily: "monospace", display: "block", mb: 0.5 }}>
                                Ping {pingAddress} — 4 żądania:
                            </Typography>
                            {pingResponses.map((msg, i) => (
                                <Typography key={i} variant="body2" sx={{ color: "#4caf50", fontFamily: "monospace", fontSize: "0.78rem" }}>
                                    [{i + 1}] {msg}
                                </Typography>
                            ))}
                        </Box>
                    )}
                </Card>
            </Box>
        </Layout>
    );
};

export default Home;
