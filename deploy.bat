@echo off
setlocal

REM ============================================================
REM  Deploy do Ponto_Field para a EC2 (rode na sua maquina Windows).
REM  EDITE as duas variaveis abaixo com a sua chave .pem e o host.
REM ============================================================
set "KEY=C:\caminho\sua-chave.pem"
set "HOST=ubuntu@15.229.92.98"
REM ============================================================

set "REPO=%~dp0"
set "BUNDLE=%REPO%pontofield-deploy.tar.gz"

if not exist "%KEY%" (
  echo ERRO: chave nao encontrada em "%KEY%". Edite a variavel KEY no topo do arquivo.
  exit /b 1
)

echo.
echo === 1/4  Gerando bundle atual (git archive) ===
pushd "%REPO%"
git archive --format=tar.gz -o "%BUNDLE%" HEAD || goto :err
popd

echo.
echo === 2/4  Enviando bundle para o servidor ===
scp -i "%KEY%" "%BUNDLE%" %HOST%:pontofield-deploy.tar.gz || goto :err

echo.
echo === 3/4  Extraindo e instalando o Docker no servidor ===
ssh -i "%KEY%" %HOST% "mkdir -p ~/ponto-field && tar -xzf ~/pontofield-deploy.tar.gz -C ~/ponto-field && chmod +x ~/ponto-field/deploy/*.sh && ~/ponto-field/deploy/setup-server.sh" || goto :err

echo.
echo === 4/4  Proximo passo (manual - envolve segredos) ===
echo   Conecte no servidor e configure o .env (uma vez):
echo       ssh -i "%KEY%" %HOST%
echo       cd ~/ponto-field/deploy ^&^& cp -n .env.example .env ^&^& nano .env
echo   Depois suba:
echo       ./update.sh          ( ou: docker compose up -d --build )
echo.
echo   Nas PROXIMAS atualizacoes, basta rodar este deploy.bat de novo
echo   e, no servidor, rodar ./update.sh (os dados sao preservados).
echo.
echo Concluido.
goto :fim

:err
echo.
echo ERRO durante o deploy. Verifique a mensagem acima.
exit /b 1

:fim
endlocal
