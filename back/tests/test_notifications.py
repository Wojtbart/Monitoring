from unittest.mock import patch
from models import SmtpSettings, db
import notifications


def test_send_email_skips_when_smtp_not_configured(app, capsys):
    with app.app_context():
        SmtpSettings.get_or_create()
        notifications.send_email(['a@b.com'], 'Subject', 'Body')
    captured = capsys.readouterr()
    assert 'SMTP nieskonfigurowany' in captured.out


def test_send_email_skips_when_no_recipients(app):
    with app.app_context():
        with patch('smtplib.SMTP') as mock_smtp:
            notifications.send_email([], 'Subject', 'Body')
            mock_smtp.assert_not_called()


def _configure_smtp(app, use_tls=True):
    with app.app_context():
        SmtpSettings.update('smtp.example.com', 587, 'user', 'pass', 'from@example.com', use_tls)


def test_send_email_sends_via_smtp(app):
    _configure_smtp(app)
    with app.app_context():
        with patch('smtplib.SMTP') as mock_smtp:
            instance = mock_smtp.return_value.__enter__.return_value
            notifications.send_email(['a@b.com'], 'Subject', 'Body')
            instance.starttls.assert_called_once()
            instance.login.assert_called_once_with('user', 'pass')
            instance.sendmail.assert_called_once()


def test_send_email_skips_starttls_when_disabled(app):
    _configure_smtp(app, use_tls=False)
    with app.app_context():
        with patch('smtplib.SMTP') as mock_smtp:
            instance = mock_smtp.return_value.__enter__.return_value
            notifications.send_email(['a@b.com'], 'Subject', 'Body')
            instance.starttls.assert_not_called()


def test_send_email_skips_login_when_no_credentials(app):
    with app.app_context():
        SmtpSettings.update('smtp.example.com', 587, None, None, 'from@example.com', True)
        with patch('smtplib.SMTP') as mock_smtp:
            instance = mock_smtp.return_value.__enter__.return_value
            notifications.send_email(['a@b.com'], 'Subject', 'Body')
            instance.login.assert_not_called()
            instance.sendmail.assert_called_once()


def test_send_email_with_attachment_sends_multipart(app):
    _configure_smtp(app)
    with app.app_context():
        with patch('smtplib.SMTP') as mock_smtp:
            instance = mock_smtp.return_value.__enter__.return_value
            notifications.send_email(['a@b.com'], 'Subject', 'Body', attachment_bytes=b'\xff\xd8\xff')
            args, _ = instance.sendmail.call_args
            assert 'Content-Type: image/jpeg' in args[2] or 'image' in args[2].lower()


def test_send_sms_logs_mock(capsys, monkeypatch):
    monkeypatch.delenv('SMS_BACKEND', raising=False)
    notifications.send_sms(['+48123456789'], 'Test message')
    captured = capsys.readouterr()
    assert '+48123456789' in captured.out


def test_send_sms_skips_when_no_recipients():
    with patch('sim800.send_sms_sim800') as mock_sim800:
        notifications.send_sms([], 'Test message')
        mock_sim800.assert_not_called()


def test_send_sms_uses_sim800_backend_when_configured(monkeypatch):
    monkeypatch.setenv('SMS_BACKEND', 'sim800')
    calls = []
    monkeypatch.setattr('sim800.send_sms_sim800', lambda numbers, msg: calls.append((numbers, msg)))
    notifications.send_sms(['+48123456789'], 'Test message')
    assert calls == [(['+48123456789'], 'Test message')]
