"""
Migracja jednorazowa: EmailGroup + SmsGroup -> jedna wspólna NotificationGroup.

Uruchom RAZ, po wgraniu nowego kodu backendu i po tym jak nowe tabele
(notification_groups, notification_recipients) i kolumna group_id w
notification_rules już istnieją (create_all + ręczny ALTER TABLE — patrz
docs/raspberry-pi-deployment.md, sekcja 7m).

Użycie:
    python migrations/merge_notification_groups.py [ścieżka_do_bazy]
    (domyślnie: instance/monitoring.db, uruchamiać z katalogu back/)

Polityka scalania:
- Jeśli reguła (notification_rules) ma ustawione zarówno email_group_id jak
  i sms_group_id -> te dwie grupy (mailowa + SMS) zostają scalone w jedną
  nową grupę (suma odbiorców, nazwa/harmonogram po stronie mailowej).
- Grupy używane tylko po jednej stronie (albo nigdy nieużyte przez żadną
  regułę) migrują 1:1 bez zmian.
- Scalanie jest przechodnie przez WSZYSTKIE reguły na raz (union-find) —
  gdyby jedna grupa mailowa była sparowana z różnymi grupami SMS w różnych
  regułach, wszystkie trafią do jednego klastra.

Stare tabele (email_groups, email_recipients, sms_groups, sms_recipients)
zostają nietknięte w bazie — tylko przestają być używane przez kod (jak
wcześniejszy precedens z `phone_numbers`, patrz README "Znane ograniczenia").
Skrypt jest idempotentny w tym sensie, że drugie uruchomienie nie nadpisze
już zmigrowanych danych z sensem — uruchom go tylko raz.
"""
import sqlite3
import sys

DB_PATH = sys.argv[1] if len(sys.argv) > 1 else 'instance/monitoring.db'

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

email_groups = {row['id']: dict(row) for row in cur.execute('SELECT * FROM email_groups')}
sms_groups = {row['id']: dict(row) for row in cur.execute('SELECT * FROM sms_groups')}
email_recipients = list(cur.execute('SELECT * FROM email_recipients'))
sms_recipients = list(cur.execute('SELECT * FROM sms_recipients'))
rules = list(cur.execute('SELECT id, event_type, email_group_id, sms_group_id FROM notification_rules'))

# --- union-find ---
parent = {}


def find(x):
    parent.setdefault(x, x)
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x


def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb:
        parent[ra] = rb


for gid in email_groups:
    find(('email', gid))
for gid in sms_groups:
    find(('sms', gid))

for r in rules:
    if r['email_group_id'] is not None and r['sms_group_id'] is not None:
        union(('email', r['email_group_id']), ('sms', r['sms_group_id']))

clusters = {}
for node in list(parent):
    clusters.setdefault(find(node), []).append(node)

DEFAULT_SCHEDULE = '1' * 168
old_to_new = {}  # ('email'|'sms', old_id) -> new notification_groups.id

for members in clusters.values():
    email_members = [m for m in members if m[0] == 'email']
    sms_members = [m for m in members if m[0] == 'sms']

    if email_members:
        source = email_groups[email_members[0][1]]
    else:
        source = sms_groups[sms_members[0][1]]
    name = source['name']
    schedule = source['schedule'] or DEFAULT_SCHEDULE

    # nazwa musi być unikalna w notification_groups
    base_name = name
    suffix = 2
    while cur.execute('SELECT 1 FROM notification_groups WHERE name = ?', (name,)).fetchone():
        name = f'{base_name} ({suffix})'
        suffix += 1

    cur.execute('INSERT INTO notification_groups (name, schedule) VALUES (?, ?)', (name, schedule))
    new_group_id = cur.lastrowid

    for _, old_id in email_members:
        old_to_new[('email', old_id)] = new_group_id
        for r in email_recipients:
            if r['group_id'] == old_id:
                cur.execute(
                    'INSERT INTO notification_recipients (group_id, email, phone_number) VALUES (?, ?, NULL)',
                    (new_group_id, r['email']),
                )
    for _, old_id in sms_members:
        old_to_new[('sms', old_id)] = new_group_id
        for r in sms_recipients:
            if r['group_id'] == old_id:
                cur.execute(
                    'INSERT INTO notification_recipients (group_id, email, phone_number) VALUES (?, NULL, ?)',
                    (new_group_id, r['phone_number']),
                )

    if len(members) == 1:
        label = f"'{source['name']}'"
    else:
        label = (f"'{email_groups[email_members[0][1]]['name']}' (mail) + "
                 f"'{sms_groups[sms_members[0][1]]['name']}' (sms)")
    print(f'Grupa {label} -> notification_groups.id={new_group_id} ({name!r})')

for r in rules:
    new_group_id = None
    if r['email_group_id'] is not None:
        new_group_id = old_to_new.get(('email', r['email_group_id']))
    elif r['sms_group_id'] is not None:
        new_group_id = old_to_new.get(('sms', r['sms_group_id']))
    if new_group_id is not None:
        cur.execute('UPDATE notification_rules SET group_id = ? WHERE id = ?', (new_group_id, r['id']))
        print(f"Reguła '{r['event_type']}' -> group_id={new_group_id}")

conn.commit()
conn.close()
print('Migracja zakończona.')
