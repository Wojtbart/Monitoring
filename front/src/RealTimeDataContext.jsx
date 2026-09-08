import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";

// Strony bez sensu do pollowania — nikt tam jeszcze/już nie ogląda danych
// z czujników (ekran logowania/rejestracji), a poller i tak działa cały
// czas w tle (Provider owija całe <Routes>), więc bez tego strzelałby
// requestami nawet zanim ktokolwiek się zaloguje.
const NO_POLL_PATHS = ["/login", "/register-user"];

// Jeden wspólny poller /real-time-data (co 5s) dla całej appki. Layout.jsx
// owija nim wszystkie strony, więc strona (np. ServerRack.jsx), która
// potrzebuje globalnego czujnika pokoju/uptime, czyta go przez
// useRealTimeData() zamiast dublować własny axios.get na tym samym
// endpoincie (wcześniej Layout.jsx i ServerRack.jsx pollowały niezależnie,
// stąd dwa identyczne requesty w tym samym ticku na stronie szafy).
const RealTimeDataContext = createContext({});

export function RealTimeDataProvider({ children }) {
    const [data, setData] = useState({});
    const location = useLocation();
    const shouldPoll = !NO_POLL_PATHS.includes(location.pathname);

    useEffect(() => {
        if (!shouldPoll) return;
        const fetch = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/real-time-data`);
                setData(data);
            } catch (_) {}
        };
        fetch();
        const iv = setInterval(fetch, 5000);
        return () => clearInterval(iv);
    }, [shouldPoll]);

    return (
        <RealTimeDataContext.Provider value={data}>
            {children}
        </RealTimeDataContext.Provider>
    );
}

export const useRealTimeData = () => useContext(RealTimeDataContext);
