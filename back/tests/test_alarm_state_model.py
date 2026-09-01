from models import db, AlarmState


def test_seed_defaults_creates_five_rows(app):
    with app.app_context():
        AlarmState.seed_defaults()
        assert AlarmState.query.count() == 5
        assert {s.event_type for s in AlarmState.query.all()} == {'fire', 'gas', 'water', 'door', 'voltage'}
        assert all(s.active is False for s in AlarmState.query.all())


def test_seed_defaults_is_idempotent(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.seed_defaults()
        assert AlarmState.query.count() == 5


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
        assert AlarmState.query.count() == 5


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


def test_trigger_resets_acknowledged(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('fire')
        AlarmState.acknowledge('fire')
        AlarmState.trigger('fire')
        state = AlarmState.query.filter_by(event_type='fire').first()
        assert state.acknowledged is False


def test_acknowledge_sets_flag_without_deactivating(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('gas')
        result = AlarmState.acknowledge('gas')
        assert result is True
        state = AlarmState.query.filter_by(event_type='gas').first()
        assert state.acknowledged is True
        assert state.active is True


def test_acknowledge_on_unknown_type_returns_false(app):
    with app.app_context():
        AlarmState.seed_defaults()
        assert AlarmState.acknowledge('unknown') is False


def test_clear_resets_acknowledged(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('water')
        AlarmState.acknowledge('water')
        AlarmState.clear('water')
        state = AlarmState.query.filter_by(event_type='water').first()
        assert state.acknowledged is False


def test_get_all_returns_serializable_dicts(app):
    with app.app_context():
        AlarmState.seed_defaults()
        AlarmState.trigger('water')
        states = AlarmState.get_all()
        assert len(states) == 5
        water = next(s for s in states if s['event_type'] == 'water')
        assert water['active'] is True
        assert water['last_triggered_at'] is not None
        assert water['cleared_at'] is None
