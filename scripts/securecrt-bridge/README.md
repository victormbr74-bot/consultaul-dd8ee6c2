# SecureCRT Local Bridge (PowerShell)

Bridge local para receber comandos do front-end e enviar para uma aba logada do SecureCRT, sem Node.js.

## Requisitos

- Windows com SecureCRT instalado
- PowerShell 5.1+ (ou PowerShell 7+)

## Como iniciar (sem Node)

No diret�rio do projeto, execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\securecrt-bridge\securecrt-bridge.ps1
```

Por padrao, o bridge sobe em `http://127.0.0.1:48365`.

## Variaveis opcionais

- `SECURECRT_PATH`: caminho completo do `SecureCRT.exe`
- `SECURECRT_BRIDGE_HOST`: host (padrao `127.0.0.1`) 
- `SECURECRT_BRIDGE_PORT`: porta (padrao `48365`)

Exemplo PowerShell:

```powershell
$env:SECURECRT_PATH = "C:\Users\Manoel\Desktop\SecureCRT\SecureCRT.exe"
powershell -ExecutionPolicy Bypass -File .\scripts\securecrt-bridge\securecrt-bridge.ps1
```

## Endpoint

- `POST /api/securecrt/execute`

Body JSON:

```json
{
  "commands": "tclsh\nforeach add {\n\"010.000.000.001 source gigabitEthernet0/0/1.1090 repeat 2\"\n} { ping $add }",
  "source": "pingao",
  "delayMs": 100,
  "captureOutput": true,
  "captureWaitMs": 9000
}
```

Observacao: o envio e a captura dependem de existir uma aba conectada e logada no SecureCRT.
