// Gemini, called only from the server (REST generateContent). The key lives
// in GEMINI_API_KEY and is sent in a header, never in a URL, a log line or a
// response. GEMINI_MODEL picks the model (default below).
export const geminiConfigured = () => !!process.env.GEMINI_API_KEY;
const model = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

const unavailable = () => Object.assign(new Error('Our concierge is resting for a moment. Please try again, or message us on WhatsApp.'), { status: 503, code: 'AI_UNAVAILABLE' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// One generateContent call: retried once on rate limits / server errors,
// 20 s timeout per try. Returns the first candidate's content.
export async function generate({ system, contents, tools, temperature = 0.4, maxTokens = 900 }) {
  if (!geminiConfigured()) throw unavailable();
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    ...(tools?.length && { tools: [{ functionDeclarations: tools }], toolConfig: { functionCallingConfig: { mode: 'AUTO' } } }),
    generationConfig: { temperature, maxOutputTokens: maxTokens },
    safetySettings: ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map((category) => ({ category, threshold: 'BLOCK_MEDIUM_AND_ABOVE' })),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await fetch(`${API}/${encodeURIComponent(model())}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      console.error(JSON.stringify({ scope: 'ai', event: 'gemini_unreachable', reason: e?.name || 'network' }));
      if (attempt === 0) {
        await wait(600);
        continue;
      }
      throw unavailable();
    }
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const content = data?.candidates?.[0]?.content;
      if (!content?.parts?.length) {
        console.error(JSON.stringify({ scope: 'ai', event: 'gemini_empty', reason: data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'empty' }));
        return { role: 'model', parts: [{ text: '' }], blocked: true };
      }
      return content;
    }
    console.error(JSON.stringify({ scope: 'ai', event: 'gemini_error', status: res.status }));
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await wait(900);
      continue;
    }
    throw unavailable();
  }
  throw unavailable();
}

export const textOf = (content) => (content?.parts || []).filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('').trim();
export const callsOf = (content) => (content?.parts || []).filter((p) => p.functionCall).map((p) => p.functionCall);
