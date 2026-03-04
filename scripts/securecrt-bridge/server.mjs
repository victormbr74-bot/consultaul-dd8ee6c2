import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const HOST = process.env.SECURECRT_BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.SECURECRT_BRIDGE_PORT || "48365");
const MAX_BODY_BYTES = 512 * 1024;
const TEMP_DIR = path.join(os.tmpdir(), "lvh-securecrt-bridge");
const SCRIPT_PATH = path.join(TEMP_DIR, "send_commands_securecrt.py");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const SECURECRT_SCRIPT = `# $language = "Python3"
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
    lines = commands.replace("\\r\\n", "\\n").split("\\n")
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
            tab.Screen.Send(line + "\\r")
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
`;

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const fileExists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase());
  }
  return false;
};

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
};

const resolveSecureCrtPath = async () => {
  const candidates = [
    process.env.SECURECRT_PATH,
    "C:\\\\Program Files\\\\VanDyke Software\\\\SecureCRT\\\\SecureCRT.exe",
    "C:\\\\Program Files (x86)\\\\VanDyke Software\\\\SecureCRT\\\\SecureCRT.exe",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }

  throw new Error(
    "SecureCRT.exe nao encontrado. Defina SECURECRT_PATH com o caminho completo do executavel.",
  );
};

const ensureScriptAssets = async () => {
  await mkdir(TEMP_DIR, { recursive: true });
  await writeFile(SCRIPT_PATH, SECURECRT_SCRIPT, "utf8");
};

const runSecureCrt = async (commands, options) => {
  const secureCrtPath = await resolveSecureCrtPath();
  await ensureScriptAssets();

  const commandFile = path.join(TEMP_DIR, `commands-${randomUUID()}.txt`);
  const outputFile = path.join(TEMP_DIR, `capture-${randomUUID()}.txt`);

  const delayMs = clamp(Number.isFinite(options.delayMs) ? options.delayMs : 80, 10, 2000);
  const captureWaitMs = clamp(Number.isFinite(options.captureWaitMs) ? options.captureWaitMs : 8000, 500, 120000);
  const captureOutput = Boolean(options.captureOutput);

  await writeFile(commandFile, commands, "utf8");

  const args = [
    "/SCRIPT",
    SCRIPT_PATH,
    "/ARG",
    commandFile,
    "/ARG",
    String(Math.round(delayMs)),
    "/ARG",
    captureOutput ? "1" : "0",
    "/ARG",
    String(Math.round(captureWaitMs)),
    "/ARG",
    outputFile,
  ];

  let capturedOutput = "";

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(secureCrtPath, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      let stdout = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        reject(error);
      });
      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }
        const details = (stderr || stdout || "").trim();
        reject(new Error(details || `SecureCRT retornou codigo ${code}.`));
      });
    });

    if (captureOutput && await fileExists(outputFile)) {
      capturedOutput = await readFile(outputFile, "utf8");
    }

    return { output: capturedOutput };
  } finally {
    await rm(commandFile, { force: true }).catch(() => undefined);
    await rm(outputFile, { force: true }).catch(() => undefined);
    await rm(`${commandFile}.capture.log`, { force: true }).catch(() => undefined);
  }
};

const readRequestBody = async (req) => {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error("Payload excede o limite de 512KB.");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
};

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 404, { ok: false, message: "Rota invalida." });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, message: "SecureCRT bridge online." });
    return;
  }

  if (req.method === "POST" && req.url === "/api/securecrt/execute") {
    try {
      const rawBody = await readRequestBody(req);
      const payload = safeJsonParse(rawBody);
      if (!payload || typeof payload !== "object") {
        sendJson(res, 400, { ok: false, message: "JSON invalido." });
        return;
      }

      const commands = String(payload.commands || "").trim();
      if (!commands) {
        sendJson(res, 400, { ok: false, message: "Campo commands obrigatorio." });
        return;
      }

      const captureOutput = toBoolean(payload.captureOutput);
      const delayMs = Number(payload.delayMs ?? 80);
      const captureWaitMs = Number(payload.captureWaitMs ?? 8000);

      const execution = await runSecureCrt(commands, {
        captureOutput,
        delayMs,
        captureWaitMs,
      });

      sendJson(res, 200, {
        ok: true,
        message: captureOutput
          ? "Comandos executados no SecureCRT e saida capturada."
          : "Comandos enviados ao SecureCRT.",
        output: execution.output || "",
      });
      return;
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        message: String(error?.message || error || "Falha ao enviar comandos para o SecureCRT."),
      });
      return;
    }
  }

  sendJson(res, 404, { ok: false, message: "Rota nao encontrada." });
});

server.listen(PORT, HOST, () => {
  console.log(`[securecrt-bridge] listening on http://${HOST}:${PORT}`);
  console.log("[securecrt-bridge] endpoint POST /api/securecrt/execute");
});
