# Per-device temp/humidity sensors (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend model + API endpoint that returns temperature/humidity readings scoped to an individual rack slot (rack_id + unit), instead of the single global sensor reading used today.

**Architecture:** New `DeviceSensor` SQLAlchemy model in `back/models.py` (one row per `(rack_id, unit)` pair), populated lazily via a "get or create + random-walk update" method. A new public GET endpoint in `back/app.py` calls that method and returns JSON. No background thread, no new settings table — reuses existing global `Settings` thresholds on the frontend side (out of scope here).

**Tech Stack:** Flask, Flask-SQLAlchemy, SQLite (dev), pytest (new dev dependency — this project currently has zero automated tests).

## Global Constraints

- Fire/gas/water/motion/door sensors stay global — do not touch `/realTimeData` or the `Sensor` class in `back/sensors.py`.
- Temperature mock range on first creation: 20.0–32.0°C, 35.0–75.0% humidity (matches existing `_read_sensors` mock in `back/sensors.py:80-81`).
- Random-walk step per request: ±1.5°C, ±3.0% humidity, clamped to 10.0–45.0°C and 10.0–95.0% humidity.
- Endpoint is public (no `@jwt_required()`), consistent with `/realTimeData` (`back/app.py:235-237`).
- **No git commands in this repo** — do not run `git add`/`git commit`/`git push` at the end of tasks. Just leave files saved on disk.

---

### Task 1: `DeviceSensor` model + pytest scaffolding

**Files:**
- Create: `back/conftest.py`
- Modify: `back/models.py` (append `DeviceSensor` class)
- Modify: `back/requirements.txt` (add `pytest`)
- Test: `back/test_device_sensor_model.py`

**Interfaces:**
- Produces: `DeviceSensor` model with columns `rack_id: str`, `unit: int`, `temperature: float`, `humidity: float`, `updated_at: datetime`, unique constraint on `(rack_id, unit)`.
- Produces: `DeviceSensor.get_or_create_reading(rack_id: str, unit: int) -> DeviceSensor` staticmethod — creates a row with mock starting values on first call, applies a clamped random walk and commits on subsequent calls.
- Consumes: `db` from `back/models.py` (already imported there).

This project has no test suite yet — `back/conftest.py` is the first one, providing an `app` fixture (in-memory SQLite, tables created/dropped per test) that every later test file in `back/` will reuse.

- [ ] **Step 1: Add pytest to requirements**

Edit `back/requirements.txt`, add under `# Core`:
```
pytest>=8.0.0
```

Run: `cd back && pip install pytest`
Expected: pytest installs successfully.

- [ ] **Step 2: Write `back/conftest.py`**

```python
import pytest


@pytest.fixture
def app():
    from app import app as flask_app
    from models import db

    flask_app.config['TESTING'] = True
    flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()
```

- [ ] **Step 3: Write the failing test for the model**

Create `back/test_device_sensor_model.py`:

```python
from models import DeviceSensor


def test_first_reading_is_within_mock_range(app):
    device = DeviceSensor.get_or_create_reading('A0', 3)
    assert 20.0 <= device.temperature <= 32.0
    assert 35.0 <= device.humidity <= 75.0
    assert device.rack_id == 'A0'
    assert device.unit == 3


def test_second_call_reuses_same_row(app):
    DeviceSensor.get_or_create_reading('A0', 3)
    DeviceSensor.get_or_create_reading('A0', 3)
    assert DeviceSensor.query.filter_by(rack_id='A0', unit=3).count() == 1


def test_different_units_are_independent_rows(app):
    DeviceSensor.get_or_create_reading('A0', 1)
    DeviceSensor.get_or_create_reading('A0', 2)
    assert DeviceSensor.query.count() == 2


def test_random_walk_stays_within_clamp_bounds(app):
    device = DeviceSensor.get_or_create_reading('A0', 5)
    for _ in range(200):
        device = DeviceSensor.get_or_create_reading('A0', 5)
        assert 10.0 <= device.temperature <= 45.0
        assert 10.0 <= device.humidity <= 95.0
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd back && python -m pytest test_device_sensor_model.py -v`
Expected: FAIL — `ImportError: cannot import name 'DeviceSensor' from 'models'`

- [ ] **Step 5: Implement `DeviceSensor` in `back/models.py`**

Append to `back/models.py` (after the `Logs` class):

```python
class DeviceSensor(db.Model):
    __tablename__ = 'device_sensors'
    id = db.Column(db.Integer, primary_key=True)
    rack_id = db.Column(db.String(20), nullable=False)
    unit = db.Column(db.Integer, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    updated_at = db.Column(db.DateTime, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('rack_id', 'unit', name='uq_device_sensor_rack_unit'),
    )

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
        return device
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd back && python -m pytest test_device_sensor_model.py -v`
Expected: 4 passed

---

### Task 2: `GET /deviceSensors/<rack_id>/<unit>` endpoint

**Files:**
- Modify: `back/app.py` (import + new route)
- Test: `back/test_device_sensors_endpoint.py`

**Interfaces:**
- Consumes: `DeviceSensor.get_or_create_reading(rack_id, unit)` from Task 1.
- Consumes: `client` fixture from `back/conftest.py` (Task 1).
- Produces: `GET /deviceSensors/<rack_id>/<int:unit>` → `200 {"temperature": float, "humidity": float, "updated_at": "YYYY-MM-DD HH:MM:SS"}`.

- [ ] **Step 1: Write the failing test**

Create `back/test_device_sensors_endpoint.py`:

```python
def test_get_device_sensors_returns_reading(client):
    resp = client.get('/deviceSensors/A0/3')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 20.0 <= data['temperature'] <= 32.0
    assert 35.0 <= data['humidity'] <= 75.0
    assert 'updated_at' in data


def test_get_device_sensors_same_slot_returns_updated_reading(client):
    first = client.get('/deviceSensors/A0/3').get_json()
    second = client.get('/deviceSensors/A0/3').get_json()
    assert 10.0 <= second['temperature'] <= 45.0
    assert 10.0 <= second['humidity'] <= 95.0


def test_get_device_sensors_requires_no_auth(client):
    resp = client.get('/deviceSensors/A1/7')
    assert resp.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back && python -m pytest test_device_sensors_endpoint.py -v`
Expected: FAIL — 404 (route does not exist)

- [ ] **Step 3: Implement the endpoint**

In `back/app.py:5`, change the import line to include `DeviceSensor`:

```python
from models import db, Users, PhoneNumbers, Settings, Logs, Layout, DeviceSensor
```

Add the route after `get_real_time_data` (`back/app.py:235-237`):

```python
@app.route('/deviceSensors/<rack_id>/<int:unit>', methods=['GET'])
def get_device_sensors(rack_id, unit):
    device = DeviceSensor.get_or_create_reading(rack_id, unit)
    return jsonify({
        'temperature': device.temperature,
        'humidity': device.humidity,
        'updated_at': device.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
    }), 200
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd back && python -m pytest test_device_sensors_endpoint.py -v`
Expected: 3 passed

- [ ] **Step 5: Run the full backend test suite**

Run: `cd back && python -m pytest -v`
Expected: 7 passed (4 from Task 1 + 3 from Task 2)

---

## Out of scope (future plans)

- Visual rack drawing (canvas/SVG, FloorPlan.jsx style) with clickable sensor icons.
- Per-server sensor detail page/route on the frontend.
- Wiring icon clicks to navigation.
