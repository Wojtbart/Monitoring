from werkzeug.security import generate_password_hash
from models import User, AlarmState
import app as app_module


class _FakeSensor:
    def _raise_alert(self, event_type, sensor_name, is_warning, desc, force=False):
        AlarmState.trigger(event_type)


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    resp = client.post('/login', json={'username': 'boss', 'password': 'pw123'})
    return resp.get_json()['accessToken']


def _seed(app):
    with app.app_context():
        AlarmState.seed_defaults()


def test_get_alarm_states_returns_seeded_five(client, app):
    _seed(app)
    resp = client.get('/alarm-states')
    states = resp.get_json()['states']
    assert len(states) == 5
    assert {s['event_type'] for s in states} == {'fire', 'gas', 'water', 'door', 'voltage'}


def test_simulate_requires_auth(client, app):
    _seed(app)
    resp = client.post('/sensors/fire/simulate')
    assert resp.status_code == 401


def test_simulate_rejects_unknown_type(client, app):
    _seed(app)
    token = _login(client, app)
    resp = client.post('/sensors/unknown/simulate', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_simulate_sets_alarm_active(client, app, monkeypatch):
    _seed(app)
    token = _login(client, app)
    monkeypatch.setattr(app_module, 'sensor', _FakeSensor())

    resp = client.post('/sensors/water/simulate', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200

    states = client.get('/alarm-states').get_json()['states']
    water = next(s for s in states if s['event_type'] == 'water')
    assert water['active'] is True


def test_acknowledge_requires_auth(client, app):
    _seed(app)
    resp = client.delete('/sensors/fire/acknowledge')
    assert resp.status_code == 401


def test_acknowledge_rejects_unknown_type(client, app):
    _seed(app)
    token = _login(client, app)
    resp = client.delete('/sensors/unknown/acknowledge', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_acknowledge_marks_acknowledged_but_stays_active(client, app):
    _seed(app)
    token = _login(client, app)
    with app.app_context():
        AlarmState.trigger('door')

    resp = client.delete('/sensors/door/acknowledge', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200

    states = client.get('/alarm-states').get_json()['states']
    door = next(s for s in states if s['event_type'] == 'door')
    assert door['active'] is True
    assert door['acknowledged'] is True
