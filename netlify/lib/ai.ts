// netlify/lib/ai.ts
// The one place the app talks to a model, so every feature that wants one asks the
// same way and fails the same way.
//
// The Netlify AI Gateway sets these variables on every deploy that has it enabled,
// so there is no key in the repository and nothing to configure per environment.
// When they are absent — a local run without the gateway — `askText()` answers null
// and the feature that asked simply is not offered. Nothing here throws: an AI
// answer is a convenience everywhere it appears, never something the app needs in
// order to work.
const MODEL = "claude-sonnet-5";

function gateway() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? process.env.NETLIFY_AI_GATEWAY_BASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.NETLIFY_AI_GATEWAY_KEY;
  return baseUrl && apiKey ? { baseUrl: baseUrl.replace(/\/$/, ""), apiKey } : null;
}

/** Whether a model can be reached at all, so a surface knows whether to offer one. */
export function gatewayAvailable() {
  return gateway() !== null;
}

/**
 * Asks the model one question and answers with its text, or null if anything at all
 * went wrong — no gateway configured, a refused request, an empty answer. Callers
 * treat null as "not available just now" rather than as an error to hand a member.
 */
export async function askText(input: {
  system: string;
  prompt: string;
  maxTokens: number;
}): Promise<string | null> {
  const config = gateway();
  if (!config) return null;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: input.maxTokens,
        system: input.system,
        messages: [{ role: "user", content: input.prompt }],
      }),
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const payload = (await response.json().catch(() => null)) as {
    content?: { type?: string; text?: string }[];
  } | null;
  const written = (payload?.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();

  return written.length > 0 ? written : null;
}
