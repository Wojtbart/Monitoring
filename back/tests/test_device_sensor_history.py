from datetime import datetime, timedelta
from models import db, DeviceSensor, DeviceSensorHistory


def test_reading_creates_one_history_row(app):
    DeviceSensor.get_or_create_reading('A0', 3)
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=3).count() == 1


def test_history_grows_with_each_call(app):
    for _ in range(5):
        DeviceSensor.get_or_create_reading('A0', 3)
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=3).count() == 5


def test_history_keeps_many_recent_rows(app):
    for _ in range(60):
        DeviceSensor.get_or_create_reading('A0', 3)
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=3).count() == 60


def test_history_prunes_rows_older_than_retention(app):
    DeviceSensor.get_or_create_reading('A0', 3)
    old_row = DeviceSensorHistory(
        rack_id='A0', unit=3, temperature=20.0, humidity=40.0,
        recorded_at=datetime.now() - timedelta(days=36),
    )
    db.session.add(old_row)
    db.session.commit()
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=3).count() == 2

    DeviceSensor.get_or_create_reading('A0', 3)
    remaining = DeviceSensorHistory.query.filter_by(rack_id='A0', unit=3).all()
    assert all(r.recorded_at >= datetime.now() - timedelta(days=35) for r in remaining)


def test_history_is_independent_per_slot(app):
    for _ in range(3):
        DeviceSensor.get_or_create_reading('A0', 1)
    for _ in range(2):
        DeviceSensor.get_or_create_reading('A0', 2)
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=1).count() == 3
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=2).count() == 2
