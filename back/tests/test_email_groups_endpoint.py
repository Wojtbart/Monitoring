from werkzeug.security import generate_password_hash
from models import User


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    resp = client.post('/login', json={'username': 'boss', 'password': 'pw123'})
    return resp.get_json()['accessToken']


def test_add_group_requires_auth(client, app):
    resp = client.post('/email-groups', json={'name': 'IT'})
    assert resp.status_code == 401


def test_add_and_list_group(client, app):
    token = _login(client, app)
    resp = client.post('/email-groups', json={'name': 'IT'}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 201
    resp = client.get('/email-groups')
    data = resp.get_json()
    assert len(data['groups']) == 1
    assert data['groups'][0]['name'] == 'IT'
    assert data['groups'][0]['recipients'] == []


def test_add_group_rejects_duplicate_name(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    client.post('/email-groups', json={'name': 'IT'}, headers=headers)
    resp = client.post('/email-groups', json={'name': 'IT'}, headers=headers)
    assert resp.status_code == 400


def test_add_group_requires_name(client, app):
    token = _login(client, app)
    resp = client.post('/email-groups', json={}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_add_recipient_and_delete(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/email-groups', json={'name': 'IT'}, headers=headers).get_json()['id']

    resp = client.post(f'/email-groups/{group_id}/recipients', json={'email': 'a@b.com'}, headers=headers)
    assert resp.status_code == 201
    recipient_id = resp.get_json()['id']

    groups = client.get('/email-groups').get_json()['groups']
    assert groups[0]['recipients'] == [{'id': recipient_id, 'email': 'a@b.com'}]

    resp = client.delete(f'/email-groups/{group_id}/recipients/{recipient_id}', headers=headers)
    assert resp.status_code == 200
    groups = client.get('/email-groups').get_json()['groups']
    assert groups[0]['recipients'] == []


def test_add_recipient_to_missing_group_404(client, app):
    token = _login(client, app)
    resp = client.post('/email-groups/999/recipients', json={'email': 'a@b.com'}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404


def test_delete_group_cascades_recipients(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/email-groups', json={'name': 'IT'}, headers=headers).get_json()['id']
    client.post(f'/email-groups/{group_id}/recipients', json={'email': 'a@b.com'}, headers=headers)

    resp = client.delete(f'/email-groups/{group_id}', headers=headers)
    assert resp.status_code == 200

    from models import EmailRecipient
    assert EmailRecipient.query.count() == 0


def test_delete_missing_group_404(client, app):
    token = _login(client, app)
    resp = client.delete('/email-groups/999', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404
