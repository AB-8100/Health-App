// Supabase Edge Function — calls the Claude (Anthropic) API server-side so the
// API key never reaches the browser. Invoked from the client via
// `supabase.functions.invoke('generate-training-plan', { body: { prompt } })`.
//
// Deploy with:
//   supabase functions deploy generate-training-plan
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically by the
// Supabase platform — no need to set them manually.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_MODEL   = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function stripCodeFence(text: string) {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return match ? match[1] : trimmed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured on the server' }, 500);

    // Require an authenticated Supabase user — supabase.functions.invoke()
    // forwards the caller's session JWT in this header automatically.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_ANON_KEY ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Not authenticated' }, 401);

    let body: { prompt?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const prompt = body?.prompt;
    if (!prompt || typeof prompt !== 'string') return json({ error: 'Missing "prompt" string in request body' }, 400);

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 32000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return json({ error: `Claude API error (${anthropicRes.status}): ${errText.slice(0, 2000)}` }, 502);
    }

    const data = await anthropicRes.json();
    const text = (data.content ?? []).map((block: { text?: string }) => block.text ?? '').join('');

    if (data.stop_reason === 'max_tokens') {
      return json({ error: 'Claude ran out of output tokens before finishing the plan — try a shorter plan or increase max_tokens in the edge function.' }, 502);
    }

    let plan;
    try {
      plan = JSON.parse(stripCodeFence(text));
    } catch {
      return json({ error: 'Claude did not return valid JSON', raw: text.slice(0, 4000) }, 502);
    }

    return json({ plan });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
