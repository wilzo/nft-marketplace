/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_SOCKET_URL?: string
  readonly VITE_ENABLE_MOCKS?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
