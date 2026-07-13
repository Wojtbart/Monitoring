from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy() 
class Users(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), unique=False, nullable=False)
    isadmin = db.Column(db.Boolean, unique=False, nullable=False)

    @staticmethod
    def add_user(username, password, isadmin):
        new_user = Users(username=username, password=password, isadmin=isadmin)
        db.session.add(new_user)
        db.session.commit()

    @staticmethod
    def get_all_users():
        return Users.query.all()

    @staticmethod
    def get_user_by_username(username):
        return Users.query.filter_by(username=username).first()
        
# tabela w której będziemy zapisywać layouty
class Layout(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.JSON, nullable=False)  # JSONB w postgresie


class PhoneNumbers(db.Model):
    __tablename__ = 'phonenumbers'
    phone_number = db.Column(db.String(80), unique=True, nullable=False, primary_key=True)

    @staticmethod
    def add_phone_number(phone_number):
        new_phone_number = PhoneNumbers(phone_number=phone_number)
        db.session.add(new_phone_number)
        db.session.commit()

    @staticmethod
    def get_all_phone_numbers():
        phone_numbers = PhoneNumbers.query.all()
        phone_numbers = [phone_number.phone_number for phone_number in phone_numbers]
        return phone_numbers
    
    @staticmethod
    def delete_phone_number(phone_number):
        phone_number = db.session.get(PhoneNumbers, phone_number)
        if phone_number:
            db.session.delete(phone_number)
            db.session.commit()
            return True
        return False




class Settings(db.Model):
    __tablename__ = 'settings'
    id = db.Column(db.Integer, primary_key=True)
    min_temperature = db.Column(db.Numeric(5, 2), nullable=False)
    max_temperature = db.Column(db.Numeric(5, 2), nullable=False)
    min_humidity = db.Column(db.Numeric(5, 2), nullable=False)
    max_humidity = db.Column(db.Numeric(5, 2), nullable=False)
    recording_seconds = db.Column(db.Integer, nullable=False)
    evening_test_time = db.Column(db.Time, nullable=False)
    morning_test_time = db.Column(db.Time, nullable=False)


    @staticmethod
    def get_all_settings():
        settings_list = Settings.query.all()
        return [
            {
                'id': setting.id,
                'min_temperature': setting.min_temperature,
                'max_temperature': setting.max_temperature,
                'min_humidity': setting.min_humidity,
                'max_humidity': setting.max_humidity,
                'recording_seconds': setting.recording_seconds,
                'evening_test_time': setting.evening_test_time.strftime('%H:%M:%S'),
                'morning_test_time': setting.morning_test_time.strftime('%H:%M:%S')
            }
            for setting in settings_list
        ]
    
    @staticmethod
    def update_settings(id, min_temperature, max_temperature, min_humidity, max_humidity, recording_seconds, evening_test_time, morning_test_time):
        settings = db.session.get(Settings, id)
        if settings:
            settings.min_temperature = min_temperature
            settings.max_temperature = max_temperature
            settings.min_humidity = min_humidity
            settings.max_humidity = max_humidity
            settings.recording_seconds = recording_seconds
            settings.evening_test_time = evening_test_time
            settings.morning_test_time = morning_test_time
            db.session.commit()
            return True
        return False




class Logs(db.Model):
    __tablename__ = 'logs'
    id = db.Column(db.Integer, primary_key=True)
    log_date = db.Column(db.DateTime, nullable=False)
    sensor_name = db.Column(db.String(255), nullable=False)
    is_warning = db.Column(db.Boolean, nullable=False)
    log_description = db.Column(db.String(255), nullable=False)

    @staticmethod
    def add_log(log_date, sensor_name, is_warning, log_description):
        new_log = Logs(log_date=log_date, sensor_name=sensor_name, is_warning=is_warning, log_description=log_description)
        db.session.add(new_log)
        db.session.commit()

    @staticmethod
    def get_all_logs():
        logs = Logs.query.all()
        return [
            {
                'id': log.id,
                'log_date': log.log_date.strftime('%Y-%m-%d %H:%M:%S'),
                'sensor_name': log.sensor_name,
                'is_warning': log.is_warning,
                'log_description': log.log_description
            }
            for log in logs
        ]
    
    @staticmethod
    def remove_all_logs():
        logs = Logs.query.all()
        for log in logs:
            db.session.delete(log)
        db.session.commit()
        