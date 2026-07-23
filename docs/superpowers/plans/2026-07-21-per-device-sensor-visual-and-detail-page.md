# Klikalne czujniki + strona szczegółów z historią Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clickable temperature/humidity icons to the existing rack visual, backed by a history table and a per-sensor detail page with a trend chart.

**Architecture:** Backend gains a `DeviceSensorHistory` table (one row appended per `/deviceSensors/<rack_id>/<unit>` call, capped at 50 rows per slot) and a `GET .../history` endpoint. Frontend adds icons to the existing `RackVisual` component that navigate to a new `SensorDetail.jsx` page, which polls the current-value and history endpoints and renders a `recharts` line chart.

**Tech Stack:** Flask, Flask-SQLAlchemy, SQLite, pytest (backend); React, react-router-dom, axios, MUI, recharts (frontend, new dependency).

## Global Constraints

- Fire/gas/water/motion/door sensors stay global — no changes to `/realTimeData` or `back/sensors.py`.
- History cap: 50 rows per `(rack_id, unit)` pair, oldest pruned first.
- New endpoints are public (no `@jwt_required()`), consistent with `/realTimeData` and `/deviceSensors/<rack_id>/<unit>`.
- **No git commands** — do not run `git add`/`git commit`/`git push`. Leave files saved on disk.
- Frontend has no test framework configured (no vitest/jest) — frontend tasks are verified by running the dev server and checking in-browser, plus a JSX syntax check via `npx esbuild`.

---

### Task 1: `DeviceSensorHistory` model + pruning logic

**Files:**
- Modify: `back/models.py` (append `DeviceSensorHistory` class; modify `DeviceSensor.get_or_create_reading`)
- Test: `back/test_device_sensor_history.py`

**Interfaces:**
- Produces: `DeviceSensorHistory` model — columns `rack_id: str`, `unit: int`, `temperature: float`, `humidity: float`, `recorded_at: datetime`.
- Modifies: `DeviceSensor.get_or_create_reading(rack_id, unit)` (from the previous plan, `back/models.py:155-177`) — same return type (`DeviceSensor` instance), now also writes to history and prunes.
- Consumes: `db` from `back/models.py` (already imported there); `back/conftest.py` `app`/`client` fixtures (already exist from the previous plan).

- [ ] **Step 1: Write the failing test**

Create `back/test_device_sensor_history.py`:

```python
from models import DeviceSensor, DeviceSensorHistory


def test_reading_creates_one_history_row(app):
    DeviceSensor.get_or_create_reading('A0', 3)
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=3).count() == 1


def test_history_grows_with_each_call(app):
    for _ in range(5):
        DeviceSensor.get_or_create_reading('A0', 3)
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=3).count() == 5


def test_history_capped_at_50_rows(app):
    for _ in range(60):
        DeviceSensor.get_or_create_reading('A0', 3)
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=3).count() == 50


def test_history_is_independent_per_slot(app):
    for _ in range(3):
        DeviceSensor.get_or_create_reading('A0', 1)
    for _ in range(2):
        DeviceSensor.get_or_create_reading('A0', 2)
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=1).count() == 3
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=2).count() == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && python -m pytest test_device_sensor_history.py -v`
Expected: FAIL — `ImportError: cannot import name 'DeviceSensorHistory' from 'models'`

- [ ] **Step 3: Implement `DeviceSensorHistory` and wire it into `get_or_create_reading`**

Append to `back/models.py` (after the `DeviceSensor` class, i.e. after line 177):

```python
class DeviceSensorHistory(db.Model):
    __tablename__ = 'device_sensor_history'
    id = db.Column(db.Integer, primary_key=True)
    rack_id = db.Column(db.String(20), nullable=False)
    unit = db.Column(db.Integer, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    recorded_at = db.Column(db.DateTime, nullable=False)
```

Replace the full `DeviceSensor.get_or_create_reading` method (`back/models.py:155-177`) with:

```python
    @staticmethod
    def get_or_create_reading(rack_id, unit):
        import random
        from datetime import datetime

        device = DeviceSensor.query.filter_by(rack_id=rack_id, unit=unit).first()
        if device is None:
            device = DeviceSensor(
                rack_id=rack_id,
                unit=unit,
                temperature=round(random.uniform(20.0, 32.0), 1),
                humidity=round(random.uniform(35.0, 75.0), 1),
                updated_at=datetime.now(),
            )
            db.session.add(device)
        else:
            new_temp = device.temperature + random.uniform(-1.5, 1.5)
            new_humidity = device.humidity + random.uniform(-3.0, 3.0)
            device.temperature = round(min(45.0, max(10.0, new_temp)), 1)
            device.humidity = round(min(95.0, max(10.0, new_humidity)), 1)
            device.updated_at = datetime.now()
        db.session.commit()

        db.session.add(DeviceSensorHistory(
            rack_id=rack_id,
            unit=unit,
            temperature=device.temperature,
            humidity=device.humidity,
            recorded_at=device.updated_at,
        ))
        db.session.commit()

        excess = (DeviceSensorHistory.query
                  .filter_by(rack_id=rack_id, unit=unit)
                  .order_by(DeviceSensorHistory.recorded_at.desc())
                  .offset(50)
                  .all())
        if excess:
            for row in excess:
                db.session.delete(row)
            db.session.commit()

        return device
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd back && python -m pytest test_device_sensor_history.py -v`
Expected: 4 passed

- [ ] **Step 5: Run the full backend suite to check nothing broke**

Run: `cd back && python -m pytest -v`
Expected: 11 passed (7 existing + 4 new)

---

### Task 2: `GET /deviceSensors/<rack_id>/<unit>/history` endpoint

**Files:**
- Modify: `back/app.py` (import + new route)
- Test: `back/test_device_sensor_history_endpoint.py`

**Interfaces:**
- Consumes: `DeviceSensorHistory` model (Task 1), `DeviceSensor.get_or_create_reading` (Task 1), `client` fixture from `back/conftest.py`.
- Produces: `GET /deviceSensors/<rack_id>/<int:unit>/history` → `200 {"history": [{"temperature": float, "humidity": float, "recorded_at": "YYYY-MM-DD HH:MM:SS"}, ...]}`, ascending by `recorded_at`.

- [ ] **Step 1: Write the failing test**

Create `back/test_device_sensor_history_endpoint.py`:

```python
def test_history_endpoint_empty_when_no_reading_yet(client):
    resp = client.get('/deviceSensors/B9/1/history')
    assert resp.status_code == 200
    assert resp.get_json() == {'history': []}


def test_history_endpoint_returns_ascending_order(client):
    client.get('/deviceSensors/A0/4')
    client.get('/deviceSensors/A0/4')
    client.get('/deviceSensors/A0/4')

    resp = client.get('/deviceSensors/A0/4/history')
    assert resp.status_code == 200
    data = resp.get_json()['history']
    assert len(data) == 3
    timestamps = [row['recorded_at'] for row in data]
    assert timestamps == sorted(timestamps)
    for row in data:
        assert 'temperature' in row
        assert 'humidity' in row
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && python -m pytest test_device_sensor_history_endpoint.py -v`
Expected: FAIL — 404 (route does not exist)

- [ ] **Step 3: Implement the endpoint**

In `back/app.py`, change the import line (currently `from models import db, Users, PhoneNumbers, Settings, Logs, Layout, DeviceSensor`) to:

```python
from models import db, Users, PhoneNumbers, Settings, Logs, Layout, DeviceSensor, DeviceSensorHistory
```

Add the route directly after `get_device_sensors` (the `/deviceSensors/<rack_id>/<int:unit>` route added in the previous plan):

```python
@app.route('/deviceSensors/<rack_id>/<int:unit>/history', methods=['GET'])
def get_device_sensor_history(rack_id, unit):
    rows = (DeviceSensorHistory.query
            .filter_by(rack_id=rack_id, unit=unit)
            .order_by(DeviceSensorHistory.recorded_at.asc())
            .all())
    return jsonify({'history': [
        {
            'temperature': row.temperature,
            'humidity': row.humidity,
            'recorded_at': row.recorded_at.strftime('%Y-%m-%d %H:%M:%S'),
        }
        for row in rows
    ]}), 200
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd back && python -m pytest test_device_sensor_history_endpoint.py -v`
Expected: 2 passed

- [ ] **Step 5: Run the full backend suite**

Run: `cd back && python -m pytest -v`
Expected: 13 passed

---

### Task 3: Clickable sensor icons on `RackVisual`

**Files:**
- Modify: `front/src/ServerRack.jsx` (`RackVisual` component, `back/src/ServerRack.jsx:132-167`, and its call site at `front/src/ServerRack.jsx:253`)

**Interfaces:**
- Consumes: `useNavigate` from `react-router-dom` (already imported at `front/src/ServerRack.jsx:2`).
- Produces: clicking the 🌡️ icon on a non-empty slot navigates to `/rack/<rackId>/unit/<unit>/sensor/temperature`; clicking 💧 navigates to `/rack/<rackId>/unit/<unit>/sensor/humidity`.

- [ ] **Step 1: Add `rackId` prop and navigation to `RackVisual`**

Replace the `RackVisual` function (`front/src/ServerRack.jsx:132-167`) with:

```jsx
function RackVisual({ slots, rackLabel, rackSize, rackId }) {
    const navigate = useNavigate();
    return (
        <Box sx={{ width: 110, flexShrink: 0, mt: 7 }}>
            <Box sx={{
                bgcolor: "#0d1117", border: "3px solid #30363d",
                borderRadius: 2, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                display: "flex", flexDirection: "column",
            }}>
                <Box sx={{ bgcolor: "#21262d", px: 1, py: 0.6, borderBottom: "2px solid #30363d", textAlign: "center" }}>
                    <Typography sx={{ color: "#8b949e", fontSize: "0.62rem", fontFamily: "monospace", fontWeight: "bold" }}>
                        {rackSize}U
                    </Typography>
                </Box>
                {slots.map(slot => {
                    const dtype = DEVICE_TYPES[slot.type] || DEVICE_TYPES.empty;
                    const isEmpty = slot.type === "empty";
                    return (
                        <Box key={slot.unit} sx={{
                            height: 20, display: "flex", alignItems: "center", justifyContent: "space-between",
                            px: 0.5, bgcolor: isEmpty ? "#161b22" : dtype.color,
                            opacity: isEmpty ? 0.5 : 0.9,
                            borderBottom: "1px solid #0d1117",
                        }}>
                            <Typography sx={{ color: isEmpty ? "#484f58" : "#fff", fontSize: "0.55rem", fontFamily: "monospace" }}>
                                {String(slot.unit).padStart(2, "0")}
                            </Typography>
                            {!isEmpty && (
                                <Box sx={{ display: "flex", gap: 0.25 }}>
                                    <Box
                                        component="span"
                                        onClick={() => navigate(`/rack/${rackId}/unit/${slot.unit}/sensor/temperature`)}
                                        sx={{ cursor: "pointer", fontSize: "0.6rem", lineHeight: 1 }}
                                        title="Temperatura"
                                    >
                                        🌡️
                                    </Box>
                                    <Box
                                        component="span"
                                        onClick={() => navigate(`/rack/${rackId}/unit/${slot.unit}/sensor/humidity`)}
                                        sx={{ cursor: "pointer", fontSize: "0.6rem", lineHeight: 1 }}
                                        title="Wilgotność"
                                    >
                                        💧
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>
            <Typography variant="caption" sx={{ display: "block", mt: 0.75, textAlign: "center", color: "text.secondary" }}>
                Widok wizualny serwera
            </Typography>
        </Box>
    );
}
```

- [ ] **Step 2: Pass `rackId` at the call site**

In `front/src/ServerRack.jsx:253`, change:

```jsx
                <RackVisual slots={slots} rackLabel={rackLabel} rackSize={rackSize} />
```

to:

```jsx
                <RackVisual slots={slots} rackLabel={rackLabel} rackSize={rackSize} rackId={rackId} />
```

- [ ] **Step 3: Syntax-check the file**

Run: `cd front && npx esbuild src/ServerRack.jsx --bundle=false`
Expected: no errors printed (esbuild exits 0 silently on success).

- [ ] **Step 4: Manually verify in the browser**

Run: `cd front && npm run dev`, open `http://localhost:5173/rack/A0`. Confirm:
- Non-empty slots in the left visual rack show 🌡️ and 💧 icons.
- Empty slots show no icons.
- Clicking 🌡️ on a slot navigates to `/rack/A0/unit/<N>/sensor/temperature` (page will 404/blank until Task 4 adds the route — that's expected at this point).

---

### Task 4: `SensorDetail.jsx` page with history chart

**Files:**
- Modify: `front/package.json` (add `recharts` dependency)
- Modify: `front/src/App.jsx` (new route)
- Create: `front/src/SensorDetail.jsx`

**Interfaces:**
- Consumes: `GET /deviceSensors/<rackId>/<unit>` (`{temperature, humidity, updated_at}`), `GET /deviceSensors/<rackId>/<unit>/history` (`{history: [{temperature, humidity, recorded_at}]}`), `GET /settings` (`{settings: [{min_temperature, max_temperature, min_humidity, max_humidity, ...}]}`) — all existing/Task-1/Task-2 endpoints.
- Produces: route `/rack/:rackId/unit/:unit/sensor/:type` rendering current value, OK/WARN status, and a `recharts` trend line for the selected `:type` (`temperature` or `humidity`).

- [ ] **Step 1: Install recharts**

Run: `cd front && npm install recharts`
Expected: `recharts` added to `front/package.json` dependencies, install succeeds.

- [ ] **Step 2: Add the route**

In `front/src/App.jsx`, add the import (after line 13, `import ServerRack from "./ServerRack";`):

```jsx
import SensorDetail from "./SensorDetail";
```

Add the route (after line 28, `<Route path="/rack/:rackId" element={<ServerRack />} />`):

```jsx
                <Route path="/rack/:rackId/unit/:unit/sensor/:type" element={<SensorDetail />} />
```

- [ ] **Step 3: Create `front/src/SensorDetail.jsx`**

```jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import { Box, Typography, IconButton, Chip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const TYPE_CONFIG = {
    temperature: { label: "Temperatura", unit: "°C", icon: ThermostatIcon, color: "#ef5350" },
    humidity:    { label: "Wilgotność",  unit: "%",  icon: WaterDropIcon,  color: "#42a5f5" },
};

export default function SensorDetail() {
    const { rackId, unit, type } = useParams();
    const navigate = useNavigate();
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.temperature;
    const Icon = cfg.icon;

    const [current, setCurrent] = useState(null);
    const [history, setHistory] = useState([]);
    const [thresholds, setThresholds] = useState(null);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [{ data: reading }, { data: hist }] = await Promise.all([
                    axios.get(`${API_BASE}/deviceSensors/${rackId}/${unit}`),
                    axios.get(`${API_BASE}/deviceSensors/${rackId}/${unit}/history`),
                ]);
                setCurrent(reading);
                setHistory(hist.history);
            } catch (_) {}
        };
        fetchAll();
        const iv = setInterval(fetchAll, 5000);
        return () => clearInterval(iv);
    }, [rackId, unit]);

    useEffect(() => {
        axios.get(`${API_BASE}/settings`)
            .then(({ data }) => setThresholds(data.settings[0]))
            .catch(() => {});
    }, []);

    const value = current ? current[type] : null;
    const min = thresholds ? Number(type === "temperature" ? thresholds.min_temperature : thresholds.min_humidity) : null;
    const max = thresholds ? Number(type === "temperature" ? thresholds.max_temperature : thresholds.max_humidity) : null;
    const status = value != null && min != null && max != null
        ? (value < min || value > max ? "warning" : "ok")
        : null;

    const chartData = history.map(row => ({ time: row.recorded_at.slice(11, 19), value: row[type] }));

    return (
        <Layout>
            <Box sx={{ p: 2, maxWidth: 700, mx: "auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <IconButton size="small" onClick={() => navigate(`/rack/${rackId}`)}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Box>
                        <Typography variant="h5" fontWeight="bold" sx={{ color: "#1a1a2e" }}>
                            Szafa {rackId} — Unit {unit}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {cfg.label} · odświeżanie co 5s
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{
                    display: "flex", alignItems: "center", gap: 2, p: 2, mb: 2,
                    bgcolor: "#1a1a2e", borderRadius: 1.5,
                }}>
                    <Icon sx={{ color: cfg.color, fontSize: 40 }} />
                    <Typography variant="h3" sx={{ color: "white", fontWeight: "bold" }}>
                        {value != null ? `${value}${cfg.unit}` : "—"}
                    </Typography>
                    {status && (
                        <Chip
                            label={status === "ok" ? "OK" : "WARN"}
                            size="small"
                            sx={{ bgcolor: status === "ok" ? "#2e7d32" : "#ff9800", color: "white", fontWeight: "bold" }}
                        />
                    )}
                </Box>

                <Box sx={{ bgcolor: "#0d1117", border: "3px solid #30363d", borderRadius: 2, p: 2, height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid stroke="#21262d" />
                            <XAxis dataKey="time" stroke="#8b949e" fontSize={10} />
                            <YAxis stroke="#8b949e" fontSize={10} domain={["auto", "auto"]} />
                            <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d" }} />
                            <Line type="monotone" dataKey="value" stroke={cfg.color} dot={false} strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </Box>
            </Box>
        </Layout>
    );
}
```

- [ ] **Step 4: Syntax-check the new/modified files**

Run: `cd front && npx esbuild src/SensorDetail.jsx --bundle=false && npx esbuild src/App.jsx --bundle=false`
Expected: no errors.

- [ ] **Step 5: Manually verify in the browser**

Run: `cd front && npm run dev` (backend must also be running: `cd back && python app.py`).

1. Open `http://localhost:5173/rack/A0`, add a device to a slot if none exist (edit icon → pick a type, save).
2. Click the 🌡️ icon on that slot.
3. Confirm the URL is `/rack/A0/unit/<N>/sensor/temperature`, the page shows a big temperature value, an OK/WARN chip, and a line chart.
4. Wait ~10s and confirm the value/chart update (new point appears).
5. Click the back arrow — confirm it returns to `/rack/A0`.
6. Repeat for the 💧 icon and confirm it shows humidity instead.

---

## Out of scope (future work)

- Per-device alarm thresholds (still uses global `Settings`).
- Editing/deleting history.
- Combined temperature+humidity chart on one page.
