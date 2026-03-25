/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_OUTLOOK_CLIENT_ID?: string;
  readonly VITE_OUTLOOK_TENANT_ID?: string;
  readonly VITE_OUTLOOK_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
