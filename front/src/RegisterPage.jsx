import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import {
    Box, TextField, Button, Typography, FormControlLabel,
    Checkbox, Alert, Divider, InputAdornment, IconButton, LinearProgress, Chip,
} from "@mui/material";
import Card from "@mui/material/Card";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import { useLang } from "./translation";

const PASSWORD_RULE_DEFS = [
    { test: p => p.length >= 8,          key: "pw_rule_min_len" },
    { test: p => /[A-Z]/.test(p),        key: "pw_rule_uppercase" },
    { test: p => /[a-z]/.test(p),        key: "pw_rule_lowercase" },
    { test: p => /[0-9]/.test(p),        key: "pw_rule_digit" },
    { test: p => /[^A-Za-z0-9]/.test(p), key: "pw_rule_special" },
];

const getStrength = (p) => PASSWORD_RULE_DEFS.filter(r => r.test(p)).length;

const STRENGTH_KEYS = ["", "strength_very_weak", "strength_weak", "strength_medium", "strength_strong", "strength_very_strong"];
const STRENGTH_COLORS = ["", "#f44336", "#ff9800", "#ffc107", "#4caf50", "#2e7d32"];

const RegisterPage = () => {
    const { t } = useLang();
    const PASSWORD_RULES = PASSWORD_RULE_DEFS.map(r => ({ ...r, label: t(r.key) }));
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);

    const [users, setUsers] = useState([]);
    const [currentUsername, setCurrentUsername] = useState(null);
    const accessToken = localStorage.getItem("JWT");

    const fetchUsers = async () => {
        try {
            const { data } = await axios.get(`${API_BASE}/users`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setUsers(data);
        } catch (_) {}
    };

    useEffect(() => {
        axios.get(`${API_BASE}/users/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        }).then(({ data }) => setCurrentUsername(data.currentUser)).catch(() => {});
        fetchUsers();
    }, []);

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(t("confirm_delete_user").replace("{u}", username))) return;
        try {
            await axios.delete(`${API_BASE}/users/${userId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            fetchUsers();
        } catch (error) {
            setStatus({ type: "error", message: error.response?.data?.message || t("user_delete_error") });
        }
    };

    const strength = getStrength(password);
    const passedRules = PASSWORD_RULES.filter(r => r.test(password));
    const failedRules = PASSWORD_RULES.filter(r => !r.test(password));
    const passwordValid = strength === PASSWORD_RULES.length;

    const handleRegister = async () => {
        if (!username.trim() || !password.trim()) {
            setStatus({ type: "error", message: t("fill_all_fields") });
            return;
        }
        if (!passwordValid) {
            setStatus({ type: "error", message: `${t("password_reqs_prefix")} ${failedRules.map(r => r.label).join(", ")}.` });
            return;
        }
        setLoading(true);
        setStatus(null);
        try {
            await axios.post(
                `${API_BASE}/users`,
                { username, password, isAdmin },
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            setStatus({ type: "success", message: t("user_added_success").replace("{u}", username) });
            setUsername("");
            setPassword("");
            setIsAdmin(false);
            fetchUsers();
        } catch (error) {
            setStatus({ type: "error", message: error.response?.data?.message || t("server_error") });
        }
        setLoading(false);
    };

    return (
        <Layout>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 4, pb: 4 }}>
                <Card sx={{ width: 420, borderRadius: 3, overflow: "hidden", boxShadow: 4 }}>

                    {/* Header */}
                    <Box sx={{
                        bgcolor: "#1a237e", px: 4, py: 3,
                        display: "flex", alignItems: "center", gap: 1.5,
                    }}>
                        <PersonAddIcon sx={{ color: "white", fontSize: "1.8rem" }} />
                        <Box>
                            <Typography variant="h6" fontWeight="bold" color="white">
                                {t("nav_register")}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#9fa8da" }}>
                                {t("admin_only_note")}
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
                            label={t("username_field")}
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
                            label={t("password_label")}
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
                                        {t(STRENGTH_KEYS[strength])}
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
                                        {t("admin_permissions_label")}
                                    </Typography>
                                </Box>
                            }
                        />

                        {isAdmin && (
                            <Alert severity="warning" sx={{ py: 0.5 }}>
                                {t("admin_warning")}
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
                            {loading ? t("adding_ellipsis") : t("nav_register")}
                        </Button>
                    </Box>
                </Card>

                <Card sx={{ width: 420, mt: 3, borderRadius: 3, overflow: "hidden", boxShadow: 4 }}>
                    <Box sx={{ bgcolor: "#1a237e", px: 4, py: 2 }}>
                        <Typography variant="h6" fontWeight="bold" color="white">
                            {t("users_header")}
                        </Typography>
                    </Box>
                    <Box sx={{ px: 2, py: 1.5 }}>
                        {users.length === 0 && (
                            <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
                                {t("no_users")}
                            </Typography>
                        )}
                        {users.map((u, i) => (
                            <Box
                                key={u.id}
                                sx={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    px: 1.5, py: 1.25, borderRadius: 2,
                                    bgcolor: i % 2 === 0 ? "transparent" : "#f7f8fc",
                                    "&:hover": { bgcolor: "#eef0fa" },
                                    transition: "background-color 0.15s",
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                    <Box sx={{
                                        width: 34, height: 34, borderRadius: "50%",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        bgcolor: u.isadmin ? "#fff3e0" : "#e8eaf6",
                                        color: u.isadmin ? "#e65100" : "#3949ab",
                                    }}>
                                        {u.isadmin ? <AdminPanelSettingsIcon fontSize="small" /> : <PersonIcon fontSize="small" />}
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" fontWeight={600}>{u.username}</Typography>
                                        <Chip
                                            label={u.isadmin ? "Admin" : t("user_badge")}
                                            size="small"
                                            sx={{
                                                height: 18, fontSize: "0.62rem", fontWeight: "bold", mt: 0.25,
                                                bgcolor: u.isadmin ? "#fff3e0" : "#eeeeee",
                                                color: u.isadmin ? "#e65100" : "#616161",
                                            }}
                                        />
                                    </Box>
                                </Box>
                                {u.username !== currentUsername ? (
                                    <IconButton
                                        size="small"
                                        onClick={() => handleDeleteUser(u.id, u.username)}
                                        sx={{ "&:hover": { bgcolor: "#fdecea" } }}
                                    >
                                        <DeleteIcon fontSize="small" color="error" />
                                    </IconButton>
                                ) : (
                                    <Box sx={{ width: 32 }} />
                                )}
                            </Box>
                        ))}
                    </Box>
                </Card>
            </Box>
        </Layout>
    );
};

export default RegisterPage;
