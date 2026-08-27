from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
from models import db, User, DeviceSensor, DeviceSensorHistory


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def test_get_device_sensors_includes_extremes(client, app):
    resp = client.get('/device-sensors/A0/6')
    data = resp.get_json()
    assert data['lowest_temperature'] == data['temperature']
    assert data['highest_temperature'] == data['temperature']
    assert data['lowest_humidity'] == data['humidity']
    assert data['highest_humidity'] == data['humidity']
    assert data['lowest_temperature_at'] is not None


def test_clear_records_requires_auth(client):
    resp = client.delete('/device-sensors/A0/6/records')
    assert resp.status_code == 401


def test_clear_records_404_for_missing_device(client, app):
    token = _login(client, app)
    resp = client.delete('/device-sensors/Z9/999/records', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404


def test_clear_records_resets_extremes(client, app):
    token = _login(client, app)
    client.get('/device-sensors/A0/6')
    with app.app_context():
        device = DeviceSensor.query.filter_by(rack_id='A0', unit=6).first()
        device.lowest_temperature = -500.0
        device.highest_temperature = 500.0
        db.session.commit()

    resp = client.delete('/device-sensors/A0/6/records', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['lowest_temperature'] == data['temperature']
    assert data['highest_temperature'] == data['temperature']


def test_clear_history_requires_auth(client):
    resp = client.delete('/device-sensors/A0/6/history')
    assert resp.status_code == 401


def test_clear_history_removes_rows(client, app):
    token = _login(client, app)
    for _ in range(3):
        client.get('/device-sensors/A0/7')
    with app.app_context():
        assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=7).count() == 3

    resp = client.delete('/device-sensors/A0/7/history', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    with app.app_context():
        assert DeviceSensorHistory.query.filter_by(rack_id='A0', unit=7).count() == 0


def test_history_range_filters_by_time(client, app):
    client.get('/device-sensors/A0/8')
    with app.app_context():
        old_row = DeviceSensorHistory(
            rack_id='A0', unit=8, temperature=20.0, humidity=40.0,
            recorded_at=datetime.now() - timedelta(days=10),
        )
        db.session.add(old_row)
        db.session.commit()

    resp = client.get('/device-sensors/A0/8/history?range=24h')
    data = resp.get_json()['history']
    assert len(data) == 1

    resp_all = client.get('/device-sensors/A0/8/history?range=month')
    assert len(resp_all.get_json()['history']) == 2

    resp_no_range = client.get('/device-sensors/A0/8/history')
    assert len(resp_no_range.get_json()['history']) == 2
