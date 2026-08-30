import os
import subprocess
import sys
import threading
import time
from datetime import datetime
import cv2

STREAM_FPS = 15
FRAME_SIZE = (640, 480)


class Camera:
    def __init__(self, videos_dir='videos'):
        backend = os.getenv('CAMERA_BACKEND', 'opencv')
        self._backend = backend if backend == 'picamera2' else 'opencv'
        self._cap = None
        self._picam = None
        self._writer = None
        self.is_recording = False
        self._videos_dir = videos_dir
        self._current_video_path = None
        # picamera2/libcamera nie są bezpieczne wątkowo — pod gunicorn -k gthread
        # kilka wątków może dotknąć kamery jednocześnie (strumień + start/stop
        # nagrywania) i to segfaultuje cały proces. Ta blokada serializuje
        # KAŻDY dostęp do _cap/_picam/_writer na jeden wątek naraz.
        self._lock = threading.Lock()

    def _open(self):
        if self._backend == 'picamera2':
            self._open_picamera2()
        else:
            self._open_opencv()

    def _open_opencv(self):
        if self._cap is not None:
            return
        # CAP_DSHOW tylko na Windows (szybszy init)
        if sys.platform == 'win32':
            self._cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        else:
            self._cap = cv2.VideoCapture(0)

    def _open_picamera2(self):
        if self._picam is not None:
            return
        try:
            from picamera2 import Picamera2
        except ImportError as e:
            raise RuntimeError(
                'CAMERA_BACKEND=picamera2, ale biblioteka picamera2 nie jest zainstalowana. '
                'Zainstaluj systemowo: sudo apt install -y python3-picamera2'
            ) from e
        picam = Picamera2()
        config = picam.create_video_configuration(main={'format': 'RGB888', 'size': FRAME_SIZE})
        picam.configure(config)
        picam.start()
        self._picam = picam

    def _is_opened(self):
        if self._backend == 'picamera2':
            return self._picam is not None
        return self._cap is not None and self._cap.isOpened()

    def _read_frame(self):
        if self._backend == 'picamera2':
            frame = self._picam.capture_array()
            return True, cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        return self._cap.read()

    def _release(self):
        if self._backend == 'picamera2':
            if self._picam:
                self._picam.stop()
                self._picam.close()
                self._picam = None
        else:
            if self._cap:
                self._cap.release()
                self._cap = None

    def capture_jpeg(self):
        with self._lock:
            self._open()
            if not self._is_opened():
                return None
            ok, frame = self._read_frame()
        if not ok:
            return None
        ret, buf = cv2.imencode('.jpg', frame)
        if not ret:
            return None
        return buf.tobytes()

    def start_recording(self):
        if self.is_recording:
            return None
        with self._lock:
            self._open()
            if not self._is_opened():
                return None
            video_name = 'Video_' + datetime.now().strftime('Date_%Y_%m_%d_Time_%H_%M_%S') + '.mp4'
            video_path = f'{self._videos_dir}/{video_name}'
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            self._writer = cv2.VideoWriter(video_path, fourcc, 20.0, FRAME_SIZE)
            self.is_recording = True
            self._current_video_path = video_path
        return video_name

    def stop_recording(self):
        if not self.is_recording:
            return
        with self._lock:
            if self._writer:
                self._writer.release()
                self._writer = None
            self.is_recording = False
            video_path = self._current_video_path
            self._current_video_path = None
        if video_path:
            self._transcode_to_h264(video_path)

    def _transcode_to_h264(self, path):
        """OpenCV (paczki pip) zapisuje mp4v (MPEG-4 Part 2) — przeglądarki tego
        nie odtwarzają natywnie. Jeśli w systemie jest ffmpeg z libx264 (typowe
        na Raspberry Pi OS), przekodowuje plik na miejscu do H.264. Jeśli ffmpeg
        nie jest dostępny (np. świeże środowisko dev) — po cichu zostawia
        oryginał, bez zmiany dotychczasowego zachowania."""
        temp_path = path + '.h264.tmp.mp4'
        try:
            subprocess.run(
                ['ffmpeg', '-y', '-i', path, '-c:v', 'libx264', '-preset', 'veryfast',
                 '-pix_fmt', 'yuv420p', '-movflags', '+faststart', temp_path],
                check=True, capture_output=True, timeout=120,
            )
            os.replace(temp_path, path)
        except FileNotFoundError:
            pass  # ffmpeg niedostępny — zostaw oryginalny plik mp4v
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            print(f'[camera] transkodowanie do H.264 nie powiodło się: {e}')
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def stream(self):
        with self._lock:
            self._open()
            opened = self._is_opened()
        if not opened:
            return

        try:
            while True:
                with self._lock:
                    ok, frame = self._read_frame()
                    if ok and self.is_recording and self._writer:
                        self._writer.write(frame)
                if not ok:
                    break
                ret, buf = cv2.imencode('.jpg', frame)
                if not ret:
                    continue
                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + buf.tobytes() + b'\r\n'
                )
                time.sleep(1 / STREAM_FPS)
        finally:
            with self._lock:
                self._release()
