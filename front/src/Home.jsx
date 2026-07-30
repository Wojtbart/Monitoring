import { useState } from "react";
import axios from "axios";
import { API_BASE } from "./api";
import {
    Typography, TextField, Button, FormHelperText, FormControl,
    Card, Box,
} from "@mui/material";
import Layout from "./Layout";
import "./Home.css";

const Home = () => {
    const accessToken = localStorage.getItem("JWT");
    const [pingAddress, setPingAddress] = useState("");
    const [pingResponses, setPingResponses] = useState([]);
    const [pinging, setPinging] = useState(false);

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

    return (
        <Layout>
            <Box sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
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
