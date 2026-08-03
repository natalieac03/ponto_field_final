<div align="center">

# ⏱️ Ponto Field

**Sistema de controle de ponto e banco de horas**

Bater ponto pelo celular · Espelho do colaborador · Aprovação de lançamentos · Banco de horas com regras CLT · Relatórios prontos para assinatura

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)

</div>

---

## 📌 O que é

Sistema web de ponto eletrônico pensado para **equipes de campo**: o técnico bate o ponto pelo
celular em 4 toques, o gestor acompanha o banco de horas em tempo real e fecha o mês com um
relatório pronto para imprimir e assinar.

Nada de planilha manual nem conta de padeiro no fim do mês — as regras de jornada
(44h semanais, escala de sábado, feriados, adicional noturno, horas extras) são aplicadas
automaticamente. E **todo cálculo é feito na exibição**: nenhum dado histórico é reescrito
quando uma regra muda, então ajustes valem retroativamente sem risco de corromper o passado.

---

## ✨ Funcionalidades

### Para o colaborador

| | |
|---|---|
| 🕐 **Bater ponto** | Entrada → Início do intervalo → Fim do intervalo → Saída, com relógio ao vivo |
| 📝 **Observações e anexos** | Justificativa escrita + arquivos (foto do atestado, comprovante…) |
| 📊 **Meu Espelho** | Saldo acumulado, KPIs do mês, gráfico por semana e detalhe dia a dia |
| ⏳ **Lançamento retroativo** | Esqueceu de bater? Lança o dia e o gestor aprova |
| 🔐 **Senha própria** | Definida pelo colaborador no 1º acesso |

### Para o gestor

| | |
|---|---|
| 🏦 **Banco de horas** | Saldo consolidado por colaborador, fechando mês a mês |
| ✅ **Fila de aprovações** | Lançamentos, edições e exclusões pendentes num só lugar |
| 📅 **Calendário editável** | Feriados nacionais + Goiás + Goiânia em um clique; eventos manuais com dispensa parcial |
| 📄 **Relatórios** | XLSX, CSV e **PDF executivo** com dashboard, espelho individual e linhas de assinatura |
| 👥 **Perfil de RH** | Cargo, setor, matrícula, admissão, contrato, contato, CPF e foto |
| 🔍 **Trilha de auditoria** | Quem alterou o quê e quando — nome registrado em cada mudança |
| ⭐ **Delegação de acesso** | Promova um colaborador a administrador com um clique |

---

## 🧮 Como o cálculo funciona

O motor classifica cada dia e compara o trabalhado com a referência esperada:

| Tipo | Quando | Referência padrão |
|:---:|---|:---:|
| **H1** | Segunda a sexta | 8h00 |
| **H2** | Sábado (escala) | 4h00 |
| **H3** | Domingo e feriados | 0h00 |

> **Total: 44 horas semanais.** Os valores de H1 e H2 são configuráveis, e cada colaborador
> pode ter jornada personalizada por dia da semana (meio período, folga fixa etc.), que tem
> prioridade sobre o padrão.

Além do saldo simples, o sistema apura automaticamente:

- ⚡ **Hora extra 50%** — excedente em dia útil ou sábado
- 🔥 **Hora extra 100%** — trabalho em domingo ou feriado
- 🌙 **Adicional noturno** — 22h às 05h, com acréscimo de 20% (trata virada de meia-noite)
- 🏖️ **Abonos** — atestado, viagem, folga, falta e abono geral, cada um com efeito próprio no saldo
- ⚠️ **Alerta de jornada excessiva** — sinaliza dias acima de 10h

### Calendário que muda o cálculo

Feriado marcado como **dia inteiro** zera a referência daquele dia (vira H3). Um evento com
**dispensa parcial** — jogo do Brasil, dedetização, treinamento — abate só as horas informadas:

```
Quarta-feira comum ................ referência 8h00
Quarta com jogo do Brasil (−3h) ... referência 5h00
```

Feriado que cai em fim de semana não abate nada (a referência já era zero).

---

## 🔒 Segurança

- **Senhas em bcrypt**, com _rehash_ transparente de hashes legados no login
- **Tokens de sessão assinados** (HMAC-SHA256) com expiração configurável (padrão 12h)
- **Rate limiting** nas rotas de autenticação
- **CPF mascarado** — guardado completo, exibido sempre como `123.***.**4-56`, inclusive nos relatórios
- Validação da assinatura real dos arquivos enviados (evita executável renomeado para `.png`)
- Cabeçalhos de segurança em toda resposta (`X-Frame-Options`, `nosniff`, HSTS em produção)
- Segredos obrigatórios em produção — a aplicação se recusa a subir sem eles

---

## 🏗️ Arquitetura

Backend em **Clean Architecture**: a regra de negócio não conhece o banco nem o framework.

```
backend/app/
├── domain/              # Regras puras — cálculo, classificação de dias, banco de horas
│   ├── accounting.py    #   H1/H2/H3, extras, adicional noturno, abonos
│   ├── banking.py       #   consolidação por período
│   └── models.py        #   entidades
├── application/         # Casos de uso — orquestram o domínio
│   ├── records.py       #   bater ponto, aprovar, corrigir
│   ├── reports.py       #   relatórios e espelhos
│   └── calendar.py      #   feriados e eventos
├── infrastructure/      # Banco, storage, segurança, exportação
└── presentation/        # Rotas HTTP (FastAPI)
```

Frontend organizado por **feature**, não por tipo de arquivo:

```
frontend/src/
├── features/
│   ├── espelho/         # Meu Espelho do colaborador
│   ├── approvals/       # Fila de aprovações
│   ├── records/         # Edição de registros
│   ├── activity/        # Trilha de auditoria
│   └── reports/pdf/     # Geração do PDF executivo
├── pages/               # Telas principais
└── components/          # UI compartilhada
```

---

## 🚀 Rodando localmente

**Pré-requisitos:** Python 3.11+ e Node.js 20+

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend (em outro terminal)

```bash
cd frontend
npm install
npm run dev
```

Acesse **http://localhost:5173** — a documentação interativa da API fica em
**http://localhost:8000/docs**.

> Senha do painel do gestor em desenvolvimento: `1989`

---

## ⚙️ Configuração

Variáveis do `backend/.env`:

| Variável | Descrição | Padrão |
|---|---|---|
| `APP_ENV` | `development` ou `production` | `development` |
| `AUTH_SECRET` | Segredo de assinatura dos tokens — **obrigatório em produção** | — |
| `MASTER_ADMIN_PASSWORD` | Senha-mestra do gestor (bootstrap/recuperação) | `1989` em dev |
| `AUTH_TTL_SECONDS` | Validade do token de sessão | `43200` (12h) |
| `DATABASE_URL` | SQLite ou PostgreSQL | `sqlite:///./che.db` |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula | `http://localhost:5173` |
| `UPLOAD_DIR` | Pasta dos anexos | `./uploads` |

Gere um segredo forte com:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

### PostgreSQL / Neon

Basta apontar o `DATABASE_URL` — o schema é criado e migrado automaticamente no startup:

```env
DATABASE_URL=postgresql://usuario:senha@host.neon.tech/neondb?sslmode=require
```

---

## 🎨 Personalização visual

Os ícones e o logo ficam em `frontend/imagens/`. Cada arquivo tem uma variante para o
**tema claro**, seguindo a convenção `nome_claro.png`:

| Tema escuro | Tema claro |
|---|---|
| `logo.png` | `logo_claro.png` |
| `clockin.png` | `clockin_claro.png` |
| `ICON_ADM.png` | `ICON_ADM_claro.png` |

A troca é automática conforme o tema ativo — basta substituir os arquivos, sem tocar no código.

---

## 📦 Deploy

O projeto acompanha infraestrutura pronta em `deploy/`:

- **Docker Compose** com backend, frontend e **Caddy** (HTTPS automático via Let's Encrypt)
- Scripts de `backup`, `restore`, `update` e `reset-db`
- Backup off-site opcional para S3

Guia completo em [`docs/DEPLOY.md`](docs/DEPLOY.md).

Também roda em plataformas gerenciadas (Railway, Render, Fly.io). Nesse caso, o comando
de start do backend é:

```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

---

## 🗺️ Roadmap

- [ ] Testes automatizados do domínio (a arquitetura já está preparada)
- [ ] Exportação do AFD (Portaria 671) para fiscalização
- [ ] Notificação de ponto não batido
- [ ] Feriados carregados por ano via API (hoje: biblioteca + calendário editável)

---

<div align="center">

**Software proprietário — FieldTechnology.** Uso interno.

</div>
