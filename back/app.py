from flask import Flask, Response ,request, jsonify,send_from_directory
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
import os
# from camera import Camera
from models import db, Users, PhoneNumbers, Settings, Logs, Layout
from pythonping import ping
from werkzeug.security import generate_password_hash, check_password_hash
#from picamera2 import Picamera2
import cv2
from datetime import datetime
#from picamera2.encoders import H264Encoder
from ffmpg import convert_to_mp4

from sensors import Sensor

app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] =   'postgresql://postgres:postgres@localhost/postgres_db' #'postgresql://neondb_owner:n2Udrik0Kmjw@ep-falling-tooth-a5hv9ol0.us-east-2.aws.neon.tech/neondb?sslmode=require'
app.config["JWT_SECRET_KEY"] = '5ff6666a14ce8b7c9872454853362a9c9cb081f8d2727059cb0b69fb24ed27af'
db.init_app(app)
jwt = JWTManager(app)

counter = 0


@app.route('/')
def hello_world():
    return 'Hello, World!'

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    isadmin = data.get('isAdmin')
    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
    print(username + ' ' + password+ ' ' + hashed_password)
    user = Users.get_user_by_username(username)
    if user is None:
        Users.add_user(username, hashed_password, isadmin)
        return jsonify({'message':'User created successfully'}), 200
    else:
        print('User already exists')
        return jsonify({'message': 'Użytkownik o takin loginie istniej'}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    print(username + ' ' + password)
    user = Users.get_user_by_username(username)
    print(user)
    print(str(user.id) + " " + user.username + " " + user.password)
    if user is not None :#and  check_password_hash(user.password, password):
        accessToken = create_access_token(identity=username)
        # print(accessToken)
        return jsonify({'accessToken':accessToken}), 200
    else:
        print('Invalid credentials')
        return jsonify({'message':'Invalid credentials'}), 401
    
@app.route('/userInfo', methods=['GET'])
@jwt_required()
def user_info():
    current_user = get_jwt_identity()
    print(current_user)
    is_admin = Users.get_user_by_username(current_user).isadmin
    return jsonify({'currentUser':current_user, 'isAdmin':is_admin}), 200
    
@app.route('/saveLayout', methods=['POST'])
def save_layout():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data"}), 400

    layout = Layout(data=data)
    db.session.add(layout)
    db.session.commit()

    return jsonify({"message": "Layout saved", "id": layout.id}), 201

@app.route('/getLayout/<int:layout_id>', methods=['GET'])
def get_layout(layout_id):
    layout = Layout.query.get(layout_id)
    if not layout:
        return jsonify({"error": "Layout not found"}), 404

    return jsonify(layout.data), 200
    
camera = None
#camera.configure(camera.create_video_configuration(main={"format": 'XRGB8888',"size": (640, 480)})) #'XRGB8888'
#camera.start()
def generate_frames():
    # camera.start()
    # camera = Picamera2()
    while True:
        frame = None #camera.capture_array()
        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/captureVideo')
def capture_video():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/startRecording', methods=['POST'])
def start_recording():
    if sensor.is_recording:
        return jsonify({'message': 'Kamera już nagrywa'}), 403
    encoder = None #H264Encoder(bitrate=10000000)
    videoName = 'Video_' + datetime.now().strftime('Date_%Y_%m_%d_Time_%H_%M_%S')
    #camera.start_recording(encoder,'videos/'+videoName+'.h264')
    sensor.is_user_recording = True
    return jsonify({'message': 'Recording started', 'videoName': videoName}), 200

@app.route('/stopRecording', methods=['POST'])
def stop_recording():
    data = request.get_json()
    video_name = data.get('videoName')
    #camera.stop_recording()
    #camera.start()
    sensor.is_user_recording = False
    convert_to_mp4('videos/'+str(video_name)+'.h264', 'videos/'+str(video_name)+'.mp4')
    return jsonify({'message': 'Recording stopped'}), 200

@app.route('/videos', methods=['GET'])
# @jwt_required()
def getVideos():
    videos = [f for f in os.listdir('videos') if f.endswith(('.mp4', '.avi', '.mov'))]
    url_videos = [{'name': video, 'url': f'http://192.168.0.150:5000/videos/{video}'} for video in videos]
    return jsonify(url_videos), 200

@app.route('/videos/<video_name>', methods=['GET'])
# @jwt_required()
def get_video(video_name):
    return send_from_directory('videos', video_name,mimetype='video/mp4')

@app.route('/addPhoneNumber', methods=['POST'])
# @jwt_required()
def add_phone_number():
    data = request.get_json()
    phone_number = data.get('phone_number')
    if phone_number is None:
        return jsonify({'message': 'Phone number is required'}), 400
    PhoneNumbers.add_phone_number(phone_number)
    return jsonify({'message': 'Phone number added successfully'}), 200

@app.route('/deletePhoneNumber', methods=['POST'])
# @jwt_required()
def delete_phone_number():
    data = request.get_json()
    phone_number = data.get('phone_number')
    if phone_number is None:
        return jsonify({'message': 'Phone number is required'}), 400
    PhoneNumbers.delete_phone_number(phone_number)
    return jsonify({'message': 'Phone number deleted successfully'}), 200

@app.route('/saveSettings', methods=['POST'])
# @jwt_required()
def save_settings():
    data = request.get_json()
    id = data.get('id')
    min_temperature = data.get('min_temperature')
    max_temperature = data.get('max_temperature')
    min_humidity = data.get('min_humidity')
    max_humidity = data.get('max_humidity')
    recording_seconds = data.get('recording_seconds')
    evening_test_time = data.get('evening_test_time')
    morning_test_time = data.get('morning_test_time')
    if(Settings.update_settings(id, min_temperature, max_temperature, min_humidity, max_humidity, recording_seconds, evening_test_time, morning_test_time)):
        sensor.update_settings(Settings.get_all_settings())
        return jsonify({'message': 'Settings updated successfully'}), 200
    return jsonify({'message': 'Something went wrong'}), 400

@app.route('/settingsAndPhoneNumbers', methods=['GET'])
# @jwt_required()
def get_settings():
    phone_numbers = PhoneNumbers.get_all_phone_numbers()
    # phone_numbers = [phone_number.phone_number for phone_number in phone_numbers]
    settings = Settings.get_all_settings()
    return jsonify({'phone_numbers': phone_numbers, 'settings': settings}), 200

@app.route('/phoneNumbers', methods=['GET'])
@jwt_required()
def get_get_phone_numbers():
    phone_numbers = PhoneNumbers.get_all_phone_numbers()
    return jsonify({'phone_numbers': phone_numbers}), 200

@app.route('/settings', methods=['GET'])
# @jwt_required()
def get_settings_only():
    settings = Settings.get_all_settings()
    return jsonify({'settings': settings}), 200

@app.route('/logs', methods=['GET'])
@jwt_required()
def get_logs():
    logs = Logs.get_all_logs()
    print(logs)
    return jsonify({'logs': logs}), 200

@app.route('/deleteLogs', methods=['POST'])
@jwt_required()
def delete_logs():
    Logs.remove_all_logs()
    return jsonify({'message': 'Logs deleted successfully'}), 200

@app.route('/realTimeData', methods=['GET'])
# @jwt_required()
def get_real_time_data():
    data =sensor.get_current_data()
    return jsonify(data), 200

@app.route('/ping/<adress>', methods=['GET'])
# @jwt_required()
def ping_host(adress):
    response = ping(adress, count=1)
    message = str(response).split("\r")[0]
    return jsonify({'message': message}), 200 

if __name__ == '__main__':
    with app.app_context():
        sensor = Sensor(app,Settings.get_all_settings(), PhoneNumbers.get_all_phone_numbers(), camera)
    app.run('0.0.0.0', 5000, debug=False)