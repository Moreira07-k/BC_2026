import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// .trim() evita o erro mais comum: espaço/quebra de linha invisível colado
// junto com a URL ou a chave (acontece fácil ao copiar de um painel web).
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

let client: SupabaseClient;
export let supabaseConfigError: string | null = null;

try {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não foram definidas.");
  }
  // A chave "anon"/"publishable" é segura para ficar no código do navegador —
  // o que protege os dados de verdade são as políticas de Row Level Security
  // (RLS) no banco, não o sigilo desta chave.
  client = createClient(supabaseUrl, supabaseAnonKey);
} catch (err) {
  // Nunca deixamos isso derrubar o app inteiro (o site público não depende
  // do Supabase). Guardamos o erro para o painel admin poder avisar o
  // usuário com uma mensagem clara em vez de tela em branco.
  supabaseConfigError = err instanceof Error ? err.message : String(err);
  console.error("Falha ao inicializar o Supabase:", supabaseConfigError);
  // Cliente "stub": qualquer chamada real vai falhar de forma controlada
  // (retornando um erro no .then), em vez de travar a aplicação.
  client = createClient("https://placeholder.supabase.co", "placeholder-key");
}

export const supabase = client;
