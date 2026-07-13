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

const LoginPage = () => {
    const navigate = useNavigate();
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
            navigate("/rzut");
        } catch (error) {
            console.error("Error: ", error);
            alert("Niepoprawy login lub hasło");
        }
    };

    return (
        <Box
            sx={{
                width: "30vw",
                backgroundColor: "#031322",
                margin: "0 auto",
                borderRadius: "30px",
                boxShadow: "10px 14px 20px rgba(1, 1, 1, 0.8)",
                p: 5,
                textAlign: "center",
            }}
        >
            <Typography
                component="h1"
                variant="h4"
                sx={{
                    fontSize: "48px",
                    color: "white",
                    mb: 5,
                    fontWeight: 700,
                    textDecoration: "underline",
                    textDecorationColor: "gold",
                    textShadow: "1px 8px 10px rgba(66, 68, 90, 1)",
                }}
            >
                LOGOWANIE
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
                        Nazwa
                    </FormLabel>
                    <TextField
                        required
                        id="username"
                        variant="outlined"
                        placeholder="Wpisz nazwę użytkownika"
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
                        Hasło
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
                    sx={{
                        width: "30%",
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
                    }}
                >
                    Login
                </Button>
            </Box>
        </Box>
    );
};

export default LoginPage;
