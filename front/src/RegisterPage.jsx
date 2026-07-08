import { useState } from "react";
import axios from "axios";
import Layout from "./Layout";
import {
    Box,
    TextField,
    Button,
    Typography,
    FormLabel,
    FormControl,
    FormGroup,
    FormControlLabel,
    Checkbox,
} from "@mui/material";
import Card from "@mui/material/Card";

const RegisterPage = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    const handleInputChange = (setter) => (event) => {
        setter(event.target.value);
    };

    const handleChange = (event) => {
        setIsAdmin(event.target.checked);
    };

    const handleRegister = async () => {
        try {
            const response = await axios.post(
                "http://192.168.0.150:5000/register",
                {
                    username,
                    password,
                    isAdmin,
                }
            );
            console.log("Response: ", response.data);
            alert("Użytkownik został dodany");
        } catch (error) {
            console.error("Error: ", error);
            alert(error.response.data.message);
        }
    };

    return (
        <Layout>
            <Card
                sx={{
                    width: "30vw",
                    margin: "10px auto",
                    borderRadius: "20px",
                    p: 5,
                    textAlign: "center",
                }}
            >
                <Typography
                    component="h2"
                    variant="h4"
                    sx={{
                        borderRadius: "30px",
                        fontSize: "48px",
                        color: "black",
                        mb: 5,
                        fontWeight: 700,
                        textDecoration: "underline",
                        textDecorationColor: "gold",
                    }}
                >
                    DODAJ UŻYTKOWNIKA
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
                >
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <FormLabel
                            htmlFor="username"
                            sx={{ color: "white", mb: 1, textAlign: "left" }}
                        ></FormLabel>
                        <TextField
                            required
                            id="username"
                            variant="outlined"
                            placeholder="Wpisz nazwę użytkownika"
                            label="Nazwa użytkownika"
                            onChange={handleInputChange(setUsername)}
                            margin="normal"
                            autoFocus
                            InputLabelProps={{ style: { fontSize: 13 } }}
                        />
                        <FormLabel
                            htmlFor="password"
                            sx={{ color: "white", mb: 1, textAlign: "left" }}
                        ></FormLabel>
                        <TextField
                            required
                            id="password"
                            variant="outlined"
                            placeholder="Wpisz hasło"
                            label="Hasło"
                            onChange={handleInputChange(setPassword)}
                            margin="normal"
                            InputLabelProps={{ style: { fontSize: 13 } }}
                        />
                    </FormControl>

                    <FormGroup>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={isAdmin}
                                    onChange={handleChange}
                                />
                            }
                            label="Uprawnienia admininistratora"
                        />
                    </FormGroup>
                    <Button
                        fullWidth
                        variant="contained"
                        type="button"
                        onClick={handleRegister}
                        sx={{
                            width: "40%",
                            padding: "0.75rem",
                            fontSize: "18px",
                            borderRadius: "20px",
                            backgroundColor: "white",
                            color: "#05070A",
                            border: "2px solid #05070A",
                            mb: 3,
                            transition: ".2s",
                            "&:hover": {
                                backgroundColor: "#1A1D21",
                                color: "orange",
                                borderColor: "#FFD700",
                            },
                        }}
                    >
                        Dodaj użytkownika
                    </Button>
                </Box>
            </Card>
        </Layout>
    );
};

export default RegisterPage;
