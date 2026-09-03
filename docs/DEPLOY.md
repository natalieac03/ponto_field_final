# Guia de Deploy — Ponto_Field em um VPS Linux (Hostinger, AWS EC2 ou outro)

> **Produção atual roda no Railway** (serviços "back" e "front"), com domínio próprio
> `ponto.fieldtec.agr.br` e banco **PostgreSQL no Neon** (`sa-east-1`) — não em VPS.
> Este guia documenta a **alternativa self-hosted**: útil como referência futura caso
> seja necessário sair de plataformas gerenciadas, mas não é o plano em andamento. Para
> ajustes de performance na configuração atual (Railway + Neon), veja
> [Ajustes de performance no Railway (produção atual)](#ajustes-de-performance-no-railway-produção-atual)
> ao final deste documento.

Coloca o sistema no ar com **HTTPS automático**, usando Docker + Caddy. O mesmo
procedimento vale para qualquer servidor Linux com Docker — os passos abaixo usam a
AWS EC2 como exemplo, mas o comando final (`docker compose up -d --build`) e a
estrutura de pastas são idênticos numa **VPS da Hostinger**. As diferenças estão
só na hora de criar a máquina (Passo 1) — o resto (Passos 2 em diante) é igual.

**Tempo estimado:** ~30–45 min. **Você vai precisar de:** uma VPS (AWS EC2, Hostinger
ou similar) e um **hostname** apontando para o servidor. Não tem domínio próprio? Use
um **subdomínio grátis do DuckDNS** (Passo 2) — custo zero e funciona com HTTPS.

---

## Visão geral

```
   Navegador (técnico/gestor)
            │  HTTPS
            ▼
   ┌─────────────────┐   Caddy (porta 80/443)
   │  container web   │   ├── /        → SPA React (estáticos)
   │  (Caddy)         │   └── /api/*   → proxy → container api
   └────────┬─────────┘
            │ rede interna do Docker
            ▼
   ┌─────────────────┐   uvicorn (porta 8000, interna)
   │  container api   │   FastAPI + SQLite em /data (volume) — banco deste cenário self-hosted
   └─────────────────┘
            │
        deploy/data/  (che.db + uploads, no disco do servidor → backup)
```

> Este diagrama descreve o cenário **self-hosted** (SQLite em volume local). A produção
> atual no Railway usa PostgreSQL externo (Neon) em vez de SQLite — ver nota no topo do
> documento.

Frontend e API ficam **no mesmo domínio** → sem CORS. O Caddy cuida do certificado
TLS sozinho (Let's Encrypt) assim que o domínio apontar para o servidor.

---

## Passo 1 — Criar o servidor (AWS EC2 — veja a alternativa Hostinger logo abaixo)

1. Console AWS → **EC2** → **Launch instance**.
2. **Nome:** `ponto-field`.
3. **AMI:** Ubuntu Server 24.04 LTS (x86_64).
4. **Tipo:** `t3.small` (2 GB RAM) é suficiente para começar. `t3.micro` (1 GB)
   funciona, mas o build das imagens pode ficar apertado — se usar micro, veja a
   nota de _swap_ no fim.
5. **Key pair:** crie/selecione um par de chaves (você usa para SSH). Baixe o `.pem`.
6. **Disco:** 20 GB gp3.
7. **Security group** — libere as portas:
   | Tipo  | Porta | Origem       | Para quê |
   |-------|-------|--------------|----------|
   | SSH   | 22    | **seu IP**   | administração |
   | HTTP  | 80    | 0.0.0.0/0    | Let's Encrypt + redirect |
   | HTTPS | 443   | 0.0.0.0/0    | acesso ao sistema |
8. **Launch instance.**

### Elastic IP (recomendado)
Para o IP não mudar a cada restart: EC2 → **Elastic IPs** → **Allocate** → **Associate**
à instância. Use esse IP no DNS.

### Alternativa — VPS da Hostinger

1. Painel Hostinger → **VPS** → contratar um plano **KVM** (não a hospedagem
   compartilhada/cPanel — essa não dá acesso root nem roda Docker).
   - **KVM 2** (2 vCPU / 8 GB RAM / 100 GB NVMe) é uma escolha folgada para este
     sistema (uso interno, poucos colaboradores) — sobra margem pra fazer o build
     das duas imagens (api + web) sem gargalo.
   - **KVM 1** (1 vCPU / 4 GB RAM) também roda o sistema no dia a dia, mas pode
     ficar apertado durante o `docker compose up -d --build` (compila o frontend).
     Se escolher KVM 1, ative um pouco de *swap* (mesma nota do t3.micro abaixo).
2. Ao criar a VPS, escolha o template **Ubuntu 24.04 LTS**. O painel já te dá o
   **IP público** e a **senha root** (ou permite subir sua chave SSH).
3. Não precisa de Elastic IP — na Hostinger o IP da VPS já é fixo por padrão.
4. Firewall: no painel da Hostinger (aba *Firewall* da VPS) ou via `ufw` no
   servidor, libere as mesmas 3 portas da tabela acima (22, 80, 443).
5. Conecte com `ssh root@<IP_DA_VPS>` (ou `ssh ubuntu@<IP>` se criou um usuário
   próprio) e siga a partir do **Passo 2** normalmente.

---

## Passo 2 — Definir o hostname (DNS)

O HTTPS (Let's Encrypt) precisa de um **nome**, não basta o IP. O DNS público da EC2
(`ec2-...amazonaws.com`) **não serve** — o Let's Encrypt recusa emitir certificado para
domínios da AWS. Escolha uma das opções:

### Opção A — Subdomínio grátis (DuckDNS) — recomendado para começar

1. Acesse **https://www.duckdns.org** e entre (login com Google/GitHub).
2. Em **domains**, crie um subdomínio — ex.: `pontofieldtech` → vira `pontofieldtech.duckdns.org`.
3. No campo **current ip** desse subdomínio, coloque o **Elastic IP** da EC2 e clique **update ip**.
   Confirmação esperada:
   ```
   success: ip address for pontofieldtech.duckdns.org updated to 15.229.92.98
   ```

Pronto — sem registrador e sem custo. Confira a resolução:
```bash
nslookup pontofieldtech.duckdns.org      # deve devolver o IP da EC2
```

### Opção B — Domínio próprio (ex.: ponto.fieldtechnology.com.br)

No painel do domínio (Registro.br, Route 53, Cloudflare...), crie um registro **A**
apontando o subdomínio para o **Elastic IP** da EC2:
```
ponto.fieldtechnology.com.br   A   <IP_ELASTICO_DA_EC2>
```

> Em qualquer opção, o HTTPS só é emitido depois que o nome **já resolve** para o IP do
> servidor **e** as portas 80/443 estão abertas. Trocar de A→B depois é só ajustar o
> `DOMAIN` no `.env` e re-subir (`docker compose up -d`).

---

## Passo 3 — Conectar e instalar o Docker

Do seu computador:
```bash
chmod 400 sua-chave.pem
ssh -i sua-chave.pem ubuntu@<IP_ELASTICO_DA_EC2>
```

No servidor, instale Docker + plugin compose. **Atalho:** depois de extrair o bundle
(Passo 4), rode `~/ponto-field/deploy/setup-server.sh` — faz tudo abaixo de forma
idempotente. Manualmente:
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu          # usar docker sem sudo
newgrp docker                            # aplica o grupo na sessão atual
docker --version && docker compose version
```

---

## Passo 4 — Colocar o código no servidor

**Opção A — bundle (.tar.gz):** envie o pacote do seu PC e extraia:
```bash
# no seu PC:
scp -i sua-chave.pem pontofield-deploy.tar.gz ubuntu@<IP>:~
# no servidor:
mkdir -p ~/ponto-field && tar -xzf ~/pontofield-deploy.tar.gz -C ~/ponto-field
cd ~/ponto-field
```

**Opção B — GitHub (repo privado):**
```bash
git clone https://github.com/<sua-org>/ponto-field.git ~/ponto-field
cd ~/ponto-field
```

---

## Migrando do Railway (produção atual) para este servidor

> Só é necessário se um dia a decisão for sair do Railway. Hoje a produção fica lá —
> ver nota no topo do documento.

Se o sistema já está no ar no Railway com dados reais, faça **isto antes do Passo 6**
(subir a stack) — senão o servidor novo nasce com banco vazio. O domínio já pode
apontar para o servidor novo desde já (o DNS do Passo 2 é o mesmo; o Railway continua
respondendo pelo endereço `*.up.railway.app` dele enquanto isso).

A produção atual usa **PostgreSQL no Neon**, não SQLite — o caminho abaixo já assume isso.

### 1. Baixe o banco com `pg_dump`
Pegue a `DATABASE_URL` nas variáveis do serviço "back" no Railway (ou direto no painel
do Neon) e rode do seu computador:
```bash
pg_dump "postgresql://usuario:senha@host.neon.tech/neondb?sslmode=require" -Fc -f che_prod.dump
```

### 2. Converta para SQLite no servidor novo
Este servidor self-hosted usa SQLite por padrão (`deploy/docker-entrypoint.sh` e o
`docker-compose.yml` apontam para `/data/che.db`). Para trazer os dados do Postgres para
SQLite, use uma ferramenta de conversão (ex.: [`pgloader`](https://pgloader.io/) no sentido
inverso não se aplica; o caminho mais direto é `pgsql2sqlite` ou exportar tabela a tabela
com `psql \copy` + `sqlite3 .import`). Alternativamente — **e mais simples** — troque o
`DATABASE_URL` deste servidor para apontar direto ao mesmo Postgres do Neon (ver
`### PostgreSQL / Neon` no [README](../README.md)), eliminando a conversão de esquema por
completo; o self-host então usa Docker + Caddy só para servir a aplicação, mantendo o Neon
como banco.

> Instale o Railway CLI (`npm i -g @railway/cli`, depois `railway login` e `railway link`)
> se preferir inspecionar variáveis e logs do serviço via `railway` em vez do painel web.

### 3. Baixe os anexos/fotos
**Se o Railway está com `S3_BUCKET` configurado (Railway Storage / R2 / MinIO):**
os arquivos já estão num bucket S3-compatível, independente do container — a forma
mais simples é **apontar o `.env` do servidor novo para o mesmo bucket** (copie
`S3_ENDPOINT_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` do
Railway para o `.env` novo) e pronto — nada para baixar. Só fique atento: se algum
dia você deletar o projeto no Railway, confirme antes que isso não apaga o bucket
junto (buckets do Railway Storage costumam morrer com o projeto — nesse caso, migre
os arquivos para um bucket separado, ex. Cloudflare R2, antes de desligar o Railway).

**Se os anexos estão no disco local do container** (sem `S3_*` configurado):
```bash
railway ssh -- "tar -czf - -C /data uploads" > uploads.tar.gz
```

### 4. Coloque os arquivos no servidor novo
```bash
scp che.db uploads.tar.gz root@<IP_DO_SERVIDOR>:~/ponto-field/deploy/
# no servidor:
mkdir -p ~/ponto-field/deploy/data
mv ~/ponto-field/deploy/che.db ~/ponto-field/deploy/data/che.db
tar -xzf ~/ponto-field/deploy/uploads.tar.gz -C ~/ponto-field/deploy/data/
rm ~/ponto-field/deploy/uploads.tar.gz
```
(Pule a parte de `uploads.tar.gz` se você optou por manter o bucket S3 no passo 3.)

### 5. Depois de subir (Passo 6) e conferir que está tudo certo
- Confira no site novo que os colaboradores, o histórico de ponto e as fotos batem
  com o Railway.
- **Não delete o projeto no Railway ainda.** Deixe alguns dias como fallback —
  se algo estiver errado no servidor novo, você volta a apontar o DNS pra lá.
- Só depois de confirmar que o servidor novo está estável (e com o backup do
  Passo 8 já rodando), cancele/pause o serviço no Railway.

---

## Passo 5 — Configurar as variáveis (.env)

```bash
cd ~/ponto-field/deploy
cp .env.example .env
nano .env
```

Preencha:
- `DOMAIN` = o hostname do Passo 2 (ex.: `pontofieldtech.duckdns.org`).
- `TLS_EMAIL` = e-mail de TI (avisos do Let's Encrypt).
- `AUTH_SECRET` = gere um valor forte:
  ```bash
  docker run --rm python:3.12-slim python -c "import secrets;print(secrets.token_urlsafe(48))"
  ```
- `MASTER_ADMIN_PASSWORD` = senha admin inicial **forte** (guarde no gerenciador de senhas).
- `CORS_ORIGINS` = `https://<seu-domínio>`.

Salve (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## Passo 6 — Subir

```bash
cd ~/ponto-field/deploy
docker compose up -d --build
```

O primeiro build baixa as imagens e compila o frontend (alguns minutos). Depois:
```bash
docker compose ps                 # api e web devem estar "running"
docker compose logs -f web        # acompanha o Caddy emitir o certificado (Ctrl+C p/ sair)
```
Procure no log do `web` por algo como `certificate obtained successfully`.

---

## Passo 7 — Verificar

```bash
curl -I https://<seu-domínio>            # deve responder 200 e cabeçalhos de segurança
```
No navegador, abra `https://<seu-domínio>`:
- cadeado de HTTPS válido;
- tela inicial (Colaborador / Administrador);
- entre como **Administrador** com a `MASTER_ADMIN_PASSWORD` → painel carrega.

✅ No ar. Troque a senha admin pela pessoal em **Configurações** quando quiser.

---

## Passo 8 — Backup automático (importante!)

O banco (`che.db`) e as fotos ficam em `deploy/data/`. Agende o backup diário:

```bash
chmod +x ~/ponto-field/deploy/backup.sh
crontab -e
```
Adicione (backup todo dia às 02:00):
```
0 2 * * * cd /home/ubuntu/ponto-field/deploy && ./backup.sh >> backup.log 2>&1
```
Backups ficam em `deploy/backups/` (retenção 30 dias).

### Passo 8.1 — Cópia off-site no S3 (recomendado)

Backup no mesmo servidor não protege contra perda da instância. Para mandar uma cópia
ao S3 automaticamente:

1. **Crie um bucket** privado — ex.: `pontofield-backups-fieldtech`. (Opcional: ative
   versionamento e uma regra de ciclo de vida para expirar objetos antigos, ex.: 90 dias.)

2. **Dê permissão à EC2 via IAM Role** (mais seguro que access key):
   IAM → Roles → Create role → *AWS service: EC2* → anexe uma policy mínima:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
         "Resource": [
           "arn:aws:s3:::pontofield-backups-fieldtech",
           "arn:aws:s3:::pontofield-backups-fieldtech/*"
         ] }
     ]
   }
   ```
   Depois: EC2 → sua instância → *Actions → Security → Modify IAM role* → selecione a role.

3. **Instale o AWS CLI** no servidor:
   ```bash
   sudo apt-get install -y unzip
   curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
   unzip -q awscliv2.zip && sudo ./aws/install && rm -rf aws awscliv2.zip
   aws sts get-caller-identity      # confirma que a role está ativa
   ```

4. **Aponte o bucket e defina a senha de cifra** no `.env` (o `backup.sh` lê essas variáveis):
   ```
   S3_BUCKET=pontofield-backups-fieldtech
   BACKUP_PASSPHRASE=<gere com: python -c "import secrets;print(secrets.token_urlsafe(32))">
   ```
   O banco guarda CPF em texto puro (a máscara é só na exibição/relatórios), então o
   `backup.sh` cifra (`openssl aes-256-cbc`) o `.db.gz`/`.tar.gz` antes de enviar ao S3 —
   sem `BACKUP_PASSPHRASE`, o script se recusa a mandar o backup pra fora do servidor.
   Guarde essa senha em um cofre separado (ex.: gerenciador de senhas da equipe): sem ela,
   o backup no S3 é irrecuperável.

Pronto — o `backup.sh` passa a sincronizar `deploy/backups/` (cifrado) → `s3://<bucket>/pontofield-backups/`
a cada execução (o cron do Passo 8 já cobre). Para restaurar um backup baixado do S3, use
`./restore.sh caminho/che_AAAAMMDD_HHMMSS.db.gz.enc` — o `restore.sh` decifra automaticamente
usando `BACKUP_PASSPHRASE` do `.env`. Teste manual:
```bash
cd ~/ponto-field/deploy && ./backup.sh
aws s3 ls s3://pontofield-backups-fieldtech/pontofield-backups/
```

### Restaurar um backup
```bash
cd ~/ponto-field/deploy
./restore.sh backups/che_AAAAMMDD_HHMMSS.db.gz
```

---

## Atualizar o sistema (nova versão)

Use o script — ele faz **backup automático**, atualiza e rebuilda **sem perder dados**
(o volume `./data` permanece):
```bash
# 1) leve a nova versão pro servidor:
#    - por bundle: reenvie o .tar.gz e extraia por cima de ~/ponto-field
#    - por git:    o próprio update.sh dá 'git pull'
cd ~/ponto-field/deploy
./update.sh
```
As migrações leves de coluna do banco rodam sozinhas na subida (`_ensure_columns`).

### Começar com o banco limpo (antes do go-live)

Um deploy novo já sobe **sem banco** (o pacote não inclui `che.db` — o app cria um vazio
no 1º boot). Se você testou no servidor e quer zerar antes de liberar de verdade:
```bash
cd ~/ponto-field/deploy
./reset-db.sh          # faz backup, apaga banco + uploads e recria vazio (pede confirmação)
```

---

## Automação a partir do Windows (deploy.bat)

Na raiz do projeto há um **`deploy.bat`** que faz o ciclo inteiro da sua máquina:
gera o bundle, envia por `scp`, extrai no servidor e roda o `setup-server.sh`.

1. Abra o `deploy.bat` e edite as duas linhas do topo:
   ```bat
   set "KEY=C:\caminho\sua-chave.pem"
   set "HOST=ubuntu@15.229.92.98"
   ```
2. Dê um duplo-clique (ou rode no `cmd`). Ao final, ele te instrui a configurar o
   `.env` (uma vez) e subir com `./update.sh`.
3. Nas próximas versões, é só rodar o `deploy.bat` de novo e, no servidor, `./update.sh`.

> Requisitos na sua máquina: `git`, `ssh` e `scp` (o Windows 10/11 já traz o OpenSSH).

---

## Solução de problemas

| Sintoma | Causa provável / o que fazer |
|---------|------------------------------|
| Certificado não emite | DNS ainda não aponta para o IP, ou porta 80/443 fechada no Security Group. Confira `nslookup` e o log `docker compose logs web`. |
| `api` reiniciando | Provavelmente `AUTH_SECRET` vazio (fail-fast em produção). Preencha no `.env` e `docker compose up -d`. |
| 502 no navegador | Container `api` não subiu. `docker compose logs api`. |
| Esqueci a senha admin | Defina `MASTER_ADMIN_PASSWORD` no `.env` e `docker compose up -d api`. |
| Build sem memória (t3.micro) | Crie swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`. |
| AFD/relatório sai com dados de empresa certos mas **zero registros** (ou vice-versa), só em dev local | Sintoma de **dois `che.db` diferentes** sendo lidos. Em produção (Docker) o `DATABASE_URL` já é absoluto (`/data/che.db` dentro do container) — isso não acontece. Mas em desenvolvimento local, se o `backend/.env` usa caminho **relativo** (`sqlite:///./che.db`), o arquivo aberto depende de qual diretório o processo foi iniciado, e pode acabar lendo um `che.db` diferente do que você espera. Use caminho absoluto no `.env` local, ex.: `DATABASE_URL=sqlite:///C:/caminho/completo/backend/che.db` (Windows) ou `sqlite:////caminho/completo/backend/che.db` (Linux/macOS). |

### Comandos úteis
```bash
docker compose ps                 # status
docker compose logs -f api        # logs da API
docker compose restart api        # reinicia só a API
docker compose down               # derruba (dados em deploy/data/ permanecem)
```

---

## Rede interna / sem domínio (alternativa)

Para testar sem domínio público (ex.: só na LAN por IP), no `.env` use `DOMAIN=:80`
(HTTP puro, sem TLS) e acesse por `http://<ip-do-servidor>`. Para produção real, use
sempre um domínio com HTTPS.

---

## Ajustes de performance no Railway (produção atual)

Topologia real da produção: dois serviços no Railway — **"back"** (FastAPI, builder
Railpack — **não** usa `deploy/backend.Dockerfile`, que é só para o self-host acima) e
**"front"** (estáticos), domínio próprio `ponto.fieldtec.agr.br`, banco **PostgreSQL no
Neon** (`sa-east-1`, São Paulo) — externo ao Railway.

### O que já foi feito
- **Compressão de resposta:** `GZipMiddleware` adicionado em `backend/app/main.py` —
  reduz o tamanho de payloads JSON grandes e exports (relatórios, listagens).
- **Região do serviço:** ajustada no Railway para minimizar distância até o Neon
  (`sa-east-1`); o Railway não oferece uma região exatamente em São Paulo, então alguma
  latência residual é esperada mesmo na melhor opção disponível.

### Recursos órfãos identificados (seguros para remover)
Os volumes **`postgres-volume`** e **`redis-volume`** no painel do Railway são discos
persistentes desconectados (aba Settings de cada um mostra "Connect to Service — Mount
to Service", ou seja, nunca foram montados) — **não** são bancos rodando; o app não usa
Redis (não há dependência `redis` no `backend/requirements.txt`) nem o Postgres do
Railway (a `DATABASE_URL` real aponta para o Neon). Podem ser deletados sem impacto.

### Decidido
- **Cold start do Neon (autosuspend):** desativar autosuspend ("Always Active") exige
  plano pago do Neon — decisão foi **permanecer no plano free** e mitigar em vez de
  eliminar. Compute do projeto elevado para **2 vCPU** (máximo do free tier), o que reduz
  o efeito do cold start (compute mais rápido ao "acordar") mesmo sem eliminá-lo por
  completo. A primeira query após um período de inatividade ainda paga o custo de
  reconexão — se a lentidão intermitente persistir, revisitar a opção de migrar para um
  Postgres realmente hospedado no Railway (hoje o `postgres-volume` não é isso — seria
  preciso adicionar o plugin/serviço Postgres do Railway de fato) ou reavaliar o plano
  pago do Neon.
- **Credenciais do Neon rotacionadas:** a senha que havia sido exposta em texto puro foi
  trocada — o banco de produção agora vive em uma conta/projeto Neon novo, com senha
  diferente. A `DATABASE_URL` no Railway já foi atualizada de acordo.

### Pendente / a avaliar
- **Múltiplos workers do uvicorn:** o Custom Start Command do serviço "back" no Railway
  hoje não usa `--workers` (single worker). Aumentar (ex.: `--workers 4`) melhora
  throughput sob carga concorrente, mas exige atenção a dois pontos:
  - o rate limiter de login (`backend/app/infrastructure/ratelimit.py`) é **em memória**
    e não é compartilhado entre processos — com N workers, o limite efetivo de tentativas
    de login sobe por um fator de até N;
  - com mais workers, cada um abre seu próprio pool de conexões SQLAlchemy — considerar
    trocar para o endpoint **pooled** do Neon (hostname com sufixo `-pooler`, backed por
    PgBouncer) para não esbarrar no limite de conexões do Neon.
- Guia oficial [Neon + Railway](https://neon.com/docs/guides/railway) cobre apenas a
  configuração básica da variável `DATABASE_URL` — não traz orientação sobre pooling,
  região ou autosuspend além do que já está descrito aqui.
