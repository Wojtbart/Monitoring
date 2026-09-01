from werkzeug.security import generate_password_hash
from models import User, NotificationRecipient


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    resp = client.post('/login', json={'username': 'boss', 'password': 'pw123'})
    return resp.get_json()['accessToken']


def test_add_group_requires_auth(client, app):
    resp = client.post('/notification-groups', json={'name': 'IT'})
    assert resp.status_code == 401


def test_add_and_list_group(client, app):
    token = _login(client, app)
    resp = client.post('/notification-groups', json={'name': 'IT'}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 201
    resp = client.get('/notification-groups')
    data = resp.get_json()
    assert len(data['groups']) == 1
    assert data['groups'][0]['name'] == 'IT'
    assert data['groups'][0]['recipients'] == []


def test_add_group_rejects_duplicate_name(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    client.post('/notification-groups', json={'name': 'IT'}, headers=headers)
    resp = client.post('/notification-groups', json={'name': 'IT'}, headers=headers)
    assert resp.status_code == 400


def test_add_group_requires_name(client, app):
    token = _login(client, app)
    resp = client.post('/notification-groups', json={}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_add_recipient_with_email_only(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/notification-groups', json={'name': 'IT'}, headers=headers).get_json()['id']

    resp = client.post(f'/notification-groups/{group_id}/recipients', json={'email': 'a@b.com'}, headers=headers)
    assert resp.status_code == 201
    recipient_id = resp.get_json()['id']

    groups = client.get('/notification-groups').get_json()['groups']
    assert groups[0]['recipients'] == [{'id': recipient_id, 'email': 'a@b.com', 'phone_number': None}]


def test_add_recipient_with_phone_only(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/notification-groups', json={'name': 'IT'}, headers=headers).get_json()['id']

    resp = client.post(f'/notification-groups/{group_id}/recipients', json={'phone_number': '111222333'}, headers=headers)
    assert resp.status_code == 201
    recipient_id = resp.get_json()['id']

    groups = client.get('/notification-groups').get_json()['groups']
    assert groups[0]['recipients'] == [{'id': recipient_id, 'email': None, 'phone_number': '111222333'}]


def test_add_recipient_with_both_email_and_phone(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/notification-groups', json={'name': 'IT'}, headers=headers).get_json()['id']

    resp = client.post(f'/notification-groups/{group_id}/recipients',
                        json={'email': 'a@b.com', 'phone_number': '111222333'}, headers=headers)
    assert resp.status_code == 201

    groups = client.get('/notification-groups').get_json()['groups']
    assert groups[0]['recipients'][0]['email'] == 'a@b.com'
    assert groups[0]['recipients'][0]['phone_number'] == '111222333'


def test_add_recipient_rejects_empty(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/notification-groups', json={'name': 'IT'}, headers=headers).get_json()['id']

    resp = client.post(f'/notification-groups/{group_id}/recipients', json={}, headers=headers)
    assert resp.status_code == 400


def test_delete_recipient(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/notification-groups', json={'name': 'IT'}, headers=headers).get_json()['id']
    recipient_id = client.post(f'/notification-groups/{group_id}/recipients', json={'email': 'a@b.com'},
                                headers=headers).get_json()['id']

    resp = client.delete(f'/notification-groups/{group_id}/recipients/{recipient_id}', headers=headers)
    assert resp.status_code == 200
    groups = client.get('/notification-groups').get_json()['groups']
    assert groups[0]['recipients'] == []


def test_add_recipient_to_missing_group_404(client, app):
    token = _login(client, app)
    resp = client.post('/notification-groups/999/recipients', json={'email': 'a@b.com'},
                        headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404


def test_delete_group_cascades_recipients(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/notification-groups', json={'name': 'IT'}, headers=headers).get_json()['id']
    client.post(f'/notification-groups/{group_id}/recipients', json={'email': 'a@b.com'}, headers=headers)

    resp = client.delete(f'/notification-groups/{group_id}', headers=headers)
    assert resp.status_code == 200

    assert NotificationRecipient.query.count() == 0


def test_delete_missing_group_404(client, app):
    token = _login(client, app)
    resp = client.delete('/notification-groups/999', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404
