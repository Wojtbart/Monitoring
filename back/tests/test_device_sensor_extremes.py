from models import db, DeviceSensor, DeviceSensorHistory


def test_first_reading_sets_extremes_to_itself(app):
    device = DeviceSensor.get_or_create_reading('A0', 4)
    assert device.lowest_temperature == device.temperature
    assert device.highest_temperature == device.temperature
    assert device.lowest_humidity == device.humidity
    assert device.highest_humidity == device.humidity


def test_extremes_update_on_new_low(app):
    device = DeviceSensor.get_or_create_reading('A0', 4)
    device.temperature = 20.0
    device.lowest_temperature = 20.0
    device.highest_temperature = 20.0
    db.session.commit()

    device.temperature = 5.0
    db.session.add(device)
    db.session.commit()
    DeviceSensor._update_extremes(device)
    db.session.commit()

    assert device.lowest_temperature == 5.0
    assert device.highest_temperature == 20.0


def test_extremes_update_on_new_high(app):
    device = DeviceSensor.get_or_create_reading('A0', 4)
    device.temperature = 20.0
    device.lowest_temperature = 20.0
    device.highest_temperature = 20.0
    db.session.commit()

    device.temperature = 40.0
    DeviceSensor._update_extremes(device)
    db.session.commit()

    assert device.highest_temperature == 40.0
    assert device.lowest_temperature == 20.0


def test_clear_records_resets_to_current_reading(app):
    device = DeviceSensor.get_or_create_reading('A0', 4)
    device.lowest_temperature = -1000.0
    device.highest_temperature = 1000.0
    db.session.commit()

    updated = DeviceSensor.clear_records('A0', 4)
    assert updated.lowest_temperature == updated.temperature
    assert updated.highest_temperature == updated.temperature
    assert updated.lowest_humidity == updated.humidity
    assert updated.highest_humidity == updated.humidity


def test_clear_records_returns_none_for_missing_device(app):
    assert DeviceSensor.clear_records('Z9', 999) is None


def test_clear_history_removes_all_rows_for_slot(app):
    for _ in range(5):
        DeviceSensor.get_or_create_reading('A0', 4)
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=4).count() == 5

    DeviceSensor.clear_history('A0', 4)
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=4).count() == 0


def test_clear_history_does_not_affect_other_slots(app):
    DeviceSensor.get_or_create_reading('A0', 4)
    DeviceSensor.get_or_create_reading('A0', 5)
    DeviceSensor.clear_history('A0', 4)
    assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=5).count() == 1
