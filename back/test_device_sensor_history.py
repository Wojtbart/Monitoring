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
