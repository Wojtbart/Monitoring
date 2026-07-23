# User management page (register lockdown + list + delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock down `POST /register` to admins only, add `GET /users` and `DELETE /users/<id>` endpoints, rename the frontend route to `/registerUser`, and add a user list (with delete) to that page.

**Architecture:** Backend gains an admin-only guard on `/register` (same pattern as existing `/userInfo`), a new `Users.delete_user` model method, and two new routes. Frontend renames the route, starts sending the JWT on register, and extends `RegisterPage.jsx` with a list fetched from `/users` and per-row delete (except the logged-in user's own row).

**Tech Stack:** Flask, Flask-SQLAlchemy, Flask-JWT-Extended, pytest (backend); React, axios, MUI (frontend, no test framework).

## Global Constraints

- Bootstrap safety: the very first admin account is seeded by `back/init_db.py` calling `Users.add_user` directly — it does NOT go through `/register`, so locking `/register` down to admin-only does not create a chicken-and-egg problem.
- A user can never delete their own account, even as admin — enforced server-side in `DELETE /users/<id>`, not just hidden in the UI.
- No pagination, no editing existing users (password/admin flag) — out of scope per spec.
- **No git commands** — do not run `git add`/`git commit`/`git push`. Leave files saved on disk.
- Frontend has no test framework — frontend tasks are verified via `npx esbuild --bundle=false` for syntax and manual browser check.

---

### Task 1: Lock `POST /register` down to admins

**Files:**
- Modify: `back/app.py:46-58` (the `register` view)
- Test: `back/test_register_endpoint.py`

**Interfaces:**
- Consumes: `Users.get_user_by_username` (existing, `back/models.py:21-23`), `get_jwt_identity`, `jwt_required` (already imported in `back/app.py:3`).
- Produces: `POST /register` now requires a valid JWT for an admin user; behavior for the actual creation logic (`Users.add_user`, duplicate-username check) is unchanged.

- [ ] **Step 1: Write the failing tests**

Create `back/test_register_endpoint.py`:

```python
from werkzeug.security import generate_password_hash
from models import db, Users


def _make_user(username, password, isadmin):
    Users.add_user(username, generate_password_hash(password, method='pbkdf2:sha256'), isadmin)


def _login(client, username, password):
    resp = client.post('/login', json={'username': username, 'password': password})
    return resp.get_json()['accessToken']


def test_register_requires_auth(client, app):
    resp = client.post('/register', json={'username': 'newbie', 'password': 'pw'})
    assert resp.status_code == 401


def test_register_requires_admin(client, app):
    with app.app_context():
        _make_user('regular', 'pw123', False)
    token = _login(client, 'regular', 'pw123')

    resp = client.post(
        '/register',
        json={'username': 'newbie', 'password': 'pw'},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 403


def test_register_succeeds_for_admin(client, app):
    with app.app_context():
        _make_user('boss', 'pw123', True)
    token = _login(client, 'boss', 'pw123')

    resp = client.post(
        '/register',
        json={'username': 'newbie', 'password': 'pw'},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert resp.status_code == 200
    with app.app_context():
        assert Users.get_user_by_username('newbie') is not None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd back && python -m pytest test_register_endpoint.py -v`
Expected: `test_register_requires_auth` FAILs (currently returns 200, not 401); the other two currently pass by coincidence but re-run after Step 3 to confirm intent.

- [ ] **Step 3: Add the admin guard**

Replace the `register` view in `back/app.py` (currently lines 46-58):

```python
@app.route('/register', methods=['POST'])
@jwt_required()
def register():
    current_user = Users.get_user_by_username(get_jwt_identity())
    if not current_user or not current_user.isadmin:
        return jsonify({'message': 'Brak uprawnień'}), 403

    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    isadmin = data.get('isAdmin', False)
    if not username or not password:
        return jsonify({'message': 'Brak danych'}), 400
    if Users.get_user_by_username(username):
        return jsonify({'message': 'Użytkownik o takim loginie istnieje'}), 400
    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
    Users.add_user(username, hashed_password, isadmin)
    return jsonify({'message': 'Użytkownik utworzony'}), 200
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd back && python -m pytest test_register_endpoint.py -v`
Expected: 3 passed

---

### Task 2: `GET /users` and `DELETE /users/<id>`

**Files:**
- Modify: `back/models.py` (add `Users.delete_user`)
- Modify: `back/app.py` (two new routes)
- Test: `back/test_users_endpoint.py`

**Interfaces:**
- Produces: `Users.delete_user(user_id) -> bool` — deletes the user if it exists, returns `True`/`False`.
- Produces: `GET /users` → `200 [{"id": int, "username": str, "isadmin": bool}, ...]`, admin-only.
- Produces: `DELETE /users/<int:user_id>` → `200 {"message": ...}` on success, `400` if deleting your own account, `404` if the user doesn't exist, admin-only.

- [ ] **Step 1: Write the failing tests**

Create `back/test_users_endpoint.py`:

```python
from werkzeug.security import generate_password_hash
from models import db, Users


def _make_user(username, password, isadmin):
    Users.add_user(username, generate_password_hash(password, method='pbkdf2:sha256'), isadmin)


def _login(client, username, password):
    resp = client.post('/login', json={'username': username, 'password': password})
    return resp.get_json()['accessToken']


def test_get_users_requires_admin(client, app):
    with app.app_context():
        _make_user('regular', 'pw123', False)
    token = _login(client, 'regular', 'pw123')

    resp = client.get('/users', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 403


def test_get_users_returns_list_for_admin(client, app):
    with app.app_context():
        _make_user('boss', 'pw123', True)
        _make_user('worker', 'pw456', False)
    token = _login(client, 'boss', 'pw123')

    resp = client.get('/users', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    data = resp.get_json()
    usernames = {row['username']: row['isadmin'] for row in data}
    assert usernames == {'boss': True, 'worker': False}
    assert all('password' not in row for row in data)


def test_delete_user_requires_admin(client, app):
    with app.app_context():
        _make_user('regular', 'pw123', False)
        _make_user('victim', 'pw456', False)
        victim_id = Users.get_user_by_username('victim').id
    token = _login(client, 'regular', 'pw123')

    resp = client.delete(f'/users/{victim_id}', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 403


def test_delete_user_blocks_self_delete(client, app):
    with app.app_context():
        _make_user('boss', 'pw123', True)
        boss_id = Users.get_user_by_username('boss').id
    token = _login(client, 'boss', 'pw123')

    resp = client.delete(f'/users/{boss_id}', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400
    with app.app_context():
        assert Users.get_user_by_username('boss') is not None


def test_delete_user_succeeds_for_admin(client, app):
    with app.app_context():
        _make_user('boss', 'pw123', True)
        _make_user('victim', 'pw456', False)
        victim_id = Users.get_user_by_username('victim').id
    token = _login(client, 'boss', 'pw123')

    resp = client.delete(f'/users/{victim_id}', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    with app.app_context():
        assert Users.get_user_by_username('victim') is None


def test_delete_user_404_when_missing(client, app):
    with app.app_context():
        _make_user('boss', 'pw123', True)
    token = _login(client, 'boss', 'pw123')

    resp = client.delete('/users/999999', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd back && python -m pytest test_users_endpoint.py -v`
Expected: FAIL — 404 (routes don't exist yet)

- [ ] **Step 3: Add `Users.delete_user` to `back/models.py`**

Add to the `Users` class in `back/models.py` (after `get_user_by_username`, currently ending at line 23):

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

- [ ] **Step 4: Add the two routes to `back/app.py`**

Add after the `register` view (from Task 1):

```python
@app.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    current_user = Users.get_user_by_username(get_jwt_identity())
    if not current_user or not current_user.isadmin:
        return jsonify({'message': 'Brak uprawnień'}), 403
    return jsonify([
        {'id': user.id, 'username': user.username, 'isadmin': user.isadmin}
        for user in Users.get_all_users()
    ]), 200


@app.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    current_user = Users.get_user_by_username(get_jwt_identity())
    if not current_user or not current_user.isadmin:
        return jsonify({'message': 'Brak uprawnień'}), 403
    if current_user.id == user_id:
        return jsonify({'message': 'Nie możesz usunąć własnego konta'}), 400
    if not db.session.get(Users, user_id):
        return jsonify({'message': 'Użytkownik nie znaleziony'}), 404
    Users.delete_user(user_id)
    return jsonify({'message': 'Użytkownik usunięty'}), 200
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd back && python -m pytest test_users_endpoint.py -v`
Expected: 6 passed

- [ ] **Step 6: Run the full backend suite**

Run: `cd back && python -m pytest -v`
Expected: 22 passed (13 existing + 3 from Task 1 + 6 from Task 2)

---

### Task 3: Rename `/registerPage` route to `/registerUser`

**Files:**
- Modify: `front/src/App.jsx`
- Modify: `front/src/Layout.jsx:122`

**Interfaces:**
- Produces: the register page is now reachable at `/registerUser`; `/registerPage` no longer exists.

- [ ] **Step 1: Update the route in `front/src/App.jsx`**

Change:
```jsx
                <Route path="/registerPage" element={<RegisterPage />} />
```
to:
```jsx
                <Route path="/registerUser" element={<RegisterPage />} />
```

- [ ] **Step 2: Update the navigation target in `front/src/Layout.jsx`**

Change line 122 from:
```jsx
            navigate("/registerPage");
```
to:
```jsx
            navigate("/registerUser");
```

- [ ] **Step 3: Syntax-check both files**

Run: `cd front && npx esbuild src/App.jsx --bundle=false && npx esbuild src/Layout.jsx --bundle=false`
Expected: no errors.

---

### Task 4: User list + delete on the register page

**Files:**
- Modify: `front/src/RegisterPage.jsx`

**Interfaces:**
- Consumes: `GET /users`, `DELETE /users/<id>`, `GET /userInfo` (all from Task 2 and pre-existing), JWT token via `localStorage.getItem("JWT")` (existing pattern, used in `ServerRack.jsx`'s `saveLayout`).
- Produces: the register page now also sends `Authorization: Bearer <token>` on `POST /register`, and renders a user list below the form with a working delete action.

- [ ] **Step 1: Add auth header to the register call and add list/delete state**

In `front/src/RegisterPage.jsx`, add near the top of the component (after the existing `useState` declarations, i.e. after line 37 `const [loading, setLoading] = useState(false);`):

```jsx
    const [users, setUsers] = useState([]);
    const [currentUsername, setCurrentUsername] = useState(null);
    const accessToken = localStorage.getItem("JWT");

    const fetchUsers = async () => {
        try {
            const { data } = await axios.get(`${API_BASE}/users`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            setUsers(data);
        } catch (_) {}
    };

    useEffect(() => {
        axios.get(`${API_BASE}/userInfo`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        }).then(({ data }) => setCurrentUsername(data.currentUser)).catch(() => {});
        fetchUsers();
    }, []);

    const handleDeleteUser = async (userId, username) => {
        if (!window.confirm(`Usunąć użytkownika "${username}"?`)) return;
        try {
            await axios.delete(`${API_BASE}/users/${userId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            fetchUsers();
        } catch (error) {
            setStatus({ type: "error", message: error.response?.data?.message || "Błąd usuwania użytkownika." });
        }
    };
```

Add the `useEffect` import — change line 1 from:
```jsx
import { useState } from "react";
```
to:
```jsx
import { useState, useEffect } from "react";
```

Add `DeleteIcon` import after the existing `CheckCircleIcon` import (line 16):
```jsx
import DeleteIcon from "@mui/icons-material/Delete";
```

- [ ] **Step 2: Send the auth header on register, and refresh the list after success**

Replace the `handleRegister` function's request line and success branch. Change:
```jsx
        try {
            await axios.post(`${API_BASE}/register`, { username, password, isAdmin });
            setStatus({ type: "success", message: `Użytkownik "${username}" został dodany.` });
            setUsername("");
            setPassword("");
            setIsAdmin(false);
        } catch (error) {
```
to:
```jsx
        try {
            await axios.post(
                `${API_BASE}/register`,
                { username, password, isAdmin },
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            setStatus({ type: "success", message: `Użytkownik "${username}" został dodany.` });
            setUsername("");
            setPassword("");
            setIsAdmin(false);
            fetchUsers();
        } catch (error) {
```

- [ ] **Step 3: Render the user list below the existing form card**

The current return statement wraps everything in one `<Card>` inside a `<Box>` (`front/src/RegisterPage.jsx:69-214`). Add a second card as a sibling of the first, still inside the outer `<Box>`. Change:
```jsx
                </Card>
            </Box>
        </Layout>
```
to:
```jsx
                </Card>

                <Card sx={{ width: 420, mt: 3, borderRadius: 3, overflow: "hidden", boxShadow: 4 }}>
                    <Box sx={{ bgcolor: "#1a237e", px: 4, py: 2 }}>
                        <Typography variant="h6" fontWeight="bold" color="white">
                            Użytkownicy
                        </Typography>
                    </Box>
                    <Box sx={{ px: 3, py: 2 }}>
                        {users.length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                                Brak użytkowników.
                            </Typography>
                        )}
                        {users.map(u => (
                            <Box
                                key={u.id}
                                sx={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    py: 1, borderBottom: "1px solid #eee",
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography variant="body2">{u.username}</Typography>
                                    <Box sx={{
                                        px: 1, py: 0.2, borderRadius: 1, fontSize: "0.68rem", fontWeight: "bold",
                                        bgcolor: u.isadmin ? "#fff3e0" : "#eeeeee",
                                        color: u.isadmin ? "#e65100" : "#616161",
                                    }}>
                                        {u.isadmin ? "Admin" : "User"}
                                    </Box>
                                </Box>
                                {u.username !== currentUsername && (
                                    <IconButton size="small" onClick={() => handleDeleteUser(u.id, u.username)}>
                                        <DeleteIcon fontSize="small" color="error" />
                                    </IconButton>
                                )}
                            </Box>
                        ))}
                    </Box>
                </Card>
            </Box>
        </Layout>
```

- [ ] **Step 4: Syntax-check the file**

Run: `cd front && npx esbuild src/RegisterPage.jsx --bundle=false`
Expected: no errors.

- [ ] **Step 5: Manually verify in the browser**

Run backend (`cd back && python app.py`) and frontend (`cd front && npm run dev`). Log in as `admin`/`admin123`.

1. Open `http://localhost:5173/registerUser` (via the menu, or directly).
2. Confirm the "Użytkownicy" list shows `admin` with an "Admin" badge, and no delete button next to it (own account).
3. Register a new non-admin user via the form. Confirm it appears in the list below with a "User" badge and a delete button.
4. Click delete on the new user, confirm the browser confirm dialog, confirm the row disappears.
5. Log out, log in as the new (non-admin) user if you created one before deleting it, and confirm the menu blocks navigation to `/registerUser` (existing `Layout.jsx` behavior, unchanged).

---

## Out of scope (per spec)

- Editing existing users' password or admin flag.
- Pagination of the user list.
