import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  document.body.innerHTML =
    '<div style="font-family:Arial,sans-serif;padding:24px;color:#111">Falha de inicializacao: elemento #root nao encontrado.</div>';
  throw new Error("Falha de inicializacao: elemento #root nao encontrado.");
}

createRoot(rootElement).render(<App />);
