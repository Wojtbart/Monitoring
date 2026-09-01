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
    auto_save_layout = db.Column(db.Boolean, nullable=False, default=False)

    @staticmethod
    def get_all_settings():
        settings_list = Setting.query.all()
        return [
            {
                'id': setting.id,
                'recording_seconds': setting.recording_seconds,
                'auto_save_layout': setting.auto_save_layout,
            }
            for setting in settings_list
        ]

    @staticmethod
    def update_settings(id, recording_seconds, auto_save_layout=None):
        settings = db.session.get(Setting, id)
        if settings:
            settings.recording_seconds = recording_seconds
            if auto_save_layout is not None:
                settings.auto_save_layout = auto_save_layout
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
    """Jeden czujnik temperatury/wilgotności na całą szafę (nie per-slot/unit —
    fizycznie w szafie jest jeden czujnik środowiskowy, nie jeden na urządzenie)."""
    __tablename__ = 'device_sensors'
    id = db.Column(db.Integer, primary_key=True)
    rack_id = db.Column(db.String(20), nullable=False, unique=True)
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    updated_at = db.Column(db.DateTime, nullable=False)
    min_temperature = db.Column(db.Float, nullable=False, default=15.0)
    max_temperature = db.Column(db.Float, nullable=False, default=35.0)
    min_humidity = db.Column(db.Float, nullable=False, default=20.0)
    max_humidity = db.Column(db.Float, nullable=False, default=80.0)
    min_temperature_critical = db.Column(db.Float, nullable=False, default=5.0)
    max_temperature_critical = db.Column(db.Float, nullable=False, default=45.0)
    min_humidity_critical = db.Column(db.Float, nullable=False, default=10.0)
    max_humidity_critical = db.Column(db.Float, nullable=False, default=90.0)
    alert_delay_seconds = db.Column(db.Integer, nullable=False, default=0)
    lowest_temperature = db.Column(db.Float, nullable=True)
    lowest_temperature_at = db.Column(db.DateTime, nullable=True)
    highest_temperature = db.Column(db.Float, nullable=True)
    highest_temperature_at = db.Column(db.DateTime, nullable=True)
    lowest_humidity = db.Column(db.Float, nullable=True)
    lowest_humidity_at = db.Column(db.DateTime, nullable=True)
    highest_humidity = db.Column(db.Float, nullable=True)
    highest_humidity_at = db.Column(db.DateTime, nullable=True)

    HISTORY_RETENTION_DAYS = 35

    @staticmethod
    def _update_extremes(device):
        now = device.updated_at
        if device.lowest_temperature is None or device.temperature < device.lowest_temperature:
            device.lowest_temperature = device.temperature
            device.lowest_temperature_at = now
        if device.highest_temperature is None or device.temperature > device.highest_temperature:
            device.highest_temperature = device.temperature
            device.highest_temperature_at = now
        if device.lowest_humidity is None or device.humidity < device.lowest_humidity:
            device.lowest_humidity = device.humidity
            device.lowest_humidity_at = now
        if device.highest_humidity is None or device.humidity > device.highest_humidity:
            device.highest_humidity = device.humidity
            device.highest_humidity_at = now

    @staticmethod
    def get_existing(rack_id):
        return DeviceSensor.query.filter_by(rack_id=rack_id).first()

    @staticmethod
    def get_or_create_reading(rack_id):
        import random
        from datetime import datetime, timedelta

        device = DeviceSensor.query.filter_by(rack_id=rack_id).first()
        if device is None:
            device = DeviceSensor(
                rack_id=rack_id,
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
        DeviceSensor._update_extremes(device)
        db.session.commit()

        db.session.add(DeviceSensorHistory(
            rack_id=rack_id,
            temperature=device.temperature,
            humidity=device.humidity,
            recorded_at=device.updated_at,
        ))
        db.session.commit()

        cutoff = datetime.now() - timedelta(days=DeviceSensor.HISTORY_RETENTION_DAYS)
        (DeviceSensorHistory.query
         .filter_by(rack_id=rack_id)
         .filter(DeviceSensorHistory.recorded_at < cutoff)
         .delete())
        db.session.commit()

        return device

    @staticmethod
    def clear_records(rack_id):
        device = DeviceSensor.query.filter_by(rack_id=rack_id).first()
        if not device:
            return None
        device.lowest_temperature = device.temperature
        device.lowest_temperature_at = device.updated_at
        device.highest_temperature = device.temperature
        device.highest_temperature_at = device.updated_at
        device.lowest_humidity = device.humidity
        device.lowest_humidity_at = device.updated_at
        device.highest_humidity = device.humidity
        device.highest_humidity_at = device.updated_at
        db.session.commit()
        return device

    @staticmethod
    def clear_history(rack_id):
        DeviceSensorHistory.query.filter_by(rack_id=rack_id).delete()
        db.session.commit()

    @staticmethod
    def update_thresholds(rack_id, min_temperature, max_temperature, min_humidity, max_humidity,
                           min_temperature_critical, max_temperature_critical,
                           min_humidity_critical, max_humidity_critical, alert_delay_seconds):
        device = DeviceSensor.query.filter_by(rack_id=rack_id).first()
        if device is None:
            return None
        device.min_temperature = min_temperature
        device.max_temperature = max_temperature
        device.min_humidity = min_humidity
        device.max_humidity = max_humidity
        device.min_temperature_critical = min_temperature_critical
        device.max_temperature_critical = max_temperature_critical
        device.min_humidity_critical = min_humidity_critical
        device.max_humidity_critical = max_humidity_critical
        device.alert_delay_seconds = alert_delay_seconds
        db.session.commit()
        return device


class DeviceSensorHistory(db.Model):
    __tablename__ = 'device_sensor_history'
    id = db.Column(db.Integer, primary_key=True)
    rack_id = db.Column(db.String(20), nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    recorded_at = db.Column(db.DateTime, nullable=False)


DEFAULT_SCHEDULE = '1' * 168  # 7 dni x 24h, zawsze aktywny


def is_within_schedule(schedule, when):
    if not schedule:
        return True
    index = when.weekday() * 24 + when.hour
    return index < len(schedule) and schedule[index] == '1'


class NotificationGroup(db.Model):
    """Jedna grupa odbiorców powiadomień, wspólna dla e-maila i SMS-a — każdy
    członek (NotificationRecipient) ma opcjonalnie adres e-mail i/lub numer
    telefonu (może mieć oba, albo tylko jedno). Zastępuje dawne osobne
    EmailGroup/SmsGroup, żeby nie trzeba było utrzymywać dwóch równoległych
    list odbiorców dla tych samych osób."""
    __tablename__ = 'notification_groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    schedule = db.Column(db.String(168), nullable=False, default=DEFAULT_SCHEDULE)

    @staticmethod
    def get_all_with_recipients():
        groups = NotificationGroup.query.all()
        return [
            {
                'id': g.id,
                'name': g.name,
                'schedule': g.schedule,
                'recipients': [
                    {'id': r.id, 'email': r.email, 'phone_number': r.phone_number}
                    for r in NotificationRecipient.query.filter_by(group_id=g.id).all()
                ],
            }
            for g in groups
        ]

    @staticmethod
    def update_schedule(group_id, schedule):
        group = db.session.get(NotificationGroup, group_id)
        if not group:
            return None
        group.schedule = schedule
        db.session.commit()
        return group

    @staticmethod
    def add_group(name):
        if NotificationGroup.query.filter_by(name=name).first():
            return None
        group = NotificationGroup(name=name)
        db.session.add(group)
        db.session.commit()
        return group

    @staticmethod
    def delete_group(group_id):
        group = db.session.get(NotificationGroup, group_id)
        if not group:
            return False
        NotificationRecipient.query.filter_by(group_id=group_id).delete()
        db.session.delete(group)
        db.session.commit()
        return True

    @staticmethod
    def add_recipient(group_id, email=None, phone_number=None):
        if not db.session.get(NotificationGroup, group_id):
            return None
        recipient = NotificationRecipient(group_id=group_id, email=email, phone_number=phone_number)
        db.session.add(recipient)
        db.session.commit()
        return recipient

    @staticmethod
    def delete_recipient(recipient_id):
        recipient = db.session.get(NotificationRecipient, recipient_id)
        if not recipient:
            return False
        db.session.delete(recipient)
        db.session.commit()
        return True


class NotificationRecipient(db.Model):
    __tablename__ = 'notification_recipients'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('notification_groups.id'), nullable=False)
    email = db.Column(db.String(255), nullable=True)
    phone_number = db.Column(db.String(20), nullable=True)


NOTIFICATION_EVENT_TYPES = ('fire', 'gas', 'water', 'door', 'device_threshold', 'voltage')


class NotificationRule(db.Model):
    __tablename__ = 'notification_rules'
    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(20), unique=True, nullable=False)
    email_enabled = db.Column(db.Boolean, nullable=False, default=False)
    sms_enabled = db.Column(db.Boolean, nullable=False, default=False)
    group_id = db.Column(db.Integer, db.ForeignKey('notification_groups.id'), nullable=True)
    notify_again_minutes = db.Column(db.Integer, nullable=False, default=30)
    sms_custom_enabled = db.Column(db.Boolean, nullable=False, default=False)
    sms_custom_message = db.Column(db.String(255), nullable=True)
    notify_on_return_enabled = db.Column(db.Boolean, nullable=False, default=False)
    email_custom_subject_enabled = db.Column(db.Boolean, nullable=False, default=False)
    email_custom_subject = db.Column(db.String(255), nullable=True)
    email_attach_camera = db.Column(db.Boolean, nullable=False, default=False)

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
                'sms_enabled': r.sms_enabled,
                'group_id': r.group_id,
                'notify_again_minutes': r.notify_again_minutes,
                'sms_custom_enabled': r.sms_custom_enabled,
                'sms_custom_message': r.sms_custom_message,
                'notify_on_return_enabled': r.notify_on_return_enabled,
                'email_custom_subject_enabled': r.email_custom_subject_enabled,
                'email_custom_subject': r.email_custom_subject,
                'email_attach_camera': r.email_attach_camera,
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
            rule.sms_enabled = rule_data['sms_enabled']
            rule.group_id = rule_data.get('group_id')
            rule.notify_again_minutes = rule_data.get('notify_again_minutes', 30)
            rule.sms_custom_enabled = rule_data.get('sms_custom_enabled', False)
            rule.sms_custom_message = rule_data.get('sms_custom_message')
            rule.notify_on_return_enabled = rule_data.get('notify_on_return_enabled', False)
            rule.email_custom_subject_enabled = rule_data.get('email_custom_subject_enabled', False)
            rule.email_custom_subject = rule_data.get('email_custom_subject')
            rule.email_attach_camera = rule_data.get('email_attach_camera', False)
        db.session.commit()


ALARM_EVENT_TYPES = ('fire', 'gas', 'water', 'door', 'voltage')


class AlarmState(db.Model):
    __tablename__ = 'alarm_states'
    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(20), unique=True, nullable=False)
    active = db.Column(db.Boolean, nullable=False, default=False)
    acknowledged = db.Column(db.Boolean, nullable=False, default=False)
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
                'acknowledged': s.acknowledged,
                'last_triggered_at': s.last_triggered_at.strftime('%Y-%m-%d %H:%M:%S') if s.last_triggered_at else None,
                'cleared_at': s.cleared_at.strftime('%Y-%m-%d %H:%M:%S') if s.cleared_at else None,
            }
            for s in AlarmState.query.all()
        ]

    @staticmethod
    def trigger(event_type):
        from datetime import datetime
        if event_type not in ALARM_EVENT_TYPES:
            return
        state = AlarmState.query.filter_by(event_type=event_type).first()
        if not state:
            state = AlarmState(event_type=event_type)
            db.session.add(state)
        state.active = True
        state.acknowledged = False
        state.last_triggered_at = datetime.now()
        db.session.commit()

    @staticmethod
    def clear(event_type):
        """Dezaktywuje alarm — wywoływane wewnętrznie, gdy odczyt sam wróci do
        normy. Nie jest to już akcja użytkownika (patrz acknowledge())."""
        from datetime import datetime
        state = AlarmState.query.filter_by(event_type=event_type).first()
        if not state:
            return False
        state.active = False
        state.acknowledged = False
        state.cleared_at = datetime.now()
        db.session.commit()
        return True

    @staticmethod
    def acknowledge(event_type):
        """Akcja użytkownika (przycisk "Potwierdź alarm") — wycisza dalsze
        powiadomienia, ale NIE dezaktywuje alarmu. Alarm sam zgaśnie, gdy
        czujnik faktycznie wróci do normy (patrz clear())."""
        state = AlarmState.query.filter_by(event_type=event_type).first()
        if not state:
            return False
        state.acknowledged = True
        db.session.commit()
        return True


DEVICE_ALARM_SEVERITIES = ('non_critical', 'critical')


class DeviceAlarmState(db.Model):
    __tablename__ = 'device_alarm_states'
    id = db.Column(db.Integer, primary_key=True)
    rack_id = db.Column(db.String(20), nullable=False)
    metric = db.Column(db.String(20), nullable=False)
    severity = db.Column(db.String(20), nullable=False, default='non_critical')
    active = db.Column(db.Boolean, nullable=False, default=False)
    acknowledged = db.Column(db.Boolean, nullable=False, default=False)
    last_triggered_at = db.Column(db.DateTime, nullable=True)
    cleared_at = db.Column(db.DateTime, nullable=True)
    pending_since = db.Column(db.DateTime, nullable=True)
    return_notified = db.Column(db.Boolean, nullable=False, default=False)

    __table_args__ = (
        db.UniqueConstraint('rack_id', 'metric', 'severity', name='uq_device_alarm_rack_metric_severity'),
    )

    @staticmethod
    def get(rack_id, metric, severity):
        return DeviceAlarmState.query.filter_by(rack_id=rack_id, metric=metric, severity=severity).first()

    @staticmethod
    def get_or_create(rack_id, metric, severity):
        state = DeviceAlarmState.get(rack_id, metric, severity)
        if not state:
            state = DeviceAlarmState(rack_id=rack_id, metric=metric, severity=severity)
            db.session.add(state)
            db.session.commit()
        return state

    @staticmethod
    def is_active(rack_id, metric, severity):
        state = DeviceAlarmState.get(rack_id, metric, severity)
        return bool(state and state.active)

    @staticmethod
    def is_acknowledged(rack_id, metric, severity):
        state = DeviceAlarmState.get(rack_id, metric, severity)
        return bool(state and state.acknowledged)

    @staticmethod
    def trigger(rack_id, metric, severity):
        from datetime import datetime
        state = DeviceAlarmState.get(rack_id, metric, severity)
        if not state:
            state = DeviceAlarmState(rack_id=rack_id, metric=metric, severity=severity)
            db.session.add(state)
        state.active = True
        state.acknowledged = False
        state.last_triggered_at = datetime.now()
        state.pending_since = None
        state.return_notified = False
        db.session.commit()

    @staticmethod
    def clear(rack_id, metric, severity):
        """Dezaktywuje alarm — wywoływane wewnętrznie, gdy odczyt sam wróci do
        normy. Nie jest to już akcja użytkownika (patrz acknowledge())."""
        state = DeviceAlarmState.get(rack_id, metric, severity)
        if not state:
            return False
        from datetime import datetime
        state.active = False
        state.acknowledged = False
        state.cleared_at = datetime.now()
        state.pending_since = None
        state.return_notified = False
        db.session.commit()
        return True

    @staticmethod
    def acknowledge(rack_id, metric, severity):
        """Akcja użytkownika (przycisk "Potwierdź alarm") — wycisza dalsze
        powiadomienia, ale NIE dezaktywuje alarmu. Alarm sam zgaśnie, gdy
        odczyt faktycznie wróci do normy (patrz clear())."""
        state = DeviceAlarmState.get(rack_id, metric, severity)
        if not state:
            return False
        state.acknowledged = True
        db.session.commit()
        return True

    @staticmethod
    def mark_pending(rack_id, metric, severity):
        from datetime import datetime
        state = DeviceAlarmState.get_or_create(rack_id, metric, severity)
        if state.pending_since is None:
            state.pending_since = datetime.now()
            db.session.commit()
        return state.pending_since

    @staticmethod
    def clear_pending(rack_id, metric, severity):
        state = DeviceAlarmState.get(rack_id, metric, severity)
        if state and state.pending_since is not None:
            state.pending_since = None
            db.session.commit()

    @staticmethod
    def mark_return_notified(rack_id, metric, severity):
        state = DeviceAlarmState.get_or_create(rack_id, metric, severity)
        state.return_notified = True
        db.session.commit()


def alarm_should_fire(state, notify_again_minutes, force=False):
    if force or not state or not state.active:
        return True
    if state.acknowledged:
        # Użytkownik potwierdził — cicho, dopóki alarm sam nie zgaśnie
        # (powrót do normy) i nie wywoła się od nowa.
        return False
    if state.last_triggered_at is None:
        return True
    from datetime import datetime
    return (datetime.now() - state.last_triggered_at).total_seconds() >= notify_again_minutes * 60


class SmtpSettings(db.Model):
    __tablename__ = 'smtp_settings'
    id = db.Column(db.Integer, primary_key=True)
    host = db.Column(db.String(255), nullable=True)
    port = db.Column(db.Integer, nullable=False, default=587)
    username = db.Column(db.String(255), nullable=True)
    password = db.Column(db.String(255), nullable=True)
    from_address = db.Column(db.String(255), nullable=True)
    use_tls = db.Column(db.Boolean, nullable=False, default=True)

    @staticmethod
    def get_or_create():
        settings = SmtpSettings.query.first()
        if not settings:
            settings = SmtpSettings()
            db.session.add(settings)
            db.session.commit()
        return settings

    @staticmethod
    def update(host, port, username, password, from_address, use_tls):
        settings = SmtpSettings.get_or_create()
        settings.host = host
        settings.port = port
        settings.username = username
        settings.password = password
        settings.from_address = from_address
        settings.use_tls = use_tls
        db.session.commit()
        return settings


class VoltageThreshold(db.Model):
    __tablename__ = 'voltage_thresholds'
    id = db.Column(db.Integer, primary_key=True)
    min_voltage = db.Column(db.Float, nullable=False, default=11.0)
    max_voltage = db.Column(db.Float, nullable=False, default=15.0)
    enabled = db.Column(db.Boolean, nullable=False, default=True)

    @staticmethod
    def get_or_create():
        threshold = VoltageThreshold.query.first()
        if not threshold:
            threshold = VoltageThreshold(min_voltage=11.0, max_voltage=15.0, enabled=True)
            db.session.add(threshold)
            db.session.commit()
        return threshold

    @staticmethod
    def update(min_voltage, max_voltage):
        threshold = VoltageThreshold.get_or_create()
        threshold.min_voltage = min_voltage
        threshold.max_voltage = max_voltage
        db.session.commit()
        return threshold

    @staticmethod
    def set_enabled(enabled):
        threshold = VoltageThreshold.get_or_create()
        threshold.enabled = enabled
        db.session.commit()
        return threshold


class DeviceSensorSettings(db.Model):
    """Globalny wyłącznik mockowanych czujników temp/wilg. per-slot w szafach
    (DeviceSensor) — nie ma realnego sprzętu per-unit, tylko losowy mock, więc
    admin może go wyłączyć zamiast dostawać fałszywe alarmy z pustych szaf."""
    __tablename__ = 'device_sensor_settings'
    id = db.Column(db.Integer, primary_key=True)
    enabled = db.Column(db.Boolean, nullable=False, default=True)

    @staticmethod
    def get_or_create():
        settings = DeviceSensorSettings.query.first()
        if not settings:
            settings = DeviceSensorSettings(enabled=True)
            db.session.add(settings)
            db.session.commit()
        return settings

    @staticmethod
    def set_enabled(enabled):
        settings = DeviceSensorSettings.get_or_create()
        settings.enabled = enabled
        db.session.commit()
        return settings
