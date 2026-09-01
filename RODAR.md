# Como rodar o Ponto Field localmente

## Terminal 1 — Backend

**PowerShell (Windows):**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

**bash / Git Bash / macOS / Linux:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows (Git Bash): source .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Acesse: http://localhost:8000/docs

---

## Terminal 2 — Frontend

```bash
cd frontend

npm install
npm run dev
```

Acesse: http://localhost:5173

---

Por padrão os dados ficam em `backend/che.db` (SQLite, vazio). Para rodar com os dados reais
de produção (backup Postgres), veja a seção **"Usando o backup de produção localmente"** no
[README.md](README.md).
