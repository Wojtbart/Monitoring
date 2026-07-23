import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import "./Logs.css";

import {
    Button, InputLabel, MenuItem, FormControl, Select,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Box, Typography, Pagination,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReportIcon from "@mui/icons-material/Report";
import WarningIcon from "@mui/icons-material/Warning";

const LOGS_PER_PAGE = 20;
const REFRESH_INTERVAL = 10000;

const Logs = () => {
    const navigate = useNavigate();
    const accessToken = localStorage.getItem("JWT");

    const [logs, setLogs] = useState([]);
    const [sortType, setSortType] = useState("newest");
    const [sensorFilter, setSensorFilter] = useState("all");
    const [isAdmin, setIsAdmin] = useState(false);
    const [page, setPage] = useState(1);

    const axiosAuth = useMemo(() => axios.create({
        baseURL: API_BASE,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
    }), [accessToken]);

    useEffect(() => {
        if (!accessToken) navigate("/loginPage");
    }, [accessToken, navigate]);

    const fetchLogs = useCallback(async () => {
        try {
            const { data } = await axiosAuth.get("/logs");
            setLogs(data.logs || []);
        } catch {
            navigate("/loginPage");
        }
    }, [axiosAuth, navigate]);

    const fetchUserInfo = useCallback(async () => {
        try {
            const { data } = await axiosAuth.get("/userInfo");
            setIsAdmin(data.isAdmin || false);
        } catch {
            navigate("/loginPage");
        }
    }, [axiosAuth, navigate]);

    useEffect(() => {
        fetchUserInfo();
        fetchLogs();
        const iv = setInterval(fetchLogs, REFRESH_INTERVAL);
        return () => clearInterval(iv);
    }, [fetchLogs, fetchUserInfo]);

    const deleteLogs = async () => {
        if (!window.confirm("Czy na pewno chcesz usunąć logi?")) return;
        try {
            await axiosAuth.post("/deleteLogs");
            setLogs([]);
            setPage(1);
        } catch {
            navigate("/loginPage");
        }
    };

    const sensorOptions = useMemo(
        () => [...new Set(logs.map(l => l.sensor_name))].sort((a, b) => a.localeCompare(b)),
        [logs]
    );

    const sortedLogs = useMemo(() => {
        const bySensor = sensorFilter === "all" ? logs : logs.filter(l => l.sensor_name === sensorFilter);
        switch (sortType) {
            case "oldest":  return [...bySensor].sort((a, b) => new Date(a.log_date) - new Date(b.log_date));
            case "newest":  return [...bySensor].sort((a, b) => new Date(b.log_date) - new Date(a.log_date));
            case "warnings": return bySensor.filter(l => l.is_warning).sort((a, b) => new Date(b.log_date) - new Date(a.log_date));
            case "reports":  return bySensor.filter(l => !l.is_warning).sort((a, b) => new Date(b.log_date) - new Date(a.log_date));
            default: return bySensor;
        }
    }, [logs, sortType, sensorFilter]);

    const totalPages = Math.max(1, Math.ceil(sortedLogs.length / LOGS_PER_PAGE));
    const pageLogs = sortedLogs.slice((page - 1) * LOGS_PER_PAGE, page * LOGS_PER_PAGE);

    const handleSortChange = (e) => {
        setSortType(e.target.value);
        setPage(1);
    };

    const handleSensorFilterChange = (e) => {
        setSensorFilter(e.target.value);
        setPage(1);
    };

    return (
        <Layout>
            <Box sx={{ p: 2 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom textAlign="center">
                    Logi z systemu
                </Typography>

                {/* Toolbar */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={() => navigate("/home")}
                        startIcon={<ArrowBackIcon />}
                        sx={{ height: 36 }}
                    >
                        Strona główna
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        size="small"
                        disabled={!isAdmin}
                        onClick={deleteLogs}
                        sx={{ height: 36 }}
                    >
                        Usuń logi
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        size="small"
                        onClick={fetchLogs}
                        sx={{ height: 36 }}
                    >
                        Przeładuj logi
                    </Button>

                    <FormControl size="small" sx={{ minWidth: 200, height: 36 }}>
                        <InputLabel>Sortowanie</InputLabel>
                        <Select
                            value={sortType}
                            label="Sortowanie"
                            onChange={handleSortChange}
                            sx={{ height: 36 }}
                        >
                            <MenuItem value="newest">Data — od najnowszych</MenuItem>
                            <MenuItem value="oldest">Data — od najstarszych</MenuItem>
                            <MenuItem value="warnings">Tylko ostrzeżenia</MenuItem>
                            <MenuItem value="reports">Tylko raporty</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 200, height: 36 }}>
                        <InputLabel>Sensor</InputLabel>
                        <Select
                            value={sensorFilter}
                            label="Sensor"
                            onChange={handleSensorFilterChange}
                            sx={{ height: 36 }}
                        >
                            <MenuItem value="all">Wszystkie</MenuItem>
                            {sensorOptions.map(name => (
                                <MenuItem key={name} value={name}>{name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                        {sortedLogs.length} logów · odświeżanie co 10s
                    </Typography>
                </Box>

                {/* Table */}
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ backgroundColor: "khaki" }}>
                                <TableCell sx={{ fontWeight: "bold", width: 160 }}>Data</TableCell>
                                <TableCell sx={{ fontWeight: "bold", width: 180 }}>Nazwa sensoru</TableCell>
                                <TableCell sx={{ fontWeight: "bold", width: 80 }}>Typ logu</TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>Opis</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {pageLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                                        Brak logów
                                    </TableCell>
                                </TableRow>
                            ) : pageLogs.map((log, index) => (
                                <TableRow
                                    key={log.id}
                                    className={index % 2 ? "odd-row" : "even-row"}
                                >
                                    <TableCell sx={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{log.log_date}</TableCell>
                                    <TableCell sx={{ fontSize: "0.8rem" }}>{log.sensor_name}</TableCell>
                                    <TableCell>
                                        {log.is_warning
                                            ? <WarningIcon sx={{ color: "#ff9800", fontSize: "1.1rem", verticalAlign: "middle" }} />
                                            : <ReportIcon sx={{ color: "#f44336", fontSize: "1.1rem", verticalAlign: "middle" }} />
                                        }
                                    </TableCell>
                                    <TableCell sx={{ fontSize: "0.8rem" }}>{log.log_description}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* Pagination */}
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 2 }}>
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_, p) => setPage(p)}
                        color="primary"
                        showFirstButton
                        showLastButton
                        size="small"
                    />
                    <Typography variant="caption" color="text.secondary">
                        Strona {page} z {totalPages} · {LOGS_PER_PAGE} logów na stronę
                    </Typography>
                </Box>
            </Box>
        </Layout>
    );
};

export default Logs;
