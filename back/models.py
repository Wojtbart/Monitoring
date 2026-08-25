from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), unique=False, nullable=False)
    is_admin = db.Column(db.Boolean, unique=False, nullable=False)

    @staticmethod
    def add_user(username, password, is_admin):
        new_user = User(username=username, password=password, is_admin=is_admin)
        db.session.add(new_user)
        db.session.commit()

    @staticmethod
    def get_all_users():
        return User.query.all()

    @staticmethod
    def get_user_by_username(username):
        return User.query.filter_by(username=username).first()

    @staticmethod
    def delete_user(user_id):
        user = db.session.get(User, user_id)
        if user:
            db.session.delete(user)
            db.session.commit()
            return True
        return False


# tabela w której będziemy zapisywać layouty
class Layout(db.Model):
    __tablename__ = 'layouts'
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.JSON, nullable=False)  # JSONB w postgresie


class Setting(db.Model):
    __tablename__ = 'settings'
    id = db.Column(db.Integer, primary_key=True)
    recording_seconds = db.Column(db.Integer, nullable=False)
    evening_test_time = db.Column(db.Time, nullable=False)
    morning_test_time = db.Column(db.Time, nullable=False)

    @staticmethod
    def get_all_settings():
        settings_list = Setting.query.all()
        return [
            {
                'id': setting.id,
                'recording_seconds': setting.recording_seconds,
                'evening_test_time': setting.evening_test_time.strftime('%H:%M:%S'),
                'morning_test_time': setting.morning_test_time.strftime('%H:%M:%S')
            }
            for setting in settings_list
        ]

    @staticmethod
    def update_settings(id, recording_seconds, evening_test_time, morning_test_time):
        from datetime import datetime

        settings = db.session.get(Setting, id)
        if settings:
            settings.recording_seconds = recording_seconds
            settings.evening_test_time = datetime.strptime(evening_test_time, '%H:%M:%S').time()
            settings.morning_test_time = datetime.strptime(morning_test_time, '%H:%M:%S').time()
            db.session.commit()
            return True
        return False


class Log(db.Model):
    __tablename__ = 'logs'
    id = db.Column(db.Integer, primary_key=True)
    log_date = db.Column(db.DateTime, nullable=False)
    sensor_name = db.Column(db.String(255), nullable=False)
    is_warning = db.Column(db.Boolean, nullable=False)
    log_description = db.Column(db.String(255), nullable=False)

    @staticmethod
    def add_log(log_date, sensor_name, is_warning, log_description):
        new_log = Log(log_date=log_date, sensor_name=sensor_name, is_warning=is_warning, log_description=log_description)
        db.session.add(new_log)
        db.session.commit()

    @staticmethod
    def get_all_logs():
        logs = Log.query.all()
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
        logs = Log.query.all()
        for log in logs:
            db.session.delete(log)
        db.session.commit()

    @staticmethod
    def remove_logs(ids):
        Log.query.filter(Log.id.in_(ids)).delete(synchronize_session=False)
        db.session.commit()


class DeviceSensor(db.Model):
    __tablename__ = 'device_sensors'
    id = db.Column(db.Integer, primary_key=True)
    rack_id = db.Column(db.String(20), nullable=False)
    unit = db.Column(db.Integer, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    updated_at = db.Column(db.DateTime, nullable=False)
    min_temperature = db.Column(db.Float, nullable=False, default=15.0)
    max_temperature = db.Column(db.Float, nullable=False, default=35.0)
    min_humidity = db.Column(db.Float, nullable=False, default=20.0)
    max_humidity = db.Column(db.Float, nullable=False, default=80.0)

    __table_args__ = (
        db.UniqueConstraint('rack_id', 'unit', name='uq_device_sensor_rack_unit'),
    )

    @staticmethod
    def get_or_create_reading(rack_id, unit):
        import random
        from datetime import datetime

        device = DeviceSensor.query.filter_by(rack_id=rack_id, unit=unit).first()
        if device is None:
            device = DeviceSensor(
                rack_id=rack_id,
                unit=unit,
                temperature=round(random.uniform(20.0, 32.0), 1),
                humidity=round(random.uniform(35.0, 75.0), 1),
                updated_at=datetime.now(),
                min_temperature=15.0,
                max_temperature=35.0,
                min_humidity=20.0,
                max_humidity=80.0,
            )
            db.session.add(device)
        else:
            new_temp = device.temperature + random.uniform(-1.5, 1.5)
            new_humidity = device.humidity + random.uniform(-3.0, 3.0)
            device.temperature = round(min(45.0, max(10.0, new_temp)), 1)
            device.humidity = round(min(95.0, max(10.0, new_humidity)), 1)
            device.updated_at = datetime.now()
        db.session.commit()

        db.session.add(DeviceSensorHistory(
            rack_id=rack_id,
            unit=unit,
            temperature=device.temperature,
            humidity=device.humidity,
            recorded_at=device.updated_at,
        ))
        db.session.commit()

        excess = (DeviceSensorHistory.query
                  .filter_by(rack_id=rack_id, unit=unit)
                  .order_by(DeviceSensorHistory.recorded_at.desc())
                  .offset(50)
                  .all())
        if excess:
            for row in excess:
                db.session.delete(row)
            db.session.commit()

        return device

    @staticmethod
    def update_thresholds(rack_id, unit, min_temperature, max_temperature, min_humidity, max_humidity):
        device = DeviceSensor.query.filter_by(rack_id=rack_id, unit=unit).first()
        if device is None:
            return None
        device.min_temperature = min_temperature
        device.max_temperature = max_temperature
        device.min_humidity = min_humidity
        device.max_humidity = max_humidity
        db.session.commit()
        return device


class DeviceSensorHistory(db.Model):
    __tablename__ = 'device_sensor_history'
    id = db.Column(db.Integer, primary_key=True)
    rack_id = db.Column(db.String(20), nullable=False)
    unit = db.Column(db.Integer, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    recorded_at = db.Column(db.DateTime, nullable=False)


class EmailGroup(db.Model):
    __tablename__ = 'email_groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)

    @staticmethod
    def get_all_with_recipients():
        groups = EmailGroup.query.all()
        return [
            {
                'id': g.id,
                'name': g.name,
                'recipients': [
                    {'id': r.id, 'email': r.email}
                    for r in EmailRecipient.query.filter_by(group_id=g.id).all()
                ],
            }
            for g in groups
        ]

    @staticmethod
    def add_group(name):
        if EmailGroup.query.filter_by(name=name).first():
            return None
        group = EmailGroup(name=name)
        db.session.add(group)
        db.session.commit()
        return group

    @staticmethod
    def delete_group(group_id):
        group = db.session.get(EmailGroup, group_id)
        if not group:
            return False
        EmailRecipient.query.filter_by(group_id=group_id).delete()
        db.session.delete(group)
        db.session.commit()
        return True

    @staticmethod
    def add_recipient(group_id, email):
        if not db.session.get(EmailGroup, group_id):
            return None
        recipient = EmailRecipient(group_id=group_id, email=email)
        db.session.add(recipient)
        db.session.commit()
        return recipient

    @staticmethod
    def delete_recipient(recipient_id):
        recipient = db.session.get(EmailRecipient, recipient_id)
        if not recipient:
            return False
        db.session.delete(recipient)
        db.session.commit()
        return True


class EmailRecipient(db.Model):
    __tablename__ = 'email_recipients'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('email_groups.id'), nullable=False)
    email = db.Column(db.String(255), nullable=False)


class SmsGroup(db.Model):
    __tablename__ = 'sms_groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)

    @staticmethod
    def get_all_with_recipients():
        groups = SmsGroup.query.all()
        return [
            {
                'id': g.id,
                'name': g.name,
                'recipients': [
                    {'id': r.id, 'phone_number': r.phone_number}
                    for r in SmsRecipient.query.filter_by(group_id=g.id).all()
                ],
            }
            for g in groups
        ]

    @staticmethod
    def add_group(name):
        if SmsGroup.query.filter_by(name=name).first():
            return None
        group = SmsGroup(name=name)
        db.session.add(group)
        db.session.commit()
        return group

    @staticmethod
    def delete_group(group_id):
        group = db.session.get(SmsGroup, group_id)
        if not group:
            return False
        SmsRecipient.query.filter_by(group_id=group_id).delete()
        db.session.delete(group)
        db.session.commit()
        return True

    @staticmethod
    def add_recipient(group_id, phone_number):
        if not db.session.get(SmsGroup, group_id):
            return None
        recipient = SmsRecipient(group_id=group_id, phone_number=phone_number)
        db.session.add(recipient)
        db.session.commit()
        return recipient

    @staticmethod
    def delete_recipient(recipient_id):
        recipient = db.session.get(SmsRecipient, recipient_id)
        if not recipient:
            return False
        db.session.delete(recipient)
        db.session.commit()
        return True


class SmsRecipient(db.Model):
    __tablename__ = 'sms_recipients'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('sms_groups.id'), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)


NOTIFICATION_EVENT_TYPES = ('fire', 'gas', 'water', 'door', 'device_threshold')


class NotificationRule(db.Model):
    __tablename__ = 'notification_rules'
    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(20), unique=True, nullable=False)
    email_enabled = db.Column(db.Boolean, nullable=False, default=False)
    email_group_id = db.Column(db.Integer, db.ForeignKey('email_groups.id'), nullable=True)
    sms_enabled = db.Column(db.Boolean, nullable=False, default=False)
    sms_group_id = db.Column(db.Integer, db.ForeignKey('sms_groups.id'), nullable=True)

    @staticmethod
    def seed_defaults():
        for event_type in NOTIFICATION_EVENT_TYPES:
            if not NotificationRule.query.filter_by(event_type=event_type).first():
                db.session.add(NotificationRule(event_type=event_type))
        db.session.commit()

    @staticmethod
    def get_all():
        return [
            {
                'event_type': r.event_type,
                'email_enabled': r.email_enabled,
                'email_group_id': r.email_group_id,
                'sms_enabled': r.sms_enabled,
                'sms_group_id': r.sms_group_id,
            }
            for r in NotificationRule.query.all()
        ]

    @staticmethod
    def update_all(rules):
        for rule_data in rules:
            rule = NotificationRule.query.filter_by(event_type=rule_data['event_type']).first()
            if not rule:
                continue
            rule.email_enabled = rule_data['email_enabled']
            rule.email_group_id = rule_data.get('email_group_id')
            rule.sms_enabled = rule_data['sms_enabled']
            rule.sms_group_id = rule_data.get('sms_group_id')
        db.session.commit()


ALARM_EVENT_TYPES = ('fire', 'gas', 'water', 'door')


class AlarmState(db.Model):
    __tablename__ = 'alarm_states'
    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(20), unique=True, nullable=False)
    active = db.Column(db.Boolean, nullable=False, default=False)
    last_triggered_at = db.Column(db.DateTime, nullable=True)
    cleared_at = db.Column(db.DateTime, nullable=True)

    @staticmethod
    def seed_defaults():
        for event_type in ALARM_EVENT_TYPES:
            if not AlarmState.query.filter_by(event_type=event_type).first():
                db.session.add(AlarmState(event_type=event_type))
        db.session.commit()

    @staticmethod
    def get_all():
        return [
            {
                'event_type': s.event_type,
                'active': s.active,
                'last_triggered_at': s.last_triggered_at.strftime('%Y-%m-%d %H:%M:%S') if s.last_triggered_at else None,
                'cleared_at': s.cleared_at.strftime('%Y-%m-%d %H:%M:%S') if s.cleared_at else None,
            }
            for s in AlarmState.query.all()
        ]

    @staticmethod
    def trigger(event_type):
        from datetime import datetime
        state = AlarmState.query.filter_by(event_type=event_type).first()
        if not state:
            return
        state.active = True
        state.last_triggered_at = datetime.now()
        db.session.commit()

    @staticmethod
    def clear(event_type):
        from datetime import datetime
        state = AlarmState.query.filter_by(event_type=event_type).first()
        if not state:
            return False
        state.active = False
        state.cleared_at = datetime.now()
        db.session.commit()
        return True


class DeviceAlarmState(db.Model):
    __tablename__ = 'device_alarm_states'
    id = db.Column(db.Integer, primary_key=True)
    rack_id = db.Column(db.String(20), nullable=False)
    unit = db.Column(db.Integer, nullable=False)
    metric = db.Column(db.String(20), nullable=False)
    active = db.Column(db.Boolean, nullable=False, default=False)
    last_triggered_at = db.Column(db.DateTime, nullable=True)
    cleared_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.UniqueConstraint('rack_id', 'unit', 'metric', name='uq_device_alarm_rack_unit_metric'),
    )

    @staticmethod
    def is_active(rack_id, unit, metric):
        state = DeviceAlarmState.query.filter_by(rack_id=rack_id, unit=unit, metric=metric).first()
        return bool(state and state.active)

    @staticmethod
    def trigger(rack_id, unit, metric):
        from datetime import datetime
        state = DeviceAlarmState.query.filter_by(rack_id=rack_id, unit=unit, metric=metric).first()
        if not state:
            state = DeviceAlarmState(rack_id=rack_id, unit=unit, metric=metric)
            db.session.add(state)
        state.active = True
        state.last_triggered_at = datetime.now()
        db.session.commit()

    @staticmethod
    def clear(rack_id, unit, metric):
        state = DeviceAlarmState.query.filter_by(rack_id=rack_id, unit=unit, metric=metric).first()
        if not state:
            return False
        from datetime import datetime
        state.active = False
        state.cleared_at = datetime.now()
        db.session.commit()
        return True
