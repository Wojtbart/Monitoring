from models import DeviceSensor


def test_new_device_gets_default_thresholds(app):
    device = DeviceSensor.get_or_create_reading('A0', 9)
    assert device.min_temperature == 15.0
    assert device.max_temperature == 35.0
    assert device.min_humidity == 20.0
    assert device.max_humidity == 80.0


def test_thresholds_survive_subsequent_reads(app):
    DeviceSensor.get_or_create_reading('A0', 9)
    DeviceSensor.update_thresholds('A0', 9, 10.0, 30.0, 25.0, 70.0)
    device = DeviceSensor.get_or_create_reading('A0', 9)
    assert device.min_temperature == 10.0
    assert device.max_temperature == 30.0
    assert device.min_humidity == 25.0
    assert device.max_humidity == 70.0


def test_update_thresholds_returns_none_for_missing_device(app):
    result = DeviceSensor.update_thresholds('A0', 999, 10.0, 30.0, 25.0, 70.0)
    assert result is None


def test_update_thresholds_persists(app):
    DeviceSensor.get_or_create_reading('A0', 9)
    updated = DeviceSensor.update_thresholds('A0', 9, 12.0, 28.0, 30.0, 60.0)
    assert updated.min_temperature == 12.0
    assert updated.max_temperature == 28.0
    assert updated.min_humidity == 30.0
    assert updated.max_humidity == 60.0
