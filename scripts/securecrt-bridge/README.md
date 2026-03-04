# SecureCRT Local Bridge

Bridge local para receber comandos do front-end e enviar para uma aba logada do SecureCRT.

## Requisitos

- Windows com SecureCRT instalado
- Node.js 18+

## Como iniciar

```bash
npm run securecrt:bridge
```

Por padrao, o bridge sobe em `http://127.0.0.1:48365`.

## Variaveis opcionais

- `SECURECRT_PATH`: caminho completo do `SecureCRT.exe`
- `SECURECRT_BRIDGE_HOST`: host (padrao `127.0.0.1`)
- `SECURECRT_BRIDGE_PORT`: porta (padrao `48365`)

Exemplo PowerShell:

```powershell
$env:SECURECRT_PATH="C:\Program Files\VanDyke Software\SecureCRT\SecureCRT.exe"
npm run securecrt:bridge
```

## Endpoint

- `POST /api/securecrt/execute`

Body JSON:

```json
{
  "commands": "tclsh\nforeach add {\n\"010.000.000.001 source gigabitEthernet0/0/1.1090 repeat 2\"\n} { ping $add }",
  "source": "pingao",
  "delayMs": 80,
  "captureOutput": true,
  "captureWaitMs": 9000
}
```

Observacao: o envio e a captura dependem de existir uma aba conectada e logada no SecureCRT.
