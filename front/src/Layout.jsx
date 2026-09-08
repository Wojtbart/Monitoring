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
import BoltIcon from "@mui/icons-material/Bolt";
import NetworkPingIcon from "@mui/icons-material/NetworkPing";
import { useRealTimeData } from "./RealTimeDataContext";
import { useLang } from "./translation";
import "./Layout.css";

const Layout = ({ children }) => {
    const accessToken = localStorage.getItem("JWT");

    const [openMenu, setOpenMenu] = React.useState(false);
    const [username, setUsername] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [now, setNow] = useState(new Date());
    const { lang, setLang, t } = useLang();
    const navigate = useNavigate();
    const theme = useTheme();

    useEffect(() => {
        const iv = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(iv);
    }, []);

    const { uptime_seconds: uptimeSeconds = null } = useRealTimeData();

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
        navigate("/login");
    };

    useEffect(() => {
        if (accessToken === null) {
            navigate("/login");
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
                    navigate("/login");
                    return null;
                }
            };
            const getUser = async () => {
                const result = await fetchUser();
                if (!result) return;
                setUsername(result.currentUser);
                setIsAdmin(result.isAdmin);
            };
            getUser();
        }
    }, []);

    const toggleDrawer = (open) => () => {
        setOpenMenu(open);
    };

    const handleFloorPlan = () => {
        navigate("/");
    };

    const handleHome = async () => {
        navigate("/test-device");
    };

    const handleCamera = async () => {
        navigate("/camera");
    };
    const handleSavedVideos = () => {
        navigate("/saved-videos");
    };

    const handleSettings = () => {
        if (isAdmin) {
            navigate("/settings");
        } else {
            alert(t("no_permission_tab"));
        }
    };

    const handleLogs = () => {
        navigate("/logs");
    };

    const handleHelp = () => {
        navigate("/help");
    };

    const handleVoltage = () => {
        navigate("/voltage");
    };

    const handleRegister = () => {
        if (isAdmin) {
            navigate("/register-user");
        } else {
            alert(t("no_permission_tab"));
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
                                sx={{ textAlign: "left" }}
                            >
                                <Link to="/">MONITORING SYSTEM</Link>
                            </Typography>
                            <Box sx={{
                                flexGrow: 1, display: "flex", justifyContent: "center", gap: 2.5,
                            }}>
                                <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.85)" }}>
                                    {t("uptime")}: <strong>{formatUptime(uptimeSeconds)}</strong>
                                </Typography>
                                <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.85)" }}>
                                    {t("time")}: <strong>{now.toLocaleString(lang === "en" ? "en-GB" : "pl-PL")}</strong>
                                </Typography>
                            </Box>
                            <Button
                                onClick={() => setLang(lang === "pl" ? "en" : "pl")}
                                variant="outlined" size="small"
                                title="PL / EN — menu i pasek górny, reszta stron stopniowo"
                                sx={{ color: "white", borderColor: "rgba(255,255,255,0.5)", minWidth: 0, px: 1.5, mr: 2, gap: 0.5 }}
                            >
                                <span>{lang === "pl" ? "🇵🇱" : "🇬🇧"}</span> {lang.toUpperCase()}
                            </Button>
                            <div className="loggedAs">
                                <Typography variant="body1">
                                    {t("logged_as")}:{" "}
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
                                {t("logout")}
                            </Button>
                        </Toolbar>
                    </AppBar>

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
                                {t("menu")}
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
                                <ListItemButton onClick={handleFloorPlan}>
                                    <ListItemIcon><HomeIcon /></ListItemIcon>
                                    <ListItemText primary={t("nav_home")} />
                                </ListItemButton>
                                <ListItemButton onClick={handleHome}>
                                    <ListItemIcon><NetworkPingIcon /></ListItemIcon>
                                    <ListItemText primary={t("nav_test_device")} />
                                </ListItemButton>
                                <ListItemButton onClick={handleSavedVideos}>
                                    <ListItemIcon><SaveAltIcon /></ListItemIcon>
                                    <ListItemText primary={t("nav_saved_videos")} />
                                </ListItemButton>
                                <ListItemButton onClick={handleCamera}>
                                    <ListItemIcon><VideocamIcon /></ListItemIcon>
                                    <ListItemText primary={t("nav_camera")} />
                                </ListItemButton>
                                <ListItemButton onClick={handleSettings}>
                                    <ListItemIcon><SettingsIcon /></ListItemIcon>
                                    <ListItemText primary={t("nav_settings")} />
                                </ListItemButton>
                                <ListItemButton onClick={handleRegister}>
                                    <ListItemIcon><PersonAddIcon /></ListItemIcon>
                                    <ListItemText primary={t("nav_register")} />
                                </ListItemButton>
                                <ListItemButton onClick={handleLogs}>
                                    <ListItemIcon><NewspaperIcon /></ListItemIcon>
                                    <ListItemText primary={t("nav_logs")} />
                                </ListItemButton>
                                <ListItemButton onClick={handleVoltage}>
                                    <ListItemIcon><BoltIcon /></ListItemIcon>
                                    <ListItemText primary={t("nav_voltage")} />
                                </ListItemButton>
                                <ListItemButton onClick={handleHelp}>
                                    <ListItemIcon><HelpOutlineIcon /></ListItemIcon>
                                    <ListItemText primary={t("nav_help")} />
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
