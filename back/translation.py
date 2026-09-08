"""Tłumaczenia komunikatów API zwracanych do UI (pole 'message' w jsonify).

Klucz słownika to oryginalny polski tekst — dzięki temu owinięcie istniejącego
wywołania w t('...') jest jednolinijkową zmianą w miejscu użycia, bez
wprowadzania osobnych abstrakcyjnych kluczy w całym app.py.

Świadomie NIE obejmuje: treści zapisywanych do Logów (log_description —
zapis historyczny/audytowy, ma zostać jednolicie polski niezależnie od
języka UI w chwili wywołania) ani treści e-maili/SMS wysyłanych do realnych
odbiorców (notifications.py — komu, w jakim języku, to osobna decyzja,
nie "język UI aktualnie zalogowanego admina").

Język zgłasza frontend nagłówkiem 'Accept-Language' przy KAŻDYM requeście
(axios interceptor w front/src/api.js) — nie ma per-użytkownikowego
ustawienia w bazie (jedno konto admina, JWT), więc to per-request, nie
globalne ustawienie.
"""
from flask import request

TRANSLATIONS = {
    'Brak uprawnień': 'No permission',
    'Brak danych': 'No data provided',
    'Użytkownik o takim loginie istnieje': 'A user with that login already exists',
    'Użytkownik utworzony': 'User created',
    'Nie możesz usunąć własnego konta': 'You cannot delete your own account',
    'Użytkownik nie znaleziony': 'User not found',
    'Użytkownik usunięty': 'User deleted',
    'Nieprawidłowe dane logowania': 'Invalid login credentials',
    'Wylogowano': 'Logged out',
    'Layout zapisany': 'Layout saved',
    'Layout zaktualizowany': 'Layout updated',
    'Kamera już nagrywa': 'Camera is already recording',
    'Nie można uruchomić nagrywania': 'Could not start recording',
    'Nagrywanie rozpoczęte': 'Recording started',
    'Nagrywanie zatrzymane': 'Recording stopped',
    'Wideo nie znalezione': 'Video not found',
    'Wideo usunięte': 'Video deleted',
    'Wszystkie wideo usunięte': 'All videos deleted',
    'Nazwa grupy wymagana': 'Group name required',
    'Grupa o takiej nazwie już istnieje': 'A group with that name already exists',
    'Grupa dodana': 'Group added',
    'Grupa nie znaleziona': 'Group not found',
    'Grupa usunięta': 'Group deleted',
    'Podaj e-mail lub numer telefonu': 'Provide an e-mail or phone number',
    'Odbiorca dodany': 'Recipient added',
    'Odbiorca nie znaleziony': 'Recipient not found',
    'Odbiorca usunięty': 'Recipient deleted',
    'Nieprawidłowy harmonogram': 'Invalid schedule',
    'Harmonogram zapisany': 'Schedule saved',
    'Nieprawidłowy typ zdarzenia': 'Invalid event type',
    'Grupa nie istnieje': 'Group does not exist',
    'Reguły zaktualizowane': 'Rules updated',
    'Nieprawidłowy typ czujnika': 'Invalid sensor type',
    'Alarm testowy wywołany': 'Test alarm triggered',
    'Stan alarmu nie znaleziony': 'Alarm state not found',
    'Alarm potwierdzony': 'Alarm acknowledged',
    'Ustawienia zapisane': 'Settings saved',
    'Błąd zapisu ustawień': 'Failed to save settings',
    'Wartość minimalna musi być mniejsza niż maksymalna': 'Minimum value must be less than maximum',
    'Adres odbiorcy wymagany': 'Recipient address required',
    'Wysłano — sprawdź skrzynkę (też SPAM).': 'Sent — check your inbox (and spam folder).',
    'Numer odbiorcy wymagany': 'Recipient number required',
    'Backend mock — nic fizycznie nie poleciało, sprawdź log backendu.': 'Mock backend — nothing was physically sent, check the backend log.',
    'Wysłano — sprawdź telefon.': 'Sent — check your phone.',
    'Logi usunięte': 'Logs deleted',
    'Alarm zasymulowany': 'Alarm simulated',
    'Wartość minimalna musi być mniejsza niż maksymalna (krytyczny)': 'Minimum value must be less than maximum (critical)',
    'Urządzenie nie znalezione': 'Device not found',
    'Wykres wyczyszczony': 'Chart cleared',
    'Nieprawidłowy plik konfiguracji': 'Invalid configuration file',
    'Konfiguracja przywrócona': 'Configuration restored',
}


def current_lang():
    header = request.headers.get('Accept-Language', 'pl')
    return 'en' if header.lower().startswith('en') else 'pl'


def t(text_pl):
    """Tłumaczy pojedynczy komunikat na EN wg nagłówka bieżącego requestu.
    Brak wpisu w słowniku -> zwraca oryginalny polski tekst (nigdy nie
    wybucha na nieprzetłumaczonym stringu)."""
    if current_lang() == 'en':
        return TRANSLATIONS.get(text_pl, text_pl)
    return text_pl
