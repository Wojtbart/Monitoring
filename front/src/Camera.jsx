import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@mui/material";
import Layout from "./Layout";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const Camera = () => {
    const accessToken = localStorage.getItem("JWT");
    const navigate = useNavigate();
    const [videoName, setVideoName] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    let cameraNotDetected = false;

    const handleBackToHome = () => {
        navigate("/home");
    };

    const handleStartRecording = async () => {
        try {
            const response = await axios.post(
                "http://192.168.0.150:5000/startRecording",
                {},
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );
            if (response.status === 403) {
                alert(response.data.message);
            } else {
                setIsRecording(true);
                setVideoName(response.data.videoName);
            }
        } catch (error) {
            alert("Error: ", error);
            console.log("Error: ", error);
        }
    };

    const handleStopRecording = async () => {
        try {
            await axios.post(
                "http://192.168.0.150:5000/stopRecording",
                {
                    videoName,
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );
            setIsRecording(false);
            setVideoName("");
        } catch (error) {
            console.log("Error: ", error);
        }
    };

    return (
        <Layout>
            <div style={{ marginBottom: 10 }}>
                <h1 style={{ color: "#031322" }}>Widok z kamery</h1>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleBackToHome}
                >
                    <ArrowBackIcon></ArrowBackIcon> Strona główna
                </Button>
            </div>

            <div>
                {cameraNotDetected ? (
                    <p>Kamera nie została podłączona</p>
                ) : (
                    <div>
                        <media-theme-microvideo>
                            <img
                                style={{
                                    boxShadow:
                                        "14px 15px 15px rgba(0, 0, 0, 0.5)",
                                }}
                                slot="media"
                                src="http://192.168.0.150:5000/captureVideo"
                                playsInline
                                id="camera-image"
                            />
                        </media-theme-microvideo>
                    </div>
                )}
            </div>

            <div>
                {isRecording ? (
                    <div>
                        <p style={{ color: "black" }}>
                            Recording video: {videoName}
                        </p>
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={handleStopRecording}
                        >
                            Zakoncz nagrywanie
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleStartRecording}
                    >
                        Zacznij nagrywanie
                    </Button>
                )}
            </div>
        </Layout>
    );
};

export default Camera;
