# import cv2
import ffmpeg
# print(cv2.getBuildInformation())
def convert_to_mp4(input_file, output_file):
    try:
        # Ustawienia konwersji
        ffmpeg.input(input_file).output(output_file, vcodec='libx264', acodec='aac', movflags='faststart').run()
        print(f'Konwersja zakończona. Zapisano w: {output_file}')
    # except (Error e ) as e:
    #     print('Wystąpił błąd podczas konwersji:')
    #     print(e.stderr.decode())999999999999999
    finally:
        pass
# convert_to_mp4('videos/Video_Date_2024_12_02_Time_16_35_01.h264', 'videos/Video_Date_2024_12_02_Time_16_35_01.mp4')