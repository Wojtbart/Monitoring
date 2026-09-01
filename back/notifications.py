import os
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage


def _wrap_email_body(body):
    """Owija treść w krótkie powitanie/stopkę — gołe jednolinijkowe maile
    (jak dawniej) wyglądają na spam i tak też są traktowane przez filtry."""
    when = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    return (
        f'Witaj,\n\n'
        f'{body}\n\n'
        f'---\n'
        f'System monitoringu serwerowni — wiadomość wygenerowana automatycznie {when}.\n'
        f'Nie odpowiadaj na tę wiadomość.'
    )


def send_email(to_addresses, subject, body, attachment_bytes=None, attachment_filename='zdjecie.jpg', raise_on_error=False):
    """raise_on_error=False (domyślnie) — używane przy realnych alarmach: błąd SMTP
    nie może wywrócić pętli czujników ani zablokować innych kanałów powiadomień,
    więc tylko loguje i wraca. raise_on_error=True — używane przez przycisk
    "Wyślij testowy e-mail" w Ustawieniach, żeby prawdziwy błąd trafił do
    odpowiedzi API i był widoczny na ekranie, a nie tylko w logach backendu."""
    if not to_addresses:
        return
    from models import SmtpSettings
    settings = SmtpSettings.get_or_create()
    host = settings.host
    port = settings.port
    user = settings.username
    password = settings.password
    from_addr = settings.from_address or user
    if not host or not from_addr:
        message = 'SMTP nieskonfigurowany (brak serwera lub adresu nadawcy) — uzupełnij i zapisz ustawienia SMTP powyżej.'
        print(f'[notifications] {message} — pomijam wysyłkę e-mail')
        if raise_on_error:
            raise RuntimeError(message)
        return

    wrapped_body = _wrap_email_body(body)
    if attachment_bytes:
        msg = MIMEMultipart()
        msg.attach(MIMEText(wrapped_body))
        image = MIMEImage(attachment_bytes, _subtype='jpeg', name=attachment_filename)
        msg.attach(image)
    else:
        msg = MIMEText(wrapped_body)
    msg['Subject'] = subject
    msg['From'] = from_addr
    msg['To'] = ', '.join(to_addresses)
    try:
        with smtplib.SMTP(host, port, timeout=10) as server:
            if settings.use_tls:
                server.starttls()
            if user and password:
                server.login(user, password)
            server.sendmail(from_addr, to_addresses, msg.as_string())
    except Exception as e:
        print(f'[notifications] błąd wysyłki e-mail: {e}')
        if raise_on_error:
            raise


def send_sms(to_numbers, message):
    if not to_numbers:
        return
    backend = os.getenv('SMS_BACKEND', 'mock')
    if backend == 'sim800':
        from sim800 import send_sms_sim800
        send_sms_sim800(to_numbers, message)
        return
    for number in to_numbers:
        print(f'[notifications] (mock SMS) do {number}: {message}')
