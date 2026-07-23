import os
from flask import Flask, Response, request, jsonify, send_from_directory
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from models import db, Users, PhoneNumbers, Settings, Logs, Layout, DeviceSensor, DeviceSensorHistory
from pythonping import ping
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from dotenv import load_dotenv

from camera import Camera
from ffmpg import convert_to_mp4
from sensors import Sensor

load_dotenv()

app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///monitoring.db')
app.config['JWT_SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-change-in-production')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
jwt = JWTManager(app)

VIDEOS_DIR = os.getenv('VIDEOS_DIR', 'videos')
os.makedirs(VIDEOS_DIR, exist_ok=True)

camera = Camera()
sensor = None


def init_sensor():
    global sensor
    with app.app_context():
        settings = Settings.get_all_settings()
        phone_numbers = PhoneNumbers.get_all_phone_numbers()
    sensor = Sensor(app, settings, phone_numbers, camera)


@app.route('/')
def hello_world():
    return 'Monitoring System API'


@app.route('/register', methods=['POST'])
@jwt_required()
def register():
    current_user = Users.get_user_by_username(get_jwt_identity())
    if not current_user or not current_user.isadmin:
        return jsonify({'message': 'Brak uprawnień'}), 403

    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    isadmin = data.get('isAdmin', False)
    if not username or not password:
        return jsonify({'message': 'Brak danych'}), 400
    if Users.get_user_by_username(username):
        return jsonify({'message': 'Użytkownik o takim loginie istnieje'}), 400
    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
    Users.add_user(username, hashed_password, isadmin)
    return jsonify({'message': 'Użytkownik utworzony'}), 200


@app.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    current_user = Users.get_user_by_username(get_jwt_identity())
    if not current_user or not current_user.isadmin:
        return jsonify({'message': 'Brak uprawnień'}), 403
    return jsonify([
        {'id': user.id, 'username': user.username, 'isadmin': user.isadmin}
        for user in Users.get_all_users()
    ]), 200


@app.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    current_user = Users.get_user_by_username(get_jwt_identity())
    if not current_user or not current_user.isadmin:
        return jsonify({'message': 'Brak uprawnień'}), 403
    if current_user.id == user_id:
        return jsonify({'message': 'Nie możesz usunąć własnego konta'}), 400
    if not db.session.get(Users, user_id):
        return jsonify({'message': 'Użytkownik nie znaleziony'}), 404
    Users.delete_user(user_id)
    return jsonify({'message': 'Użytkownik usunięty'}), 200


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    user = Users.get_user_by_username(username)
    if user is None or not check_password_hash(user.password, password):
        return jsonify({'message': 'Nieprawidłowe dane logowania'}), 401
    access_token = create_access_token(identity=username)
    return jsonify({'accessToken': access_token}), 200


@app.route('/userInfo', methods=['GET'])
@jwt_required()
def user_info():
    current_user = get_jwt_identity()
    is_admin = Users.get_user_by_username(current_user).isadmin
    return jsonify({'currentUser': current_user, 'isAdmin': is_admin}), 200


@app.route('/saveLayout', methods=['POST'])
@jwt_required()
def save_layout():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Brak danych'}), 400
    layout = Layout(data=data)
    db.session.add(layout)
    db.session.commit()
    return jsonify({'message': 'Layout zapisany', 'id': layout.id}), 201


@app.route('/getLayout/<int:layout_id>', methods=['GET'])
def get_layout(layout_id):
    layout = db.session.get(Layout, layout_id)
    if not layout:
        return jsonify({'error': 'Layout nie znaleziony'}), 404
    return jsonify(layout.data), 200


@app.route('/updateLayout/<int:layout_id>', methods=['PUT'])
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


@app.route('/captureVideo')
def capture_video():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/startRecording', methods=['POST'])
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


@app.route('/stopRecording', methods=['POST'])
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


@app.route('/addPhoneNumber', methods=['POST'])
@jwt_required()
def add_phone_number():
    data = request.get_json()
    phone_number = data.get('phone_number')
    if not phone_number:
        return jsonify({'message': 'Numer telefonu wymagany'}), 400
    PhoneNumbers.add_phone_number(phone_number)
    return jsonify({'message': 'Numer telefonu dodany'}), 200


@app.route('/deletePhoneNumber', methods=['POST'])
@jwt_required()
def delete_phone_number():
    data = request.get_json()
    phone_number = data.get('phone_number')
    if not phone_number:
        return jsonify({'message': 'Numer telefonu wymagany'}), 400
    PhoneNumbers.delete_phone_number(phone_number)
    return jsonify({'message': 'Numer telefonu usunięty'}), 200


@app.route('/saveSettings', methods=['POST'])
@jwt_required()
def save_settings():
    data = request.get_json()
    ok = Settings.update_settings(
        data.get('id'),
        data.get('min_temperature'),
        data.get('max_temperature'),
        data.get('min_humidity'),
        data.get('max_humidity'),
        data.get('recording_seconds'),
        data.get('evening_test_time'),
        data.get('morning_test_time'),
    )
    if ok:
        sensor.update_settings(Settings.get_all_settings())
        return jsonify({'message': 'Ustawienia zapisane'}), 200
    return jsonify({'message': 'Błąd zapisu ustawień'}), 400


@app.route('/settingsAndPhoneNumbers', methods=['GET'])
def get_settings():
    return jsonify({
        'phone_numbers': PhoneNumbers.get_all_phone_numbers(),
        'settings': Settings.get_all_settings(),
    }), 200


@app.route('/phoneNumbers', methods=['GET'])
@jwt_required()
def get_phone_numbers():
    return jsonify({'phone_numbers': PhoneNumbers.get_all_phone_numbers()}), 200


@app.route('/settings', methods=['GET'])
def get_settings_only():
    return jsonify({'settings': Settings.get_all_settings()}), 200


@app.route('/logs', methods=['GET'])
@jwt_required()
def get_logs():
    return jsonify({'logs': Logs.get_all_logs()}), 200


@app.route('/deleteLogs', methods=['POST'])
@jwt_required()
def delete_logs():
    Logs.remove_all_logs()
    return jsonify({'message': 'Logi usunięte'}), 200


@app.route('/realTimeData', methods=['GET'])
def get_real_time_data():
    return jsonify(sensor.get_current_data()), 200


@app.route('/deviceSensors/<rack_id>/<int:unit>', methods=['GET'])
def get_device_sensors(rack_id, unit):
    device = DeviceSensor.get_or_create_reading(rack_id, unit)
    return jsonify({
        'temperature': device.temperature,
        'humidity': device.humidity,
        'updated_at': device.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
    }), 200


@app.route('/deviceSensors/<rack_id>/<int:unit>/history', methods=['GET'])
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
