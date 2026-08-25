from werkzeug.security import generate_password_hash
from models import User, NotificationRule, EmailGroup


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    resp = client.post('/login', json={'username': 'boss', 'password': 'pw123'})
    return resp.get_json()['accessToken']


def _seed(app):
    with app.app_context():
        NotificationRule.seed_defaults()


def test_get_rules_returns_seeded_five(client, app):
    _seed(app)
    resp = client.get('/notification-rules')
    rules = resp.get_json()['rules']
    assert len(rules) == 5
    assert {r['event_type'] for r in rules} == {'fire', 'gas', 'water', 'door', 'device_threshold'}
    assert all(r['email_enabled'] is False and r['sms_enabled'] is False for r in rules)


def test_seed_defaults_is_idempotent(app):
    with app.app_context():
        NotificationRule.seed_defaults()
        NotificationRule.seed_defaults()
        assert NotificationRule.query.count() == 5


def test_update_rules_requires_auth(client, app):
    _seed(app)
    resp = client.put('/notification-rules', json={'rules': []})
    assert resp.status_code == 401


def test_update_rules_success(client, app):
    _seed(app)
    token = _login(client, app)
    with app.app_context():
        group = EmailGroup.add_group('IT')
        group_id = group.id
    payload = {'rules': [
        {'event_type': 'fire', 'email_enabled': True, 'email_group_id': group_id, 'sms_enabled': False, 'sms_group_id': None},
        {'event_type': 'gas', 'email_enabled': False, 'email_group_id': None, 'sms_enabled': False, 'sms_group_id': None},
        {'event_type': 'water', 'email_enabled': False, 'email_group_id': None, 'sms_enabled': False, 'sms_group_id': None},
        {'event_type': 'door', 'email_enabled': False, 'email_group_id': None, 'sms_enabled': False, 'sms_group_id': None},
        {'event_type': 'device_threshold', 'email_enabled': False, 'email_group_id': None, 'sms_enabled': False, 'sms_group_id': None},
    ]}
    resp = client.put('/notification-rules', json=payload, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    rules = client.get('/notification-rules').get_json()['rules']
    fire_rule = next(r for r in rules if r['event_type'] == 'fire')
    assert fire_rule['email_enabled'] is True
    assert fire_rule['email_group_id'] == group_id


def test_update_rules_rejects_wrong_count(client, app):
    _seed(app)
    token = _login(client, app)
    resp = client.put('/notification-rules', json={'rules': []}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_update_rules_rejects_unknown_group(client, app):
    _seed(app)
    token = _login(client, app)
    payload = {'rules': [
        {'event_type': 'fire', 'email_enabled': True, 'email_group_id': 999, 'sms_enabled': False, 'sms_group_id': None},
        {'event_type': 'gas', 'email_enabled': False, 'email_group_id': None, 'sms_enabled': False, 'sms_group_id': None},
        {'event_type': 'water', 'email_enabled': False, 'email_group_id': None, 'sms_enabled': False, 'sms_group_id': None},
        {'event_type': 'door', 'email_enabled': False, 'email_group_id': None, 'sms_enabled': False, 'sms_group_id': None},
        {'event_type': 'device_threshold', 'email_enabled': False, 'email_group_id': None, 'sms_enabled': False, 'sms_group_id': None},
    ]}
    resp = client.put('/notification-rules', json=payload, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400
