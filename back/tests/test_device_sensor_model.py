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
