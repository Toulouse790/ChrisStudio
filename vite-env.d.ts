/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  readonly VITE_YOUTUBE_CLIENT_ID: string;
  readonly VITE_YOUTUBE_CLIENT_SECRET: string;
  readonly VITE_PEXELS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
