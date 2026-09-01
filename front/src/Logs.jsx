import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import "./Logs.css";

import {
    Button, InputLabel, MenuItem, FormControl, Select,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Box, Typography, Pagination, Checkbox, Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReportIcon from "@mui/icons-material/Report";
import WarningIcon from "@mui/icons-material/Warning";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";

const LOGS_PER_PAGE_OPTIONS = [10, 20, 30, 50];
const REFRESH_INTERVAL = 10000;

const CATEGORY_COLORS = {
    "Logowanie": "info",
    "Wylogowanie": "default",
    "System": "default",
    "Czujnik pożaru": "error",
    "Czujnik gazu": "error",
    "Czujnik wody": "warning",
    "Czujnik drzwi": "info",
};
const categoryColor = (name) => CATEGORY_COLORS[name] || "default";

const Logs = () => {
    const navigate = useNavigate();
    const accessToken = localStorage.getItem("JWT");

    const [logs, setLogs] = useState([]);
    const [sortType, setSortType] = useState("newest");
    const [sensorFilter, setSensorFilter] = useState("all");
    const [isAdmin, setIsAdmin] = useState(false);
    const [page, setPage] = useState(1);
    const [logsPerPage, setLogsPerPage] = useState(20);
    const [selectedIds, setSelectedIds] = useState([]);

    const axiosAuth = useMemo(() => axios.create({
        baseURL: API_BASE,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
    }), [accessToken]);

    useEffect(() => {
        if (!accessToken) navigate("/login");
    }, [accessToken, navigate]);

    const fetchLogs = useCallback(async () => {
        try {
            const { data } = await axiosAuth.get("/logs");
            setLogs(data.logs || []);
        } catch {
            navigate("/login");
        }
    }, [axiosAuth, navigate]);

    const fetchUserInfo = useCallback(async () => {
        try {
            const { data } = await axiosAuth.get("/users/me");
            setIsAdmin(data.isAdmin || false);
        } catch {
            navigate("/login");
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
            await axiosAuth.delete("/logs");
            setLogs([]);
            setSelectedIds([]);
            setPage(1);
        } catch {
            navigate("/login");
        }
    };

    const deleteSelectedLogs = async () => {
        if (!window.confirm(`Czy na pewno chcesz usunąć zaznaczone logi (${selectedIds.length})?`)) return;
        try {
            await axiosAuth.delete("/logs", { data: { ids: selectedIds } });
            setLogs(prev => prev.filter(l => !selectedIds.includes(l.id)));
            setSelectedIds([]);
        } catch {
            navigate("/login");
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectPage = () => {
        const pageIds = pageLogs.map(l => l.id);
        const allSelected = pageIds.every(id => selectedIds.includes(id));
        setSelectedIds(prev => allSelected
            ? prev.filter(id => !pageIds.includes(id))
            : [...new Set([...prev, ...pageIds])]);
    };

    const downloadLogs = () => {
        const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const header = ["Data", "Nazwa sensoru", "Typ", "Opis"].map(escape).join(",");
        const rows = sortedLogs.map(l => [
            l.log_date,
            l.sensor_name,
            l.is_warning ? "Ostrzeżenie" : "Raport",
            l.log_description,
        ].map(escape).join(","));
        const csv = [header, ...rows].join("\r\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `logi_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
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

    const totalPages = Math.max(1, Math.ceil(sortedLogs.length / logsPerPage));
    const pageLogs = sortedLogs.slice((page - 1) * logsPerPage, page * logsPerPage);

    const handleSortChange = (e) => {
        setSortType(e.target.value);
        setPage(1);
        setSelectedIds([]);
    };

    const handleSensorFilterChange = (e) => {
        setSensorFilter(e.target.value);
        setPage(1);
        setSelectedIds([]);
    };

    const handleLogsPerPageChange = (e) => {
        setLogsPerPage(Number(e.target.value));
        setPage(1);
        setSelectedIds([]);
    };

    const handlePageChange = (_, p) => {
        setPage(p);
        setSelectedIds([]);
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
                        onClick={() => navigate("/")}
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
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={downloadLogs}
                        disabled={sortedLogs.length === 0}
                        startIcon={<DownloadIcon />}
                        sx={{ height: 36 }}
                    >
                        Pobierz logi
                    </Button>
                    <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        disabled={!isAdmin || selectedIds.length === 0}
                        onClick={deleteSelectedLogs}
                        startIcon={<DeleteIcon />}
                        sx={{ height: 36 }}
                    >
                        Usuń zaznaczone ({selectedIds.length})
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

                    <FormControl size="small" sx={{ minWidth: 140, height: 36 }}>
                        <InputLabel>Logów na stronę</InputLabel>
                        <Select
                            value={logsPerPage}
                            label="Logów na stronę"
                            onChange={handleLogsPerPageChange}
                            sx={{ height: 36 }}
                        >
                            {LOGS_PER_PAGE_OPTIONS.map(n => (
                                <MenuItem key={n} value={n}>{n}</MenuItem>
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
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        size="small"
                                        checked={pageLogs.length > 0 && pageLogs.every(l => selectedIds.includes(l.id))}
                                        indeterminate={pageLogs.some(l => selectedIds.includes(l.id)) && !pageLogs.every(l => selectedIds.includes(l.id))}
                                        onChange={toggleSelectPage}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontWeight: "bold", width: 160 }}>Data</TableCell>
                                <TableCell sx={{ fontWeight: "bold", width: 180 }}>Nazwa sensoru</TableCell>
                                <TableCell sx={{ fontWeight: "bold", width: 80 }}>Typ logu</TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>Opis</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {pageLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                                        Brak logów
                                    </TableCell>
                                </TableRow>
                            ) : pageLogs.map((log, index) => (
                                <TableRow
                                    key={log.id}
                                    className={index % 2 ? "odd-row" : "even-row"}
                                    selected={selectedIds.includes(log.id)}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            size="small"
                                            checked={selectedIds.includes(log.id)}
                                            onChange={() => toggleSelectOne(log.id)}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{log.log_date}</TableCell>
                                    <TableCell sx={{ fontSize: "0.8rem" }}>
                                        <Chip size="small" label={log.sensor_name} color={categoryColor(log.sensor_name)} variant="outlined" />
                                    </TableCell>
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
                        onChange={handlePageChange}
                        color="primary"
                        showFirstButton
                        showLastButton
                        size="small"
                    />
                    <Typography variant="caption" color="text.secondary">
                        Strona {page} z {totalPages} · {logsPerPage} logów na stronę
                    </Typography>
                </Box>
            </Box>
        </Layout>
    );
};

export default Logs;
