"""
Uruchom RAZ przed pierwszym startem aplikacji:
    python init_db.py

Tworzy tabele i seed domyślnych ustawień.
Bezpieczne przy ponownym uruchomieniu (nie usuwa danych).
"""
import os
from dotenv import load_dotenv

load_dotenv()

from app import app
from models import db, Settings, Users
from werkzeug.security import generate_password_hash

with app.app_context():
    db.create_all()
    print('[init_db] Tabele utworzone.')

    # Seed domyślnych ustawień jeśli tabela pusta
    if not Settings.query.first():
        from datetime import time as dtime
        default = Settings(
            min_temperature=15,
            max_temperature=35,
            min_humidity=20,
            max_humidity=80,
            recording_seconds=30,
            morning_test_time=dtime(8, 0, 0),
            evening_test_time=dtime(20, 0, 0),
        )
        db.session.add(default)
        db.session.commit()
        print('[init_db] Domyślne ustawienia dodane.')
    else:
        print('[init_db] Ustawienia już istnieją — pominięto seed.')

    # Seed konta admin jeśli brak użytkowników
    if not Users.query.first():
        admin_pass = generate_password_hash('admin123', method='pbkdf2:sha256')
        Users.add_user('admin', admin_pass, isadmin=True)
        print('[init_db] Konto admin utworzone (login: admin, hasło: admin123).')
        print('[init_db] ZMIEŃ HASŁO po pierwszym logowaniu!')
    else:
        print('[init_db] Użytkownicy już istnieją — pominięto seed.')

print('[init_db] Gotowe.')
