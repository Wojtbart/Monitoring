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
import Diagram from "./Diagram";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/loginPage" element={<LoginPage />} />
                <Route path="/registerPage" element={<RegisterPage />} />
                <Route path="/home" element={<Home />} />
                <Route path="/camera" element={<Camera />} />
                <Route path="/savedVideos" element={<SavedVideos />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/diagram" element={<Diagram />} />
                <Route path="/" element={<Home />} />
            </Routes>
        </Router>
    );
}

export default App;
