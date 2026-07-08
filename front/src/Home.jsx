import { useState, useEffect } from "react";
import axios from "axios";
import {
    Typography,
    Grid,
    FormControl,
    FormLabel,
    TextField,
    Button,
    OutlinedInput,
    InputLabel,
    FormHelperText,
} from "@mui/material";
import Card from "@mui/material/Card";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import GasMeterIcon from "@mui/icons-material/GasMeter";
import PersonIcon from "@mui/icons-material/Person";
import WaterIcon from "@mui/icons-material/Water";
import SensorDoorIcon from "@mui/icons-material/SensorDoor";
import Layout from "./Layout";
import "./Home.css";

// korzystałem z tego https://mui.com/material-ui/react-drawer/

const Home = () => {
    const accessToken = localStorage.getItem("JWT");
    const [temperature, setTemperature] = useState(0);
    const [humidity, setHumidity] = useState(0);
    const [moution, setMoution] = useState(false);
    const [fire, setFire] = useState(false);
    const [gas, setGas] = useState(false);
    const [door, setDoor] = useState(false);
    const [water, setWater] = useState(false);
    const [responseFromPing, setResponseFromPing] = useState("");
    const [pingAddress, setPingAddress] = useState("");

    const setRealTimeData = (e) => {
        setTemperature(e.temperature);
        setHumidity(e.humidity);
        setMoution(e.motion);
        setFire(e.fire);
        setGas(e.gas);
        setDoor(e.door);
        setWater(e.water);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(
                    "http://192.168.0.150:5000/realTimeData"
                );
                console.log(response.data);
                setRealTimeData(response.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        const interval = setInterval(fetchData, 5000);
        fetchData();

        return () => clearInterval(interval);
    }, []);

    const ping = async () => {
        try {
            const response = await axios.get(
                `http://192.168.0.150:5000/ping/${pingAddress}`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );
            console.log(response.data.message);
            setResponseFromPing(response.data.message);
        } catch (error) {
            console.log("cos sie zdupiło w ping");
            console.log(error);
        }
    };

    return (
        <Layout>
            <Card
                variant="outlined"
                sx={{
                    padding: 2,
                    margin: "0 auto",
                    marginTop: 2,
                    borderRadius: 4,
                    marginBottom: 2,
                    backgroundColor: "#faf2f9",
                    width: "70%",
                }}
            >
                <Typography
                    variant="h4"
                    gutterBottom
                    sx={{ marginBottom: "25px" }}
                >
                    Monitoring środowiskowy serwerowni
                </Typography>
                <Grid container spacing={3}>
                    <Grid item md={4}>
                        <ThermostatIcon
                            sx={{
                                color: "red",
                                verticalAlign: "bottom",
                            }}
                        />
                        <span style={{ fontWeight: "bold" }}>Temperatura:</span>{" "}
                        <Typography variant="h5">{temperature} °C</Typography>
                    </Grid>

                    <Grid item md={4}>
                        <WaterDropIcon
                            sx={{
                                color: "blue",
                                verticalAlign: "bottom",
                            }}
                        />
                        <span style={{ fontWeight: "bold" }}>Wilgotność:</span>{" "}
                        <Typography variant="h5">{humidity} %</Typography>
                    </Grid>

                    <Grid item md={4}>
                        <PersonIcon
                            sx={{
                                color: "green",
                                verticalAlign: "bottom",
                            }}
                        />
                        <span style={{ fontWeight: "bold" }}>
                            Ruch w pomieszczeniu:
                        </span>{" "}
                        <Typography
                            variant="h5"
                            sx={{ color: moution ? "red" : "inherit" }}
                        >
                            {moution ? "Wykryto" : "Brak"}
                        </Typography>
                    </Grid>

                    <Grid item md={4}>
                        <LocalFireDepartmentIcon
                            sx={{
                                color: "orange",
                                verticalAlign: "bottom",
                            }}
                        />
                        <span style={{ fontWeight: "bold" }}>Pożar:</span>{" "}
                        <Typography
                            variant="h5"
                            sx={{ color: fire ? "red" : "inherit" }}
                        >
                            {fire ? "Wykryto" : "Brak"}
                        </Typography>
                    </Grid>
                    <Grid item md={4}>
                        <GasMeterIcon
                            sx={{
                                color: "gray",
                                verticalAlign: "bottom",
                            }}
                        />
                        <span style={{ fontWeight: "bold" }}>
                            Czujnik dymu:
                        </span>{" "}
                        <Typography
                            variant="h5"
                            sx={{ color: gas ? "red" : "inherit" }}
                        >
                            {gas ? "Wykryto" : "Brak"}
                        </Typography>
                    </Grid>

                    <Grid item md={4}>
                        <SensorDoorIcon
                            sx={{
                                color: "brown",
                                verticalAlign: "bottom",
                            }}
                        />
                        <span style={{ fontWeight: "bold" }}>
                            Drzwi wejściowe:
                        </span>{" "}
                        <Typography
                            variant="h5"
                            sx={{ color: door ? "red" : "inherit" }}
                        >
                            {door ? "Otwarte" : "Zamknięte"}
                        </Typography>
                    </Grid>
                    <Grid item md={4}>
                        <WaterIcon
                            sx={{
                                color: "blue",
                                verticalAlign: "bottom",
                            }}
                        />
                        <span style={{ fontWeight: "bold" }}>Woda:</span>{" "}
                        <Typography
                            variant="h5"
                            sx={{ color: water ? "red" : "inherit" }}
                        >
                            {water ? "Wykryto" : "Brak"}
                        </Typography>
                    </Grid>
                </Grid>
            </Card>

            <Card
                variant="outlined"
                sx={{
                    padding: 2,
                    margin: "0 auto",
                    marginTop: 2,
                    borderRadius: 4,
                    marginBottom: 2,
                    width: "70%",
                }}
            >
                <Typography subtitle1="h2" gutterBottom>
                    Test urządzenia
                </Typography>
                <FormControl>
                    <TextField
                        label="Adres IP"
                        variant="outlined"
                        onChange={(e) => setPingAddress(e.target.value)}
                    />
                    <FormHelperText id="my-helper-text">
                        Test urządzenia w sieci lokalnej lub zewnętrznej.
                    </FormHelperText>

                    <Button
                        variant="contained"
                        onClick={ping}
                        sx={{ marginBottom: 2, marginTop: 2 }}
                    >
                        Ping
                    </Button>
                </FormControl>

                <Typography variant="h6" sx={{ color: "black" }}>
                    Odpowiedź:{" "}
                    <span style={{ color: "red" }}>{responseFromPing}</span>
                </Typography>
            </Card>
        </Layout>
    );
};

export default Home;
