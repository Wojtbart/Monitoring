import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import {
    Box, Typography, TextField, InputAdornment, Chip,
    IconButton, Divider, LinearProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CloseIcon from "@mui/icons-material/Close";
import VideocamIcon from "@mui/icons-material/Videocam";
import DownloadIcon from "@mui/icons-material/Download";

// Try to extract date/time from common filename patterns:
// recording_20240115_143000.mp4  |  rec_2024-01-15_14-30-00.mp4  |  clip_1705329000.mp4
function parseVideoDate(name) {
    // pattern: 8-digit date + 6-digit time (YYYYMMDD_HHMMSS or YYYYMMDD-HHMMSS)
    let m = name.match(/(\d{4})(\d{2})(\d{2})[_\-](\d{2})(\d{2})(\d{2})/);
    if (m) {
        return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]);
    }
    // ISO date: 2024-01-15_14-30-00
    m = name.match(/(\d{4})-(\d{2})-(\d{2})[_T](\d{2})-(\d{2})-(\d{2})/);
    if (m) {
        return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]);
    }
    // Unix timestamp (10 digits)
    m = name.match(/(\d{10})/);
    if (m) return new Date(+m[1] * 1000);
    return null;
}

function formatDate(d) {
    if (!d) return null;
    return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(d) {
    if (!d) return null;
    return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function groupByDate(videos) {
    const groups = {};
    for (const v of videos) {
        const key = v.parsedDate ? formatDate(v.parsedDate) : "Brak daty";
        if (!groups[key]) groups[key] = [];
        groups[key].push(v);
    }
    return groups;
}

const SavedVideos = () => {
    const accessToken = localStorage.getItem("JWT");
    const [videos, setVideos]           = useState([]);
    const [loading, setLoading]         = useState(true);
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [search, setSearch]           = useState("");
    const playerRef = useRef(null);

    useEffect(() => {
        axios.get(`${API_BASE}/videos`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then(({ data }) => {
            const enriched = data
                .map(v => ({ ...v, parsedDate: parseVideoDate(v.name) }))
                .sort((a, b) => {
                    if (a.parsedDate && b.parsedDate) return b.parsedDate - a.parsedDate;
                    return a.parsedDate ? -1 : 1;
                });
            setVideos(enriched);
        })
        .catch(err => console.error("Błąd pobierania wideo:", err))
        .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (selectedVideo && playerRef.current) {
            playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [selectedVideo]);

    const filtered = videos.filter(v =>
        v.name.toLowerCase().includes(search.toLowerCase())
    );
    const groups = groupByDate(filtered);
    const dateKeys = Object.keys(groups);

    return (
        <Layout>
            <Box sx={{ p: 3, maxWidth: 860, mx: "auto" }}>
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
                    Zapisane wideo
                </Typography>

                {/* Inline player */}
                {selectedVideo && (
                    <Box ref={playerRef} sx={{
                        mb: 3, bgcolor: "#0d1117", borderRadius: 2,
                        border: "1px solid #30363d", overflow: "hidden",
                    }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1, bgcolor: "#161b22" }}>
                            <Typography sx={{ fontSize: "0.85rem", color: "#c9d1d9", fontFamily: "monospace" }}>
                                {selectedVideo.name}
                            </Typography>
                            <IconButton size="small" onClick={() => setSelectedVideo(null)} sx={{ color: "#8b949e" }}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "center", bgcolor: "#000", p: 1 }}>
                            <video key={selectedVideo.url} width="100%" style={{ maxWidth: 720 }} controls autoPlay>
                                <source src={selectedVideo.url} type="video/mp4" />
                                Twoja przeglądarka nie wspiera odtwarzacza wideo.
                            </video>
                        </Box>
                    </Box>
                )}

                {/* Search */}
                <TextField
                    size="small" fullWidth placeholder="Szukaj po nazwie..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    sx={{ mb: 2 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" sx={{ color: "#8b949e" }} />
                            </InputAdornment>
                        ),
                    }}
                />

                {loading && <LinearProgress sx={{ mb: 2 }} />}

                {!loading && filtered.length === 0 && (
                    <Typography color="text.secondary">Brak nagrań.</Typography>
                )}

                {/* Grouped list */}
                {dateKeys.map(dateKey => (
                    <Box key={dateKey} sx={{ mb: 3 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                            <Chip label={dateKey} size="small"
                                sx={{ bgcolor: "#21262d", color: "#8b949e", fontSize: "0.72rem" }} />
                            <Typography variant="caption" color="text.secondary">
                                {groups[dateKey].length} {groups[dateKey].length === 1 ? "nagranie" : "nagrań"}
                            </Typography>
                        </Box>

                        <Box sx={{ bgcolor: "#0d1117", border: "1px solid #21262d", borderRadius: 1.5, overflow: "hidden" }}>
                            {groups[dateKey].map((v, idx) => {
                                const isSelected = selectedVideo?.name === v.name;
                                return (
                                    <React.Fragment key={v.name}>
                                        {idx > 0 && <Divider sx={{ borderColor: "#21262d" }} />}
                                        <Box sx={{
                                            display: "flex", alignItems: "center", gap: 1.5,
                                            px: 2, py: 1.25,
                                            bgcolor: isSelected ? "#1c2d3e" : "transparent",
                                            "&:hover": { bgcolor: "#161b22" },
                                            transition: "background 0.15s",
                                        }}>
                                            <VideocamIcon sx={{ fontSize: "1rem", color: isSelected ? "#58a6ff" : "#484f58", flexShrink: 0 }} />

                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography sx={{
                                                    fontSize: "0.82rem", fontFamily: "monospace",
                                                    color: isSelected ? "#58a6ff" : "#c9d1d9",
                                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                }}>
                                                    {v.name}
                                                </Typography>
                                                {v.parsedDate && (
                                                    <Typography sx={{ fontSize: "0.7rem", color: "#8b949e" }}>
                                                        {formatTime(v.parsedDate)}
                                                    </Typography>
                                                )}
                                            </Box>

                                            <IconButton size="small" title="Odtwórz"
                                                onClick={() => setSelectedVideo(isSelected ? null : v)}
                                                sx={{
                                                    color: isSelected ? "#58a6ff" : "#8b949e",
                                                    bgcolor: isSelected ? "#1f3a5c" : "#161b22",
                                                    "&:hover": { bgcolor: "#1f6feb", color: "#fff" },
                                                    borderRadius: 1, p: 0.5,
                                                }}>
                                                <PlayArrowIcon sx={{ fontSize: "1rem" }} />
                                            </IconButton>

                                            <IconButton size="small" title="Pobierz"
                                                component="a" href={v.url} download={v.name}
                                                sx={{
                                                    color: "#8b949e", bgcolor: "#161b22",
                                                    "&:hover": { bgcolor: "#238636", color: "#fff" },
                                                    borderRadius: 1, p: 0.5,
                                                }}>
                                                <DownloadIcon sx={{ fontSize: "1rem" }} />
                                            </IconButton>
                                        </Box>
                                    </React.Fragment>
                                );
                            })}
                        </Box>
                    </Box>
                ))}
            </Box>
        </Layout>
    );
};

export default SavedVideos;
