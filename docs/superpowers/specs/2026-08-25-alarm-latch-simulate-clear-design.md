# Zatrzaśnięty alarm + test/kasowanie (podsystem H) — spec

## Kontekst

Backlog z 2026-08-25, punkt "niektóre czujniki świecą na czerwono jak jest jakiś błąd, mają one świecić na czerwono dopóki nie skasuje błędów" + punkt "chcę w okienku... przycisk test wysyła sms/mail". Zainspirowane referencyjnym systemem NTI E-16D (`shots/27.png`, `shots/28.jpg`) — mechanizm "Simulate Alert" / "Clear Alert" / "Handle Alert: Dismiss" na stronie każdego czujnika.

## Zakres

**W zakresie:** cztery room-level czujniki z `FloorPlan.jsx` powiązane z `NotificationRule` — pożar, gaz, zalanie, drzwi. Nowa strona szczegółów per typ z przyciskami testu i kasowania.

**Poza zakresem:** czujnik ruchu (nie ma reguły powiadomień, zostaje bez zmian), progi temperatury/wilgotności per-urządzenie w `ServerRack`/`SensorDetail.jsx` (mają już własną, ciągłą logikę progową — nie latch).

## Model danych (`back/models.py`)

```python
ALARM_EVENT_TYPES = ('fire', 'gas', 'water', 'door')  # = NOTIFICATION_EVENT_TYPES, osobna stała dla jasności importu

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

Seed w `init_db.py` obok `NotificationRule.seed_defaults()`.

## Backend — logika i endpointy

**`back/sensors.py`** — `_raise_alert` dostaje `force=False`:

```python
def _raise_alert(self, event_type, sensor_name, is_warning, desc, force=False):
    print(f'[sensor] {desc}')
    logged = self._log(sensor_name, is_warning, desc, force=force)
    if not logged:
        return
    from models import AlarmState
    with self.app.app_context():
        AlarmState.trigger(event_type)
    self._notify(event_type, desc)
```

`_log` dostaje `force=False` — gdy `True`, pomija sprawdzenie cooldownu (ale nadal aktualizuje `_last_log[key]`, żeby kolejny *nie*-wymuszony log respektował cooldown liczony od testu):

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
```

`_check_thresholds` bez zmian (woła `_raise_alert` bez `force`, jak dziś).

**`back/app.py`** — nowe trasy:

```python
EVENT_TYPE_SENSOR_NAMES = {
    'fire': 'Czujnik pożaru', 'gas': 'Czujnik gazu',
    'water': 'Czujnik wody', 'door': 'Czujnik drzwi',
}
EVENT_TYPE_DESCRIPTIONS = {
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
        EVENT_TYPE_DESCRIPTIONS[event_type], force=True,
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

Import w `app.py`: dodać `AlarmState, ALARM_EVENT_TYPES` do importu z `models`.

`/sensors/<event_type>/simulate` woła bezpośrednio metodę globalnego obiektu `sensor` (już istnieje jako `sensor = None` → `init_sensor()`), analogicznie do `/camera/recording`.

## Frontend

**Nowa strona `front/src/RoomSensorDetail.jsx`**, route `/room-sensor/:type` (w `App.jsx`):

- Nagłówek: ikona + etykieta typu (Pożar/Gaz-Dym/Zalanie/Drzwi), przycisk wstecz do `/rzut`
- Karta statusu: żywy odczyt (`sd[type]`/`sd.door`) informacyjnie + duży baner "ALARM — wymaga skasowania" (czerwony) gdy `AlarmState.active`, albo "Brak alarmu" (zielony)
- Przycisk **"Symuluj alarm (test)"** → `POST /sensors/:type/simulate`
- Przycisk **"Skasuj alarm"** (aktywny tylko gdy `active`) → `DELETE /sensors/:type/clear`
- Link "Skonfiguruj powiadomienia dla tego zdarzenia →" prowadzący do `/settings#powiadomienia`
- Odświeżanie stanu co 5s (jak `/real-time-data`)

**`front/src/FloorPlan.jsx`:**
- Nowy fetch `GET /alarm-states` co 5s (razem z `/real-time-data`), stan `alarmStates` (`{fire: bool, gas: bool, water: bool, door: bool}`)
- `getAlert(t)` dla `fire/gas/water` → `alarmStates[t]` zamiast żywego `sd[t]` (motion bez zmian, zostaje `sd.motion`)
- `rackAlert` → `alarmStates.fire || alarmStates.gas || alarmStates.water || sd.temperature > 35` (spójne z resztą — nie gaśnie razem z chwilowym odczytem)
- `dColor` (kolor kropki drzwi) → `alarmStates.door ? C.sensorE : C.sensorOk`; tekst "OTWARTE"/"ZAMKN." zostaje z żywego `sd.door` (informacyjny stan, nie alarm)
- Dwuklik na `Sensor` (domyślnym i dodanym) typu fire/gas/water → `navigate('/room-sensor/' + s.type)` zamiast `/settings#powiadomienia`; motion bez zmian
- Dwuklik na bloku drzwi → `navigate('/room-sensor/door')` zamiast `/settings#powiadomienia`

## Testy backendu

- `test_alarm_state_model.py` — `seed_defaults` idempotentny, `trigger`/`clear` ustawiają pola poprawnie
- `test_alarm_states_endpoint.py` — GET zwraca 4 wiersze, simulate wymaga auth i realnie ustawia `active=True` + tworzy wpis w `Log`, clear wymaga auth, zwraca 404 dla nieznanego typu, 400 dla nieprawidłowego `event_type`
- `test_sensor_raise_alert_force.py` — `_raise_alert(force=True)` pomija cooldown, `_raise_alert()` (bez force) nadal go respektuje; `_raise_alert` ustawia `AlarmState.active=True`

## Migracja

Nowa tabela `alarm_states` — `db.create_all()` doda ją automatycznie przy starcie, `init_db.py` seeduje 4 wiersze (idempotentnie, bezpieczne przy ponownym uruchomieniu).
