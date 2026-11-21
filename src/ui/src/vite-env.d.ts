/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** "1" = always mocks, "0" = never mocks, empty = try API, fall back to mocks */
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_API_BASE?: string;
  /** "hash" = #/path routing for static previews */
  readonly VITE_ROUTER?: string;
}
