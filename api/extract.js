export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};

    // Branch: travel pack suggestions
    if (body && body.type === 'travel-pack') {
      const { members = [], city = '', startDate = '', durationDays = 0 } = body;
      const openaiKey = process.env.OPENAI_API_KEY;

      if (!openaiKey) {
        // Fallback static suggestions
        return res.status(200).json({
          fromCabinet: [],
          toBuy: [
            { name: 'Pain reliever (Paracetamol/Ibuprofen)', reason: 'General pain/fever' },
            { name: 'Antihistamines', reason: 'Allergy relief' },
          ],
        });
      }

      // Ask OpenAI for suggestions in a strict JSON format
      const prompt = `Plan a travel medicine pack.
Destination city: ${city}
Start date: ${startDate}
Duration (days): ${durationDays}
Travelers (ids): ${Array.isArray(members) ? members.join(', ') : ''}

Return JSON with keys "fromCabinet" and "toBuy" (arrays of items with name, reason, and optional qty). Do not include any text outside JSON.`;

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a pharmacist generating travel medicine suggestions as strict JSON.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      const data = await resp.json();
      let content = data?.choices?.[0]?.message?.content || '{}';
      try {
        const parsed = JSON.parse(content);
        return res.status(200).json({
          fromCabinet: Array.isArray(parsed.fromCabinet) ? parsed.fromCabinet : [],
          toBuy: Array.isArray(parsed.toBuy) ? parsed.toBuy : [],
        });
      } catch (e) {
        return res.status(200).json({ fromCabinet: [], toBuy: [] });
      }
    }

    // Default branch: medicine extraction from images + optional text
    const { images = [], text = '' } = body;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      // Heuristic fallback
      return res.status(200).json({
        name: 'Ibuprofen',
        dosage: '400mg',
        type: 'Pain Relief',
        illness: 'Headache, Fever',
        expiryDate: '2025-12-31',
      });
    }

    // Build a vision prompt
    const messages = [
      { role: 'system', content: 'You extract medicine label data as strict JSON.' },
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'Extract medicine fields. If unknown, omit. Return JSON only.' },
          ...images.slice(0, 4).map((dataUrl) => ({ type: 'input_image', image_url: dataUrl })),
          ...(text ? [{ type: 'input_text', text: `OCR/Text: ${text}` }] : []),
        ],
      },
    ];

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        response_format: { type: 'json_object' },
      }),
    });
    const data = await resp.json();
    let content = data?.choices?.[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(content);
      return res.status(200).json(parsed);
    } catch (e) {
      return res.status(200).json({});
    }
  } catch (e) {
    return res.status(500).json({ error: 'Server error', details: String(e) });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
