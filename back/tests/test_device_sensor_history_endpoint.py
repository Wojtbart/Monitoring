from werkzeug.security import generate_password_hash
from models import User


def _enable(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    token = client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']
    client.put('/device-sensor-settings', json={'enabled': True},
               headers={'Authorization': f'Bearer {token}'})


def test_history_endpoint_empty_when_no_reading_yet(client):
    resp = client.get('/device-sensors/B9/history')
    assert resp.status_code == 200
    assert resp.get_json() == {'history': []}


def test_history_endpoint_returns_ascending_order(client, app):
    _enable(client, app)
    client.get('/device-sensors/A0')
    client.get('/device-sensors/A0')
    client.get('/device-sensors/A0')

    resp = client.get('/device-sensors/A0/history')
    assert resp.status_code == 200
    data = resp.get_json()['history']
    assert len(data) == 3
    timestamps = [row['recorded_at'] for row in data]
    assert timestamps == sorted(timestamps)
    for row in data:
        assert 'temperature' in row
        assert 'humidity' in row
