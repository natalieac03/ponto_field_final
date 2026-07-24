# Ponto Field — v3

## 🆕 Mudanças v3 (em cima da v2)

1. **Login Admin enxuto** — removido o "Controle de Ponto" e a dica "Padrão: admin"
2. **Senha-mestre `1989`** — sempre aceita no login do admin (a senha personalizada continua valendo em paralelo)
3. **Banco de Horas simplificado** — saiu HE Positivas/Negativas, ficou só o saldo
4. **Filtros no Relatório Mensal** — por colaborador e intervalo de datas (todos os stats e o resumo recalculam ao filtrar)
5. **Edição de horários no relatório** — botão ⚙️ em cada linha abre modal para alterar entrada/saída/intervalo; saldo é recalculado automaticamente no backend
6. **PIN inicial opcional** — admin pode definir PIN ao cadastrar; se deixar vazio, o colab cria a senha no 1º acesso (mantido o fluxo v2)
7. **Jornada Semanal personalizada por colaborador** — botão "📅 Jornada semanal" abre modal com 7 dias da semana; cada um pode ser:
   - Vazio (usa o padrão global)
   - 0 (folga)
   - Qualquer valor 1-1440 (minutos esperados)
   - Atalho "🕗 480 min (8h) seg-sex" para popular rápido
   - Ao bater ponto, o sistema usa a jornada do dia da semana

## 📜 Mudanças v2 (mantidas)

- Login do colaborador por busca de nome (insensível a caps/acentos)
- Senhas autogerenciadas pelo colaborador (4-8 chars, qualquer caractere)
- Toast de feedback de 7s
- Campo Observações (500 chars) + até 2 anexos por dia (png/jpg/pdf/webp/heic/gif, máx. 5 MB)
- Header redesenhado em 3 colunas (logo · relógio · usuário+config)
- Menu ⚙️ no portal do colab para "Alterar senha" e "Sair"

---

## Como rodar localmente

### Terminal 1 — Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```
Acesse: http://localhost:8080
Docs interativos: http://localhost:8080/docs

### Terminal 2 — Frontend
```bash
cd frontend
npm install
npm run dev
```
Acesse: http://localhost:5173

---

## Acesso administrativo

- **Senha-mestre:** `1989` (sempre aceita, hardcoded)
- **Senha personalizada:** você pode definir em Configurações → "Senha do Administrador"
- As duas funcionam em paralelo — se esquecer a personalizada, o `1989` resolve

## Fluxo de senha do colaborador

**Cenário A — Admin define PIN inicial:**
1. Admin cadastra colab com PIN (4-8 chars) → colab pode entrar direto
2. Colab pode alterar a senha pelo menu ⚙️ no próprio portal

**Cenário B — Admin não define PIN:**
1. Admin cadastra só com o nome
2. No 1º acesso, o colab cria a senha (com confirmação)
3. Login normal nas próximas vezes

Não há mais opção de "resetar senha" pelo admin. Se o colab esquecer a senha, **remova e recadastre**.

## Jornada Semanal — como funciona

- Cada colaborador pode ter **0 a 7 dias personalizados**
- Dias vazios usam o **padrão global** (configurável)
- Dia com **0 min** = folga
- Ao bater ponto, o sistema descobre o dia da semana e aplica a jornada correta
- Se o admin alterar a jornada depois de registros existirem, os registros **antigos não mudam** (a jornada é "fotografada" no momento do bater ponto)

## Edição de horários (admin)

No Relatório Mensal, clique no ⚙️ de qualquer linha:
- Pode alterar Entrada, Saída, Início e Fim do intervalo
- Deixar um campo vazio = limpar (exceto Entrada, que é obrigatória)
- Saldo e HE são recalculados automaticamente

## Onde os dados ficam

- **Banco:** `backend/che.db` (SQLite)
- **Anexos:** `backend/uploads/`
