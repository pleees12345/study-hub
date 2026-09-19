/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GROQ_API_KEY?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_MS_CLIENT_ID?: string;
  readonly VITE_MS_AUTHORITY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
