export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages = [], member = null } = req.body || {};
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return res.status(200).json({ reply: 'Please configure server OPENAI_API_KEY. For now: stay hydrated, rest, and consider Paracetamol if you have fever (check your cabinet).' });
    }

    const prompt = `Provide safe, non-diagnostic, informational health advice based on the conversation and member info.
Return only the assistant reply text (no JSON). Avoid prescribing; suggest OTC when appropriate and check typical contraindications.`;

    const apiMessages = [
      { role: 'system', content: prompt },
      ...(Array.isArray(messages) ? messages : []).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text || '' })),
    ];

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: apiMessages }),
    });
    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e) });
  }
}
