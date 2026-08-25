/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Container,
    Box,
    Drawer,
    List,
    ListItemButton,
    ListItemText,
    IconButton,
} from "@mui/material";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import { styled, useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsIcon from "@mui/icons-material/Settings";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import VideocamIcon from "@mui/icons-material/Videocam";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import HomeIcon from "@mui/icons-material/Home";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import "./Layout.css";

const Layout = ({ children }) => {
    const accessToken = localStorage.getItem("JWT");

    const [openMenu, setOpenMenu] = React.useState(false);
    const [username, setUsername] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [now, setNow] = useState(new Date());
    const [uptimeSeconds, setUptimeSeconds] = useState(null);
    const [voltage, setVoltage] = useState(null);
    const navigate = useNavigate();
    const theme = useTheme();

    useEffect(() => {
        const iv = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/real-time-data`);
                setUptimeSeconds(data.uptime_seconds);
                setVoltage(data.voltage);
            } catch (_) {}
        };
        fetchStatus();
        const iv = setInterval(fetchStatus, 5000);
        return () => clearInterval(iv);
    }, []);

    const formatUptime = (seconds) => {
        if (seconds == null) return "—";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours} godz ${minutes} min`;
    };

    const handleLogout = async () => {
        try {
            await axios.post(`${API_BASE}/logout`, {}, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
        } catch (_) {}
        localStorage.removeItem("JWT");
        navigate("/loginPage");
    };

    useEffect(() => {
        if (accessToken === null) {
            navigate("/loginPage");
        } else {
            const fetchUser = async () => {
                try {
                    const response = await axios.get(
                        `${API_BASE}/users/me`,
                        {
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${accessToken}`,
                            },
                        }
                    );
                    return response.data;
                } catch (error) {
                    console.error("Error:", error);
                    navigate("/loginPage");
                }
            };
            const getUser = async () => {
                const result = await fetchUser();
                setUsername(result.currentUser);
                setIsAdmin(result.isAdmin);
            };
            getUser();
        }
    }, []);

    const toggleDrawer = (open) => () => {
        setOpenMenu(open);
    };

    const handleHome = async () => {
        navigate("/testDevice");
    };

    const handleCamera = async () => {
        navigate("/camera");
    };
    const handleSavedVideos = () => {
        navigate("/savedVideos");
    };

    const handleSettings = () => {
        if (isAdmin) {
            navigate("/settings");
        } else {
            alert("Nie masz uprawnień do tej zakładki");
        }
    };

    const handleLogs = () => {
        navigate("/logs");
    };

    const handleHelp = () => {
        navigate("/pomoc");
    };

    const handleRegister = () => {
        if (isAdmin) {
            navigate("/registerUser");
        } else {
            alert("Nie masz uprawnień do tej zakładki");
        }
    };

    const DrawerHeader = styled("div")(({ theme }) => ({
        display: "flex",
        alignItems: "center",
        ...theme.mixins.toolbar,
        justifyContent: "center",
    }));

    return (
        <>
            <div className="containerBox">
                    <AppBar position="static" className="header">
                        <Toolbar>
                            <IconButton
                                edge="start"
                                width="10px"
                                aria-label="menu"
                                onClick={toggleDrawer(true)}
                            >
                                <MenuIcon />
                            </IconButton>
                            <Typography
                                variant="h6"
                                component="div"
                                sx={{ flexGrow: 1, textAlign: "left" }}
                            >
                                <Link to="/">MONITORING SYSTEM</Link>
                            </Typography>
                            <div className="loggedAs">
                                <Typography variant="body1">
                                    Zalogowany jako:{" "}
                                    <span className="loggedUser">
                                        {username || "---"}
                                    </span>
                                </Typography>
                            </div>
                            <Button
                                onClick={handleLogout}
                                variant="contained"
                                color="error"
                            >
                                Wyloguj
                            </Button>
                        </Toolbar>
                    </AppBar>

                    <Box sx={{
                        display: "flex", justifyContent: "flex-end", gap: 1.5,
                        px: 1.5, py: 0.125, bgcolor: "#f0f2f8", borderBottom: "1px solid #d5dae5",
                    }}>
                        <Typography sx={{ fontSize: "0.68rem" }} color="text.secondary">
                            Uptime: <strong>{formatUptime(uptimeSeconds)}</strong>
                        </Typography>
                        <Typography sx={{ fontSize: "0.68rem" }} color="text.secondary">
                            Napięcie: <strong>{voltage != null ? `${voltage}V` : "—"}</strong>
                        </Typography>
                        <Typography sx={{ fontSize: "0.68rem" }} color="text.secondary">
                            Czas: <strong>{now.toLocaleString("pl-PL")}</strong>
                        </Typography>
                    </Box>

                    <Container component="main" className="container">
                        <Drawer
                            sx={{
                                width: 240,

                                flexShrink: 0,
                                "& .MuiDrawer-paper": {
                                    width: 240,
                                    boxSizing: "border-box",
                                },
                            }}
                            variant="persistent"
                            anchor="left"
                            open={openMenu}
                        >
                            <DrawerHeader>
                                MENU
                                <IconButton onClick={toggleDrawer(false)}>
                                    {theme.direction === "ltr" ? (
                                        <ChevronLeftIcon />
                                    ) : (
                                        <ChevronRightIcon />
                                    )}
                                </IconButton>
                            </DrawerHeader>
                            <Divider />
                            <List>
                                <ListItemButton onClick={handleHome}>
                                    <ListItemIcon><HomeIcon /></ListItemIcon>
                                    <ListItemText primary="Test urządzenia" />
                                </ListItemButton>
                                <ListItemButton onClick={handleSavedVideos}>
                                    <ListItemIcon><SaveAltIcon /></ListItemIcon>
                                    <ListItemText primary="Zapisane wideo" />
                                </ListItemButton>
                                <ListItemButton onClick={handleCamera}>
                                    <ListItemIcon><VideocamIcon /></ListItemIcon>
                                    <ListItemText primary="Widok z kamery" />
                                </ListItemButton>
                                <ListItemButton onClick={handleSettings}>
                                    <ListItemIcon><SettingsIcon /></ListItemIcon>
                                    <ListItemText primary="Ustawienia systemu" />
                                </ListItemButton>
                                <ListItemButton onClick={handleRegister}>
                                    <ListItemIcon><PersonAddIcon /></ListItemIcon>
                                    <ListItemText primary="Dodaj użytkownika" />
                                </ListItemButton>
                                <ListItemButton onClick={handleLogs}>
                                    <ListItemIcon><NewspaperIcon /></ListItemIcon>
                                    <ListItemText primary="Logi z systemu" />
                                </ListItemButton>
                                <ListItemButton onClick={handleHelp}>
                                    <ListItemIcon><HelpOutlineIcon /></ListItemIcon>
                                    <ListItemText primary="Pomoc" />
                                </ListItemButton>
                            </List>
                            <Divider />
                        </Drawer>

                        <main>{children}</main>
                    </Container>

                    <Box
                        component="footer"
                        sx={{
                            py: 2,
                            textAlign: "center",
                            backgroundColor: "#0f2a4a",
                        }}
                        className="footer"
                    >
                        <Typography variant="body2" color="white">
                            {new Date().getFullYear()} Monitoring System
                        </Typography>
                    </Box>
            </div>
        </>
    );
};

export default Layout;
