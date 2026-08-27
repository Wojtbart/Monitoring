from models import SmtpSettings


def test_get_or_create_returns_defaults_when_missing(app):
    with app.app_context():
        settings = SmtpSettings.get_or_create()
        assert settings.host is None
        assert settings.port == 587
        assert settings.use_tls is True


def test_get_or_create_is_idempotent(app):
    with app.app_context():
        SmtpSettings.get_or_create()
        SmtpSettings.get_or_create()
        assert SmtpSettings.query.count() == 1


def test_update_changes_settings(app):
    with app.app_context():
        SmtpSettings.get_or_create()
        updated = SmtpSettings.update('smtp.example.com', 465, 'user', 'pass', 'from@example.com', False)
        assert updated.host == 'smtp.example.com'
        assert updated.port == 465
        assert updated.username == 'user'
        assert updated.password == 'pass'
        assert updated.from_address == 'from@example.com'
        assert updated.use_tls is False
        assert SmtpSettings.query.count() == 1
