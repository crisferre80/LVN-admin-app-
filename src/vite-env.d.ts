/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_GOOGLE_API_KEY: string
  readonly VITE_DEEPSEEK_API_KEY: string
}

declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (message: string, options?: { model?: string }) => Promise<string>
      }
    }
  }
}
