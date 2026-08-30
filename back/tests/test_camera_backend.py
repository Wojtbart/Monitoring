import subprocess
import sys
import pytest
from camera import Camera


def test_camera_defaults_to_opencv_backend(monkeypatch):
    monkeypatch.delenv('CAMERA_BACKEND', raising=False)
    cam = Camera('videos')
    assert cam._backend == 'opencv'


def test_camera_reads_picamera2_backend_from_env(monkeypatch):
    monkeypatch.setenv('CAMERA_BACKEND', 'picamera2')
    cam = Camera('videos')
    assert cam._backend == 'picamera2'


def test_unknown_backend_falls_back_to_opencv(monkeypatch):
    monkeypatch.setenv('CAMERA_BACKEND', 'bogus')
    cam = Camera('videos')
    assert cam._backend == 'opencv'


def test_open_picamera2_without_module_raises_clear_error(monkeypatch):
    monkeypatch.setenv('CAMERA_BACKEND', 'picamera2')
    monkeypatch.setitem(sys.modules, 'picamera2', None)
    cam = Camera('videos')
    with pytest.raises(RuntimeError, match='python3-picamera2'):
        cam._open_picamera2()


def test_transcode_calls_ffmpeg_with_libx264(tmp_path, monkeypatch):
    calls = []

    def fake_run(args, **kwargs):
        calls.append(args)
        (tmp_path / 'video.mp4.h264.tmp.mp4').write_bytes(b'fake-h264-data')
        return subprocess.CompletedProcess(args, 0)

    monkeypatch.setattr(subprocess, 'run', fake_run)
    cam = Camera(str(tmp_path))
    video_path = str(tmp_path / 'video.mp4')
    (tmp_path / 'video.mp4').write_bytes(b'fake-mp4v-data')

    cam._transcode_to_h264(video_path)

    assert calls[0][0] == 'ffmpeg'
    assert '-i' in calls[0]
    assert 'libx264' in calls[0]
    assert (tmp_path / 'video.mp4').read_bytes() == b'fake-h264-data'


def test_transcode_leaves_original_when_ffmpeg_missing(tmp_path, monkeypatch):
    def fake_run(args, **kwargs):
        raise FileNotFoundError('ffmpeg not found')

    monkeypatch.setattr(subprocess, 'run', fake_run)
    cam = Camera(str(tmp_path))
    video_path = str(tmp_path / 'video.mp4')
    (tmp_path / 'video.mp4').write_bytes(b'fake-mp4v-data')

    cam._transcode_to_h264(video_path)

    assert (tmp_path / 'video.mp4').read_bytes() == b'fake-mp4v-data'


def test_transcode_leaves_original_when_ffmpeg_fails(tmp_path, monkeypatch):
    def fake_run(args, **kwargs):
        raise subprocess.CalledProcessError(1, args)

    monkeypatch.setattr(subprocess, 'run', fake_run)
    cam = Camera(str(tmp_path))
    video_path = str(tmp_path / 'video.mp4')
    (tmp_path / 'video.mp4').write_bytes(b'fake-mp4v-data')

    cam._transcode_to_h264(video_path)

    assert (tmp_path / 'video.mp4').read_bytes() == b'fake-mp4v-data'
