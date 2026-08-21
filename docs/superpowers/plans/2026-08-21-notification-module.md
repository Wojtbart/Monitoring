# Moduł powiadomień e-mail/SMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grupy odbiorców mailowych/SMS + reguły przypisania grupy do zdarzenia (pożar/gaz/zalanie/drzwi), z realną wysyłką e-mail (SMTP) i zamockowaną wysyłką SMS.

**Architecture:** 5 nowych modeli SQLAlchemy + REST endpointy w `app.py` + nowy `notifications.py` (wysyłka) + hook w `sensors.py._check_thresholds` + nowa sekcja w `Settings.jsx` zastępująca starą, martwą listę numerów telefonu.

**Tech Stack:** Flask-SQLAlchemy, `smtplib` (stdlib, bez nowej zależności), pytest, React + MUI + axios (frontend, bez zmian stacku).

**Spec:** `docs/superpowers/specs/2026-08-21-notification-module-design.md`

## Global Constraints

- **Nigdy nie uruchamiaj `git`/`gh`** — brak kroków commit w tym planie, użytkownik commituje sam.
- **Pytaj o zgodę przed każdym pojedynczym wywołaniu Bash** (pytest, esbuild, npm run build) — nie łącz komend bez potwierdzenia.
- Komunikaty API (`message`) zawsze po polsku.
- Backend: baza testowa zawsze `sqlite:///:memory:` przez `back/tests/conftest.py` (już poprawnie skonfigurowane) — testy uruchamiane `cd back && python -m pytest -v`.
- Frontend: brak test runnera (jest/vitest) — weryfikacja przez `npx esbuild <plik> --bundle=false --loader:.jsx=jsx` + `npm run build`, zamiast automatycznych testów.
- Dane SMTP (host/port/login/hasło) wyłącznie w `.env` — nigdy w bazie danych.
- SMS pozostaje zamockowany (log w konsoli) — brak realnego dostawcy na tym etapie.
- Zachowaj istniejące id zdarzeń: `event_type` ∈ `{fire, gas, water, door}` dokładnie tak, jak nazwane w `sensors.py`.

---

### Task 1: Grupy mailowe (model + endpointy)

**Files:**
- Modify: `back/models.py`
- Modify: `back/app.py`
- Test: `back/tests/test_email_groups_endpoint.py`

**Interfaces:**
- Produces: `EmailGroup` (statyczne metody `get_all_with_recipients()`, `add_group(name)`, `delete_group(group_id)`, `add_recipient(group_id, email)`, `delete_recipient(recipient_id)`), `EmailRecipient` (kolumny `id, group_id, email`). Endpointy `POST/GET /email-groups`, `DELETE /email-groups/<id>`, `POST/DELETE /email-groups/<id>/recipients[/<recipient_id>]`. Task 3 (reguły) waliduje `email_group_id` przez `db.session.get(EmailGroup, id)`.

- [ ] **Step 1: Napisz failing testy**

Utwórz `back/tests/test_email_groups_endpoint.py`:
```python
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
```

- [ ] **Step 2: Uruchom testy, potwierdź że failują**

Run: `cd back && python -m pytest tests/test_email_groups_endpoint.py -v`
Expected: FAIL (404 — trasy jeszcze nie istnieją / `ImportError` na `EmailGroup`)

- [ ] **Step 3: Dodaj modele do `back/models.py`**

Dodaj na końcu pliku (po `DeviceSensorHistory`):
```python
class EmailGroup(db.Model):
    __tablename__ = 'email_groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)

    @staticmethod
    def get_all_with_recipients():
        groups = EmailGroup.query.all()
        return [
            {
                'id': g.id,
                'name': g.name,
                'recipients': [
                    {'id': r.id, 'email': r.email}
                    for r in EmailRecipient.query.filter_by(group_id=g.id).all()
                ],
            }
            for g in groups
        ]

    @staticmethod
    def add_group(name):
        if EmailGroup.query.filter_by(name=name).first():
            return None
        group = EmailGroup(name=name)
        db.session.add(group)
        db.session.commit()
        return group

    @staticmethod
    def delete_group(group_id):
        group = db.session.get(EmailGroup, group_id)
        if not group:
            return False
        EmailRecipient.query.filter_by(group_id=group_id).delete()
        db.session.delete(group)
        db.session.commit()
        return True

    @staticmethod
    def add_recipient(group_id, email):
        if not db.session.get(EmailGroup, group_id):
            return None
        recipient = EmailRecipient(group_id=group_id, email=email)
        db.session.add(recipient)
        db.session.commit()
        return recipient

    @staticmethod
    def delete_recipient(recipient_id):
        recipient = db.session.get(EmailRecipient, recipient_id)
        if not recipient:
            return False
        db.session.delete(recipient)
        db.session.commit()
        return True


class EmailRecipient(db.Model):
    __tablename__ = 'email_recipients'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('email_groups.id'), nullable=False)
    email = db.Column(db.String(255), nullable=False)
```

- [ ] **Step 4: Dodaj endpointy do `back/app.py`**

Zmień import modeli (linia z `from models import ...`):
```python
from models import db, User, PhoneNumber, Setting, Log, Layout, DeviceSensor, DeviceSensorHistory, EmailGroup, EmailRecipient
```

Dodaj trasy (obok istniejących `/phone-numbers`, przed `/settings`):
```python
@app.route('/email-groups', methods=['POST'])
@jwt_required()
def add_email_group():
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'message': 'Nazwa grupy wymagana'}), 400
    group = EmailGroup.add_group(name)
    if not group:
        return jsonify({'message': 'Grupa o takiej nazwie już istnieje'}), 400
    return jsonify({'message': 'Grupa dodana', 'id': group.id}), 201


@app.route('/email-groups', methods=['GET'])
def get_email_groups():
    return jsonify({'groups': EmailGroup.get_all_with_recipients()}), 200


@app.route('/email-groups/<int:group_id>', methods=['DELETE'])
@jwt_required()
def delete_email_group(group_id):
    if not EmailGroup.delete_group(group_id):
        return jsonify({'message': 'Grupa nie znaleziona'}), 404
    return jsonify({'message': 'Grupa usunięta'}), 200


@app.route('/email-groups/<int:group_id>/recipients', methods=['POST'])
@jwt_required()
def add_email_recipient(group_id):
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'message': 'Adres e-mail wymagany'}), 400
    recipient = EmailGroup.add_recipient(group_id, email)
    if not recipient:
        return jsonify({'message': 'Grupa nie znaleziona'}), 404
    return jsonify({'message': 'Adres dodany', 'id': recipient.id}), 201


@app.route('/email-groups/<int:group_id>/recipients/<int:recipient_id>', methods=['DELETE'])
@jwt_required()
def delete_email_recipient(group_id, recipient_id):
    if not EmailGroup.delete_recipient(recipient_id):
        return jsonify({'message': 'Adres nie znaleziony'}), 404
    return jsonify({'message': 'Adres usunięty'}), 200
```

- [ ] **Step 5: Uruchom testy, potwierdź że przechodzą**

Run: `cd back && python -m pytest tests/test_email_groups_endpoint.py -v`
Expected: PASS (8/8)

---

### Task 2: Grupy SMS (model + endpointy)

**Files:**
- Modify: `back/models.py`
- Modify: `back/app.py`
- Test: `back/tests/test_sms_groups_endpoint.py`

**Interfaces:**
- Consumes: nic z Task 1 (niezależne, ten sam wzorzec).
- Produces: `SmsGroup` (te same statyczne metody co `EmailGroup`, `add_recipient(group_id, phone_number)`), `SmsRecipient` (kolumny `id, group_id, phone_number`). Endpointy `POST/GET /sms-groups`, `DELETE /sms-groups/<id>`, `POST/DELETE /sms-groups/<id>/recipients[/<recipient_id>]`. Task 3 waliduje `sms_group_id` przez `db.session.get(SmsGroup, id)`.

- [ ] **Step 1: Napisz failing testy**

Utwórz `back/tests/test_sms_groups_endpoint.py` (dokładna kopia `test_email_groups_endpoint.py` z podmienionymi nazwami):
```python
from werkzeug.security import generate_password_hash
from models import User


def _login(client, app):
    with app.app_context():
        User.add_user('boss', generate_password_hash('pw123', method='pbkdf2:sha256'), True)
    resp = client.post('/login', json={'username': 'boss', 'password': 'pw123'})
    return resp.get_json()['accessToken']


def test_add_group_requires_auth(client, app):
    resp = client.post('/sms-groups', json={'name': 'IT'})
    assert resp.status_code == 401


def test_add_and_list_group(client, app):
    token = _login(client, app)
    resp = client.post('/sms-groups', json={'name': 'IT'}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 201
    resp = client.get('/sms-groups')
    data = resp.get_json()
    assert len(data['groups']) == 1
    assert data['groups'][0]['name'] == 'IT'
    assert data['groups'][0]['recipients'] == []


def test_add_group_rejects_duplicate_name(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    client.post('/sms-groups', json={'name': 'IT'}, headers=headers)
    resp = client.post('/sms-groups', json={'name': 'IT'}, headers=headers)
    assert resp.status_code == 400


def test_add_group_requires_name(client, app):
    token = _login(client, app)
    resp = client.post('/sms-groups', json={}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_add_recipient_and_delete(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/sms-groups', json={'name': 'IT'}, headers=headers).get_json()['id']

    resp = client.post(f'/sms-groups/{group_id}/recipients', json={'phone_number': '111222333'}, headers=headers)
    assert resp.status_code == 201
    recipient_id = resp.get_json()['id']

    groups = client.get('/sms-groups').get_json()['groups']
    assert groups[0]['recipients'] == [{'id': recipient_id, 'phone_number': '111222333'}]

    resp = client.delete(f'/sms-groups/{group_id}/recipients/{recipient_id}', headers=headers)
    assert resp.status_code == 200
    groups = client.get('/sms-groups').get_json()['groups']
    assert groups[0]['recipients'] == []


def test_add_recipient_to_missing_group_404(client, app):
    token = _login(client, app)
    resp = client.post('/sms-groups/999/recipients', json={'phone_number': '111'}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404


def test_delete_group_cascades_recipients(client, app):
    token = _login(client, app)
    headers = {'Authorization': f'Bearer {token}'}
    group_id = client.post('/sms-groups', json={'name': 'IT'}, headers=headers).get_json()['id']
    client.post(f'/sms-groups/{group_id}/recipients', json={'phone_number': '111'}, headers=headers)

    resp = client.delete(f'/sms-groups/{group_id}', headers=headers)
    assert resp.status_code == 200

    from models import SmsRecipient
    assert SmsRecipient.query.count() == 0


def test_delete_missing_group_404(client, app):
    token = _login(client, app)
    resp = client.delete('/sms-groups/999', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404
```

- [ ] **Step 2: Uruchom testy, potwierdź że failują**

Run: `cd back && python -m pytest tests/test_sms_groups_endpoint.py -v`
Expected: FAIL

- [ ] **Step 3: Dodaj modele do `back/models.py`**

Dodaj po `EmailRecipient`:
```python
class SmsGroup(db.Model):
    __tablename__ = 'sms_groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)

    @staticmethod
    def get_all_with_recipients():
        groups = SmsGroup.query.all()
        return [
            {
                'id': g.id,
                'name': g.name,
                'recipients': [
                    {'id': r.id, 'phone_number': r.phone_number}
                    for r in SmsRecipient.query.filter_by(group_id=g.id).all()
                ],
            }
            for g in groups
        ]

    @staticmethod
    def add_group(name):
        if SmsGroup.query.filter_by(name=name).first():
            return None
        group = SmsGroup(name=name)
        db.session.add(group)
        db.session.commit()
        return group

    @staticmethod
    def delete_group(group_id):
        group = db.session.get(SmsGroup, group_id)
        if not group:
            return False
        SmsRecipient.query.filter_by(group_id=group_id).delete()
        db.session.delete(group)
        db.session.commit()
        return True

    @staticmethod
    def add_recipient(group_id, phone_number):
        if not db.session.get(SmsGroup, group_id):
            return None
        recipient = SmsRecipient(group_id=group_id, phone_number=phone_number)
        db.session.add(recipient)
        db.session.commit()
        return recipient

    @staticmethod
    def delete_recipient(recipient_id):
        recipient = db.session.get(SmsRecipient, recipient_id)
        if not recipient:
            return False
        db.session.delete(recipient)
        db.session.commit()
        return True


class SmsRecipient(db.Model):
    __tablename__ = 'sms_recipients'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('sms_groups.id'), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
```

- [ ] **Step 4: Dodaj endpointy do `back/app.py`**

Zmień import:
```python
from models import db, User, PhoneNumber, Setting, Log, Layout, DeviceSensor, DeviceSensorHistory, EmailGroup, EmailRecipient, SmsGroup, SmsRecipient
```

Dodaj trasy (analogiczne do email, `phone_number` zamiast `email`):
```python
@app.route('/sms-groups', methods=['POST'])
@jwt_required()
def add_sms_group():
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'message': 'Nazwa grupy wymagana'}), 400
    group = SmsGroup.add_group(name)
    if not group:
        return jsonify({'message': 'Grupa o takiej nazwie już istnieje'}), 400
    return jsonify({'message': 'Grupa dodana', 'id': group.id}), 201


@app.route('/sms-groups', methods=['GET'])
def get_sms_groups():
    return jsonify({'groups': SmsGroup.get_all_with_recipients()}), 200


@app.route('/sms-groups/<int:group_id>', methods=['DELETE'])
@jwt_required()
def delete_sms_group(group_id):
    if not SmsGroup.delete_group(group_id):
        return jsonify({'message': 'Grupa nie znaleziona'}), 404
    return jsonify({'message': 'Grupa usunięta'}), 200


@app.route('/sms-groups/<int:group_id>/recipients', methods=['POST'])
@jwt_required()
def add_sms_recipient(group_id):
    data = request.get_json()
    phone_number = data.get('phone_number')
    if not phone_number:
        return jsonify({'message': 'Numer telefonu wymagany'}), 400
    recipient = SmsGroup.add_recipient(group_id, phone_number)
    if not recipient:
        return jsonify({'message': 'Grupa nie znaleziona'}), 404
    return jsonify({'message': 'Numer dodany', 'id': recipient.id}), 201


@app.route('/sms-groups/<int:group_id>/recipients/<int:recipient_id>', methods=['DELETE'])
@jwt_required()
def delete_sms_recipient(group_id, recipient_id):
    if not SmsGroup.delete_recipient(recipient_id):
        return jsonify({'message': 'Numer nie znaleziony'}), 404
    return jsonify({'message': 'Numer usunięty'}), 200
```

- [ ] **Step 5: Uruchom testy, potwierdź że przechodzą**

Run: `cd back && python -m pytest tests/test_sms_groups_endpoint.py -v`
Expected: PASS (8/8)

---

### Task 3: Reguły powiadomień (model + seed + endpointy)

**Files:**
- Modify: `back/models.py`
- Modify: `back/app.py`
- Modify: `back/init_db.py`
- Test: `back/tests/test_notification_rules_endpoint.py`

**Interfaces:**
- Consumes: `EmailGroup`/`SmsGroup` z Task 1/2 (walidacja istnienia grupy przy `PUT`).
- Produces: `NOTIFICATION_EVENT_TYPES = ('fire', 'gas', 'water', 'door')`, `NotificationRule` (`seed_defaults()`, `get_all()`, `update_all(rules)`). Endpointy `GET/PUT /notification-rules`. Task 4 (`sensors.py`) odpytuje `NotificationRule.query.filter_by(event_type=...)` bezpośrednio.

- [ ] **Step 1: Napisz failing testy**

Utwórz `back/tests/test_notification_rules_endpoint.py`:
```python
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


def test_get_rules_returns_seeded_four(client, app):
    _seed(app)
    resp = client.get('/notification-rules')
    rules = resp.get_json()['rules']
    assert len(rules) == 4
    assert {r['event_type'] for r in rules} == {'fire', 'gas', 'water', 'door'}
    assert all(r['email_enabled'] is False and r['sms_enabled'] is False for r in rules)


def test_seed_defaults_is_idempotent(app):
    with app.app_context():
        NotificationRule.seed_defaults()
        NotificationRule.seed_defaults()
        assert NotificationRule.query.count() == 4


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
    ]}
    resp = client.put('/notification-rules', json=payload, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400
```

- [ ] **Step 2: Uruchom testy, potwierdź że failują**

Run: `cd back && python -m pytest tests/test_notification_rules_endpoint.py -v`
Expected: FAIL

- [ ] **Step 3: Dodaj model do `back/models.py`**

Dodaj po `SmsRecipient`:
```python
NOTIFICATION_EVENT_TYPES = ('fire', 'gas', 'water', 'door')


class NotificationRule(db.Model):
    __tablename__ = 'notification_rules'
    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(20), unique=True, nullable=False)
    email_enabled = db.Column(db.Boolean, nullable=False, default=False)
    email_group_id = db.Column(db.Integer, db.ForeignKey('email_groups.id'), nullable=True)
    sms_enabled = db.Column(db.Boolean, nullable=False, default=False)
    sms_group_id = db.Column(db.Integer, db.ForeignKey('sms_groups.id'), nullable=True)

    @staticmethod
    def seed_defaults():
        for event_type in NOTIFICATION_EVENT_TYPES:
            if not NotificationRule.query.filter_by(event_type=event_type).first():
                db.session.add(NotificationRule(event_type=event_type))
        db.session.commit()

    @staticmethod
    def get_all():
        return [
            {
                'event_type': r.event_type,
                'email_enabled': r.email_enabled,
                'email_group_id': r.email_group_id,
                'sms_enabled': r.sms_enabled,
                'sms_group_id': r.sms_group_id,
            }
            for r in NotificationRule.query.all()
        ]

    @staticmethod
    def update_all(rules):
        for rule_data in rules:
            rule = NotificationRule.query.filter_by(event_type=rule_data['event_type']).first()
            if not rule:
                continue
            rule.email_enabled = rule_data['email_enabled']
            rule.email_group_id = rule_data.get('email_group_id')
            rule.sms_enabled = rule_data['sms_enabled']
            rule.sms_group_id = rule_data.get('sms_group_id')
        db.session.commit()
```

- [ ] **Step 4: Dodaj endpointy do `back/app.py`**

Zmień import:
```python
from models import db, User, PhoneNumber, Setting, Log, Layout, DeviceSensor, DeviceSensorHistory, EmailGroup, EmailRecipient, SmsGroup, SmsRecipient, NotificationRule, NOTIFICATION_EVENT_TYPES
```

Dodaj trasy:
```python
@app.route('/notification-rules', methods=['GET'])
def get_notification_rules():
    return jsonify({'rules': NotificationRule.get_all()}), 200


@app.route('/notification-rules', methods=['PUT'])
@jwt_required()
def update_notification_rules():
    data = request.get_json()
    rules = data.get('rules')
    if not rules or len(rules) != len(NOTIFICATION_EVENT_TYPES):
        return jsonify({'message': 'Wymagane dokładnie 4 reguły'}), 400
    seen_types = set()
    for rule in rules:
        event_type = rule.get('event_type')
        if event_type not in NOTIFICATION_EVENT_TYPES or event_type in seen_types:
            return jsonify({'message': 'Nieprawidłowy typ zdarzenia'}), 400
        seen_types.add(event_type)
        if rule.get('email_group_id') is not None and not db.session.get(EmailGroup, rule['email_group_id']):
            return jsonify({'message': 'Grupa mailowa nie istnieje'}), 400
        if rule.get('sms_group_id') is not None and not db.session.get(SmsGroup, rule['sms_group_id']):
            return jsonify({'message': 'Grupa SMS nie istnieje'}), 400
    NotificationRule.update_all(rules)
    return jsonify({'message': 'Reguły zaktualizowane'}), 200
```

- [ ] **Step 5: Seed w `back/init_db.py`**

Zmień:
```python
from models import db, Setting, User
```
na:
```python
from models import db, Setting, User, NotificationRule
```

Dodaj po seedzie użytkownika (przed `print('[init_db] Gotowe.')`):
```python
    # Seed domyślnych reguł powiadomień (idempotentne)
    NotificationRule.seed_defaults()
    print('[init_db] Reguły powiadomień zseedowane.')
```

- [ ] **Step 6: Uruchom testy, potwierdź że przechodzą**

Run: `cd back && python -m pytest tests/test_notification_rules_endpoint.py -v`
Expected: PASS (6/6)

---

### Task 4: Wysyłka (notifications.py) + hook w sensors.py

**Files:**
- Create: `back/notifications.py`
- Modify: `back/sensors.py`
- Test: `back/tests/test_notifications.py`
- Test: `back/tests/test_sensor_notify.py`

**Interfaces:**
- Consumes: `NotificationRule`, `EmailRecipient`, `SmsRecipient` z Task 1-3.
- Produces: `notifications.send_email(to_addresses, subject, body)`, `notifications.send_sms(to_numbers, message)`. `Sensor._raise_alert(event_type, sensor_name, is_warning, desc)`, `Sensor._notify(event_type, desc)`.

- [ ] **Step 1: Napisz failing testy dla `notifications.py`**

Utwórz `back/tests/test_notifications.py`:
```python
from unittest.mock import patch
import notifications


def test_send_email_skips_when_smtp_not_configured(monkeypatch, capsys):
    monkeypatch.delenv('SMTP_HOST', raising=False)
    notifications.send_email(['a@b.com'], 'Subject', 'Body')
    captured = capsys.readouterr()
    assert 'SMTP nieskonfigurowany' in captured.out


def test_send_email_skips_when_no_recipients():
    with patch('smtplib.SMTP') as mock_smtp:
        notifications.send_email([], 'Subject', 'Body')
        mock_smtp.assert_not_called()


def test_send_email_sends_via_smtp(monkeypatch):
    monkeypatch.setenv('SMTP_HOST', 'smtp.example.com')
    monkeypatch.setenv('SMTP_USER', 'user')
    monkeypatch.setenv('SMTP_PASSWORD', 'pass')
    with patch('smtplib.SMTP') as mock_smtp:
        instance = mock_smtp.return_value.__enter__.return_value
        notifications.send_email(['a@b.com'], 'Subject', 'Body')
        instance.starttls.assert_called_once()
        instance.login.assert_called_once_with('user', 'pass')
        instance.sendmail.assert_called_once()


def test_send_sms_logs_mock(capsys):
    notifications.send_sms(['+48123456789'], 'Test message')
    captured = capsys.readouterr()
    assert '+48123456789' in captured.out
    assert 'Test message' in captured.out
```

- [ ] **Step 2: Uruchom testy, potwierdź że failują**

Run: `cd back && python -m pytest tests/test_notifications.py -v`
Expected: FAIL (`ModuleNotFoundError: notifications`)

- [ ] **Step 3: Utwórz `back/notifications.py`**

```python
import os
import smtplib
from email.mime.text import MIMEText


def send_email(to_addresses, subject, body):
    if not to_addresses:
        return
    host = os.getenv('SMTP_HOST')
    port = int(os.getenv('SMTP_PORT', 587))
    user = os.getenv('SMTP_USER')
    password = os.getenv('SMTP_PASSWORD')
    from_addr = os.getenv('SMTP_FROM', user)
    if not host or not user or not password:
        print('[notifications] SMTP nieskonfigurowany — pomijam wysyłkę e-mail')
        return
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = from_addr
    msg['To'] = ', '.join(to_addresses)
    try:
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_addr, to_addresses, msg.as_string())
    except Exception as e:
        print(f'[notifications] błąd wysyłki e-mail: {e}')


def send_sms(to_numbers, message):
    """Zamockowane — brak konta u dostawcy SMS. Podłącz realne API tutaj."""
    for number in to_numbers:
        print(f'[notifications] (mock SMS) do {number}: {message}')
```

- [ ] **Step 4: Uruchom testy, potwierdź że przechodzą**

Run: `cd back && python -m pytest tests/test_notifications.py -v`
Expected: PASS (4/4)

- [ ] **Step 5: Napisz failing testy dla hooka w `sensors.py`**

Utwórz `back/tests/test_sensor_notify.py`:
```python
from models import db, NotificationRule, EmailGroup
from sensors import Sensor


def _bare_sensor(app):
    sensor = Sensor.__new__(Sensor)
    sensor.app = app
    sensor._last_log = {}
    return sensor


def test_notify_sends_email_when_rule_enabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda to, subject, body: calls.append((to, subject, body)))
    monkeypatch.setattr('notifications.send_sms', lambda *a: (_ for _ in ()).throw(AssertionError('nie powinno wysłać SMS')))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = EmailGroup.add_group('IT')
        EmailGroup.add_recipient(group.id, 'a@b.com')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.email_enabled = True
        rule.email_group_id = group.id
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor._notify('fire', 'Wykryto ogień!')

    assert len(calls) == 1
    to, subject, body = calls[0]
    assert to == ['a@b.com']


def test_notify_does_nothing_when_rule_disabled(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a: calls.append(a))
    monkeypatch.setattr('notifications.send_sms', lambda *a: calls.append(a))

    with app.app_context():
        NotificationRule.seed_defaults()

    sensor = _bare_sensor(app)
    sensor._notify('fire', 'Wykryto ogień!')

    assert calls == []


def test_raise_alert_skips_notify_during_cooldown(app, monkeypatch):
    calls = []
    monkeypatch.setattr('notifications.send_email', lambda *a: calls.append(a))

    with app.app_context():
        NotificationRule.seed_defaults()
        group = EmailGroup.add_group('IT')
        EmailGroup.add_recipient(group.id, 'a@b.com')
        rule = NotificationRule.query.filter_by(event_type='fire').first()
        rule.email_enabled = True
        rule.email_group_id = group.id
        db.session.commit()

    sensor = _bare_sensor(app)
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')
    sensor._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')

    assert len(calls) == 1
```

- [ ] **Step 6: Uruchom testy, potwierdź że failują**

Run: `cd back && python -m pytest tests/test_sensor_notify.py -v`
Expected: FAIL (`AttributeError: '_raise_alert'`/`'_notify'` nie istnieją)

- [ ] **Step 7: Zmodyfikuj `back/sensors.py`**

Zamień:
```python
    def _log(self, sensor_name, is_warning, description):
        from models import Log
        key = f'{sensor_name}:{description[:40]}'
        now = time.time()
        if now - self._last_log.get(key, 0) < LOG_COOLDOWN_SECONDS:
            return
        self._last_log[key] = now
        try:
            with self.app.app_context():
                Log.add_log(datetime.now(), sensor_name, is_warning, description)
        except Exception as e:
            print(f'[sensor] błąd zapisu logu: {e}')
```
na:
```python
    def _log(self, sensor_name, is_warning, description):
        from models import Log
        key = f'{sensor_name}:{description[:40]}'
        now = time.time()
        if now - self._last_log.get(key, 0) < LOG_COOLDOWN_SECONDS:
            return False
        self._last_log[key] = now
        try:
            with self.app.app_context():
                Log.add_log(datetime.now(), sensor_name, is_warning, description)
        except Exception as e:
            print(f'[sensor] błąd zapisu logu: {e}')
        return True

    def _raise_alert(self, event_type, sensor_name, is_warning, desc):
        print(f'[sensor] {desc}')
        if not self._log(sensor_name, is_warning, desc):
            return
        self._notify(event_type, desc)

    def _notify(self, event_type, desc):
        from models import NotificationRule, EmailRecipient, SmsRecipient
        from notifications import send_email, send_sms
        with self.app.app_context():
            rule = NotificationRule.query.filter_by(event_type=event_type).first()
            if not rule:
                return
            if rule.email_enabled and rule.email_group_id:
                emails = [r.email for r in EmailRecipient.query.filter_by(group_id=rule.email_group_id).all()]
                send_email(emails, f'Alarm: {desc}', desc)
            if rule.sms_enabled and rule.sms_group_id:
                numbers = [r.phone_number for r in SmsRecipient.query.filter_by(group_id=rule.sms_group_id).all()]
                send_sms(numbers, desc)
```

Zamień:
```python
    def _check_thresholds(self):
        if self.fire:
            desc = 'Wykryto ogień!'
            print(f'[sensor] {desc}')
            self._log('Czujnik pożaru', True, desc)

        if self.gas:
            desc = 'Wykryto gaz/dym!'
            print(f'[sensor] {desc}')
            self._log('Czujnik gazu', True, desc)

        if self.water:
            desc = 'Wykryto wodę!'
            print(f'[sensor] {desc}')
            self._log('Czujnik wody', True, desc)

        if self.door:
            desc = 'Otwarto drzwi'
            print(f'[sensor] {desc}')
            self._log('Czujnik drzwi', False, desc)
```
na:
```python
    def _check_thresholds(self):
        if self.fire:
            self._raise_alert('fire', 'Czujnik pożaru', True, 'Wykryto ogień!')
        if self.gas:
            self._raise_alert('gas', 'Czujnik gazu', True, 'Wykryto gaz/dym!')
        if self.water:
            self._raise_alert('water', 'Czujnik wody', True, 'Wykryto wodę!')
        if self.door:
            self._raise_alert('door', 'Czujnik drzwi', False, 'Otwarto drzwi')
```

- [ ] **Step 8: Uruchom testy, potwierdź że przechodzą**

Run: `cd back && python -m pytest tests/test_sensor_notify.py -v`
Expected: PASS (3/3)

- [ ] **Step 9: Pełny przebieg testów backendu**

Run: `cd back && python -m pytest -v`
Expected: wszystkie testy PASS (żaden istniejący test nie regresuje przez zmianę `_log`'s return value ani refaktor `_check_thresholds`)

---

### Task 5: Usunięcie starego `PhoneNumber` + konfiguracja `.env`

**Files:**
- Modify: `back/models.py`
- Modify: `back/app.py`
- Modify: `back/sensors.py`
- Modify: `back/.env.example`
- Test: `back/tests/test_phone_numbers_removed.py`

**Interfaces:**
- Consumes: nic nowego.
- Produces: `Sensor.__init__(self, app, settings, camera)` (bez `phone_numbers`). Endpointy `/phone-numbers` znikają. `/settings-and-phone-numbers` przestaje zwracać klucz `phone_numbers`.

- [ ] **Step 1: Napisz failing testy**

Utwórz `back/tests/test_phone_numbers_removed.py`:
```python
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
```

- [ ] **Step 2: Uruchom testy, potwierdź że failują**

Run: `cd back && python -m pytest tests/test_phone_numbers_removed.py -v`
Expected: FAIL (trasy `/phone-numbers` wciąż istnieją → 200/401 zamiast 404; `phone_numbers` wciąż w odpowiedzi)

- [ ] **Step 3: Usuń `PhoneNumber` z `back/models.py`**

Usuń całą klasę `PhoneNumber` (od `class PhoneNumber(db.Model):` do jej ostatniej metody, przed `class Setting`).

- [ ] **Step 4: Usuń trasy i użycia `PhoneNumber` z `back/app.py`**

Zmień import (usuń `PhoneNumber` z listy):
```python
from models import db, User, Setting, Log, Layout, DeviceSensor, DeviceSensorHistory, EmailGroup, EmailRecipient, SmsGroup, SmsRecipient, NotificationRule, NOTIFICATION_EVENT_TYPES
```

Usuń trasy:
```python
@app.route('/phone-numbers', methods=['POST'])
@jwt_required()
def add_phone_number():
    ...


@app.route('/phone-numbers/<phone_number>', methods=['DELETE'])
@jwt_required()
def delete_phone_number(phone_number):
    ...
```
i:
```python
@app.route('/phone-numbers', methods=['GET'])
@jwt_required()
def get_phone_numbers():
    return jsonify({'phone_numbers': PhoneNumber.get_all_phone_numbers()}), 200
```

Zamień:
```python
@app.route('/settings-and-phone-numbers', methods=['GET'])
def get_settings():
    return jsonify({
        'phone_numbers': PhoneNumber.get_all_phone_numbers(),
        'settings': Setting.get_all_settings(),
    }), 200
```
na:
```python
@app.route('/settings-and-phone-numbers', methods=['GET'])
def get_settings():
    return jsonify({
        'settings': Setting.get_all_settings(),
    }), 200
```

Zamień `init_sensor()`:
```python
def init_sensor():
    global sensor
    with app.app_context():
        settings = Setting.get_all_settings()
        phone_numbers = PhoneNumber.get_all_phone_numbers()
    sensor = Sensor(app, settings, phone_numbers, camera)
```
na:
```python
def init_sensor():
    global sensor
    with app.app_context():
        settings = Setting.get_all_settings()
    sensor = Sensor(app, settings, camera)
```

- [ ] **Step 5: Zmień konstruktor `Sensor` w `back/sensors.py`**

Zamień:
```python
    def __init__(self, app, settings, phone_numbers, camera):
        self.app = app
        self.camera = camera
        self.phone_numbers = phone_numbers
        self._apply_settings(settings)
```
na:
```python
    def __init__(self, app, settings, camera):
        self.app = app
        self.camera = camera
        self._apply_settings(settings)
```

- [ ] **Step 6: Dodaj zmienne SMTP do `back/.env.example`**

Dopisz na końcu pliku:
```
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

- [ ] **Step 7: Uruchom nowe testy, potwierdź że przechodzą**

Run: `cd back && python -m pytest tests/test_phone_numbers_removed.py -v`
Expected: PASS (3/3)

- [ ] **Step 8: Pełny przebieg testów backendu**

Run: `cd back && python -m pytest -v`
Expected: wszystkie PASS — potwierdza że usunięcie `PhoneNumber` nie zepsuło żadnego innego testu (żaden inny plik testowy nie importuje/używa `PhoneNumber`).

---

### Task 6: Frontend — `Settings.jsx`

**Files:**
- Modify: `front/src/Settings.jsx`

**Interfaces:**
- Consumes: `GET/POST/DELETE /email-groups[...]`, `GET/POST/DELETE /sms-groups[...]`, `GET/PUT /notification-rules` z Task 1-3.
- Produces: brak (liść UI).

- [ ] **Step 1: Usuń starą sekcję numerów telefonu**

Usuń import:
```js
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
```

Usuń stan:
```js
const [phoneNumbers, setPhoneNumbers] = useState([]);
const [newPhoneNumber, setNewPhoneNumber] = useState("");
const [phoneStatus, setPhoneStatus] = useState(null);
```

W `fetchInitialData`, usuń linię:
```js
setPhoneNumbers(data.phone_numbers);
```

Usuń handlery `handleAddPhoneNumber` i `handleDeleteNumber` w całości.

Usuń całą sekcję JSX:
```jsx
<SectionCard icon={<LocalPhoneOutlinedIcon />} title="Numery telefonów alarmowych">
    ...
</SectionCard>
```

- [ ] **Step 2: Zweryfikuj składnię po usunięciu**

Zapytaj o zgodę, potem: `cd front && npx esbuild src/Settings.jsx --bundle=false --loader:.jsx=jsx`
Expected: brak błędów

- [ ] **Step 3: Dodaj importy pod nową sekcję**

Zamień:
```js
import {
    TextField,
    Box,
    Button,
    Typography,
    Grid,
    Chip,
    Alert,
    IconButton,
} from "@mui/material";
```
na:
```js
import {
    TextField,
    Box,
    Button,
    Typography,
    Grid,
    Chip,
    Alert,
    IconButton,
    Select,
    MenuItem,
    Checkbox,
    FormControlLabel,
} from "@mui/material";
```

Dodaj po `import LocalFireDepartmentIcon ...` (usuniętej linii `LocalPhoneOutlinedIcon` już nie ma, więc dodaj w tym miejscu):
```js
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import DeleteIcon from "@mui/icons-material/Delete";
```

- [ ] **Step 4: Dodaj stan modułu powiadomień**

Dodaj po istniejącym stanie `envData`:
```js
const [emailGroups, setEmailGroups] = useState([]);
const [newEmailGroupName, setNewEmailGroupName] = useState("");
const [newEmailByGroup, setNewEmailByGroup] = useState({});
const [emailGroupStatus, setEmailGroupStatus] = useState(null);

const [smsGroups, setSmsGroups] = useState([]);
const [newSmsGroupName, setNewSmsGroupName] = useState("");
const [newPhoneByGroup, setNewPhoneByGroup] = useState({});
const [smsGroupStatus, setSmsGroupStatus] = useState(null);

const [rules, setRules] = useState([]);
const [rulesStatus, setRulesStatus] = useState(null);

const EVENT_TYPE_LABELS = { fire: "Pożar", gas: "Gaz/Dym", water: "Zalanie", door: "Drzwi otwarte" };
```

- [ ] **Step 5: Dodaj fetch na starcie**

Dodaj nowy `useEffect` obok istniejących:
```js
useEffect(() => {
    const fetchNotifications = async () => {
        try {
            const [egRes, sgRes, rulesRes] = await Promise.all([
                axios.get(`${API_BASE}/email-groups`),
                axios.get(`${API_BASE}/sms-groups`),
                axios.get(`${API_BASE}/notification-rules`),
            ]);
            setEmailGroups(egRes.data.groups);
            setSmsGroups(sgRes.data.groups);
            setRules(rulesRes.data.rules);
        } catch (_) {}
    };
    fetchNotifications();
}, []);
```

- [ ] **Step 6: Dodaj handlery grup mailowych**

Dodaj obok `handleSaveSettings`:
```js
const handleAddEmailGroup = async () => {
    if (!newEmailGroupName.trim()) return;
    try {
        await axios.post(`${API_BASE}/email-groups`, { name: newEmailGroupName }, { headers: { Authorization: `Bearer ${accessToken}` } });
        const { data } = await axios.get(`${API_BASE}/email-groups`);
        setEmailGroups(data.groups);
        setNewEmailGroupName("");
        setEmailGroupStatus({ type: "success", message: "Grupa dodana." });
    } catch (error) {
        setEmailGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd dodawania grupy." });
    }
    setTimeout(() => setEmailGroupStatus(null), 2500);
};

const handleDeleteEmailGroup = async (groupId) => {
    if (!window.confirm("Usunąć tę grupę mailową wraz z adresami?")) return;
    try {
        await axios.delete(`${API_BASE}/email-groups/${groupId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        setEmailGroups(prev => prev.filter(g => g.id !== groupId));
        setEmailGroupStatus({ type: "success", message: "Grupa usunięta." });
    } catch (error) {
        setEmailGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd usuwania grupy." });
    }
    setTimeout(() => setEmailGroupStatus(null), 2500);
};

const handleAddEmailRecipient = async (groupId) => {
    const email = (newEmailByGroup[groupId] || "").trim();
    if (!email) return;
    try {
        const { data } = await axios.post(`${API_BASE}/email-groups/${groupId}/recipients`, { email }, { headers: { Authorization: `Bearer ${accessToken}` } });
        setEmailGroups(prev => prev.map(g => g.id === groupId
            ? { ...g, recipients: [...g.recipients, { id: data.id, email }] }
            : g));
        setNewEmailByGroup(prev => ({ ...prev, [groupId]: "" }));
        setEmailGroupStatus({ type: "success", message: "Adres dodany." });
    } catch (error) {
        setEmailGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd dodawania adresu." });
    }
    setTimeout(() => setEmailGroupStatus(null), 2500);
};

const handleDeleteEmailRecipient = async (groupId, recipientId) => {
    try {
        await axios.delete(`${API_BASE}/email-groups/${groupId}/recipients/${recipientId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        setEmailGroups(prev => prev.map(g => g.id === groupId
            ? { ...g, recipients: g.recipients.filter(r => r.id !== recipientId) }
            : g));
    } catch (error) {
        setEmailGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd usuwania adresu." });
    }
    setTimeout(() => setEmailGroupStatus(null), 2500);
};
```

- [ ] **Step 7: Dodaj handlery grup SMS (lustrzane)**

```js
const handleAddSmsGroup = async () => {
    if (!newSmsGroupName.trim()) return;
    try {
        await axios.post(`${API_BASE}/sms-groups`, { name: newSmsGroupName }, { headers: { Authorization: `Bearer ${accessToken}` } });
        const { data } = await axios.get(`${API_BASE}/sms-groups`);
        setSmsGroups(data.groups);
        setNewSmsGroupName("");
        setSmsGroupStatus({ type: "success", message: "Grupa dodana." });
    } catch (error) {
        setSmsGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd dodawania grupy." });
    }
    setTimeout(() => setSmsGroupStatus(null), 2500);
};

const handleDeleteSmsGroup = async (groupId) => {
    if (!window.confirm("Usunąć tę grupę SMS wraz z numerami?")) return;
    try {
        await axios.delete(`${API_BASE}/sms-groups/${groupId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        setSmsGroups(prev => prev.filter(g => g.id !== groupId));
        setSmsGroupStatus({ type: "success", message: "Grupa usunięta." });
    } catch (error) {
        setSmsGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd usuwania grupy." });
    }
    setTimeout(() => setSmsGroupStatus(null), 2500);
};

const handleAddSmsRecipient = async (groupId) => {
    const phoneNumber = (newPhoneByGroup[groupId] || "").trim();
    if (!phoneNumber) return;
    try {
        const { data } = await axios.post(`${API_BASE}/sms-groups/${groupId}/recipients`, { phone_number: phoneNumber }, { headers: { Authorization: `Bearer ${accessToken}` } });
        setSmsGroups(prev => prev.map(g => g.id === groupId
            ? { ...g, recipients: [...g.recipients, { id: data.id, phone_number: phoneNumber }] }
            : g));
        setNewPhoneByGroup(prev => ({ ...prev, [groupId]: "" }));
        setSmsGroupStatus({ type: "success", message: "Numer dodany." });
    } catch (error) {
        setSmsGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd dodawania numeru." });
    }
    setTimeout(() => setSmsGroupStatus(null), 2500);
};

const handleDeleteSmsRecipient = async (groupId, recipientId) => {
    try {
        await axios.delete(`${API_BASE}/sms-groups/${groupId}/recipients/${recipientId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        setSmsGroups(prev => prev.map(g => g.id === groupId
            ? { ...g, recipients: g.recipients.filter(r => r.id !== recipientId) }
            : g));
    } catch (error) {
        setSmsGroupStatus({ type: "error", message: error.response?.data?.message || "Błąd usuwania numeru." });
    }
    setTimeout(() => setSmsGroupStatus(null), 2500);
};
```

- [ ] **Step 8: Dodaj handlery reguł**

```js
const updateRule = (eventType, patch) => {
    setRules(prev => prev.map(r => r.event_type === eventType ? { ...r, ...patch } : r));
};

const handleSaveRules = async () => {
    try {
        await axios.put(`${API_BASE}/notification-rules`, { rules }, { headers: { Authorization: `Bearer ${accessToken}` } });
        setRulesStatus({ type: "success", message: "Reguły zapisane." });
    } catch (error) {
        setRulesStatus({ type: "error", message: error.response?.data?.message || "Błąd zapisu reguł." });
    }
    setTimeout(() => setRulesStatus(null), 2500);
};
```

- [ ] **Step 9: Dodaj sekcję JSX "Powiadomienia"**

Dodaj jako nowy `SectionCard` na końcu, po sekcji "Ustawienia nagrywania i testów" (w miejscu gdzie była sekcja numerów telefonu):
```jsx
<SectionCard icon={<NotificationsActiveIcon />} title="Powiadomienia">
    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Grupy mailowe</Typography>
    {emailGroups.map(group => (
        <Box key={group.id} sx={{ mb: 2, p: 1.5, border: "1px solid #e0e0e0", borderRadius: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography fontWeight="bold">{group.name}</Typography>
                <IconButton size="small" onClick={() => handleDeleteEmailGroup(group.id)}>
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
                {group.recipients.map(r => (
                    <Chip key={r.id} label={r.email} onDelete={() => handleDeleteEmailRecipient(group.id, r.id)} size="small" />
                ))}
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                    size="small" placeholder="adres@przyklad.pl"
                    value={newEmailByGroup[group.id] || ""}
                    onChange={e => setNewEmailByGroup(prev => ({ ...prev, [group.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && handleAddEmailRecipient(group.id)}
                />
                <Button size="small" variant="outlined" onClick={() => handleAddEmailRecipient(group.id)}>Dodaj adres</Button>
            </Box>
        </Box>
    ))}
    <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
        <TextField size="small" label="Nazwa nowej grupy mailowej" value={newEmailGroupName} onChange={e => setNewEmailGroupName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddEmailGroup()} />
        <Button variant="contained" size="small" onClick={handleAddEmailGroup}>Nowa grupa</Button>
    </Box>
    {emailGroupStatus && <Alert severity={emailGroupStatus.type} sx={{ mb: 3 }} onClose={() => setEmailGroupStatus(null)}>{emailGroupStatus.message}</Alert>}

    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Grupy SMS</Typography>
    {smsGroups.map(group => (
        <Box key={group.id} sx={{ mb: 2, p: 1.5, border: "1px solid #e0e0e0", borderRadius: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography fontWeight="bold">{group.name}</Typography>
                <IconButton size="small" onClick={() => handleDeleteSmsGroup(group.id)}>
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
                {group.recipients.map(r => (
                    <Chip key={r.id} label={r.phone_number} onDelete={() => handleDeleteSmsRecipient(group.id, r.id)} size="small" />
                ))}
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                    size="small" placeholder="+48123456789"
                    value={newPhoneByGroup[group.id] || ""}
                    onChange={e => setNewPhoneByGroup(prev => ({ ...prev, [group.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && handleAddSmsRecipient(group.id)}
                />
                <Button size="small" variant="outlined" onClick={() => handleAddSmsRecipient(group.id)}>Dodaj numer</Button>
            </Box>
        </Box>
    ))}
    <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
        <TextField size="small" label="Nazwa nowej grupy SMS" value={newSmsGroupName} onChange={e => setNewSmsGroupName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddSmsGroup()} />
        <Button variant="contained" size="small" onClick={handleAddSmsGroup}>Nowa grupa</Button>
    </Box>
    {smsGroupStatus && <Alert severity={smsGroupStatus.type} sx={{ mb: 3 }} onClose={() => setSmsGroupStatus(null)}>{smsGroupStatus.message}</Alert>}

    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>Reguły powiadomień</Typography>
    {rules.map(rule => (
        <Box key={rule.event_type} sx={{ display: "flex", alignItems: "center", gap: 2, py: 1, borderBottom: "1px solid #f0f0f0", flexWrap: "wrap" }}>
            <Typography sx={{ minWidth: 130 }} fontWeight="bold">{EVENT_TYPE_LABELS[rule.event_type]}</Typography>
            <FormControlLabel
                control={<Checkbox checked={rule.email_enabled} onChange={e => updateRule(rule.event_type, { email_enabled: e.target.checked })} />}
                label="E-mail"
            />
            <Select size="small" displayEmpty sx={{ minWidth: 160 }}
                value={rule.email_group_id ?? ""}
                disabled={!rule.email_enabled}
                onChange={e => updateRule(rule.event_type, { email_group_id: e.target.value === "" ? null : e.target.value })}
            >
                <MenuItem value=""><em>Wybierz grupę</em></MenuItem>
                {emailGroups.map(g => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
            </Select>
            <FormControlLabel
                control={<Checkbox checked={rule.sms_enabled} onChange={e => updateRule(rule.event_type, { sms_enabled: e.target.checked })} />}
                label="SMS"
            />
            <Select size="small" displayEmpty sx={{ minWidth: 160 }}
                value={rule.sms_group_id ?? ""}
                disabled={!rule.sms_enabled}
                onChange={e => updateRule(rule.event_type, { sms_group_id: e.target.value === "" ? null : e.target.value })}
            >
                <MenuItem value=""><em>Wybierz grupę</em></MenuItem>
                {smsGroups.map(g => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
            </Select>
        </Box>
    ))}
    <Button variant="contained" color="success" sx={{ mt: 2 }} onClick={handleSaveRules}>Zapisz reguły</Button>
    {rulesStatus && <Alert severity={rulesStatus.type} sx={{ mt: 2 }} onClose={() => setRulesStatus(null)}>{rulesStatus.message}</Alert>}
</SectionCard>
```

- [ ] **Step 10: Weryfikacja składni**

Zapytaj o zgodę, potem: `cd front && npx esbuild src/Settings.jsx --bundle=false --loader:.jsx=jsx`
Expected: brak błędów

- [ ] **Step 11: Weryfikacja builda**

Zapytaj o zgodę, potem: `cd front && npm run build`
Expected: `✓ built` bez błędów

- [ ] **Step 12: Manualna weryfikacja**

`npm run dev`, otwórz `/settings` — sprawdź: sekcja "Powiadomienia" widoczna, można dodać grupę mailową + adres, dodać grupę SMS + numer, zaznaczyć checkbox i wybrać grupę per zdarzenie, zapisać reguły, odświeżyć stronę i sprawdzić że wszystko się utrzymało. Sekcja starych numerów telefonu zniknęła.

---

### Task 7: README

**Files:**
- Modify: `README.md`

**Interfaces:** brak (dokumentacja).

- [ ] **Step 1: Zaktualizuj listę tabel**

Zamień:
```
Tabele: `users`, `layouts`, `phone_numbers`, `settings`, `logs`, `device_sensors`, `device_sensor_history`.
```
na:
```
Tabele: `users`, `layouts`, `settings`, `logs`, `device_sensors`, `device_sensor_history`, `email_groups`, `email_recipients`, `sms_groups`, `sms_recipients`, `notification_rules`.
```

- [ ] **Step 2: Zaktualizuj opis funkcji "Ustawienia"**

Zamień:
```
- **Ustawienia** — czas nagrywania, godziny testów systemowych, numery telefonów do powiadomień, podgląd czujników globalnych pomieszczenia.
```
na:
```
- **Ustawienia** — czas nagrywania, godziny testów systemowych, podgląd czujników globalnych pomieszczenia.
- **Powiadomienia** — grupy odbiorców mailowych i SMS, reguły wysyłki per zdarzenie (pożar/gaz/zalanie/drzwi). E-mail wysyłany realnie przez SMTP, SMS na razie zamockowany (log w konsoli, gotowy do podłączenia realnego dostawcy).
```

- [ ] **Step 3: Dodaj zmienne SMTP do sekcji "Zmienne środowiskowe"**

Zamień:
```
Zobacz `back/.env.example` i `front/.env.example`. Pliki `.env` (z prawdziwymi wartościami) nie są śledzone w gicie.
```
na:
```
Zobacz `back/.env.example` i `front/.env.example`. Pliki `.env` (z prawdziwymi wartościami) nie są śledzone w gicie. Wysyłka e-mail wymaga uzupełnienia `SMTP_HOST/PORT/USER/PASSWORD/FROM` w `back/.env` — bez tego moduł powiadomień działa (reguły/grupy), ale wysyłka jest pomijana z logiem `SMTP nieskonfigurowany`.
```

- [ ] **Step 4: Dodaj do "Znane ograniczenia"**

Dodaj na końcu listy:
```
- Wysyłka SMS w module powiadomień jest zamockowana (`back/notifications.py:send_sms` tylko loguje do konsoli) — brak konta u płatnego dostawcy SMS. Gotowe do podłączenia realnego API, analogicznie do GPIO w `sensors.py`.
- Stara tabela `phone_numbers` (zastąpiona grupami SMS) może zostać osierocona w już istniejących bazach `instance/monitoring.db` — dane nie są usuwane automatycznie, tylko kod przestaje ich używać.
```

---

## Kolejność wykonania

Ścisła: Task 1 i 2 niezależne od siebie (mogą iść w dowolnej kolejności między sobą), ale Task 3 wymaga obu (FK do `EmailGroup`/`SmsGroup` w walidacji `PUT`). Task 4 wymaga Task 3 (odpytuje `NotificationRule`). Task 5 (usunięcie `PhoneNumber`) najlepiej na końcu backendu, żeby nic nie kolidowało w trakcie budowy nowego systemu równolegle ze starym. Task 6 (frontend) wymaga Task 1-3 (woła te endpointy). Task 7 (README) na samym końcu.
