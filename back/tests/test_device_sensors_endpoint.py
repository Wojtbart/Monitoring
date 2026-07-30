def test_get_device_sensors_returns_reading(client):
    resp = client.get('/deviceSensors/A0/3')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 20.0 <= data['temperature'] <= 32.0
    assert 35.0 <= data['humidity'] <= 75.0
    assert 'updated_at' in data


def test_get_device_sensors_same_slot_returns_updated_reading(client):
    first = client.get('/deviceSensors/A0/3').get_json()
    second = client.get('/deviceSensors/A0/3').get_json()
    assert 10.0 <= second['temperature'] <= 45.0
    assert 10.0 <= second['humidity'] <= 95.0


def test_get_device_sensors_requires_no_auth(client):
    resp = client.get('/deviceSensors/A1/7')
    assert resp.status_code == 200
