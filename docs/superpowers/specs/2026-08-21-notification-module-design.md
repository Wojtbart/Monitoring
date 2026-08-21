# Moduł powiadomień e-mail/SMS (podsystem E) — spec

## Kontekst

Ostatni z backlogu 2026-08-20 (podsystemy A–D już zaimplementowane). Użytkownik chce: grupy odbiorców mailowych i SMS-owych, przypisanie grupy do konkretnego typu zdarzenia (pożar/gaz/zalanie/drzwi), włącz/wyłącz per kanał per zdarzenie.

Zastane: **zero realnej wysyłki dziś**. `PhoneNumber`/`phone_numbers` (tabela, endpointy `/phone-numbers`, sekcja w `Settings.jsx`) to płaska lista numerów przekazywana do `Sensor.__init__` (`back/sensors.py:13,16`), ale nigdy nieużywana do faktycznego wysłania czegokolwiek — czysty dead-end. Zastępujemy ją całym nowym modułem.

## Zakres

**W zakresie:**
- Realna wysyłka e-mail (SMTP, dane w `.env`)
- Wysyłka SMS **zamockowana** (log w konsoli — brak konta u dostawcy SMS), gotowa do podłączenia realnego API tak jak GPIO w `sensors.py`
- Grupy mailowe i SMS-owe (CRUD)
- Reguły powiadomień dla 4 typów zdarzeń: pożar, gaz/dym, zalanie, drzwi otwarte
- Nowa sekcja w `Settings.jsx`

**Poza zakresem:**
- Realna wysyłka SMS (wymaga płatnego konta u dostawcy, którego użytkownik jeszcze nie ma)
- Powiadomienia o przekroczeniu progów temperatury/wilgotności per-urządzenie (osobny, potencjalnie duży temat — tylko 4 zdarzenia room-level w zakresie)
- Historia/log wysłanych powiadomień (osobna funkcja, nie proszono)

## Model danych (`back/models.py`)

```python
class EmailGroup(db.Model):
    __tablename__ = 'email_groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)

class EmailRecipient(db.Model):
    __tablename__ = 'email_recipients'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('email_groups.id'), nullable=False)
    email = db.Column(db.String(255), nullable=False)

class SmsGroup(db.Model):
    __tablename__ = 'sms_groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)

class SmsRecipient(db.Model):
    __tablename__ = 'sms_recipients'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('sms_groups.id'), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)

class NotificationRule(db.Model):
    __tablename__ = 'notification_rules'
    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(20), unique=True, nullable=False)  # fire|gas|water|door
    email_enabled = db.Column(db.Boolean, nullable=False, default=False)
    email_group_id = db.Column(db.Integer, db.ForeignKey('email_groups.id'), nullable=True)
    sms_enabled = db.Column(db.Boolean, nullable=False, default=False)
    sms_group_id = db.Column(db.Integer, db.ForeignKey('sms_groups.id'), nullable=True)
```

**Seed:** 4 wiersze `NotificationRule` (`fire`, `gas`, `water`, `door`) tworzone przy braku istniejących — w `init_db.py`, analogicznie do seeda `Setting`/`User`. Wszystkie pola `*_enabled` startują jako `False`, `*_group_id` jako `NULL`.

**Usuwane:** `PhoneNumber` (klasa + tabela `phone_numbers`) — model, `add_phone_number`/`get_all_phone_numbers`/`delete_phone_number`, oraz jego import w `app.py`/`init_db.py`.

**Metody modeli (statyczne, wzorem istniejących):**
- `EmailGroup.get_all_with_recipients()` → lista `{id, name, recipients: [{id, email}]}`
- `EmailGroup.add_group(name)`, `EmailGroup.delete_group(id)` (kaskadowo usuwa `EmailRecipient` tej grupy)
- `EmailGroup.add_recipient(group_id, email)`, `EmailGroup.delete_recipient(recipient_id)`
- Analogicznie `SmsGroup`
- `NotificationRule.get_all()` → lista 4 reguł jako dict
- `NotificationRule.update_all(rules: list[dict])` → nadpisuje email_enabled/email_group_id/sms_enabled/sms_group_id dla każdego z 4 event_type

## Endpointy (`back/app.py`)

```
POST   /email-groups                              {name} → 201
GET    /email-groups                               → {groups: [...]}
DELETE /email-groups/<int:group_id>                → 200
POST   /email-groups/<int:group_id>/recipients     {email} → 201
DELETE /email-groups/<int:group_id>/recipients/<int:recipient_id> → 200

POST   /sms-groups                                 {name} → 201
GET    /sms-groups                                 → {groups: [...]}
DELETE /sms-groups/<int:group_id>                  → 200
POST   /sms-groups/<int:group_id>/recipients       {phone_number} → 201
DELETE /sms-groups/<int:group_id>/recipients/<int:recipient_id> → 200

GET    /notification-rules                         → {rules: [...]}
PUT    /notification-rules                         {rules: [{event_type, email_enabled, email_group_id, sms_enabled, sms_group_id}, ...]} → 200
```

Wszystkie `@jwt_required()` poza `GET`-ami czysto informacyjnymi (wzorem `/settings` GET bez auth, reszta z auth) — tu: wszystkie CRUD (`POST`/`DELETE`/`PUT`) wymagają JWT, oba `GET` (`/email-groups`, `/sms-groups`, `/notification-rules`) NIE wymagają (spójnie z `/settings` GET, potrzebne też stronie startowej jeśli kiedyś pokażemy status).

Walidacja: `POST /email-groups` 400 gdy brak `name` lub nazwa już istnieje (unique). `POST .../recipients` 400 gdy brak pola. `PUT /notification-rules` 400 gdy `rules` nie ma dokładnie 4 wpisów albo `event_type` spoza `{fire,gas,water,door}`, albo wskazana `email_group_id`/`sms_group_id` nie istnieje.

Usuwane endpointy: `/phone-numbers` (POST/GET/DELETE), pole `phone_numbers` z `/settings-and-phone-numbers` (endpoint zostaje, ale zwraca tylko `settings` — albo zmieniamy nazwę na `/settings` i usuwamy duplikat `GET /settings`... **nie robimy tego** poza zakresem, tylko usuwamy klucz `phone_numbers` z istniejącej odpowiedzi tego endpointu).

## Wysyłka (`back/notifications.py`, nowy plik)

```python
import os
import smtplib
from email.mime.text import MIMEText

def send_email(to_addresses: list[str], subject: str, body: str) -> None:
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


def send_sms(to_numbers: list[str], message: str) -> None:
    """Zamockowane — brak konta u dostawcy SMS. Podłącz realne API tutaj."""
    for number in to_numbers:
        print(f'[notifications] (mock SMS) do {number}: {message}')
```

Nowe zmienne `.env` (dopisać do `.env.example`): `SMTP_HOST`, `SMTP_PORT` (domyślnie 587), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.

## Hook w `back/sensors.py`

`_check_thresholds()` woła dziś `self._log(sensor_name, is_warning, desc)` dla fire/gas/water/door. Dochodzi `self._notify(event_type, desc)` w każdym z 4 bloków, **pod tym samym cooldownem** co `_log` (reużywamy `_last_log`, żeby trwający alarm nie zasypał maila/SMS-a co sekundę — jeśli `_log` pominął zapis przez cooldown, `_notify` też nie woła, więc kolejność: sprawdź cooldown raz, jeśli przechodzi → i `_log`, i `_notify`).

```python
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

Refaktoryzacja `_check_thresholds`: wydzielić wspólną logikę cooldown+log+notify do jednej pomocniczej metody `_raise_alert(event_type, sensor_name, is_warning, desc)`, wołanej 4× zamiast osobnych `self._log(...)` — unika duplikacji kodu cooldownu w 4 miejscach i zapewnia że `_log`/`_notify` dzielą dokładnie ten sam cooldown-check.

## Frontend — `front/src/Settings.jsx`

**Usuwane:** cała sekcja `SectionCard icon={<LocalPhoneOutlinedIcon />} title="Numery telefonów alarmowych"` + jej stan (`phoneNumbers`, `newPhoneNumber`, `phoneStatus`) + handlery (`handleAddPhoneNumber`, `handleDeleteNumber`) + import `LocalPhoneOutlinedIcon`. Fetch initial data przestaje czytać `data.phone_numbers`.

**Nowa sekcja** `SectionCard icon={<NotificationsActiveIcon />} title="Powiadomienia"`, trzy pod-bloki:

1. **Grupy mailowe** — lista kart (nazwa + chipy adresów z `onDelete`), pole+przycisk "Nowa grupa" (samo `name`, tworzy pustą grupę), w każdej karcie pole+przycisk "Dodaj adres". Usunięcie grupy: przycisk kosza na karcie + `window.confirm`.
2. **Grupy SMS** — identyczny layout, `phone_number` zamiast `email`.
3. **Reguły powiadomień** — tabela/lista 4 wierszy z etykietami PL (Pożar/Gaz-Dym/Zalanie/Drzwi otwarte), każdy wiersz: `Checkbox` "E-mail" + `Select` grupy mailowej (opcje z pobranych grup, disabled gdy checkbox off), `Checkbox` "SMS" + `Select` grupy SMS. Jeden przycisk "Zapisz reguły" na dole bloku 3 → `PUT /notification-rules` z całą tablicą 4 reguł na raz.

Grupy (bloki 1-2) zapisują się natychmiast przy każdej akcji (dodaj grupę/usuń grupę/dodaj odbiorcę/usuń odbiorcę) — wzorem obecnych numerów telefonu, bez osobnego przycisku "zapisz" dla nich. Tylko blok 3 (reguły) ma swój przycisk zapisu, bo to jeden spójny formularz wielu pól na raz.

Komunikaty błędów/sukcesu: `Alert` pod każdym z 3 bloków niezależnie (osobny stan `emailGroupStatus`/`smsGroupStatus`/`rulesStatus`), auto-znikają po 2.5s — wzorem istniejących `settingsStatus`/`phoneStatus`.

## Testy backendu

Nowe pliki w `back/tests/`:
- `test_email_groups_endpoint.py` — dodanie grupy, dodanie/usunięcie odbiorcy, usunięcie grupy (kaskada), duplikat nazwy → 400
- `test_sms_groups_endpoint.py` — analogicznie
- `test_notification_rules_endpoint.py` — GET zwraca 4 seedowane reguły, PUT aktualizuje, PUT z niepoprawnym `event_type`/nieistniejącym `group_id` → 400
- `test_sensor_notify.py` — `Sensor._notify` z fake `app`, wywołuje `send_email`/`send_sms` (monkeypatched) z odpowiednimi argumentami gdy reguła włączona, nic nie woła gdy `email_enabled=False`

## Migracja istniejącej bazy

`db.create_all()` nie doda nowych tabel do już-uruchamianej `instance/monitoring.db` automatycznie przy starcie `python app.py` — **owszem doda**, bo to NOWE tabele (create_all tworzy brakujące tabele, tylko nie ALTER na już-istniejące — gotcha #2 w CLAUDE.md dotyczy dodawania KOLUMN do istniejących tabel, nie nowych tabel). Tabela `phone_numbers` zostaje osierocona w bazie (dane nieusuwane automatycznie, ale kod przestaje jej używać) — wspominamy to w README jako świadomą decyzję, nie czyścimy ręcznie danych użytkownika bez pytania.
