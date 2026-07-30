from datetime import time as dtime
from werkzeug.security import generate_password_hash
from models import db, User, Setting
import app as app_module


class _FakeSensor:
    def update_settings(self, settings):
        pass


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    resp = client.post('/login', json={'username': 'boss', 'password': 'pw123'})
    return resp.get_json()['accessToken']


def _seed_settings(app):
    with app.app_context():
        setting = Setting(
            recording_seconds=30,
            morning_test_time=dtime(8, 0, 0),
            evening_test_time=dtime(20, 0, 0),
        )
        db.session.add(setting)
        db.session.commit()
        return setting.id


def test_update_settings_accepts_time_strings(client, app):
    settings_id = _seed_settings(app)
    token = _login(client, app)
    app_module.sensor = _FakeSensor()

    resp = client.put(
        '/settings',
        json={
            'id': settings_id,
            'recording_seconds': 45,
            'morning_test_time': '07:30:00',
            'evening_test_time': '21:15:00',
        },
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 200

    updated = client.get('/settings').get_json()['settings'][0]
    assert updated['recording_seconds'] == 45
    assert updated['morning_test_time'] == '07:30:00'
    assert updated['evening_test_time'] == '21:15:00'
