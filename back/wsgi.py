"""Punkt wejścia dla gunicorna (produkcja / Raspberry Pi).

`app.py` samo w sobie NIE odpala `db.create_all()`/`init_sensor()` przy imporcie —
te kroki są schowane pod `if __name__ == '__main__':`, celowo, żeby `import app`
pod pytestem (patrz `back/tests/conftest.py`) nie odpalało wątku czujników ani
nie dotykało prawdziwej kamery/GPIO. Gunicorn robi `import <moduł>` i bierze
gotowy obiekt WSGI — nigdy nie trafia w ten blok. Dlatego produkcyjny start
(gunicorn) importuje TEN plik (`wsgi:app`), nie `app:app`.

Uruchamiaj z DOKŁADNIE jednym workerem (`-w 1`) — `init_sensor()` startuje
wątek czytający czujniki i otwiera kamerę; więcej niż jeden proces gunicorna
odpaliłby to wielokrotnie równolegle (duplikaty logów, wyścig zapisów do
SQLite, konflikt o urządzenie kamery).
"""
from app import app, db, init_sensor

with app.app_context():
    db.create_all()
init_sensor()
