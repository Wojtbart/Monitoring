from models import DeviceSensor


def test_new_device_gets_default_thresholds(app):
    device = DeviceSensor.get_or_create_reading('A0', 9)
    assert device.min_temperature == 15.0
    assert device.max_temperature == 35.0
    assert device.min_humidity == 20.0
    assert device.max_humidity == 80.0
    assert device.min_temperature_critical == 5.0
    assert device.max_temperature_critical == 45.0
    assert device.min_humidity_critical == 10.0
    assert device.max_humidity_critical == 90.0
    assert device.alert_delay_seconds == 0


def test_thresholds_survive_subsequent_reads(app):
    DeviceSensor.get_or_create_reading('A0', 9)
    DeviceSensor.update_thresholds('A0', 9, 10.0, 30.0, 25.0, 70.0, 0.0, 40.0, 15.0, 85.0, 60)
    device = DeviceSensor.get_or_create_reading('A0', 9)
    assert device.min_temperature == 10.0
    assert device.max_temperature == 30.0
    assert device.min_humidity == 25.0
    assert device.max_humidity == 70.0
    assert device.min_temperature_critical == 0.0
    assert device.max_temperature_critical == 40.0
    assert device.min_humidity_critical == 15.0
    assert device.max_humidity_critical == 85.0
    assert device.alert_delay_seconds == 60


def test_update_thresholds_returns_none_for_missing_device(app):
    result = DeviceSensor.update_thresholds('A0', 999, 10.0, 30.0, 25.0, 70.0, 0.0, 40.0, 15.0, 85.0, 60)
    assert result is None


def test_update_thresholds_persists(app):
    DeviceSensor.get_or_create_reading('A0', 9)
    updated = DeviceSensor.update_thresholds('A0', 9, 12.0, 28.0, 30.0, 60.0, 2.0, 38.0, 20.0, 75.0, 30)
    assert updated.min_temperature == 12.0
    assert updated.max_temperature == 28.0
    assert updated.min_humidity == 30.0
    assert updated.max_humidity == 60.0
    assert updated.min_temperature_critical == 2.0
    assert updated.max_temperature_critical == 38.0
    assert updated.min_humidity_critical == 20.0
    assert updated.max_humidity_critical == 75.0
    assert updated.alert_delay_seconds == 30
