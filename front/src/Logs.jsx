import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import axios from "axios";
import Layout from "./Layout";
import "./Logs.css";

import {
  Button,
  InputLabel,
  MenuItem,
  FormControl,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReportIcon from "@mui/icons-material/Report";
import WarningIcon from "@mui/icons-material/Warning";

const API_BASE = "http://192.168.0.150:5000";

const Logs = () => {
  const navigate = useNavigate();
  const accessToken = localStorage.getItem("JWT");

  const [logs, setLogs] = useState([]);
  const [sortType, setSortType] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // Axios instance for cleaner headers
  const axiosAuth = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    [accessToken]
  );

  // Redirect if no token
  useEffect(() => {
    if (!accessToken) navigate("/loginPage");
  }, [accessToken, navigate]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await axiosAuth.get("/logs");
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      navigate("/loginPage");
    }
  }, [axiosAuth, navigate]);

  // Fetch user info (isAdmin)
  const fetchUserInfo = useCallback(async () => {
    try {
      const { data } = await axiosAuth.get("/userInfo");
      setIsAdmin(data.isAdmin || false);
    } catch (error) {
      console.error("Error fetching user info:", error);
      navigate("/loginPage");
    }
  }, [axiosAuth, navigate]);

  useEffect(() => {
    fetchUserInfo();
    fetchLogs();
  }, [fetchLogs, fetchUserInfo]);

  const deleteLogs = async () => {
    if (!window.confirm("Czy na pewno chcesz usunąć logi?")) return;
    try {
      await axiosAuth.post("/deleteLogs");
      await fetchLogs();
    } catch (error) {
      console.error("Error deleting logs:", error);
      navigate("/loginPage");
    }
  };

  // Derived sorted logs using useMemo (avoids unnecessary re-renders)
  const sortedLogs = useMemo(() => {
    if (!sortType) return logs;

    switch (sortType) {
      case "oldest":
        return [...logs].sort(
          (a, b) => new Date(a.log_date) - new Date(b.log_date)
        );
      case "newest":
        return [...logs].sort(
          (a, b) => new Date(b.log_date) - new Date(a.log_date)
        );
      case "warnings":
        return logs.filter((log) => log.is_warning);
      case "reports":
        return logs.filter((log) => !log.is_warning);
      default:
        return logs;
    }
  }, [logs, sortType]);

  return (
    <Layout>
      <h1 style={{ color: "#031322" }}>Logi z systemu</h1>
      <div style={{ marginTop: 20 }}>
        <div className="button-group">
          <Button
            variant="contained"
            onClick={() => navigate("/home")}
            sx={{ mb: 2 }}
          >
            <ArrowBackIcon /> Strona główna
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={!isAdmin}
            onClick={deleteLogs}
            sx={{ mb: 2, ml: 1 }}
          >
            Usuń logi
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={fetchLogs}
            sx={{ mb: 2, ml: 1 }}
          >
            Przeładuj logi
          </Button>

          <FormControl sx={{ minWidth: 180, ml: 2 }}>
            <InputLabel>Sortowanie</InputLabel>
            <Select
              value={sortType}
              label="Sortowanie"
              onChange={(e) => setSortType(e.target.value)}
            >
              <MenuItem value="oldest">Data — od najstarszych</MenuItem>
              <MenuItem value="newest">Data — od najnowszych</MenuItem>
              <MenuItem value="warnings">Tylko ostrzeżenia</MenuItem>
              <MenuItem value="reports">Tylko raporty</MenuItem>
            </Select>
          </FormControl>
        </div>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "khaki" }}>
                <TableCell>Data</TableCell>
                <TableCell>Nazwa sensoru</TableCell>
                <TableCell>Typ logu</TableCell>
                <TableCell>Opis</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedLogs.map((log, index) => (
                <TableRow
                  key={log.id}
                  className={index % 2 ? "odd-row" : "even-row"}
                >
                  <TableCell>{log.log_date}</TableCell>
                  <TableCell>{log.sensor_name}</TableCell>
                  <TableCell>
                    {log.is_warning ? (
                      <WarningIcon sx={{ color: "#ff9966" }} />
                    ) : (
                      <ReportIcon sx={{ color: "red" }} />
                    )}
                  </TableCell>
                  <TableCell>{log.log_description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </Layout>
  );
};

export default Logs;
