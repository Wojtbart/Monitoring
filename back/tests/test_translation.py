def test_message_is_polish_by_default(client):
    resp = client.post('/login', json={'username': 'nope', 'password': 'nope'})
    assert resp.status_code == 401
    assert resp.get_json()['message'] == 'Nieprawidłowe dane logowania'


def test_message_is_english_with_accept_language_header(client):
    resp = client.post('/login', json={'username': 'nope', 'password': 'nope'},
                        headers={'Accept-Language': 'en'})
    assert resp.status_code == 401
    assert resp.get_json()['message'] == 'Invalid login credentials'


def test_unknown_string_passes_through_untranslated(client):
    from translation import t
    with client.application.test_request_context(headers={'Accept-Language': 'en'}):
        assert t('Jakiś nieznany tekst bez tłumaczenia') == 'Jakiś nieznany tekst bez tłumaczenia'
