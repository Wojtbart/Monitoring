# Zatrzaśnięty alarm + test/kasowanie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cztery room-level czujniki (pożar/gaz/zalanie/drzwi) świecą na czerwono aż do ręcznego skasowania, z przyciskiem testowym który realnie odpala cały łańcuch (log+powiadomienie+zatrzaśnięcie).

**Architecture:** Nowa tabela `AlarmState` (jeden wiersz per typ, `active` = źródło prawdy dla koloru na rzucie). `Sensor._raise_alert` ustawia latch przy każdym prawdziwym LUB wymuszonym (`force=True`, z pominięciem cooldownu) wyzwoleniu. Nowa strona frontendowa per typ z przyciskami Symuluj/Skasuj.

**Tech Stack:** Flask-SQLAlchemy, pytest, React + MUI + axios (bez zmian stacku).

**Spec:** `docs/superpowers/specs/2026-08-25-alarm-latch-simulate-clear-design.md`

## Global Constraints

- **Nigdy nie uruchamiaj `git`/`gh`** — brak kroków commit, użytkownik commituje sam.
- **Pytaj o zgodę przed każdym pojedynczym wywołaniu Bash** (pytest, esbuild, npm run build).
- Komunikaty API po polsku.
- Backend: baza testowa zawsze `sqlite:///:memory:` (już poprawnie w `conftest.py`), testy: `cd back && python -m pytest -v`.
- Frontend: brak test runnera — weryfikacja przez `npx esbuild <plik> --bundle=false --loader:.jsx=jsx` + `npm run build`.
- Zakres: tylko `fire`, `gas`, `water`, `door` — czujnik ruchu (`motion`) i progi temperatury/wilgotności per-urządzenie bez zmian.

---

### Task 1: Model `AlarmState`

**Files:**
- Modify: `back/models.py`
- Modify: `back/init_db.py`
- Test: `back/tests/test_alarm_state_model.py`

**Interfaces:**
- Produces: `ALARM_EVENT_TYPES = ('fire', 'gas', 'water', 'door')`, `AlarmState` (`seed_defaults()`, `get_all()`, `trigger(event_type)`, `clear(event_type)`). Task 2 (`sensors.py`) woła `AlarmState.trigger`. Task 3 (`app.py`) woła `get_all()`/`clear()`.

- [ ] **Step 1: Napisz failing testy**

Utwórz `back/tests/test_alarm_state_model.py`:
```python
from models import db, AlarmState


def test_seed_defaults_creates_four_rows(app):
    with app.app_context():
        AlarmState.seed_defaults()
        assert AlarmState.query.count() == 4
        assert {s.event_type for s in AlarmState.query.all()} == {'fire', 'gas', 'water', 'door'}
        assert all(s.active is False for s in AlarmState.query.all())


def test_seed_defaults_is_idempotent(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.seed_defaults()
        assert AlarmState.query.count() == 4


def test_trigger_sets_active_and_timestamp(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('fire')
        state = AlarmState.query.filter_by(event_type='fire').first()
        assert state.active is True
        assert state.last_triggered_at is not None


def test_trigger_on_unknown_type_does_nothing(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('unknown')  # nie rzuca wyjątku
        assert AlarmState.query.count() == 4


def test_clear_sets_inactive_and_timestamp(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('fire')
        result = AlarmState.clear('fire')
        assert result is True
        state = AlarmState.query.filter_by(event_type='fire').first()
        assert state.active is False
        assert state.cleared_at is not None


def test_clear_on_unknown_type_returns_false(app):
    with app.app_context():
        AlarmState.seed_defaults()
        assert AlarmState.clear('unknown') is False


def test_get_all_returns_serializable_dicts(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('water')
        states = AlarmState.get_all()
        assert len(states) == 4
        water = next(s for s in states if s['event_type'] == 'water')
        assert water['active'] is True
        assert water['last_triggered_at'] is not None
        assert water['cleared_at'] is None
```

- [ ] **Step 2: Uruchom testy, potwierdź że failują**

Run: `cd back && python -m pytest tests/test_alarm_state_model.py -v`
Expected: FAIL (`ImportError: cannot import name 'AlarmState'`)

- [ ] **Step 3: Dodaj model do `back/models.py`**

Dodaj na końcu pliku (po `NotificationRule.update_all`):
```python


ALARM_EVENT_TYPES = ('fire', 'gas', 'water', 'door')


class AlarmState(db.Model):
    __tablename__ = 'alarm_states'
    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(20), unique=True, nullable=False)
    active = db.Column(db.Boolean, nullable=False, default=False)
    last_triggered_at = db.Column(db.DateTime, nullable=True)
    cleared_at = db.Column(db.DateTime, nullable=True)

    @staticmethod
    def seed_defaults():
        for event_type in ALARM_EVENT_TYPES:
            if not AlarmState.query.filter_by(event_type=event_type).first():
                db.session.add(AlarmState(event_type=event_type))
        db.session.commit()

    @staticmethod
    def get_all():
        return [
            {
                'event_type': s.event_type,
                'active': s.active,
                'last_triggered_at': s.last_triggered_at.strftime('%Y-%m-%d %H:%M:%S') if s.last_triggered_at else None,
                'cleared_at': s.cleared_at.strftime('%Y-%m-%d %H:%M:%S') if s.cleared_at else None,
            }
            for s in AlarmState.query.all()
        ]

    @staticmethod
    def trigger(event_type):
        from datetime import datetime
        state = AlarmState.query.filter_by(event_type=event_type).first()
        if not state:
            return
        state.active = True
        state.last_triggered_at = datetime.now()
        db.session.commit()

    @staticmethod
    def clear(event_type):
        from datetime import datetime
        state = AlarmState.query.filter_by(event_type=event_type).first()
        if not state:
            return False
        state.active = False
        state.cleared_at = datetime.now()
        db.session.commit()
        return True
```

- [ ] **Step 4: Uruchom testy, potwierdź że przechodzą**

Run: `cd back && python -m pytest tests/test_alarm_state_model.py -v`
Expected: PASS (7/7)

- [ ] **Step 5: Seed w `back/init_db.py`**

Zmień:
```python
from models import db, Setting, User, NotificationRule
```
na:
```python
from models import db, Setting, User, NotificationRule, AlarmState
```

Dodaj po `NotificationRule.seed_defaults()`:
```python
    # Seed domyślnych stanów alarmów (idempotentne)
    AlarmState.seed_defaults()
    print('[init_db] Stany alarmów zseedowane.')
```

---

### Task 2: Latch w `sensors.py` (`_raise_alert` + `force`)

**Files:**
- Modify: `back/sensors.py`
- Test: `back/tests/test_sensor_raise_alert_force.py`

**Interfaces:**
- Consumes: `AlarmState.trigger(event_type)` z Task 1.
- Produces: `Sensor._log(sensor_name, is_warning, description, force=False)` → `bool`, `Sensor._raise_alert(event_type, sensor_name, is_warning, desc, force=False)`. Task 3 (`app.py` endpoint simulate) woła `sensor._raise_alert(..., force=True)`.

- [ ] **Step 1: Napisz failing testy**

Utwórz `back/tests/test_sensor_raise_alert_force.py`:
```python
from models import db, AlarmState
from sensors import Sensor


def _bare_sensor(app):
    sensor = Sensor.__new__(Sensor)
    sensor.app = app
    sensor._last_log = {}
    return sensor


def test_raise_alert_sets_alarm_state_active(app, monkeypatch):
    monkeypatch.setattr('notifications.send_email', lambda *a: None)
    monkeypatch.setattr('notifications.send_sms', lambda *a: None)
    with app.app_context():
        AlarmState.seed_defaults()

    sensor = _bare_sensor(app)
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')

    with app.app_context():
        state = AlarmState.query.filter_by(event_type='fire').first()
        assert state.active is True


def test_raise_alert_respects_cooldown_without_force(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a: calls.append(a))
    monkeypatch.setattr('notifications.send_sms', lambda *a: calls.append(a))
    with app.app_context():
        AlarmState.seed_defaults()

    sensor = _bare_sensor(app)
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')

    assert len(calls) == 1


def test_raise_alert_force_bypasses_cooldown(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a: calls.append(a))
    monkeypatch.setattr('notifications.send_sms', lambda *a: calls.append(a))
    with app.app_context():
        AlarmState.seed_defaults()

    sensor = _bare_sensor(app)
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień! (TEST)', force=True)

    assert len(calls) == 2


def test_log_force_still_updates_cooldown_window(app):
    sensor = _bare_sensor(app)
    assert sensor._log('Czujnik pożaru', True, 'Wykryto ogień!', force=True) is True
    # Kolejne wywołanie bez force, w tym samym oknie, powinno zostać spauzowane
    assert sensor._log('Czujnik pożaru', True, 'Wykryto ogień!') is False
```

- [ ] **Step 2: Uruchom testy, potwierdź że failują**

Run: `cd back && python -m pytest tests/test_sensor_raise_alert_force.py -v`
Expected: FAIL (`TypeError: _raise_alert() got an unexpected keyword argument 'force'`)

- [ ] **Step 3: Zmodyfikuj `back/sensors.py`**

Zamień:
```python
    def _log(self, sensor_name, is_warning, description):
        from models import Log
        key = f'{sensor_name}:{description[:40]}'
        now = time.time()
        if now - self._last_log.get(key, 0) < LOG_COOLDOWN_SECONDS:
            return False
        self._last_log[key] = now
        try:
            with self.app.app_context():
                Log.add_log(datetime.now(), sensor_name, is_warning, description)
        except Exception as e:
            print(f'[sensor] błąd zapisu logu: {e}')
        return True

    def _raise_alert(self, event_type, sensor_name, is_warning, desc):
        print(f'[sensor] {desc}')
        if not self._log(sensor_name, is_warning, desc):
            return
        self._notify(event_type, desc)
```
na:
```python
    def _log(self, sensor_name, is_warning, description, force=False):
        from models import Log
        key = f'{sensor_name}:{description[:40]}'
        now = time.time()
        if not force and now - self._last_log.get(key, 0) < LOG_COOLDOWN_SECONDS:
            return False
        self._last_log[key] = now
        try:
            with self.app.app_context():
                Log.add_log(datetime.now(), sensor_name, is_warning, description)
        except Exception as e:
            print(f'[sensor] błąd zapisu logu: {e}')
        return True

    def _raise_alert(self, event_type, sensor_name, is_warning, desc, force=False):
        print(f'[sensor] {desc}')
        if not self._log(sensor_name, is_warning, desc, force=force):
            return
        from models import AlarmState
        with self.app.app_context():
            AlarmState.trigger(event_type)
        self._notify(event_type, desc)
```

- [ ] **Step 4: Uruchom testy, potwierdź że przechodzą**

Run: `cd back && python -m pytest tests/test_sensor_raise_alert_force.py -v`
Expected: PASS (4/4)

- [ ] **Step 5: Pełny przebieg testów backendu**

Run: `cd back && python -m pytest -v`
Expected: wszystkie PASS (potwierdza że zmiana sygnatury `_log`/`_raise_alert` nie zepsuła `test_sensor_notify.py` z podsystemu E — te testy wołają bez `force`, domyślna wartość `False` zachowuje stare zachowanie)

---

### Task 3: Endpointy `back/app.py`

**Files:**
- Modify: `back/app.py`
- Test: `back/tests/test_alarm_states_endpoint.py`

**Interfaces:**
- Consumes: `AlarmState`, `ALARM_EVENT_TYPES` z Task 1; `sensor._raise_alert(..., force=True)` z Task 2.
- Produces: `GET /alarm-states`, `POST /sensors/<event_type>/simulate`, `DELETE /sensors/<event_type>/clear`.

- [ ] **Step 1: Napisz failing testy**

Utwórz `back/tests/test_alarm_states_endpoint.py`:
```python
from werkzeug.security import generate_password_hash
from models import User, AlarmState
import app as app_module


class _FakeSensor:
    def _raise_alert(self, event_type, sensor_name, is_warning, desc, force=False):
        AlarmState.trigger(event_type)


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    resp = client.post('/login', json={'username': 'boss', 'password': 'pw123'})
    return resp.get_json()['accessToken']


def _seed(app):
    with app.app_context():
        AlarmState.seed_defaults()


def test_get_alarm_states_returns_seeded_four(client, app):
    _seed(app)
    resp = client.get('/alarm-states')
    states = resp.get_json()['states']
    assert len(states) == 4
    assert {s['event_type'] for s in states} == {'fire', 'gas', 'water', 'door'}


def test_simulate_requires_auth(client, app):
    _seed(app)
    resp = client.post('/sensors/fire/simulate')
    assert resp.status_code == 401


def test_simulate_rejects_unknown_type(client, app):
    _seed(app)
    token = _login(client, app)
    resp = client.post('/sensors/unknown/simulate', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_simulate_sets_alarm_active(client, app, monkeypatch):
    _seed(app)
    token = _login(client, app)
    monkeypatch.setattr(app_module, 'sensor', _FakeSensor())

    resp = client.post('/sensors/water/simulate', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200

    states = client.get('/alarm-states').get_json()['states']
    water = next(s for s in states if s['event_type'] == 'water')
    assert water['active'] is True


def test_clear_requires_auth(client, app):
    _seed(app)
    resp = client.delete('/sensors/fire/clear')
    assert resp.status_code == 401


def test_clear_rejects_unknown_type(client, app):
    _seed(app)
    token = _login(client, app)
    resp = client.delete('/sensors/unknown/clear', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_clear_sets_alarm_inactive(client, app):
    _seed(app)
    token = _login(client, app)
    with app.app_context():
        AlarmState.trigger('door')

    resp = client.delete('/sensors/door/clear', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200

    states = client.get('/alarm-states').get_json()['states']
    door = next(s for s in states if s['event_type'] == 'door')
    assert door['active'] is False
```

- [ ] **Step 2: Uruchom testy, potwierdź że failują**

Run: `cd back && python -m pytest tests/test_alarm_states_endpoint.py -v`
Expected: FAIL (404 na nowych trasach / `ImportError`)

- [ ] **Step 3: Dodaj endpointy i import do `back/app.py`**

Zmień import:
```python
from models import db, User, Setting, Log, Layout, DeviceSensor, DeviceSensorHistory, EmailGroup, EmailRecipient, SmsGroup, SmsRecipient, NotificationRule, NOTIFICATION_EVENT_TYPES
```
na:
```python
from models import db, User, Setting, Log, Layout, DeviceSensor, DeviceSensorHistory, EmailGroup, EmailRecipient, SmsGroup, SmsRecipient, NotificationRule, NOTIFICATION_EVENT_TYPES, AlarmState, ALARM_EVENT_TYPES
```

Dodaj trasy (po `update_notification_rules`, przed `@app.route('/settings', methods=['PUT'])`):
```python
EVENT_TYPE_SENSOR_NAMES = {
    'fire': 'Czujnik pożaru', 'gas': 'Czujnik gazu',
    'water': 'Czujnik wody', 'door': 'Czujnik drzwi',
}
EVENT_TYPE_TEST_DESCRIPTIONS = {
    'fire': 'Wykryto ogień! (TEST)', 'gas': 'Wykryto gaz/dym! (TEST)',
    'water': 'Wykryto wodę! (TEST)', 'door': 'Otwarto drzwi (TEST)',
}


@app.route('/alarm-states', methods=['GET'])
def get_alarm_states():
    return jsonify({'states': AlarmState.get_all()}), 200


@app.route('/sensors/<event_type>/simulate', methods=['POST'])
@jwt_required()
def simulate_sensor_alert(event_type):
    if event_type not in ALARM_EVENT_TYPES:
        return jsonify({'message': 'Nieprawidłowy typ czujnika'}), 400
    sensor._raise_alert(
        event_type, EVENT_TYPE_SENSOR_NAMES[event_type], True,
        EVENT_TYPE_TEST_DESCRIPTIONS[event_type], force=True,
    )
    return jsonify({'message': 'Alarm testowy wywołany'}), 200


@app.route('/sensors/<event_type>/clear', methods=['DELETE'])
@jwt_required()
def clear_sensor_alert(event_type):
    if event_type not in ALARM_EVENT_TYPES:
        return jsonify({'message': 'Nieprawidłowy typ czujnika'}), 400
    if not AlarmState.clear(event_type):
        return jsonify({'message': 'Stan alarmu nie znaleziony'}), 404
    current_user = get_jwt_identity()
    Log.add_log(datetime.now(), EVENT_TYPE_SENSOR_NAMES[event_type], False,
                f'Alarm skasowany przez {current_user}')
    return jsonify({'message': 'Alarm skasowany'}), 200
```

- [ ] **Step 4: Uruchom testy, potwierdź że przechodzą**

Run: `cd back && python -m pytest tests/test_alarm_states_endpoint.py -v`
Expected: PASS (8/8)

- [ ] **Step 5: Pełny przebieg testów backendu**

Run: `cd back && python -m pytest -v`
Expected: wszystkie PASS

---

### Task 4: Frontend — `RoomSensorDetail.jsx`

**Files:**
- Create: `front/src/RoomSensorDetail.jsx`
- Modify: `front/src/App.jsx`

**Interfaces:**
- Consumes: `GET /alarm-states`, `GET /real-time-data`, `POST /sensors/:type/simulate`, `DELETE /sensors/:type/clear` z Task 3.
- Produces: route `/room-sensor/:type`. Task 5 (`FloorPlan.jsx`) nawiguje tu z dwukliku.

- [ ] **Step 1: Utwórz `front/src/RoomSensorDetail.jsx`**

```jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "./api";
import Layout from "./Layout";
import { Box, Typography, IconButton, Button, Alert } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import GasMeterIcon from "@mui/icons-material/GasMeter";
import WaterIcon from "@mui/icons-material/Water";
import SensorDoorIcon from "@mui/icons-material/SensorDoor";

const TYPE_CONFIG = {
    fire:  { label: "Pożar",    icon: LocalFireDepartmentIcon, color: "#e53935" },
    gas:   { label: "Gaz/Dym",  icon: GasMeterIcon,             color: "#8e24aa" },
    water: { label: "Zalanie",  icon: WaterIcon,                color: "#1e88e5" },
    door:  { label: "Drzwi",    icon: SensorDoorIcon,           color: "#6d4c41" },
};

export default function RoomSensorDetail() {
    const { type } = useParams();
    const navigate = useNavigate();
    const accessToken = localStorage.getItem("JWT");
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.fire;
    const Icon = cfg.icon;

    const [liveValue, setLiveValue] = useState(null);
    const [active, setActive] = useState(false);
    const [lastTriggeredAt, setLastTriggeredAt] = useState(null);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        const fetchState = async () => {
            try {
                const [rtRes, alarmRes] = await Promise.all([
                    axios.get(`${API_BASE}/real-time-data`),
                    axios.get(`${API_BASE}/alarm-states`),
                ]);
                setLiveValue(rtRes.data[type]);
                const state = alarmRes.data.states.find(s => s.event_type === type);
                if (state) {
                    setActive(state.active);
                    setLastTriggeredAt(state.last_triggered_at);
                }
            } catch (_) {}
        };
        fetchState();
        const iv = setInterval(fetchState, 5000);
        return () => clearInterval(iv);
    }, [type]);

    const handleSimulate = async () => {
        try {
            await axios.post(`${API_BASE}/sensors/${type}/simulate`, {}, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setStatus({ type: "success", message: "Alarm testowy wywołany — sprawdź powiadomienia." });
        } catch (error) {
            setStatus({ type: "error", message: error.response?.data?.message || "Błąd wywołania testu." });
        }
        setTimeout(() => setStatus(null), 3000);
    };

    const handleClear = async () => {
        try {
            await axios.delete(`${API_BASE}/sensors/${type}/clear`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setActive(false);
            setStatus({ type: "success", message: "Alarm skasowany." });
        } catch (error) {
            setStatus({ type: "error", message: error.response?.data?.message || "Błąd kasowania alarmu." });
        }
        setTimeout(() => setStatus(null), 2500);
    };

    return (
        <Layout>
            <Box sx={{ p: 2, maxWidth: 700, mx: "auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <IconButton size="small" onClick={() => navigate("/rzut")}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: "#1a1a2e" }}>
                        Czujnik: {cfg.label}
                    </Typography>
                </Box>

                <Box sx={{
                    display: "flex", alignItems: "center", gap: 2, p: 2, mb: 2,
                    bgcolor: "#f0f2f8", border: "1px solid #d5dae5", borderRadius: 1.5,
                }}>
                    <Icon sx={{ color: cfg.color, fontSize: 40 }} />
                    <Typography variant="h6" sx={{ color: "#1a1a2e" }}>
                        Żywy odczyt: {liveValue === true ? "Wykryto" : liveValue === false ? "Brak" : "—"}
                    </Typography>
                </Box>

                <Box sx={{
                    p: 2, mb: 2, borderRadius: 1.5,
                    bgcolor: active ? "#fdecea" : "#eaf6ec",
                    border: active ? "1px solid #e53935" : "1px solid #2e7d32",
                }}>
                    <Typography variant="h6" fontWeight="bold" sx={{ color: active ? "#c62828" : "#2e7d32" }}>
                        {active ? "ALARM — wymaga skasowania" : "Brak alarmu"}
                    </Typography>
                    {lastTriggeredAt && (
                        <Typography variant="caption" color="text.secondary">
                            Ostatnio wywołany: {lastTriggeredAt}
                        </Typography>
                    )}
                </Box>

                <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
                    <Button variant="outlined" onClick={handleSimulate}>
                        Symuluj alarm (test)
                    </Button>
                    <Button variant="contained" color="error" onClick={handleClear} disabled={!active}>
                        Skasuj alarm
                    </Button>
                </Box>

                {status && (
                    <Alert severity={status.type} sx={{ mb: 2 }} onClose={() => setStatus(null)}>
                        {status.message}
                    </Alert>
                )}

                <Typography variant="body2">
                    <a href="/settings#powiadomienia">Skonfiguruj powiadomienia dla tego zdarzenia →</a>
                </Typography>
            </Box>
        </Layout>
    );
}
```

- [ ] **Step 2: Dodaj trasę w `front/src/App.jsx`**

Zmień:
```jsx
import SensorDetail from "./SensorDetail";
import FloorPlan from "./FloorPlan";
```
na:
```jsx
import SensorDetail from "./SensorDetail";
import RoomSensorDetail from "./RoomSensorDetail";
import FloorPlan from "./FloorPlan";
```

Dodaj trasę (obok `/rack/:rackId/unit/:unit/sensor/:type`):
```jsx
<Route path="/room-sensor/:type" element={<RoomSensorDetail />} />
```

- [ ] **Step 3: Weryfikacja składni**

Zapytaj o zgodę, potem:
```
cd front && npx esbuild src/RoomSensorDetail.jsx --bundle=false --loader:.jsx=jsx
npx esbuild src/App.jsx --bundle=false --loader:.jsx=jsx
```
Expected: brak błędów w obu.

- [ ] **Step 4: Weryfikacja builda**

Zapytaj o zgodę, potem: `cd front && npm run build`
Expected: `✓ built` bez błędów.

---

### Task 5: Frontend — wpięcie w `FloorPlan.jsx`

**Files:**
- Modify: `front/src/FloorPlan.jsx`

**Interfaces:**
- Consumes: `GET /alarm-states` z Task 3, route `/room-sensor/:type` z Task 4.

- [ ] **Step 1: Dodaj fetch stanu alarmów**

Dodaj obok istniejącego `useEffect` który pobiera `/real-time-data` (szuka `const [sd, setSd] = useState({});`):
```jsx
const [alarmStates, setAlarmStates] = useState({});
```

Dodaj nowy `useEffect`:
```jsx
useEffect(() => {
    const fetchAlarms = async () => {
        try {
            const { data } = await axios.get(`${API_BASE}/alarm-states`);
            setAlarmStates(Object.fromEntries(data.states.map(s => [s.event_type, s.active])));
        } catch (_) {}
    };
    fetchAlarms();
    const iv = setInterval(fetchAlarms, 5000);
    return () => clearInterval(iv);
}, []);
```

- [ ] **Step 2: Zamień `getAlert`, `rackAlert`, `dColor` na latch**

Zamień:
```jsx
const getAlert  = t => ({ fire: !!sd.fire, gas: !!sd.gas, water: !!sd.water, motion: !!sd.motion }[t] ?? false);
const rackAlert = !!(sd.fire || sd.gas || sd.water || sd.temperature > 35);
```
na:
```jsx
const getAlert  = t => t === "motion" ? !!sd.motion : !!alarmStates[t];
const rackAlert = !!(alarmStates.fire || alarmStates.gas || alarmStates.water || sd.temperature > 35);
```

Zamień:
```jsx
const dColor = doorOpen ? C.sensorE : C.sensorOk;
```
na:
```jsx
const dColor = alarmStates.door ? C.sensorE : C.sensorOk;
```

(`doorOpen` zostaje bez zmian — nadal steruje tekstem "OTWARTE"/"ZAMKN." z żywego odczytu, tylko kolor kropki przechodzi na latch.)

- [ ] **Step 3: Zmień routing dwukliku na fire/gas/water/door**

Zamień (dla domyślnych czujników):
```jsx
onDblClick={() => navigate("/settings#powiadomienia")}
```
w obu miejscach renderu `Sensor` (`effectiveDefaultSensors.map` i `customSensors.map`) na:
```jsx
onDblClick={() => s.type === "motion" ? navigate("/settings#powiadomienia") : navigate("/room-sensor/" + s.type)}
```

Zamień w bloku "Door sensor circle":
```jsx
<Group onDblClick={() => navigate("/settings#powiadomienia")}>
```
na:
```jsx
<Group onDblClick={() => navigate("/room-sensor/door")}>
```

- [ ] **Step 4: Weryfikacja składni**

Zapytaj o zgodę, potem: `cd front && npx esbuild src/FloorPlan.jsx --bundle=false --loader:.jsx=jsx`
Expected: brak błędów.

- [ ] **Step 5: Weryfikacja builda**

Zapytaj o zgodę, potem: `cd front && npm run build`
Expected: `✓ built` bez błędów.

- [ ] **Step 6: Manualna weryfikacja**

`npm run dev`, otwórz `/rzut`:
1. Dwuklik w czujnik Pożar → `/room-sensor/fire`, kliknij "Symuluj alarm (test)" — sprawdź że pokazuje się "ALARM — wymaga skasowania" na czerwono
2. Wróć na `/rzut` — czujnik Pożar powinien świecić na czerwono (i tak zostać, mimo że mockowany odczyt sam wróci do normy w ciągu sekundy)
3. Wróć do `/room-sensor/fire`, kliknij "Skasuj alarm" — sprawdź że wraca na zielono, i na rzucie też
4. Sprawdź konsolę backendu — powinien pojawić się log `[notifications] SMTP nieskonfigurowany` (chyba że skonfigurowałeś SMTP) potwierdzający że `_notify` faktycznie się wykonało

---

## Kolejność wykonania

Task 1 → Task 2 → Task 3 (sekwencyjnie, każdy zależy od poprzedniego: model → logika sensora → endpointy). Task 4 niezależny od 1-3 (czysto frontend, może iść równolegle), ale Task 5 wymaga Task 3 (endpoint `/alarm-states`) i Task 4 (route `/room-sensor/:type`).
