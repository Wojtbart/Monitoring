import os
from flask import Flask, Response, request, jsonify, send_from_directory
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from models import db, User, Setting, Log, Layout, DeviceSensor, DeviceSensorHistory, EmailGroup, EmailRecipient, SmsGroup, SmsRecipient, NotificationRule, NOTIFICATION_EVENT_TYPES, AlarmState, ALARM_EVENT_TYPES, DeviceAlarmState
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
}
EVENT_TYPE_TEST_DESCRIPTIONS = {
    'fire': 'Wykryto ogień! (TEST)', 'gas': 'Wykryto gaz/dym! (TEST)',
    'water': 'Wykryto wodę! (TEST)', 'door': 'Otwarto drzwi (TEST)',
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
        data.get('evening_test_time'),
        data.get('morning_test_time'),
    )
    if ok:
        sensor.update_settings(Setting.get_all_settings())
        return jsonify({'message': 'Ustawienia zapisane'}), 200
    return jsonify({'message': 'Błąd zapisu ustawień'}), 400


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


def _device_sensor_dict(rack_id, unit, device):
    return {
        'temperature': device.temperature,
        'humidity': device.humidity,
        'updated_at': device.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
        'min_temperature': device.min_temperature,
        'max_temperature': device.max_temperature,
        'min_humidity': device.min_humidity,
        'max_humidity': device.max_humidity,
        'alarm_active_temperature': DeviceAlarmState.is_active(rack_id, unit, 'temperature'),
        'alarm_active_humidity': DeviceAlarmState.is_active(rack_id, unit, 'humidity'),
    }


def _raise_device_alert(rack_id, unit, metric, value, min_v, max_v):
    label = DEVICE_METRIC_LABELS[metric]
    unit_symbol = DEVICE_METRIC_UNITS[metric]
    desc = (f'Przekroczono próg {label} w szafie {rack_id} (unit {unit}): '
            f'{value}{unit_symbol} (próg {min_v}-{max_v}{unit_symbol})')
    Log.add_log(datetime.now(), f'Szafa {rack_id} — Unit {unit}', True, desc)
    DeviceAlarmState.trigger(rack_id, unit, metric)

    rule = NotificationRule.query.filter_by(event_type='device_threshold').first()
    if not rule:
        return
    from notifications import send_email, send_sms
    if rule.email_enabled and rule.email_group_id:
        emails = [r.email for r in EmailRecipient.query.filter_by(group_id=rule.email_group_id).all()]
        send_email(emails, f'Alarm: {desc}', desc)
    if rule.sms_enabled and rule.sms_group_id:
        numbers = [r.phone_number for r in SmsRecipient.query.filter_by(group_id=rule.sms_group_id).all()]
        send_sms(numbers, desc)


def _check_device_thresholds(rack_id, unit, device):
    checks = (
        ('temperature', device.temperature, device.min_temperature, device.max_temperature),
        ('humidity', device.humidity, device.min_humidity, device.max_humidity),
    )
    for metric, value, min_v, max_v in checks:
        if (value < min_v or value > max_v) and not DeviceAlarmState.is_active(rack_id, unit, metric):
            _raise_device_alert(rack_id, unit, metric, value, min_v, max_v)


@app.route('/device-sensors/<rack_id>/<int:unit>', methods=['GET'])
def get_device_sensors(rack_id, unit):
    device = DeviceSensor.get_or_create_reading(rack_id, unit)
    _check_device_thresholds(rack_id, unit, device)
    return jsonify(_device_sensor_dict(rack_id, unit, device)), 200


@app.route('/device-sensors/<rack_id>/<int:unit>/<metric>/simulate', methods=['POST'])
@jwt_required()
def simulate_device_alert(rack_id, unit, metric):
    if metric not in DEVICE_METRIC_LABELS:
        return jsonify({'message': 'Nieprawidłowy typ czujnika'}), 400
    device = DeviceSensor.get_or_create_reading(rack_id, unit)
    value = device.temperature if metric == 'temperature' else device.humidity
    min_v = device.min_temperature if metric == 'temperature' else device.min_humidity
    max_v = device.max_temperature if metric == 'temperature' else device.max_humidity
    _raise_device_alert(rack_id, unit, metric, value, min_v, max_v)
    return jsonify({'message': 'Alarm zasymulowany'}), 200


@app.route('/device-sensors/<rack_id>/<int:unit>/<metric>/clear', methods=['DELETE'])
@jwt_required()
def clear_device_alert(rack_id, unit, metric):
    if metric not in DEVICE_METRIC_LABELS:
        return jsonify({'message': 'Nieprawidłowy typ czujnika'}), 400
    if not DeviceAlarmState.clear(rack_id, unit, metric):
        return jsonify({'message': 'Stan alarmu nie znaleziony'}), 404
    current_user = get_jwt_identity()
    Log.add_log(datetime.now(), f'Szafa {rack_id} — Unit {unit}', False,
                f'Alarm ({DEVICE_METRIC_LABELS[metric]}) skasowany przez {current_user}')
    return jsonify({'message': 'Alarm skasowany'}), 200


@app.route('/device-sensors/<rack_id>/<int:unit>/thresholds', methods=['PUT'])
@jwt_required()
def update_device_sensor_thresholds(rack_id, unit):
    data = request.get_json()
    min_temperature = data.get('min_temperature')
    max_temperature = data.get('max_temperature')
    min_humidity = data.get('min_humidity')
    max_humidity = data.get('max_humidity')
    if min_temperature is None or max_temperature is None or min_humidity is None or max_humidity is None:
        return jsonify({'message': 'Brak danych'}), 400
    if min_temperature >= max_temperature or min_humidity >= max_humidity:
        return jsonify({'message': 'Wartość minimalna musi być mniejsza niż maksymalna'}), 400

    device = DeviceSensor.update_thresholds(rack_id, unit, min_temperature, max_temperature, min_humidity, max_humidity)
    if device is None:
        return jsonify({'message': 'Urządzenie nie znalezione'}), 404
    return jsonify(_device_sensor_dict(rack_id, unit, device)), 200


@app.route('/device-sensors/<rack_id>/<int:unit>/history', methods=['GET'])
def get_device_sensor_history(rack_id, unit):
    rows = (DeviceSensorHistory.query
            .filter_by(rack_id=rack_id, unit=unit)
            .order_by(DeviceSensorHistory.recorded_at.asc())
            .all())
    return jsonify({'history': [
        {
            'temperature': row.temperature,
            'humidity': row.humidity,
            'recorded_at': row.recorded_at.strftime('%Y-%m-%d %H:%M:%S'),
        }
        for row in rows
    ]}), 200


@app.route('/ping/<path:address>', methods=['GET'])
@jwt_required()
def ping_host(address):
    response = ping(address, count=4)
    messages = [str(r).split('\r')[0] for r in response]
    return jsonify({'messages': messages}), 200


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    init_sensor()
    app.run('0.0.0.0', 5000, debug=False)
