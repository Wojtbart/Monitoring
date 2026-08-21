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
