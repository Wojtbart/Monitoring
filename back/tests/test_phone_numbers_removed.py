from datetime import time as dtime
from models import db, Setting


def test_phone_numbers_post_route_gone(client, app):
    resp = client.post('/phone-numbers', json={'phone_number': '123'})
    assert resp.status_code == 404


def test_phone_numbers_get_route_gone(client, app):
    resp = client.get('/phone-numbers')
    assert resp.status_code == 404


def test_settings_and_phone_numbers_no_longer_includes_phone_numbers(client, app):
    with app.app_context():
        db.session.add(Setting(recording_seconds=30, morning_test_time=dtime(8, 0, 0), evening_test_time=dtime(20, 0, 0)))
        db.session.commit()
    resp = client.get('/settings-and-phone-numbers')
    assert resp.status_code == 200
    assert 'phone_numbers' not in resp.get_json()
