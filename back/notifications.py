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
