from models import DeviceAlarmState


def test_is_active_false_when_no_row(app):
    with app.app_context():
        assert DeviceAlarmState.is_active('A0', 1, 'temperature') is False


def test_trigger_creates_row_and_sets_active(app):
    with app.app_context():
        DeviceAlarmState.trigger('A0', 1, 'temperature')
        assert DeviceAlarmState.is_active('A0', 1, 'temperature') is True
        state = DeviceAlarmState.query.filter_by(rack_id='A0', unit=1, metric='temperature').first()
        assert state.last_triggered_at is not None


def test_trigger_twice_reuses_same_row(app):
    with app.app_context():
        DeviceAlarmState.trigger('A0', 1, 'temperature')
        DeviceAlarmState.trigger('A0', 1, 'temperature')
        assert DeviceAlarmState.query.filter_by(rack_id='A0', unit=1, metric='temperature').count() == 1


def test_different_metric_same_slot_independent(app):
    with app.app_context():
        DeviceAlarmState.trigger('A0', 1, 'temperature')
        assert DeviceAlarmState.is_active('A0', 1, 'humidity') is False


def test_clear_sets_inactive(app):
    with app.app_context():
        DeviceAlarmState.trigger('A0', 1, 'temperature')
        result = DeviceAlarmState.clear('A0', 1, 'temperature')
        assert result is True
        assert DeviceAlarmState.is_active('A0', 1, 'temperature') is False


def test_clear_on_missing_row_returns_false(app):
    with app.app_context():
        assert DeviceAlarmState.clear('A0', 1, 'temperature') is False
