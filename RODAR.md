# Como rodar o CHE localmente

## Terminal 1 — Backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

Acesse: http://localhost:8000

---

## Terminal 2 — Frontend

```bash
cd frontend

npm install
npm run dev
```

Acesse: http://localhost:5173

---

Os dados ficam salvos em `backend/che.db` (SQLite).
