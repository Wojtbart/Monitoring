import os
from flask import Flask, Response, request, jsonify, send_from_directory
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from models import db, User, Setting, Log, Layout, DeviceSensor, DeviceSensorHistory, EmailGroup, EmailRecipient, SmsGroup, SmsRecipient, NotificationRule, NOTIFICATION_EVENT_TYPES, AlarmState, ALARM_EVENT_TYPES, DeviceAlarmState, VoltageThreshold, DeviceSensorSettings, alarm_should_fire, is_within_schedule, SmtpSettings, DEFAULT_SCHEDULE
from pythonping import ping
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from dotenv import load_dotenv

from camera import Camera
from sensors import Sensor

load_dotenv()

app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///monitoring.db')
app.config['JWT_SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=int(os.getenv('JWT_EXPIRES_MINUTES', 60)))
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
jwt = JWTManager(app)

VIDEOS_DIR = os.getenv('VIDEOS_DIR', 'videos')
os.makedirs(VIDEOS_DIR, exist_ok=True)

camera = Camera(VIDEOS_DIR)
sensor = None


def init_sensor():
    global sensor
    with app.app_context():
        settings = Setting.get_all_settings()
        Log.add_log(datetime.now(), 'System', False, 'System uruchomiony')
    sensor = Sensor(app, settings, camera)


@app.route('/')
def hello_world():
    return 'Monitoring System API'


@app.route('/users', methods=['POST'])
@jwt_required()
def register():
    current_user = User.get_user_by_username(get_jwt_identity())
    if not current_user or not current_user.is_admin:
        return jsonify({'message': 'Brak uprawnień'}), 403

    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    is_admin = data.get('isAdmin', False)
    if not username or not password:
        return jsonify({'message': 'Brak danych'}), 400
    if User.get_user_by_username(username):
        return jsonify({'message': 'Użytkownik o takim loginie istnieje'}), 400
    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
    User.add_user(username, hashed_password, is_admin)
    return jsonify({'message': 'Użytkownik utworzony'}), 200


@app.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    current_user = User.get_user_by_username(get_jwt_identity())
    if not current_user or not current_user.is_admin:
        return jsonify({'message': 'Brak uprawnień'}), 403
    return jsonify([
        {'id': user.id, 'username': user.username, 'isadmin': user.is_admin}
        for user in User.get_all_users()
    ]), 200


@app.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    current_user = User.get_user_by_username(get_jwt_identity())
    if not current_user or not current_user.is_admin:
        return jsonify({'message': 'Brak uprawnień'}), 403
    if current_user.id == user_id:
        return jsonify({'message': 'Nie możesz usunąć własnego konta'}), 400
    if not db.session.get(User, user_id):
        return jsonify({'message': 'Użytkownik nie znaleziony'}), 404
    User.delete_user(user_id)
    return jsonify({'message': 'Użytkownik usunięty'}), 200


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    user = User.get_user_by_username(username)
    if user is None or not check_password_hash(user.password, password):
        Log.add_log(datetime.now(), 'Logowanie', True,
                    f'Nieudana próba logowania: {username} (IP: {request.remote_addr})')
        return jsonify({'message': 'Nieprawidłowe dane logowania'}), 401
    access_token = create_access_token(identity=username)
    Log.add_log(datetime.now(), 'Logowanie', False,
                f'Zalogowano jako {username} (IP: {request.remote_addr})')
    return jsonify({'accessToken': access_token}), 200


@app.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    current_user = get_jwt_identity()
    Log.add_log(datetime.now(), 'Wylogowanie', False, f'Wylogowano: {current_user}')
    return jsonify({'message': 'Wylogowano'}), 200


@app.route('/users/me', methods=['GET'])
@jwt_required()
def user_info():
    current_user = get_jwt_identity()
    is_admin = User.get_user_by_username(current_user).is_admin
    return jsonify({'currentUser': current_user, 'isAdmin': is_admin}), 200


@app.route('/layouts', methods=['POST'])
@jwt_required()
def save_layout():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Brak danych'}), 400
    layout = Layout(data=data)
    db.session.add(layout)
    db.session.commit()
    return jsonify({'message': 'Layout zapisany', 'id': layout.id}), 201


@app.route('/layouts/<int:layout_id>', methods=['GET'])
def get_layout(layout_id):
    layout = db.session.get(Layout, layout_id)
    if not layout:
        return jsonify({'error': 'Layout nie znaleziony'}), 404
    return jsonify(layout.data), 200


@app.route('/layouts/<int:layout_id>', methods=['PUT'])
@jwt_required()
def update_layout(layout_id):
    layout = db.session.get(Layout, layout_id)
    if not layout:
        return jsonify({'error': 'Layout nie znaleziony'}), 404
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Brak danych'}), 400
    layout.data = data
    db.session.commit()
    return jsonify({'message': 'Layout zaktualizowany'}), 200


def generate_frames():
    for frame_bytes in camera.stream():
        yield frame_bytes


@app.route('/camera/stream')
def capture_video():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/camera/recording', methods=['POST'])
@jwt_required()
def start_recording():
    if sensor.is_recording:
        return jsonify({'message': 'Kamera już nagrywa'}), 403
    video_name = camera.start_recording()
    if video_name is None:
        return jsonify({'message': 'Nie można uruchomić nagrywania'}), 500
    sensor.is_user_recording = True
    sensor.video_name = video_name.replace('.mp4', '')
    return jsonify({'message': 'Nagrywanie rozpoczęte', 'videoName': video_name}), 200


@app.route('/camera/recording', methods=['DELETE'])
@jwt_required()
def stop_recording():
    camera.stop_recording()
    sensor.is_user_recording = False
    return jsonify({'message': 'Nagrywanie zatrzymane'}), 200


@app.route('/videos', methods=['GET'])
@jwt_required()
def get_videos():
    videos = [f for f in os.listdir(VIDEOS_DIR) if f.endswith(('.mp4', '.avi', '.mov'))]
    base_url = request.host_url.rstrip('/')
    url_videos = [{'name': v, 'url': f'{base_url}/videos/{v}'} for v in videos]
    return jsonify(url_videos), 200


@app.route('/videos/<video_name>', methods=['GET'])
def get_video(video_name):
    return send_from_directory(VIDEOS_DIR, video_name, mimetype='video/mp4')


@app.route('/videos/<video_name>', methods=['DELETE'])
@jwt_required()
def delete_video(video_name):
    safe_name = os.path.basename(video_name)
    path = os.path.join(VIDEOS_DIR, safe_name)
    if not os.path.isfile(path):
        return jsonify({'message': 'Wideo nie znalezione'}), 404
    os.remove(path)
    return jsonify({'message': 'Wideo usunięte'}), 200


@app.route('/videos', methods=['DELETE'])
@jwt_required()
def delete_all_videos():
    for f in os.listdir(VIDEOS_DIR):
        if f.endswith(('.mp4', '.avi', '.mov')):
            os.remove(os.path.join(VIDEOS_DIR, f))
    return jsonify({'message': 'Wszystkie wideo usunięte'}), 200


@app.route('/email-groups', methods=['POST'])
@jwt_required()
def add_email_group():
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'message': 'Nazwa grupy wymagana'}), 400
    group = EmailGroup.add_group(name)
    if not group:
        return jsonify({'message': 'Grupa o takiej nazwie już istnieje'}), 400
    return jsonify({'message': 'Grupa dodana', 'id': group.id}), 201


@app.route('/email-groups', methods=['GET'])
def get_email_groups():
    return jsonify({'groups': EmailGroup.get_all_with_recipients()}), 200


@app.route('/email-groups/<int:group_id>', methods=['DELETE'])
@jwt_required()
def delete_email_group(group_id):
    if not EmailGroup.delete_group(group_id):
        return jsonify({'message': 'Grupa nie znaleziona'}), 404
    return jsonify({'message': 'Grupa usunięta'}), 200


@app.route('/email-groups/<int:group_id>/recipients', methods=['POST'])
@jwt_required()
def add_email_recipient(group_id):
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'message': 'Adres e-mail wymagany'}), 400
    recipient = EmailGroup.add_recipient(group_id, email)
    if not recipient:
        return jsonify({'message': 'Grupa nie znaleziona'}), 404
    return jsonify({'message': 'Adres dodany', 'id': recipient.id}), 201


@app.route('/email-groups/<int:group_id>/recipients/<int:recipient_id>', methods=['DELETE'])
@jwt_required()
def delete_email_recipient(group_id, recipient_id):
    if not EmailGroup.delete_recipient(recipient_id):
        return jsonify({'message': 'Adres nie znaleziony'}), 404
    return jsonify({'message': 'Adres usunięty'}), 200


@app.route('/email-groups/<int:group_id>/schedule', methods=['PUT'])
@jwt_required()
def update_email_group_schedule(group_id):
    data = request.get_json()
    schedule = data.get('schedule')
    if not schedule or len(schedule) != 168 or any(c not in '01' for c in schedule):
        return jsonify({'message': 'Nieprawidłowy harmonogram'}), 400
    group = EmailGroup.update_schedule(group_id, schedule)
    if not group:
        return jsonify({'message': 'Grupa nie znaleziona'}), 404
    return jsonify({'message': 'Harmonogram zapisany'}), 200


@app.route('/sms-groups', methods=['POST'])
@jwt_required()
def add_sms_group():
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'message': 'Nazwa grupy wymagana'}), 400
    group = SmsGroup.add_group(name)
    if not group:
        return jsonify({'message': 'Grupa o takiej nazwie już istnieje'}), 400
    return jsonify({'message': 'Grupa dodana', 'id': group.id}), 201


@app.route('/sms-groups', methods=['GET'])
def get_sms_groups():
    return jsonify({'groups': SmsGroup.get_all_with_recipients()}), 200


@app.route('/sms-groups/<int:group_id>', methods=['DELETE'])
@jwt_required()
def delete_sms_group(group_id):
    if not SmsGroup.delete_group(group_id):
        return jsonify({'message': 'Grupa nie znaleziona'}), 404
    return jsonify({'message': 'Grupa usunięta'}), 200


@app.route('/sms-groups/<int:group_id>/recipients', methods=['POST'])
@jwt_required()
def add_sms_recipient(group_id):
    data = request.get_json()
    phone_number = data.get('phone_number')
    if not phone_number:
        return jsonify({'message': 'Numer telefonu wymagany'}), 400
    recipient = SmsGroup.add_recipient(group_id, phone_number)
    if not recipient:
        return jsonify({'message': 'Grupa nie znaleziona'}), 404
    return jsonify({'message': 'Numer dodany', 'id': recipient.id}), 201


@app.route('/sms-groups/<int:group_id>/recipients/<int:recipient_id>', methods=['DELETE'])
@jwt_required()
def delete_sms_recipient(group_id, recipient_id):
    if not SmsGroup.delete_recipient(recipient_id):
        return jsonify({'message': 'Numer nie znaleziony'}), 404
    return jsonify({'message': 'Numer usunięty'}), 200


@app.route('/sms-groups/<int:group_id>/schedule', methods=['PUT'])
@jwt_required()
def update_sms_group_schedule(group_id):
    data = request.get_json()
    schedule = data.get('schedule')
    if not schedule or len(schedule) != 168 or any(c not in '01' for c in schedule):
        return jsonify({'message': 'Nieprawidłowy harmonogram'}), 400
    group = SmsGroup.update_schedule(group_id, schedule)
    if not group:
        return jsonify({'message': 'Grupa nie znaleziona'}), 404
    return jsonify({'message': 'Harmonogram zapisany'}), 200


@app.route('/notification-rules', methods=['GET'])
def get_notification_rules():
    return jsonify({'rules': NotificationRule.get_all()}), 200


@app.route('/notification-rules', methods=['PUT'])
@jwt_required()
def update_notification_rules():
    data = request.get_json()
    rules = data.get('rules')
    if not rules or len(rules) != len(NOTIFICATION_EVENT_TYPES):
        return jsonify({'message': 'Wymagane dokładnie 4 reguły'}), 400
    seen_types = set()
    for rule in rules:
        event_type = rule.get('event_type')
        if event_type not in NOTIFICATION_EVENT_TYPES or event_type in seen_types:
            return jsonify({'message': 'Nieprawidłowy typ zdarzenia'}), 400
        seen_types.add(event_type)
        if rule.get('email_group_id') is not None and not db.session.get(EmailGroup, rule['email_group_id']):
            return jsonify({'message': 'Grupa mailowa nie istnieje'}), 400
        if rule.get('sms_group_id') is not None and not db.session.get(SmsGroup, rule['sms_group_id']):
            return jsonify({'message': 'Grupa SMS nie istnieje'}), 400
    NotificationRule.update_all(rules)
    return jsonify({'message': 'Reguły zaktualizowane'}), 200


EVENT_TYPE_SENSOR_NAMES = {
    'fire': 'Czujnik pożaru', 'gas': 'Czujnik gazu',
    'water': 'Czujnik wody', 'door': 'Czujnik drzwi',
    'voltage': 'Napięcie zasilania',
}
EVENT_TYPE_TEST_DESCRIPTIONS = {
    'fire': 'Wykryto ogień! (TEST)', 'gas': 'Wykryto gaz/dym! (TEST)',
    'water': 'Wykryto wodę! (TEST)', 'door': 'Otwarto drzwi (TEST)',
    'voltage': 'Napięcie poza normą! (TEST)',
}


@app.route('/alarm-states', methods=['GET'])
def get_alarm_states():
    return jsonify({'states': AlarmState.get_all()}), 200


@app.route('/sensors/<event_type>/simulate', methods=['POST'])
@jwt_required()
def simulate_sensor_alert(event_type):
    if event_type not in ALARM_EVENT_TYPES:
        return jsonify({'message': 'Nieprawidłowy typ czujnika'}), 400
    sensor._raise_alert(
        event_type, EVENT_TYPE_SENSOR_NAMES[event_type], True,
        EVENT_TYPE_TEST_DESCRIPTIONS[event_type], force=True,
    )
    return jsonify({'message': 'Alarm testowy wywołany'}), 200


@app.route('/sensors/<event_type>/clear', methods=['DELETE'])
@jwt_required()
def clear_sensor_alert(event_type):
    if event_type not in ALARM_EVENT_TYPES:
        return jsonify({'message': 'Nieprawidłowy typ czujnika'}), 400
    if not AlarmState.clear(event_type):
        return jsonify({'message': 'Stan alarmu nie znaleziony'}), 404
    current_user = get_jwt_identity()
    Log.add_log(datetime.now(), EVENT_TYPE_SENSOR_NAMES[event_type], False,
                f'Alarm skasowany przez {current_user}')
    return jsonify({'message': 'Alarm skasowany'}), 200


@app.route('/settings', methods=['PUT'])
@jwt_required()
def save_settings():
    data = request.get_json()
    ok = Setting.update_settings(
        data.get('id'),
        data.get('recording_seconds'),
    )
    if ok:
        sensor.update_settings(Setting.get_all_settings())
        return jsonify({'message': 'Ustawienia zapisane'}), 200
    return jsonify({'message': 'Błąd zapisu ustawień'}), 400


@app.route('/voltage-threshold', methods=['GET'])
def get_voltage_threshold():
    threshold = VoltageThreshold.get_or_create()
    return jsonify({
        'min_voltage': threshold.min_voltage,
        'max_voltage': threshold.max_voltage,
        'enabled': threshold.enabled,
    }), 200


@app.route('/voltage-enabled', methods=['PUT'])
@jwt_required()
def save_voltage_enabled():
    data = request.get_json()
    enabled = data.get('enabled')
    if not isinstance(enabled, bool):
        return jsonify({'message': 'Brak danych'}), 400
    threshold = VoltageThreshold.set_enabled(enabled)
    sensor.update_voltage_enabled(enabled)
    return jsonify({'enabled': threshold.enabled}), 200


@app.route('/voltage-threshold', methods=['PUT'])
@jwt_required()
def save_voltage_threshold():
    data = request.get_json()
    min_voltage = data.get('min_voltage')
    max_voltage = data.get('max_voltage')
    if min_voltage is None or max_voltage is None:
        return jsonify({'message': 'Brak danych'}), 400
    if min_voltage >= max_voltage:
        return jsonify({'message': 'Wartość minimalna musi być mniejsza niż maksymalna'}), 400
    threshold = VoltageThreshold.update(min_voltage, max_voltage)
    sensor.update_voltage_threshold(min_voltage, max_voltage)
    return jsonify({'min_voltage': threshold.min_voltage, 'max_voltage': threshold.max_voltage}), 200


def _smtp_settings_dict(settings):
    return {
        'host': settings.host,
        'port': settings.port,
        'username': settings.username,
        'password': settings.password,
        'from_address': settings.from_address,
        'use_tls': settings.use_tls,
    }


@app.route('/smtp-settings', methods=['GET'])
@jwt_required()
def get_smtp_settings():
    return jsonify(_smtp_settings_dict(SmtpSettings.get_or_create())), 200


@app.route('/smtp-settings', methods=['PUT'])
@jwt_required()
def save_smtp_settings():
    data = request.get_json()
    settings = SmtpSettings.update(
        data.get('host'),
        int(data.get('port') or 587),
        data.get('username'),
        data.get('password'),
        data.get('from_address'),
        bool(data.get('use_tls', True)),
    )
    return jsonify(_smtp_settings_dict(settings)), 200


@app.route('/smtp-settings/test', methods=['POST'])
@jwt_required()
def test_smtp_settings():
    data = request.get_json()
    to_address = data.get('to_address')
    if not to_address:
        return jsonify({'message': 'Adres odbiorcy wymagany'}), 400
    from notifications import send_email
    send_email([to_address], 'Test SMTP — Monitoring System',
               'To jest testowa wiadomość ze strony Ustawienia → SMTP.')
    return jsonify({'message': 'Wysłano (sprawdź skrzynkę i logi backendu w razie błędu)'}), 200


@app.route('/settings-and-phone-numbers', methods=['GET'])
def get_settings():
    return jsonify({
        'settings': Setting.get_all_settings(),
    }), 200


@app.route('/settings', methods=['GET'])
def get_settings_only():
    return jsonify({'settings': Setting.get_all_settings()}), 200


@app.route('/logs', methods=['GET'])
@jwt_required()
def get_logs():
    return jsonify({'logs': Log.get_all_logs()}), 200


@app.route('/logs', methods=['DELETE'])
@jwt_required()
def delete_logs():
    data = request.get_json(silent=True) or {}
    ids = data.get('ids')
    if ids:
        Log.remove_logs(ids)
    else:
        Log.remove_all_logs()
    return jsonify({'message': 'Logi usunięte'}), 200


@app.route('/real-time-data', methods=['GET'])
def get_real_time_data():
    return jsonify(sensor.get_current_data()), 200


DEVICE_METRIC_LABELS = {'temperature': 'temperatury', 'humidity': 'wilgotności'}
DEVICE_METRIC_UNITS = {'temperature': '°C', 'humidity': '%'}
DEVICE_SEVERITY_LABELS = {'non_critical': 'ostrzeżenie', 'critical': 'krytyczny'}


def _fmt_dt(value):
    return value.strftime('%Y-%m-%d %H:%M:%S') if value else None


def _device_sensor_dict(rack_id, unit, device):
    return {
        'temperature': device.temperature,
        'humidity': device.humidity,
        'updated_at': device.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
        'min_temperature': device.min_temperature,
        'max_temperature': device.max_temperature,
        'min_humidity': device.min_humidity,
        'max_humidity': device.max_humidity,
        'min_temperature_critical': device.min_temperature_critical,
        'max_temperature_critical': device.max_temperature_critical,
        'min_humidity_critical': device.min_humidity_critical,
        'max_humidity_critical': device.max_humidity_critical,
        'alert_delay_seconds': device.alert_delay_seconds,
        'alarm_active_temperature_non_critical': DeviceAlarmState.is_active(rack_id, unit, 'temperature', 'non_critical'),
        'alarm_active_temperature_critical': DeviceAlarmState.is_active(rack_id, unit, 'temperature', 'critical'),
        'alarm_active_humidity_non_critical': DeviceAlarmState.is_active(rack_id, unit, 'humidity', 'non_critical'),
        'alarm_active_humidity_critical': DeviceAlarmState.is_active(rack_id, unit, 'humidity', 'critical'),
        'lowest_temperature': device.lowest_temperature,
        'lowest_temperature_at': _fmt_dt(device.lowest_temperature_at),
        'highest_temperature': device.highest_temperature,
        'highest_temperature_at': _fmt_dt(device.highest_temperature_at),
        'lowest_humidity': device.lowest_humidity,
        'lowest_humidity_at': _fmt_dt(device.lowest_humidity_at),
        'highest_humidity': device.highest_humidity,
        'highest_humidity_at': _fmt_dt(device.highest_humidity_at),
    }


def _raise_device_alert(rack_id, unit, metric, severity, value, min_v, max_v, force=False):
    state = DeviceAlarmState.get(rack_id, unit, metric, severity)
    rule = NotificationRule.query.filter_by(event_type='device_threshold').first()
    notify_again_minutes = rule.notify_again_minutes if rule else 30
    if not alarm_should_fire(state, notify_again_minutes, force=force):
        return

    label = DEVICE_METRIC_LABELS[metric]
    unit_symbol = DEVICE_METRIC_UNITS[metric]
    severity_label = DEVICE_SEVERITY_LABELS[severity]
    desc = (f'Przekroczono próg {label} ({severity_label}) w szafie {rack_id} (unit {unit}): '
            f'{value}{unit_symbol} (próg {min_v}-{max_v}{unit_symbol})')
    Log.add_log(datetime.now(), f'Szafa {rack_id} — Unit {unit}', True, desc)
    DeviceAlarmState.trigger(rack_id, unit, metric, severity)

    if not rule:
        return
    from notifications import send_email, send_sms
    if rule.email_enabled and rule.email_group_id:
        email_group = db.session.get(EmailGroup, rule.email_group_id)
        if email_group and is_within_schedule(email_group.schedule, datetime.now()):
            emails = [r.email for r in EmailRecipient.query.filter_by(group_id=rule.email_group_id).all()]
            subject = rule.email_custom_subject if (rule.email_custom_subject_enabled and rule.email_custom_subject) else f'Alarm: {desc}'
            attachment = camera.capture_jpeg() if rule.email_attach_camera else None
            send_email(emails, subject, desc, attachment_bytes=attachment)
    if rule.sms_enabled and rule.sms_group_id:
        sms_group = db.session.get(SmsGroup, rule.sms_group_id)
        if sms_group and is_within_schedule(sms_group.schedule, datetime.now()):
            numbers = [r.phone_number for r in SmsRecipient.query.filter_by(group_id=rule.sms_group_id).all()]
            sms_text = rule.sms_custom_message if (rule.sms_custom_enabled and rule.sms_custom_message) else desc
            send_sms(numbers, sms_text)


def _raise_device_return_to_normal(rack_id, unit, metric, severity):
    rule = NotificationRule.query.filter_by(event_type='device_threshold').first()
    label = DEVICE_METRIC_LABELS[metric]
    severity_label = DEVICE_SEVERITY_LABELS[severity]
    desc = f'{label.capitalize()} ({severity_label}) wróciła do normy w szafie {rack_id} (unit {unit})'
    Log.add_log(datetime.now(), f'Szafa {rack_id} — Unit {unit}', False, desc)
    DeviceAlarmState.mark_return_notified(rack_id, unit, metric, severity)

    if not rule or not rule.notify_on_return_enabled:
        return
    from notifications import send_email, send_sms
    if rule.email_enabled and rule.email_group_id:
        email_group = db.session.get(EmailGroup, rule.email_group_id)
        if email_group and is_within_schedule(email_group.schedule, datetime.now()):
            emails = [r.email for r in EmailRecipient.query.filter_by(group_id=rule.email_group_id).all()]
            subject = rule.email_custom_subject if (rule.email_custom_subject_enabled and rule.email_custom_subject) else f'Powrót do normy: {desc}'
            send_email(emails, subject, desc)
    if rule.sms_enabled and rule.sms_group_id:
        sms_group = db.session.get(SmsGroup, rule.sms_group_id)
        if sms_group and is_within_schedule(sms_group.schedule, datetime.now()):
            numbers = [r.phone_number for r in SmsRecipient.query.filter_by(group_id=rule.sms_group_id).all()]
            send_sms(numbers, desc)


def _check_device_metric_severity(rack_id, unit, metric, severity, value, min_v, max_v, alert_delay_seconds):
    out_of_range = value < min_v or value > max_v
    if out_of_range:
        state = DeviceAlarmState.get(rack_id, unit, metric, severity)
        if state and state.active:
            _raise_device_alert(rack_id, unit, metric, severity, value, min_v, max_v)
        elif alert_delay_seconds <= 0:
            _raise_device_alert(rack_id, unit, metric, severity, value, min_v, max_v)
        else:
            pending_since = DeviceAlarmState.mark_pending(rack_id, unit, metric, severity)
            if (datetime.now() - pending_since).total_seconds() >= alert_delay_seconds:
                _raise_device_alert(rack_id, unit, metric, severity, value, min_v, max_v)
    else:
        DeviceAlarmState.clear_pending(rack_id, unit, metric, severity)
        state = DeviceAlarmState.get(rack_id, unit, metric, severity)
        if state and state.active and not state.return_notified:
            _raise_device_return_to_normal(rack_id, unit, metric, severity)


def _check_device_thresholds(rack_id, unit, device):
    checks = (
        ('temperature', device.temperature, 'non_critical', device.min_temperature, device.max_temperature),
        ('temperature', device.temperature, 'critical', device.min_temperature_critical, device.max_temperature_critical),
        ('humidity', device.humidity, 'non_critical', device.min_humidity, device.max_humidity),
        ('humidity', device.humidity, 'critical', device.min_humidity_critical, device.max_humidity_critical),
    )
    for metric, value, severity, min_v, max_v in checks:
        _check_device_metric_severity(rack_id, unit, metric, severity, value, min_v, max_v, device.alert_delay_seconds)


@app.route('/device-sensor-settings', methods=['GET'])
def get_device_sensor_settings():
    settings = DeviceSensorSettings.get_or_create()
    return jsonify({'enabled': settings.enabled}), 200


@app.route('/device-sensor-settings', methods=['PUT'])
@jwt_required()
def save_device_sensor_settings():
    data = request.get_json()
    enabled = data.get('enabled')
    if not isinstance(enabled, bool):
        return jsonify({'message': 'Brak danych'}), 400
    settings = DeviceSensorSettings.set_enabled(enabled)
    return jsonify({'enabled': settings.enabled}), 200


@app.route('/device-sensors/<rack_id>/<int:unit>', methods=['GET'])
def get_device_sensors(rack_id, unit):
    if not DeviceSensorSettings.get_or_create().enabled:
        device = DeviceSensor.get_existing(rack_id, unit)
        if device is None:
            return jsonify({'enabled': False}), 200
        result = _device_sensor_dict(rack_id, unit, device)
        result['enabled'] = False
        return jsonify(result), 200
    device = DeviceSensor.get_or_create_reading(rack_id, unit)
    _check_device_thresholds(rack_id, unit, device)
    result = _device_sensor_dict(rack_id, unit, device)
    result['enabled'] = True
    return jsonify(result), 200


@app.route('/device-sensors/<rack_id>/<int:unit>/<metric>/<severity>/simulate', methods=['POST'])
@jwt_required()
def simulate_device_alert(rack_id, unit, metric, severity):
    if metric not in DEVICE_METRIC_LABELS or severity not in DEVICE_SEVERITY_LABELS:
        return jsonify({'message': 'Nieprawidłowy typ czujnika'}), 400
    device = DeviceSensor.get_or_create_reading(rack_id, unit)
    value = device.temperature if metric == 'temperature' else device.humidity
    if metric == 'temperature':
        min_v = device.min_temperature_critical if severity == 'critical' else device.min_temperature
        max_v = device.max_temperature_critical if severity == 'critical' else device.max_temperature
    else:
        min_v = device.min_humidity_critical if severity == 'critical' else device.min_humidity
        max_v = device.max_humidity_critical if severity == 'critical' else device.max_humidity
    _raise_device_alert(rack_id, unit, metric, severity, value, min_v, max_v, force=True)
    return jsonify({'message': 'Alarm zasymulowany'}), 200


@app.route('/device-sensors/<rack_id>/<int:unit>/<metric>/<severity>/clear', methods=['DELETE'])
@jwt_required()
def clear_device_alert(rack_id, unit, metric, severity):
    if metric not in DEVICE_METRIC_LABELS or severity not in DEVICE_SEVERITY_LABELS:
        return jsonify({'message': 'Nieprawidłowy typ czujnika'}), 400
    if not DeviceAlarmState.clear(rack_id, unit, metric, severity):
        return jsonify({'message': 'Stan alarmu nie znaleziony'}), 404
    current_user = get_jwt_identity()
    Log.add_log(datetime.now(), f'Szafa {rack_id} — Unit {unit}', False,
                f'Alarm ({DEVICE_METRIC_LABELS[metric]}, {DEVICE_SEVERITY_LABELS[severity]}) skasowany przez {current_user}')
    return jsonify({'message': 'Alarm skasowany'}), 200


@app.route('/device-sensors/<rack_id>/<int:unit>/thresholds', methods=['PUT'])
@jwt_required()
def update_device_sensor_thresholds(rack_id, unit):
    data = request.get_json()
    fields = ['min_temperature', 'max_temperature', 'min_humidity', 'max_humidity',
              'min_temperature_critical', 'max_temperature_critical',
              'min_humidity_critical', 'max_humidity_critical', 'alert_delay_seconds']
    values = {f: data.get(f) for f in fields}
    if any(v is None for v in values.values()):
        return jsonify({'message': 'Brak danych'}), 400
    if values['min_temperature'] >= values['max_temperature'] or values['min_humidity'] >= values['max_humidity']:
        return jsonify({'message': 'Wartość minimalna musi być mniejsza niż maksymalna'}), 400
    if values['min_temperature_critical'] >= values['max_temperature_critical'] or \
            values['min_humidity_critical'] >= values['max_humidity_critical']:
        return jsonify({'message': 'Wartość minimalna musi być mniejsza niż maksymalna (krytyczny)'}), 400

    device = DeviceSensor.update_thresholds(
        rack_id, unit,
        values['min_temperature'], values['max_temperature'],
        values['min_humidity'], values['max_humidity'],
        values['min_temperature_critical'], values['max_temperature_critical'],
        values['min_humidity_critical'], values['max_humidity_critical'],
        values['alert_delay_seconds'],
    )
    if device is None:
        return jsonify({'message': 'Urządzenie nie znalezione'}), 404
    return jsonify(_device_sensor_dict(rack_id, unit, device)), 200


HISTORY_RANGE_HOURS = {'24h': 24, 'week': 24 * 7, 'month': 24 * 30}


@app.route('/device-sensors/<rack_id>/<int:unit>/history', methods=['GET'])
def get_device_sensor_history(rack_id, unit):
    query = DeviceSensorHistory.query.filter_by(rack_id=rack_id, unit=unit)
    range_key = request.args.get('range')
    hours = HISTORY_RANGE_HOURS.get(range_key)
    if hours:
        query = query.filter(DeviceSensorHistory.recorded_at >= datetime.now() - timedelta(hours=hours))
    rows = query.order_by(DeviceSensorHistory.recorded_at.asc()).all()
    return jsonify({'history': [
        {
            'temperature': row.temperature,
            'humidity': row.humidity,
            'recorded_at': row.recorded_at.strftime('%Y-%m-%d %H:%M:%S'),
        }
        for row in rows
    ]}), 200


@app.route('/device-sensors/<rack_id>/<int:unit>/history', methods=['DELETE'])
@jwt_required()
def clear_device_sensor_history(rack_id, unit):
    DeviceSensor.clear_history(rack_id, unit)
    return jsonify({'message': 'Wykres wyczyszczony'}), 200


@app.route('/device-sensors/<rack_id>/<int:unit>/records', methods=['DELETE'])
@jwt_required()
def clear_device_sensor_records(rack_id, unit):
    device = DeviceSensor.clear_records(rack_id, unit)
    if device is None:
        return jsonify({'message': 'Urządzenie nie znalezione'}), 404
    return jsonify(_device_sensor_dict(rack_id, unit, device)), 200


@app.route('/ping/<path:address>', methods=['GET'])
@jwt_required()
def ping_host(address):
    try:
        response = ping(address, count=4)
    except RuntimeError:
        return jsonify({'message': f'Nie można rozwiązać adresu "{address}" — sprawdź czy IP/hostname jest poprawny'}), 400
    messages = [str(r).split('\r')[0] for r in response]
    return jsonify({'messages': messages}), 200


def _export_config():
    email_names = {g.id: g.name for g in EmailGroup.query.all()}
    sms_names = {g.id: g.name for g in SmsGroup.query.all()}
    rules = []
    for r in NotificationRule.get_all():
        rules.append({
            **r,
            'email_group_name': email_names.get(r['email_group_id']),
            'sms_group_name': sms_names.get(r['sms_group_id']),
        })
    thresholds = [
        {
            'rack_id': d.rack_id, 'unit': d.unit,
            'min_temperature': d.min_temperature, 'max_temperature': d.max_temperature,
            'min_humidity': d.min_humidity, 'max_humidity': d.max_humidity,
            'min_temperature_critical': d.min_temperature_critical, 'max_temperature_critical': d.max_temperature_critical,
            'min_humidity_critical': d.min_humidity_critical, 'max_humidity_critical': d.max_humidity_critical,
            'alert_delay_seconds': d.alert_delay_seconds,
        }
        for d in DeviceSensor.query.all()
    ]
    voltage = VoltageThreshold.get_or_create()
    smtp = _smtp_settings_dict(SmtpSettings.get_or_create())
    smtp.pop('password', None)
    return {
        'version': 1,
        'exported_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'settings': Setting.get_all_settings(),
        'notification_rules': rules,
        'email_groups': EmailGroup.get_all_with_recipients(),
        'sms_groups': SmsGroup.get_all_with_recipients(),
        'device_sensor_thresholds': thresholds,
        'voltage_threshold': {'min_voltage': voltage.min_voltage, 'max_voltage': voltage.max_voltage},
        'smtp_settings': smtp,
    }


def _restore_email_groups(groups_data):
    for g in groups_data:
        group = EmailGroup.query.filter_by(name=g['name']).first()
        if not group:
            group = EmailGroup(name=g['name'])
            db.session.add(group)
            db.session.flush()
        group.schedule = g.get('schedule') or DEFAULT_SCHEDULE
        EmailRecipient.query.filter_by(group_id=group.id).delete()
        for r in g.get('recipients', []):
            db.session.add(EmailRecipient(group_id=group.id, email=r['email']))
    db.session.commit()


def _restore_sms_groups(groups_data):
    for g in groups_data:
        group = SmsGroup.query.filter_by(name=g['name']).first()
        if not group:
            group = SmsGroup(name=g['name'])
            db.session.add(group)
            db.session.flush()
        group.schedule = g.get('schedule') or DEFAULT_SCHEDULE
        SmsRecipient.query.filter_by(group_id=group.id).delete()
        for r in g.get('recipients', []):
            db.session.add(SmsRecipient(group_id=group.id, phone_number=r['phone_number']))
    db.session.commit()


def _restore_notification_rules(rules_data, email_name_to_id, sms_name_to_id):
    payload = [{
        'event_type': r['event_type'],
        'email_enabled': r.get('email_enabled', False),
        'email_group_id': email_name_to_id.get(r.get('email_group_name')),
        'sms_enabled': r.get('sms_enabled', False),
        'sms_group_id': sms_name_to_id.get(r.get('sms_group_name')),
        'notify_again_minutes': r.get('notify_again_minutes', 30),
        'sms_custom_enabled': r.get('sms_custom_enabled', False),
        'sms_custom_message': r.get('sms_custom_message'),
        'notify_on_return_enabled': r.get('notify_on_return_enabled', False),
        'email_custom_subject_enabled': r.get('email_custom_subject_enabled', False),
        'email_custom_subject': r.get('email_custom_subject'),
        'email_attach_camera': r.get('email_attach_camera', False),
    } for r in rules_data]
    NotificationRule.update_all(payload)


def _restore_device_thresholds(rows):
    for row in rows:
        device = DeviceSensor.query.filter_by(rack_id=row['rack_id'], unit=row['unit']).first()
        if not device:
            continue
        device.min_temperature = row['min_temperature']
        device.max_temperature = row['max_temperature']
        device.min_humidity = row['min_humidity']
        device.max_humidity = row['max_humidity']
        device.min_temperature_critical = row['min_temperature_critical']
        device.max_temperature_critical = row['max_temperature_critical']
        device.min_humidity_critical = row['min_humidity_critical']
        device.max_humidity_critical = row['max_humidity_critical']
        device.alert_delay_seconds = row['alert_delay_seconds']
    db.session.commit()


def _restore_settings(rows):
    if not rows:
        return
    row = rows[0]
    existing = Setting.query.first()
    if existing:
        Setting.update_settings(existing.id, row['recording_seconds'])


def _restore_smtp(data):
    if not data:
        return
    current = SmtpSettings.get_or_create()
    SmtpSettings.update(
        data.get('host'), int(data.get('port') or 587), data.get('username'),
        current.password, data.get('from_address'), bool(data.get('use_tls', True)),
    )


@app.route('/config-backup', methods=['GET'])
@jwt_required()
def get_config_backup():
    return jsonify(_export_config()), 200


@app.route('/config-backup/restore', methods=['POST'])
@jwt_required()
def restore_config_backup():
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or 'version' not in data:
        return jsonify({'message': 'Nieprawidłowy plik konfiguracji'}), 400
    try:
        NotificationRule.seed_defaults()
        _restore_settings(data.get('settings', []))
        _restore_email_groups(data.get('email_groups', []))
        _restore_sms_groups(data.get('sms_groups', []))
        email_name_to_id = {g.name: g.id for g in EmailGroup.query.all()}
        sms_name_to_id = {g.name: g.id for g in SmsGroup.query.all()}
        _restore_notification_rules(data.get('notification_rules', []), email_name_to_id, sms_name_to_id)
        _restore_device_thresholds(data.get('device_sensor_thresholds', []))
        if data.get('voltage_threshold'):
            VoltageThreshold.update(data['voltage_threshold']['min_voltage'], data['voltage_threshold']['max_voltage'])
        _restore_smtp(data.get('smtp_settings'))
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({'message': f'Błąd przywracania konfiguracji: {e}'}), 400
    return jsonify({'message': 'Konfiguracja przywrócona'}), 200


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    init_sensor()
    app.run('0.0.0.0', 5000, debug=False)
