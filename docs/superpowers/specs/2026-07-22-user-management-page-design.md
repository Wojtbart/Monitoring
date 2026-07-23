# Strona zarządzania użytkownikami (rejestracja + lista + usuwanie)

## Kontekst

Obecnie `/registerPage` ([RegisterPage.jsx](../../../front/src/RegisterPage.jsx)) pozwala adminowi dodać nowego użytkownika (formularz z nazwą, hasłem, checkboxem "admin"). Front blokuje wejście na tę stronę dla nie-adminów tylko wizualnie (`Layout.jsx:120-126`, `alert()` bez faktycznego zabezpieczenia). Backend (`POST /register`, `back/app.py:46-58`) nie ma żadnego zabezpieczenia — każdy, nawet niezalogowany, może wysłać request bezpośrednio i utworzyć konto, włącznie z kontem administratora.

Ten dokument opisuje: przemianowanie trasy, zamknięcie dziury bezpieczeństwa w `/register`, oraz dodanie listy istniejących użytkowników (z informacją o uprawnieniach) i możliwości ich usuwania.

## Zmiana trasy

`/registerPage` → `/registerUser`:
- `front/src/App.jsx`: `<Route path="/registerPage" .../>` → `<Route path="/registerUser" .../>`.
- `front/src/Layout.jsx:122`: `navigate("/registerPage")` → `navigate("/registerUser")`.

## Backend: zabezpieczenie `/register`

`back/app.py:46-58` — dodaję `@jwt_required()` i sprawdzenie uprawnień, wzorem istniejącego `/userInfo` (`back/app.py:73-78`):

```python
@app.route('/register', methods=['POST'])
@jwt_required()
def register():
    current_user = Users.get_user_by_username(get_jwt_identity())
    if not current_user or not current_user.isadmin:
        return jsonify({'message': 'Brak uprawnień'}), 403
    ...  # reszta bez zmian
```

Efekt: rejestracja nowego użytkownika wymaga teraz zalogowanego administratora — front już wysyła `Authorization: Bearer <token>` przy innych chronionych requestach (wzorzec z `saveLayout`, `startRecording` itd.), więc `RegisterPage.jsx` musi zacząć dołączać ten nagłówek do `axios.post(.../register, ...)`.

## Backend: lista i usuwanie użytkowników

Nowa metoda w `back/models.py`, w klasie `Users` (obok istniejącego `get_all_users`):

```python
    @staticmethod
    def delete_user(user_id):
        user = db.session.get(Users, user_id)
        if user:
            db.session.delete(user)
            db.session.commit()
            return True
        return False
```

Nowe endpointy w `back/app.py`:

```
GET /users
```
- `@jwt_required()`, tylko admin (403 jeśli nie-admin, ten sam wzorzec co wyżej).
- Zwraca `[{"id": int, "username": str, "isadmin": bool}, ...]` dla wszystkich użytkowników (`Users.get_all_users()` już istnieje, dodaję tylko serializację pól potrzebnych na liście — bez hasła).

```
DELETE /users/<int:user_id>
```
- `@jwt_required()`, tylko admin.
- Jeśli `user_id` odpowiada aktualnie zalogowanemu użytkownikowi (porównanie `get_jwt_identity()` z `username` docelowego rekordu) → `400 {"message": "Nie możesz usunąć własnego konta"}`.
- Jeśli użytkownik nie istnieje → `404`.
- W przeciwnym razie usuwa i zwraca `200 {"message": "Użytkownik usunięty"}`.

## Frontend: lista użytkowników na `/registerUser`

W `RegisterPage.jsx`, pod istniejącym formularzem (po `</Card>` z formularzem, wewnątrz tego samego `Layout`):
- Nowa karta/sekcja "Użytkownicy" — tabela/lista: nazwa użytkownika, badge "Admin" (kolor warning, jak istniejący `AdminPanelSettingsIcon`) lub "User" (szary/neutralny), przycisk usuń (ikona kosza) w każdym wierszu.
- Pobieranie listy: `GET /users` z nagłówkiem `Authorization` (token z `localStorage.getItem("JWT")`), przy montowaniu komponentu i po każdym udanym dodaniu/usunięciu użytkownika.
- Przycisk usuń: ukryty (nie tylko disabled — nie ma sensu pokazywać przycisku, który nigdy nie zadziała) przy wierszu odpowiadającym aktualnie zalogowanemu użytkownikowi. Rozpoznanie "to ja" — porównanie `username` wiersza z nazwą zalogowanego użytkownika, pobraną z `GET /userInfo` (endpoint już istnieje, zwraca `currentUser`).
- Przed usunięciem: potwierdzenie przez `window.confirm(...)` (spójne z istniejącym stylem apki — `saveLayout` w innych miejscach też używa prostego `alert()` do komunikatów, brak custom modali potwierdzeń nigdzie indziej).
- Błędy usuwania (403/400/404 z backendu) pokazywane w tym samym komponencie `<Alert>` co błędy formularza rejestracji.

## Poza zakresem

- Edycja hasła/uprawnień istniejącego użytkownika (tylko dodawanie i usuwanie).
- Paginacja listy użytkowników (zakładamy niewielką liczbę kont w tym systemie).
