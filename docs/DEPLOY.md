# Guia de Deploy — Ponto_Field na AWS (EC2)

Coloca o sistema no ar com **HTTPS automático**, usando Docker + Caddy. O mesmo
procedimento vale para qualquer servidor Linux (basta ter Docker).

**Tempo estimado:** ~30–45 min. **Você vai precisar de:** conta AWS e um **hostname**
apontando para o servidor. Não tem domínio próprio? Use um **subdomínio grátis do
DuckDNS** (Passo 2) — custo zero e funciona com HTTPS.

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
   │  container api   │   FastAPI + SQLite em /data (volume)
   └─────────────────┘
            │
        deploy/data/  (che.db + uploads, no disco do servidor → backup)
```

Frontend e API ficam **no mesmo domínio** → sem CORS. O Caddy cuida do certificado
TLS sozinho (Let's Encrypt) assim que o domínio apontar para o servidor.

---

## Passo 1 — Criar a instância EC2

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

4. **Aponte o bucket** no `.env` (o `backup.sh` lê essa variável):
   ```
   S3_BUCKET=pontofield-backups-fieldtech
   ```

Pronto — o `backup.sh` passa a sincronizar `deploy/backups/` → `s3://<bucket>/pontofield-backups/`
a cada execução (o cron do Passo 8 já cobre). Teste manual:
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
