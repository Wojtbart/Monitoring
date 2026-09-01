from datetime import datetime
from werkzeug.security import generate_password_hash
from models import User, NotificationGroup, DEFAULT_SCHEDULE, is_within_schedule


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    return client.post('/login', json={'username': 'boss', 'password': 'pw123'}).get_json()['accessToken']


def test_new_group_gets_always_on_schedule(app):
    with app.app_context():
        group = NotificationGroup.add_group('IT')
        assert group.schedule == DEFAULT_SCHEDULE


def test_update_schedule_persists(app):
    with app.app_context():
        group = NotificationGroup.add_group('IT')
        custom = ('0' * 168)
        updated = NotificationGroup.update_schedule(group.id, custom)
        assert updated.schedule == custom
        assert NotificationGroup.query.get(group.id).schedule == custom


def test_update_schedule_returns_none_for_missing_group(app):
    with app.app_context():
        assert NotificationGroup.update_schedule(999, '1' * 168) is None


def test_is_within_schedule_true_when_no_schedule():
    assert is_within_schedule(None, datetime(2026, 1, 5, 10, 0)) is True
    assert is_within_schedule('', datetime(2026, 1, 5, 10, 0)) is True


def test_is_within_schedule_checks_correct_bit():
    # 2026-01-05 to poniedziałek (weekday=0), godzina 10
    schedule = list('0' * 168)
    schedule[0 * 24 + 10] = '1'
    schedule = ''.join(schedule)
    when = datetime(2026, 1, 5, 10, 30)
    assert is_within_schedule(schedule, when) is True
    when_off = datetime(2026, 1, 5, 11, 0)
    assert is_within_schedule(schedule, when_off) is False


def test_is_within_schedule_different_day():
    schedule = list('0' * 168)
    schedule[3 * 24 + 5] = '1'  # czwartek (weekday=3), godzina 5
    schedule = ''.join(schedule)
    thursday_5am = datetime(2026, 1, 8, 5, 15)
    assert is_within_schedule(schedule, thursday_5am) is True
    friday_5am = datetime(2026, 1, 9, 5, 15)
    assert is_within_schedule(schedule, friday_5am) is False


def test_new_group_endpoint_has_default_schedule(client, app):
    token = _login(client, app)
    client.post('/notification-groups', json={'name': 'IT'}, headers={'Authorization': f'Bearer {token}'})
    groups = client.get('/notification-groups').get_json()['groups']
    assert groups[0]['schedule'] == DEFAULT_SCHEDULE


def test_update_group_schedule_requires_auth(client, app):
    resp = client.put('/notification-groups/1/schedule', json={'schedule': '1' * 168})
    assert resp.status_code == 401


def test_update_group_schedule_persists_via_endpoint(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/notification-groups', json={'name': 'IT'}, headers=headers).get_json()['id']
    custom = '0' * 168
    resp = client.put(f'/notification-groups/{group_id}/schedule', json={'schedule': custom}, headers=headers)
    assert resp.status_code == 200
    groups = client.get('/notification-groups').get_json()['groups']
    assert groups[0]['schedule'] == custom


def test_update_group_schedule_rejects_bad_length(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/notification-groups', json={'name': 'IT'}, headers=headers).get_json()['id']
    resp = client.put(f'/notification-groups/{group_id}/schedule', json={'schedule': '111'}, headers=headers)
    assert resp.status_code == 400


def test_update_group_schedule_404_for_missing_group(client, app):
    token = _login(client, app)
    resp = client.put('/notification-groups/999/schedule', json={'schedule': '1' * 168},
                       headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404
