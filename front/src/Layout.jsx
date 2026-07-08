/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AdminProvider } from "./AdminContext";
import axios from "axios";
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Container,
    Box,
    Drawer,
    List,
    ListItem,
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
                        "http://192.168.0.150:5000/userInfo",
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
        navigate("/");
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
                                <ListItem
                                    button
                                    onClick={handleHome}
                                    sx={{ cursor: "pointer" }}
                                >
                                    <ListItemIcon>
                                        <HomeIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Strona główna" />
                                </ListItem>
                                <ListItem
                                    button
                                    onClick={handleSavedVideos}
                                    sx={{ cursor: "pointer" }}
                                >
                                    <ListItemIcon>
                                        <SaveAltIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Zapisane wideo" />
                                </ListItem>
                                <ListItem
                                    button
                                    onClick={handleCamera}
                                    sx={{ cursor: "pointer" }}
                                >
                                    <ListItemIcon>
                                        <VideocamIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Widok z kamery" />
                                </ListItem>
                                <ListItem
                                    button
                                    onClick={handleSettings}
                                    sx={{ cursor: "pointer" }}
                                >
                                    <ListItemIcon>
                                        <SettingsIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Ustawienia systemu" />
                                </ListItem>
                                <ListItem
                                    button
                                    onClick={handleRegister}
                                    sx={{ cursor: "pointer" }}
                                >
                                    <ListItemIcon>
                                        <PersonAddIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Dodaj użytkownika" />
                                </ListItem>
                                <ListItem
                                    button
                                    onClick={handleLogs}
                                    sx={{ cursor: "pointer" }}
                                >
                                    <ListItemIcon>
                                        <NewspaperIcon />
                                    </ListItemIcon>
                                    <ListItemText primary="Logi z systemu" />
                                </ListItem>
                                <ListItem
                                    button
                                    onClick={handleDiagram}
                                    sx={{ cursor: "pointer" }}
                                >
                                    <ListItemIcon>
                                        <AccountTreeIcon/>
                                    </ListItemIcon>
                                    <ListItemText primary="Mapa podłączeń" />
                                </ListItem>
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
                            backgroundColor: "#031322",
                        }}
                        className="footer"
                    >
                        <Typography variant="body2" color="white">
                            2024 Monitoring System
                        </Typography>
                    </Box>
                </div>
            </AdminProvider>
        </>
    );
};

export default Layout;
