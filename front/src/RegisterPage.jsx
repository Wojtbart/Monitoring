import { useState } from "react";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import {
    Box, TextField, Button, Typography, FormControlLabel,
    Checkbox, Alert, Divider, InputAdornment, IconButton, LinearProgress,
} from "@mui/material";
import Card from "@mui/material/Card";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const PASSWORD_RULES = [
    { test: p => p.length >= 8,          label: "min. 8 znaków" },
    { test: p => /[A-Z]/.test(p),        label: "wielka litera" },
    { test: p => /[a-z]/.test(p),        label: "mała litera" },
    { test: p => /[0-9]/.test(p),        label: "cyfra" },
    { test: p => /[^A-Za-z0-9]/.test(p), label: "znak specjalny" },
];

const getStrength = (p) => PASSWORD_RULES.filter(r => r.test(p)).length;

const STRENGTH_LABELS = ["", "Bardzo słabe", "Słabe", "Średnie", "Silne", "Bardzo silne"];
const STRENGTH_COLORS = ["", "#f44336", "#ff9800", "#ffc107", "#4caf50", "#2e7d32"];

const RegisterPage = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    const strength = getStrength(password);
    const passedRules = PASSWORD_RULES.filter(r => r.test(password));
    const failedRules = PASSWORD_RULES.filter(r => !r.test(password));
    const passwordValid = strength === PASSWORD_RULES.length;

    const handleRegister = async () => {
        if (!username.trim() || !password.trim()) {
            setStatus({ type: "error", message: "Wypełnij wszystkie pola." });
            return;
        }
        if (!passwordValid) {
            setStatus({ type: "error", message: `Hasło nie spełnia wymagań: ${failedRules.map(r => r.label).join(", ")}.` });
            return;
        }
        setLoading(true);
        setStatus(null);
        try {
            await axios.post(`${API_BASE}/register`, { username, password, isAdmin });
            setStatus({ type: "success", message: `Użytkownik "${username}" został dodany.` });
            setUsername("");
            setPassword("");
            setIsAdmin(false);
        } catch (error) {
            setStatus({ type: "error", message: error.response?.data?.message || "Błąd serwera." });
        }
        setLoading(false);
    };

    return (
        <Layout>
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "flex-start", pt: 4 }}>
                <Card sx={{ width: 420, borderRadius: 3, overflow: "hidden", boxShadow: 4 }}>

                    {/* Header */}
                    <Box sx={{
                        bgcolor: "#1a237e", px: 4, py: 3,
                        display: "flex", alignItems: "center", gap: 1.5,
                    }}>
                        <PersonAddIcon sx={{ color: "white", fontSize: "1.8rem" }} />
                        <Box>
                            <Typography variant="h6" fontWeight="bold" color="white">
                                Dodaj użytkownika
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#9fa8da" }}>
                                Tylko administrator może dodawać konta
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ px: 4, py: 3, display: "flex", flexDirection: "column", gap: 2 }}>

                        {status && (
                            <Alert
                                severity={status.type}
                                icon={status.type === "success" ? <CheckCircleIcon /> : undefined}
                                onClose={() => setStatus(null)}
                            >
                                {status.message}
                            </Alert>
                        )}

                        <TextField
                            label="Nazwa użytkownika"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            fullWidth
                            size="small"
                            autoFocus
                            autoComplete="off"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <PersonIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <TextField
                            label="Hasło"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            type={showPassword ? "text" : "password"}
                            fullWidth
                            size="small"
                            autoComplete="new-password"
                            onKeyDown={e => e.key === "Enter" && handleRegister()}
                            error={password.length > 0 && !passwordValid}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <LockIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setShowPassword(p => !p)} edge="end">
                                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {password.length > 0 && (
                            <Box sx={{ mt: -1 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                                    <LinearProgress
                                        variant="determinate"
                                        value={(strength / PASSWORD_RULES.length) * 100}
                                        sx={{
                                            flex: 1, height: 6, borderRadius: 3,
                                            bgcolor: "#e0e0e0",
                                            "& .MuiLinearProgress-bar": { bgcolor: STRENGTH_COLORS[strength] },
                                        }}
                                    />
                                    <Typography variant="caption" sx={{ color: STRENGTH_COLORS[strength], fontWeight: "bold", minWidth: 90 }}>
                                        {STRENGTH_LABELS[strength]}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                    {PASSWORD_RULES.map(rule => {
                                        const ok = rule.test(password);
                                        return (
                                            <Typography key={rule.label} variant="caption" sx={{
                                                color: ok ? "#2e7d32" : "#9e9e9e",
                                                fontSize: "0.68rem",
                                                display: "flex", alignItems: "center", gap: 0.25,
                                            }}>
                                                {ok ? "✓" : "○"} {rule.label}
                                            </Typography>
                                        );
                                    })}
                                </Box>
                            </Box>
                        )}

                        <Divider />

                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={isAdmin}
                                    onChange={e => setIsAdmin(e.target.checked)}
                                    color="warning"
                                />
                            }
                            label={
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                    <AdminPanelSettingsIcon fontSize="small" color={isAdmin ? "warning" : "disabled"} />
                                    <Typography variant="body2" color={isAdmin ? "warning.main" : "text.secondary"} fontWeight={isAdmin ? "bold" : "normal"}>
                                        Uprawnienia administratora
                                    </Typography>
                                </Box>
                            }
                        />

                        {isAdmin && (
                            <Alert severity="warning" sx={{ py: 0.5 }}>
                                Administrator ma dostęp do wszystkich funkcji systemu.
                            </Alert>
                        )}

                        <Button
                            variant="contained"
                            fullWidth
                            onClick={handleRegister}
                            disabled={loading}
                            startIcon={<PersonAddIcon />}
                            sx={{ py: 1.2, fontWeight: "bold", bgcolor: "#1a237e", "&:hover": { bgcolor: "#283593" } }}
                        >
                            {loading ? "Dodawanie..." : "Dodaj użytkownika"}
                        </Button>
                    </Box>
                </Card>
            </Box>
        </Layout>
    );
};

export default RegisterPage;
