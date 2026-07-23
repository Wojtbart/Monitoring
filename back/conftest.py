import os

# Must run BEFORE `app` module is imported anywhere: Flask-SQLAlchemy builds
# and caches its engine inside db.init_app(app), which app.py calls at import
# time. Setting this after import is too late and silently operates on the
# real sqlite file instead of an in-memory one.
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

import pytest


@pytest.fixture
def app():
    from app import app as flask_app
    from models import db

    flask_app.config['TESTING'] = True

    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()
