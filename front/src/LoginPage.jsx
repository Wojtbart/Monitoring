import React, { useState } from "react";
import axios from "axios";
import { API_BASE } from "./api";
import { useNavigate } from "react-router-dom";
import {
    Box,
    TextField,
    Button,
    Typography,
    FormLabel,
    FormControl,
    Link,
} from "@mui/material";
import { useLang } from "./translation";

const LoginPage = () => {
    const navigate = useNavigate();
    const { t } = useLang();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const handleInputChange = (setter) => (event) => {
        setter(event.target.value);
    };

    const handleLogin = async (event) => {
        event.preventDefault();
        try {
            const response = await axios.post(
                `${API_BASE}/login`,
                {
                    username,
                    password,
                }
            );
            localStorage.setItem("JWT", response.data.accessToken);
            navigate("/floor-plan");
        } catch (error) {
            console.error("Error: ", error);
            // error.response brak = żądanie w ogóle nie doleciało do backendu
            // (serwer wyłączony, zły adres API, CORS) — to nie ma nic
            // wspólnego ze złym loginem/hasłem, więc nie mów że hasło złe.
            alert(error.response ? t("invalid_credentials_alert") : t("connection_error_alert"));
        }
    };

    return (
        <Box
            sx={{
                width: { xs: "90%", sm: "70%", md: "30vw" },
                maxWidth: 420,
                boxSizing: "border-box",
                backgroundColor: "#031322",
                margin: { xs: "5vh auto 0", md: "0 auto" },
                borderRadius: "30px",
                boxShadow: "10px 14px 20px rgba(1, 1, 1, 0.8)",
                p: { xs: 3, sm: 5 },
                textAlign: "center",
            }}
        >
            <Typography
                component="h1"
                variant="h4"
                sx={{
                    fontSize: { xs: "1.9rem", sm: "2.6rem", md: "3rem" },
                    color: "white",
                    mb: { xs: 3, sm: 5 },
                    fontWeight: 700,
                    textDecoration: "underline",
                    textDecorationColor: "gold",
                    textShadow: "1px 8px 10px rgba(66, 68, 90, 1)",
                }}
            >
                {t("login_title")}
            </Typography>
            <Box
                component="form"
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: "100%",
                }}
                noValidate
                autoComplete="off"
                // onSubmit={handleLogin}
            >
                <FormControl fullWidth sx={{ mb: 3 }}>
                    <FormLabel
                        htmlFor="username"
                        sx={{ color: "white", mb: 1, textAlign: "left" }}
                    >
                        {t("login_username_label")}
                    </FormLabel>
                    <TextField
                        required
                        id="username"
                        variant="outlined"
                        placeholder={t("username_placeholder")}
                        onChange={handleInputChange(setUsername)}
                        autoFocus
                        sx={{
                            backgroundColor: "#05070A",
                            input: { color: "white" },
                        }}
                    />
                </FormControl>

                <FormControl fullWidth sx={{ mb: 4 }}>
                    <FormLabel
                        htmlFor="password"
                        sx={{ color: "white", mb: 1, textAlign: "left" }}
                    >
                        {t("password_label")}
                    </FormLabel>
                    <TextField
                        required
                        id="password"
                        variant="outlined"
                        placeholder="••••••"
                        type="password"
                        onChange={handleInputChange(setPassword)}
                        sx={{
                            backgroundColor: "#05070A",
                            input: { color: "white" },
                        }}
                    />
                </FormControl>

                <Button
                    fullWidth
                    variant="contained"
                    type="submit"
                    onClick={handleLogin}
                    disabled={!username.trim() || !password.trim()}
                    sx={{
                        width: { xs: "100%", sm: "60%" },
                        padding: "0.75rem",
                        fontSize: "18px",
                        borderRadius: "20px",
                        backgroundColor: "#05070A",
                        color: "white",
                        border: "2px solid white",
                        mb: 3,
                        transition: ".2s",
                        "&:hover": {
                            backgroundColor: "#1A1D21",
                            color: "orange",
                            borderColor: "#FFD700",
                        },
                        "&.Mui-disabled": {
                            backgroundColor: "#1a1a1a",
                            color: "rgba(255,255,255,0.3)",
                            borderColor: "rgba(255,255,255,0.2)",
                        },
                    }}
                >
                    Login
                </Button>
            </Box>
        </Box>
    );
};

export default LoginPage;
