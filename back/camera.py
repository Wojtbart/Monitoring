import cv2
from datetime import datetime

class Camera:
    def __init__(self):
        self.camera = None
        self.isCameraOpened = False
        self.isRecording = False
        self.outputFile = None

    def open_camera(self):
        if not self.isCameraOpened:
            self.camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            self.isCameraOpened = self.camera.isOpened()

    def release_camera(self):
        if self.isCameraOpened:
            self.camera.release()
            self.camera = None
            self.isCameraOpened = False

    def start_recording(self):
        if not self.isRecording and self.isCameraOpened:
            videoName = 'Video_' + datetime.now().strftime('Date_%Y_%m_%d_Time_%H_%M_%S') + '.mp4'
            self.outputFile = cv2.VideoWriter("videos/" + videoName, cv2.VideoWriter_fourcc('m', 'p', '4', 'v'), 20.0, (640, 480))
            self.isRecording = True
            return videoName
        return None

    def stop_recording(self):
        if self.isRecording:
            self.outputFile.release()
            self.isRecording = False

    def stream(self):
        if self.camera is None or not self.isCameraOpened:
            self.open_camera()

        if not self.isCameraOpened:
            print("Camera could not be opened.")
            return

        print("Streaming started")
        try:
            while self.isCameraOpened:
                success, frame = self.camera.read()
                if success:
                    if self.isRecording:
                        self.outputFile.write(frame)

                    ret, buffer = cv2.imencode('.jpg', frame)
                    frame = buffer.tobytes()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
                else:
                    print("Failed to read frame.")
                    break
        finally:
            print("Releasing camera.")
            self.release_camera()