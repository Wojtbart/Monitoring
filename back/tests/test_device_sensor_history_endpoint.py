def test_history_endpoint_empty_when_no_reading_yet(client):
    resp = client.get('/device-sensors/B9/1/history')
    assert resp.status_code == 200
    assert resp.get_json() == {'history': []}


def test_history_endpoint_returns_ascending_order(client):
    client.get('/device-sensors/A0/4')
    client.get('/device-sensors/A0/4')
    client.get('/device-sensors/A0/4')

    resp = client.get('/device-sensors/A0/4/history')
    assert resp.status_code == 200
    data = resp.get_json()['history']
    assert len(data) == 3
    timestamps = [row['recorded_at'] for row in data]
    assert timestamps == sorted(timestamps)
    for row in data:
        assert 'temperature' in row
        assert 'humidity' in row
