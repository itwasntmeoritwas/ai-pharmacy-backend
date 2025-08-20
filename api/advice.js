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
    const { messages = [], member = null, cabinet = '' } = body;
    
    console.log('CHAT inbound body:', JSON.stringify(body));

    // Normalize messages to plain transcript
    const transcript = messages
      .map((m) => `${m.role || "user"}: ${m.text ?? m.content ?? ""}`)
      .join("\n");

    const prompt = `You are an AI health assistant providing informational, non-diagnostic guidance.

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THIS EXACT FORMAT:

1. ALWAYS start by checking the user's medicine cabinet FIRST
2. If they have suitable medicine for their symptoms, list it FIRST with dosage and usage notes
3. Only then suggest over-the-counter options to buy if needed
4. Consider the family member's age, weight, allergies, and conditions

REQUIRED RESPONSE STRUCTURE:
**From Your Cabinet:**
- [List each suitable medicine with dosage and brief usage notes]

**If Buying from Pharmacy:**
- [Only list if nothing suitable in cabinet or as alternatives]

**Safety Notes:**
- [Brief cautions and when to see a doctor]

EXAMPLE: If user says "I have a headache" and their cabinet has "Nurofen 400 — Pain releif — for: Headache — Qty 20 — suitable", you MUST start with:
"**From Your Cabinet:**
- Nurofen 400mg: Take 1-2 tablets every 4-6 hours as needed for headache relief. You have 20 tablets available."

Family member: ${member ? JSON.stringify(member) : 'unknown'}
Medicine cabinet list (each line is one item):\n${cabinet}

Remember: ALWAYS check their cabinet first and suggest their existing medicines before anything else!`;

    console.log('CHAT PROMPT BEING SENT TO OPENAI:', prompt);

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

    console.log('CHAT OpenAI response:', JSON.stringify(data));
    console.log('CHAT extracted reply:', reply);

    return res.status(200).json({ reply: String(reply || "").trim() });
  } catch (e) {
    console.error("Server error:", e);
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
});
