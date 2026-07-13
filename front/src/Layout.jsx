/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AdminProvider } from "./AdminContext";
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
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import MapIcon from '@mui/icons-material/Map';
import DnsIcon from '@mui/icons-material/Dns';
import HomeIcon from "@mui/icons-material/Home";
import "./Layout.css";

const Layout = ({ children }) => {
    const accessToken = localStorage.getItem("JWT");

    const [openMenu, setOpenMenu] = React.useState(false);
    const [username, setUsername] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const navigate = useNavigate();
    const theme = useTheme();

    const handleLogout = () => {
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
                        `${API_BASE}/userInfo`,
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
        navigate("/home");
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

    const handleDiagram = () => {
        navigate("/diagram");
    };

    const handleRack = () => {
        navigate("/rack");
    };

    const handleFloorPlan = () => {
        navigate("/rzut");
    };

    const handleRegister = () => {
        if (isAdmin) {
            navigate("/registerPage");
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
            <AdminProvider value={isAdmin}>
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
                                <ListItemButton onClick={handleFloorPlan}>
                                    <ListItemIcon><MapIcon /></ListItemIcon>
                                    <ListItemText primary="Rzut serwerowni" />
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
            </AdminProvider>
        </>
    );
};

export default Layout;
