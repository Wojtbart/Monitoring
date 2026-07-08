import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Layout from "./Layout";
import videoLogo from "./assets/video.png";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const SavedVideos = () => {
    const accessToken = localStorage.getItem("JWT");
    const navigate = useNavigate();
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState(null);

    const handleBackToHome = async () => {
        navigate("/home");
    };

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const response = await axios.get(
                    "http://192.168.0.150:5000/videos",
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );
                console.log(response.data);
                setVideos(response.data);
            } catch (error) {
                console.log("Error: ", error);
            }
            setLoading(false);
        };

        fetchVideos();
    }, []);

    const handleSelectedVideo = (video) => {
        console.log("Selected video: ", video);
        setSelectedVideo(video);
    };
    const videoList = videos.map((video) => (
        <Box
            key={video.name}
            sx={{
                display: "inline-block",
                margin: 1,
                width: 120,
                color: "black",
            }}
        >
            <img
                src={videoLogo}
                alt={video.name}
                width="100"
                height="100"
                onClick={() => handleSelectedVideo(video)}
                style={{ cursor: "pointer" }}
            />
            <p style={{ wordWrap: "break-word" }}>{video.name}</p>
        </Box>
    ));

    const video = selectedVideo && (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
            }}
        >
            <video width="600" controls>
                <source src={selectedVideo?.url} type="video/mp4" />
                Twoja przeglądarka nie wspiera odtwarzacza wideo.
            </video>
            <Button
                variant="contained"
                onClick={() => setSelectedVideo(null)}
                sx={{ marginTop: 8 }}
            >
                Wróć do listy wideo
            </Button>
        </Box>
    );

    return (
        <Layout>
            <div>
                <div>
                    <h1 style={{ color: "black" }}>Zapisane wideo</h1>
                    <Button
                        variant="contained"
                        onClick={handleBackToHome}
                        sx={{ marginBottom: 2 }}
                    >
                        <ArrowBackIcon></ArrowBackIcon> Strona główna
                    </Button>
                    <p style={{ color: "black" }}>
                        Kliknij na wideo, aby je odtworzyć
                    </p>
                </div>
                {loading ? (
                    <p>Ładowanie...</p>
                ) : selectedVideo ? (
                    <Box> {video} </Box>
                ) : (
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            flexWrap: "wrap",
                        }}
                    >
                        {videoList}
                    </Box>
                )}
            </div>
        </Layout>
    );
};

export default SavedVideos;
