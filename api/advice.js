// api/advice.js
function withCors(handler) {
  return async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).end();
    return handler(req, res);
  };
}

module.exports = withCors(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.OPENAI_API_KEY || "";
  // Log once per invocation (visible in Vercel → Deployments → Runtime Logs)
  console.log("OPENAI key visible?", !!key, "len:", key.length);
  if (!key) {
    // Fail loudly so you know the env var isn't wired
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  try {
    const body = req.body || {};
    const incoming = Array.isArray(body.messages) ? body.messages : [];

    // Normalize messages to plain transcript
    const transcript = incoming
      .map((m) => `${m.role || "user"}: ${m.text ?? m.content ?? ""}`)
      .join("\n");

    const prompt =
      "You are a careful, non-diagnostic health assistant. Offer short, safe, informational guidance. " +
      "Do not prescribe. Suggest OTC options only when appropriate and mention common contraindications briefly.";

    // Call OpenAI Responses API (text-only request)
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: `${prompt}\n\nConversation:\n${transcript || "user: hello"}` },
            ],
          },
        ],
        // keep outputs concise
        max_output_tokens: 400,
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("OpenAI error:", r.status, errText);
      return res.status(r.status).json({ error: "OpenAI error", detail: errText });
    }

    const data = await r.json();
    // Responses API can return in a few shapes; try the common ones:
    const reply =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      (data.choices && data.choices[0]?.message?.content) ||
      "";

    return res.status(200).json({ reply: String(reply || "").trim() });
  } catch (e) {
    console.error("Server error:", e);
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
});
