from models import VoltageThreshold


def test_get_or_create_returns_defaults_when_missing(app):
    with app.app_context():
        threshold = VoltageThreshold.get_or_create()
        assert threshold.min_voltage == 11.0
        assert threshold.max_voltage == 15.0


def test_get_or_create_is_idempotent(app):
    with app.app_context():
        VoltageThreshold.get_or_create()
        VoltageThreshold.get_or_create()
        assert VoltageThreshold.query.count() == 1


def test_update_changes_thresholds(app):
    with app.app_context():
        VoltageThreshold.get_or_create()
        updated = VoltageThreshold.update(10.0, 16.0)
        assert updated.min_voltage == 10.0
        assert updated.max_voltage == 16.0
        assert VoltageThreshold.query.count() == 1
