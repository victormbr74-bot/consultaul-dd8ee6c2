param(
  [string]$Host = "127.0.0.1",
  [int]$Port = 48365,
  [string]$SecureCrtPath = $env:SECURECRT_PATH
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$TempDir = Join-Path $env:TEMP "lvh-securecrt-bridge"
$ScriptPath = Join-Path $TempDir "send_commands_securecrt.py"

function Resolve-SecureCrtPath {
  param([string]$ProvidedPath)

  $candidates = @()
  if ($ProvidedPath) { $candidates += $ProvidedPath }
  $candidates += "C:\Program Files\VanDyke Software\SecureCRT\SecureCRT.exe"
  $candidates += "C:\Program Files (x86)\VanDyke Software\SecureCRT\SecureCRT.exe"

  foreach ($candidate in $candidates) {
    if (-not $candidate) { continue }
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw "SecureCRT.exe nao encontrado. Defina SECURECRT_PATH com o caminho completo do executavel."
}

function Ensure-BridgeAssets {
  New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

  $secureCrtScript = @'
# $language = "Python3"
# $interface = "1.0"
import os

def _read_text(file_path):
    with open(file_path, "r", errors="ignore") as f:
        return f.read()

def _write_text(file_path, value):
    if not file_path:
        return
    with open(file_path, "w", errors="ignore") as f:
        f.write(value)

def _to_int(raw, fallback, min_value, max_value):
    try:
        value = int(raw)
    except:
        return fallback

    if value < min_value:
        return min_value
    if value > max_value:
        return max_value
    return value

def _to_bool(raw):
    value = str(raw).strip().lower()
    return value in ("1", "true", "yes", "y", "on")

def main():
    if len(crt.Arguments) < 1:
        crt.Dialog.MessageBox("Arquivo de comandos nao informado.")
        return

    command_file = crt.Arguments[0]
    delay_ms = _to_int(crt.Arguments[1], 80, 10, 2000) if len(crt.Arguments) > 1 else 80
    capture_output = _to_bool(crt.Arguments[2]) if len(crt.Arguments) > 2 else False
    capture_wait_ms = _to_int(crt.Arguments[3], 8000, 500, 120000) if len(crt.Arguments) > 3 else 8000
    output_file = crt.Arguments[4] if len(crt.Arguments) > 4 else ""

    if not os.path.exists(command_file):
        message = "Arquivo de comandos nao encontrado: " + command_file
        _write_text(output_file, message)
        crt.Dialog.MessageBox(message)
        return

    tab = crt.GetScriptTab()
    if tab is None or not tab.Session.Connected:
        message = "Nenhuma aba conectada no SecureCRT. Abra uma sessao logada e tente novamente."
        _write_text(output_file, message)
        crt.Dialog.MessageBox(message)
        return

    commands = _read_text(command_file)
    lines = commands.replace("\r\n", "\n").split("\n")
    log_file = command_file + ".capture.log"

    if capture_output:
        try:
            tab.Session.Log(False)
        except:
            pass
        tab.Session.LogFileName = log_file
        tab.Session.Log(True)

    tab.Screen.Synchronous = True
    try:
        for raw in lines:
            line = raw.strip()
            if not line:
                continue
            tab.Screen.Send(line + "\r")
            crt.Sleep(delay_ms)

        if capture_output:
            crt.Sleep(capture_wait_ms)
    finally:
        tab.Screen.Synchronous = False
        if capture_output:
            try:
                tab.Session.Log(False)
            except:
                pass

    if capture_output:
        captured = ""
        if os.path.exists(log_file):
            captured = _read_text(log_file)
        _write_text(output_file, captured)
        try:
            os.remove(log_file)
        except:
            pass

main()
'@

  Set-Content -LiteralPath $ScriptPath -Value $secureCrtScript -Encoding UTF8
}

function Clamp-Int {
  param(
    [double]$Value,
    [int]$Min,
    [int]$Max
  )

  if ([double]::IsNaN($Value) -or [double]::IsInfinity($Value)) { return $Min }
  $rounded = [int][Math]::Round($Value)
  if ($rounded -lt $Min) { return $Min }
  if ($rounded -gt $Max) { return $Max }
  return $rounded
}

function ConvertTo-Bool {
  param($Value)

  if ($Value -is [bool]) { return $Value }
  if ($Value -is [int] -or $Value -is [double]) { return [double]$Value -ne 0 }
  if ($Value -is [string]) {
    $normalized = $Value.Trim().ToLowerInvariant()
    return $normalized -in @("1", "true", "yes", "y", "on")
  }
  return $false
}

function Get-ValueOrDefault {
  param(
    $Value,
    $DefaultValue
  )

  if ($null -eq $Value) { return $DefaultValue }
  return $Value
}

function Read-RequestBody {
  param([System.Net.HttpListenerRequest]$Request)

  $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
}

function Set-CorsHeaders {
  param([System.Net.HttpListenerResponse]$Response)

  $Response.Headers["Access-Control-Allow-Origin"] = "*"
  $Response.Headers["Access-Control-Allow-Headers"] = "Content-Type"
  $Response.Headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
}

function Write-JsonResponse {
  param(
    [System.Net.HttpListenerContext]$Context,
    [int]$StatusCode,
    [hashtable]$Payload
  )

  $response = $Context.Response
  $json = $Payload | ConvertTo-Json -Depth 10 -Compress
  $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)

  $response.StatusCode = $StatusCode
  $response.ContentType = "application/json; charset=utf-8"
  $response.ContentEncoding = [System.Text.Encoding]::UTF8
  $response.ContentLength64 = $buffer.Length
  Set-CorsHeaders -Response $response

  $response.OutputStream.Write($buffer, 0, $buffer.Length)
  $response.OutputStream.Close()
}

function Invoke-SecureCrtExecution {
  param(
    [string]$SecureCrtExe,
    [string]$Commands,
    [int]$DelayMs,
    [bool]$CaptureOutput,
    [int]$CaptureWaitMs
  )

  $commandFile = Join-Path $TempDir ("commands-{0}.txt" -f [Guid]::NewGuid().ToString())
  $outputFile = Join-Path $TempDir ("capture-{0}.txt" -f [Guid]::NewGuid().ToString())

  Set-Content -LiteralPath $commandFile -Value $Commands -Encoding UTF8

  try {
    $args = @(
      "/SCRIPT", $ScriptPath,
      "/ARG", $commandFile,
      "/ARG", $DelayMs.ToString(),
      "/ARG", $(if ($CaptureOutput) { "1" } else { "0" }),
      "/ARG", $CaptureWaitMs.ToString(),
      "/ARG", $outputFile
    )

    $process = Start-Process -FilePath $SecureCrtExe -ArgumentList $args -PassThru -Wait -WindowStyle Hidden
    if ($process.ExitCode -ne 0) {
      throw "SecureCRT retornou codigo $($process.ExitCode)."
    }

    $output = ""
    if ($CaptureOutput -and (Test-Path -LiteralPath $outputFile)) {
      $output = Get-Content -LiteralPath $outputFile -Raw
    }

    return @{ output = $output }
  } finally {
    Remove-Item -LiteralPath $commandFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $outputFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath ($commandFile + ".capture.log") -Force -ErrorAction SilentlyContinue
  }
}

$secureCrtExe = Resolve-SecureCrtPath -ProvidedPath $SecureCrtPath
Ensure-BridgeAssets

$listener = [System.Net.HttpListener]::new()
$prefix = "http://$Host`:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "[securecrt-bridge] listening on $prefix"
Write-Host "[securecrt-bridge] endpoint POST /api/securecrt/execute"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $method = $request.HttpMethod.ToUpperInvariant()
    $path = $request.Url.AbsolutePath

    if ($method -eq "OPTIONS") {
      Set-CorsHeaders -Response $response
      $response.StatusCode = 204
      $response.Close()
      continue
    }

    if ($method -eq "GET" -and $path -eq "/health") {
      Write-JsonResponse -Context $context -StatusCode 200 -Payload @{
        ok = $true
        message = "SecureCRT bridge online."
      }
      continue
    }

    if ($method -eq "POST" -and $path -eq "/api/securecrt/execute") {
      try {
        $rawBody = Read-RequestBody -Request $request
        if ([string]::IsNullOrWhiteSpace($rawBody)) {
          Write-JsonResponse -Context $context -StatusCode 400 -Payload @{
            ok = $false
            message = "JSON invalido."
          }
          continue
        }

        $payload = $rawBody | ConvertFrom-Json -ErrorAction Stop
        $commands = [string]$payload.commands
        if ([string]::IsNullOrWhiteSpace($commands)) {
          Write-JsonResponse -Context $context -StatusCode 400 -Payload @{
            ok = $false
            message = "Campo commands obrigatorio."
          }
          continue
        }

        $captureOutput = ConvertTo-Bool -Value $payload.captureOutput
        $delayMsRaw = Get-ValueOrDefault -Value $payload.delayMs -DefaultValue 80
        $captureWaitRaw = Get-ValueOrDefault -Value $payload.captureWaitMs -DefaultValue 8000
        $delayMs = Clamp-Int -Value ([double]$delayMsRaw) -Min 10 -Max 2000
        $captureWaitMs = Clamp-Int -Value ([double]$captureWaitRaw) -Min 500 -Max 120000

        $execution = Invoke-SecureCrtExecution `
          -SecureCrtExe $secureCrtExe `
          -Commands $commands `
          -DelayMs $delayMs `
          -CaptureOutput $captureOutput `
          -CaptureWaitMs $captureWaitMs

        Write-JsonResponse -Context $context -StatusCode 200 -Payload @{
          ok = $true
          message = if ($captureOutput) {
            "Comandos executados no SecureCRT e saida capturada."
          } else {
            "Comandos enviados ao SecureCRT."
          }
          output = [string]$execution.output
        }
      } catch {
        Write-JsonResponse -Context $context -StatusCode 500 -Payload @{
          ok = $false
          message = [string]$_.Exception.Message
        }
      }
      continue
    }

    Write-JsonResponse -Context $context -StatusCode 404 -Payload @{
      ok = $false
      message = "Rota nao encontrada."
    }
  }
} finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
