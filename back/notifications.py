import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage


def send_email(to_addresses, subject, body, attachment_bytes=None, attachment_filename='zdjecie.jpg'):
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
        print('[notifications] SMTP nieskonfigurowany — pomijam wysyłkę e-mail')
        return

    if attachment_bytes:
        msg = MIMEMultipart()
        msg.attach(MIMEText(body))
        image = MIMEImage(attachment_bytes, _subtype='jpeg', name=attachment_filename)
        msg.attach(image)
    else:
        msg = MIMEText(body)
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
