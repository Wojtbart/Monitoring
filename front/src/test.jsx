import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Camera = () => {
    const accessToken = localStorage.getItem("JWT");
    const navigate = useNavigate();
    const [isCameraOn, setIsCameraOn] = useState(false); // Track camera state

    const handleBackToHome = async () => {
        await handleStopCamera();
        navigate("/home");
    };

    const handleStopCamera = async () => {
        try {
            if (isCameraOn) {
                await axios.get("http://localhost:5000/controlCamera", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    params: {
                        action: "off",
                    },
                });
                setIsCameraOn(false); // Update state
            }
        } catch (error) {
            console.log("Error stopping camera: ", error);
        }
    };

    return (
        <div>
            <h1>Camera</h1>
            <button onClick={handleBackToHome}>Back to "Home"</button>

            <img src="http://localhost:5000/captureVideo" alt="video" />
        </div>
    );
};

export default Camera;

// {isRecording ? (
//     <button onClick={handleStopRecording}>Stop recording</button>
// ) : (
//     <button onClick={handleStartRecording}>Start recording</button>
// )}

// const handleStartRecording = async () => {
//     try {
//         const response = await axios.post(
//             "http://localhost:5000/startRecording",
//             {},
//             {
//                 headers: {
//                     Authorization: `Bearer ${accessToken}`,
//                 },
//             }
//         );
//         setIsRecording(true);
//         setVideoName(response.data.videoName);
//     } catch (error) {
//         console.log("Error: ", error);
//     }
// };

// const handleStopRecording = async () => {
//     try {
//         const response = await axios.post(
//             "http://localhost:5000/stopRecording",
//             {},
//             {
//                 headers: {
//                     Authorization: `Bearer ${accessToken}`,
//                 },
//             }
//         );
//         setIsRecording(false);
//         setVideoName("");
//     } catch (error) {
//         console.log("Error: ", error);
//     }
// };
