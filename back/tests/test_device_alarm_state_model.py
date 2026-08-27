from models import DeviceAlarmState


def test_is_active_false_when_no_row(app):
    with app.app_context():
        assert DeviceAlarmState.is_active('A0', 1, 'temperature', 'non_critical') is False


def test_trigger_creates_row_and_sets_active(app):
    with app.app_context():
        DeviceAlarmState.trigger('A0', 1, 'temperature', 'non_critical')
        assert DeviceAlarmState.is_active('A0', 1, 'temperature', 'non_critical') is True
        state = DeviceAlarmState.query.filter_by(rack_id='A0', unit=1, metric='temperature', severity='non_critical').first()
        assert state.last_triggered_at is not None


def test_trigger_twice_reuses_same_row(app):
    with app.app_context():
        DeviceAlarmState.trigger('A0', 1, 'temperature', 'non_critical')
        DeviceAlarmState.trigger('A0', 1, 'temperature', 'non_critical')
        assert DeviceAlarmState.query.filter_by(rack_id='A0', unit=1, metric='temperature', severity='non_critical').count() == 1


def test_different_metric_same_slot_independent(app):
    with app.app_context():
        DeviceAlarmState.trigger('A0', 1, 'temperature', 'non_critical')
        assert DeviceAlarmState.is_active('A0', 1, 'humidity', 'non_critical') is False


def test_non_critical_and_critical_are_independent(app):
    with app.app_context():
        DeviceAlarmState.trigger('A0', 1, 'temperature', 'non_critical')
        assert DeviceAlarmState.is_active('A0', 1, 'temperature', 'critical') is False


def test_clear_sets_inactive(app):
    with app.app_context():
        DeviceAlarmState.trigger('A0', 1, 'temperature', 'non_critical')
        result = DeviceAlarmState.clear('A0', 1, 'temperature', 'non_critical')
        assert result is True
        assert DeviceAlarmState.is_active('A0', 1, 'temperature', 'non_critical') is False


def test_clear_on_missing_row_returns_false(app):
    with app.app_context():
        assert DeviceAlarmState.clear('A0', 1, 'temperature', 'non_critical') is False


def test_mark_pending_sets_timestamp_once(app):
    with app.app_context():
        first = DeviceAlarmState.mark_pending('A0', 1, 'temperature', 'non_critical')
        second = DeviceAlarmState.mark_pending('A0', 1, 'temperature', 'non_critical')
        assert first == second


def test_clear_pending_resets_timestamp(app):
    with app.app_context():
        DeviceAlarmState.mark_pending('A0', 1, 'temperature', 'non_critical')
        DeviceAlarmState.clear_pending('A0', 1, 'temperature', 'non_critical')
        state = DeviceAlarmState.get('A0', 1, 'temperature', 'non_critical')
        assert state.pending_since is None


def test_trigger_resets_pending_and_return_notified(app):
    with app.app_context():
        DeviceAlarmState.mark_pending('A0', 1, 'temperature', 'non_critical')
        DeviceAlarmState.mark_return_notified('A0', 1, 'temperature', 'non_critical')
        DeviceAlarmState.trigger('A0', 1, 'temperature', 'non_critical')
        state = DeviceAlarmState.get('A0', 1, 'temperature', 'non_critical')
        assert state.pending_since is None
        assert state.return_notified is False
