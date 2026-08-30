from models import AlarmState, Log
from sensors import Sensor


def _bare_sensor(app):
    sensor = Sensor.__new__(Sensor)
    sensor.app = app
    sensor._last_log = {}
    sensor.fire = False
    sensor.gas = False
    sensor.water = False
    sensor.door = False
    sensor.voltage_enabled = True
    return sensor


def test_voltage_within_range_does_not_trigger_alarm(app):
    with app.app_context():
        AlarmState.seed_defaults()

    sensor = _bare_sensor(app)
    sensor.voltage = 12.5
    sensor.min_voltage = 11.0
    sensor.max_voltage = 15.0
    sensor._check_thresholds()

    with app.app_context():
        state = AlarmState.query.filter_by(event_type='voltage').first()
        assert state.active is False


def test_voltage_below_min_triggers_alarm_and_log(app):
    with app.app_context():
        AlarmState.seed_defaults()

    sensor = _bare_sensor(app)
    sensor.voltage = 9.0
    sensor.min_voltage = 11.0
    sensor.max_voltage = 15.0
    sensor._check_thresholds()

    with app.app_context():
        state = AlarmState.query.filter_by(event_type='voltage').first()
        assert state.active is True
        logs = Log.get_all_logs()
    assert any('Napięcie' in l['sensor_name'] for l in logs)


def test_voltage_above_max_triggers_alarm(app):
    with app.app_context():
        AlarmState.seed_defaults()

    sensor = _bare_sensor(app)
    sensor.voltage = 20.0
    sensor.min_voltage = 11.0
    sensor.max_voltage = 15.0
    sensor._check_thresholds()

    with app.app_context():
        state = AlarmState.query.filter_by(event_type='voltage').first()
        assert state.active is True


def test_voltage_out_of_range_does_not_trigger_alarm_when_disabled(app):
    with app.app_context():
        AlarmState.seed_defaults()

    sensor = _bare_sensor(app)
    sensor.voltage_enabled = False
    sensor.voltage = 20.0
    sensor.min_voltage = 11.0
    sensor.max_voltage = 15.0
    sensor._check_thresholds()

    with app.app_context():
        state = AlarmState.query.filter_by(event_type='voltage').first()
        assert state.active is False
