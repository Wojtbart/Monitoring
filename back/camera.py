import cv2
import sys
from datetime import datetime


class Camera:
    def __init__(self):
        self._cap = None
        self._writer = None
        self.is_recording = False
        self._videos_dir = 'videos'

    def _open(self):
        if self._cap is not None:
            return
        # CAP_DSHOW tylko na Windows (szybszy init)
        if sys.platform == 'win32':
            self._cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        else:
            self._cap = cv2.VideoCapture(0)

    def start_recording(self):
        if self.is_recording:
            return None
        self._open()
        if not self._cap or not self._cap.isOpened():
            return None
        video_name = 'Video_' + datetime.now().strftime('Date_%Y_%m_%d_Time_%H_%M_%S') + '.mp4'
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self._writer = cv2.VideoWriter(f'{self._videos_dir}/{video_name}', fourcc, 20.0, (640, 480))
        self.is_recording = True
        return video_name

    def stop_recording(self):
        if not self.is_recording:
            return
        if self._writer:
            self._writer.release()
            self._writer = None
        self.is_recording = False

    def stream(self):
        self._open()
        if not self._cap or not self._cap.isOpened():
            return

        try:
            while True:
                ok, frame = self._cap.read()
                if not ok:
                    break
                if self.is_recording and self._writer:
                    self._writer.write(frame)
                ret, buf = cv2.imencode('.jpg', frame)
                if not ret:
                    continue
                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + buf.tobytes() + b'\r\n'
                )
        finally:
            if self._cap:
                self._cap.release()
                self._cap = None
