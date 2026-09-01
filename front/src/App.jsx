import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import Home from "./Home";
import Camera from "./Camera";
import SavedVideos from "./SavedVideos";
import Settings from "./Settings";
import Logs from "./Logs";
import ServerRack from "./ServerRack";
import SensorDetail from "./SensorDetail";
import RoomSensorDetail from "./RoomSensorDetail";
import VoltageDetail from "./VoltageDetail";
import Help from "./Help";
import FloorPlan from "./FloorPlan";
import { RealTimeDataProvider } from "./RealTimeDataContext";

function App() {
    return (
        <Router>
            <RealTimeDataProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register-user" element={<RegisterPage />} />
                    <Route path="/test-device" element={<Home />} />
                    <Route path="/camera" element={<Camera />} />
                    <Route path="/saved-videos" element={<SavedVideos />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/logs" element={<Logs />} />
                    <Route path="/rack/:rackId" element={<ServerRack />} />
                    <Route path="/rack/:rackId/sensor/:type" element={<SensorDetail />} />
                    <Route path="/room-sensor/:type" element={<RoomSensorDetail />} />
                    <Route path="/voltage" element={<VoltageDetail />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/floor-plan" element={<FloorPlan />} />
                    <Route path="/" element={<FloorPlan />} />
                </Routes>
            </RealTimeDataProvider>
        </Router>
    );
}

export default App;
