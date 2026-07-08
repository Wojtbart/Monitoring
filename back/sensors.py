import threading
import random
import time
from datetime import datetime
from flask import current_app
#from picamera2.encoders import H264Encoder
from ffmpg import convert_to_mp4
#import RPi.GPIO as GPIO
import time



class Sensor:
    def __init__(self, app, settings, phone_numbers, camera):
        self.app = app
        self.camera = camera
        self.min_temperature = settings[0]['min_temperature']
        self.max_temperature = settings[0]['max_temperature']
        self.min_humidity = settings[0]['min_humidity']
        self.max_humidity = settings[0]['max_humidity']
        self.recording_seconds = settings[0]['recording_seconds']
        self.evening_test_time = settings[0]['evening_test_time']
        self.morning_test_time = settings[0]['morning_test_time']
        self.is_recording = False
        self.is_user_recording = False
        self.temperature = 0.0
        self.humidity = 0.0
        self.motion = False
        self.fire = False
        self.gas = False
        self.door = False
        self.water = False
        self.message = ''
        self.phone_numbers = phone_numbers
        self.timer = None #threading.Timer(self.recording_seconds, self.stop_timer_and_recording)
        self.video_name = ''
       # GPIO.setmode(GPIO.BCM)
        self.pin = 18
        #GPIO.setup(self.pin, GPIO.IN)
        self.handling_thread = threading.Thread(target=self.read_data_from_sensor)
        self.handling_thread.daemon = True
        self.handling_thread.start()

    def stop_timer_and_recording(self):
        self.is_recording = False
        self.camera.stop_recording()
        self.camera.start()
        self.timer.cancel()
        # self.timer.join()
        convert_to_mp4('videos/'+self.video_name+'.h264', 'videos/'+self.video_name+'.mp4')
        # print('Recording stopped')
    
    def get_current_data(self):
        return {
            'temperature': self.temperature,
            'humidity': self.humidity,
            'motion': self.motion,
            'fire': self.fire,
            'gas': self.gas,
            'door': self.door,
            'water': self.water
        }

    def update_settings(self, settings):
        self.min_temperature = settings[0]['min_temperature']
        self.max_temperature = settings[0]['max_temperature']
        self.min_humidity = settings[0]['min_humidity']
        self.max_humidity = settings[0]['max_humidity']
        self.recording_seconds = settings[0]['recording_seconds']
        self.evening_test_time = settings[0]['evening_test_time']
        self.morning_test_time = settings[0]['morning_test_time']


    def read_data_from_sensor(self):
        from models import Logs
        while True:
            self.message = str(time.time())
            self.temperature = random.randint(0, 100)
            self.humidity = random.randint(0, 100)
            self.motion = None# GPIO.input(self.pin)
            print(self.motion)
            self.fire = random.choice([True, False])
            self.gas = random.choice([True, False])
            self.door = random.choice([True, False])
            self.water = random.choice([True, False])
            if self.temperature < self.min_temperature or self.temperature > self.max_temperature:
                self.message += 'Temperautra przekroczyła granice, aktualna temperatura: ' + str(self.temperature)
                # current_datetime = datetime.now()
                # with self.app.app_context():
                #     Logs.add_log(current_datetime.strftime("%Y-%m-%d %H:%M:%S") , "Czujnik temperatury", True, 'Temperautra przekroczyła granice, aktualna temperatura: ' + str(self.temperature))
            if self.humidity < self.min_humidity or self.humidity > self.max_humidity:
                self.message += 'Wilgotność przekroczyła granice, aktualna wilgotność: ' + str(self.humidity)
            if self.motion == True or self.is_recording == True:
                if self.motion == True:
                    print('Wykryto ruch')
                self.message += 'Wykryto ruch rozpoczeto nagrywanie'
                if self.is_recording == False and self.is_user_recording == False:
                    self.timer = threading.Timer(self.recording_seconds, self.stop_timer_and_recording)
                    self.timer.start()
                    encoder = None #H264Encoder(bitrate=10000000)
                    self.video_name = 'Video_' + datetime.now().strftime('Date_%Y_%m_%d_Time_%H_%M_%S')
                    self.camera.start_recording(encoder,'videos/'+self.video_name+'.h264')
                    self.is_recording = True
                    print('Wykryto ruch Nagrywanie rozpoczete')
                if self.timer.is_alive() == True and self.motion == True:
                    self.timer.cancel()
                    self.timer.join()
                    self.timer = threading.Timer(self.recording_seconds, self.stop_timer_and_recording)
                    self.timer.start()
                    print('Wykryto ruch nagrywanie przedłużone')
            if self.fire == True:
                self.message += 'Wykryto ogień'
            if self.gas == True:
                self.message += 'Wykryto gaz'
            if self.door == True:
                self.message += 'Owarto drzwi'
            if self.water == True:
                self.message += 'Wykryto wodę'
            current_time = time.strftime('%H:%M:%S', time.localtime())
            if current_time == self.evening_test_time or current_time == self.morning_test_time:
                print( 'Test poranny lub wieczorny')
            # tutaj oczekiwanie na smsa bedzie jeszcze mozliwe ze tez w osobnym watku
            time.sleep(1)

                

from models import Logs
    
        
        