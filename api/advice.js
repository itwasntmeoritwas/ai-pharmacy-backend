export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    console.log('CHAT inbound body:', JSON.stringify(body));
    const { messages = [], member = null, cabinet = '' } = body;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return res.status(200).json({ reply: 'Server missing OPENAI_API_KEY. Temporary advice: stay hydrated, rest, and consider OTC pain reliever if appropriate.' });
    }

    const prompt = `You are a friendly, caring AI health assistant - think of yourself as a knowledgeable friend who happens to be a pharmacist. You should be warm, empathetic, and conversational like ChatGPT.

CRITICAL SAFETY RULES - YOU MUST FOLLOW THESE EXACTLY:

1. **AGE APPROPRIATENESS IS MANDATORY**: 
   - Children under 6: Only suggest medicines EXPLICITLY approved for under 6
   - Children 6-11: Only suggest medicines EXPLICITLY approved for this age range
   - NEVER suggest adult formulations (400mg+, 500mg+, etc.) for children under 12
   - If unsure about age suitability, DO NOT recommend the medicine

2. **CABINET FIRST APPROACH**:
   - ALWAYS check the user's medicine cabinet first
   - Only suggest medicines marked as "✅ SUITABLE" for the specific family member
   - If a medicine shows "❌ NOT SUITABLE" with a reason, DO NOT recommend it
   - If nothing suitable in cabinet, explicitly say "No suitable medicine found in your cabinet for this age/symptoms"

3. **CHILDREN SAFETY**:
   - For children under 12, be EXTRA cautious
   - High-strength painkillers (400mg+) are dangerous for children
   - Always check age restrictions and contraindications
   - When in doubt, recommend consulting a healthcare professional

CONVERSATIONAL STYLE - BE LIKE CHATGPT:
- Start with empathy and understanding
- Ask clarifying questions when needed
- Be conversational and friendly, not clinical
- Show concern for the person's wellbeing
- Offer to provide medicine advice if they want it
- Use natural language, not rigid medical jargon

RESPONSE STRUCTURE (be conversational, not rigid):

1. **Start with empathy and understanding** - acknowledge their concern
2. **Ask clarifying questions** if you need more information
3. **Offer medicine advice** - "Would you like me to look at what you have in your medicine cabinet and suggest some options?"
4. **If they want advice, provide it in a friendly way**:
   - "Let me check what you have that might help..."
   - "From your cabinet, I found..."
   - "If you need to buy something..."
5. **End with care and follow-up** - "How are they feeling now?" or "Let me know if you need anything else!"

EXAMPLE CONVERSATION STYLE:
"I'm sorry to hear that Nicole isn't feeling well! Headaches and diarrhea can be really uncomfortable, especially for a little one. 😔

Let me help you figure out what might help. First, I'd like to understand a bit more - how long has she been feeling this way? And is the headache really bad, or more like a mild discomfort?

I can also look at what you have in your medicine cabinet and suggest some safe options for a 6-year-old. Would that be helpful?

[Then if they want advice, continue with the medicine suggestions in a friendly, caring way]"

Family member: ${member ? JSON.stringify(member) : 'unknown'}
Medicine cabinet list (each line is one item):\n${cabinet}

Remember: Be friendly and conversational like ChatGPT, but NEVER compromise on safety. If a medicine shows "❌ NOT SUITABLE", DO NOT recommend it!`;

    console.log('CHAT PROMPT BEING SENT TO OPENAI:', prompt);

    const apiMessages = [
      { 
        role: 'system', 
        content: `You are a friendly, caring AI health assistant - think of yourself as a knowledgeable friend who happens to be a pharmacist. You should be warm, empathetic, and conversational like ChatGPT.

CRITICAL RULES:
1. Be conversational and friendly, not clinical or rigid
2. Start with empathy and understanding
3. Ask clarifying questions when needed
4. NEVER suggest medicines marked as "❌ NOT SUITABLE"
5. Only suggest medicines marked as "✅ SUITABLE" from their cabinet
6. For children, be EXTRA cautious about age-appropriate medicines
7. Always prioritize safety over convenience`
      },
      { role: 'user', content: prompt },
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
    const raw = await resp.text();
    console.log('CHAT OpenAI status:', resp.status);
    console.log('CHAT OpenAI raw:', raw);
    try {
      const data = JSON.parse(raw);
      let reply = data?.choices?.[0]?.message?.content || '';
      
      // VALIDATION: Check if AI is suggesting medicines that don't exist or aren't suitable
      if (reply && cabinet) {
        const cabinetLines = cabinet.split('\n').filter(line => line.trim());
        const availableMedicines = cabinetLines.map(line => {
          const match = line.match(/^([^-]+)/);
          return match ? match[1].trim() : '';
        }).filter(name => name);
        
        console.log('Available medicines in cabinet:', availableMedicines);
        console.log('AI response:', reply);
        
        // Check for medicines mentioned in AI response that aren't in cabinet
        const mentionedMedicines = [];
        availableMedicines.forEach(medName => {
          if (reply.toLowerCase().includes(medName.toLowerCase())) {
            mentionedMedicines.push(medName);
          }
        });
        
        // Check if any mentioned medicines are marked as NOT SUITABLE
        const unsuitableMedicines = [];
        cabinetLines.forEach(line => {
          if (line.includes('❌ NOT SUITABLE')) {
            const medName = line.match(/^([^-]+)/)?.[1]?.trim();
            if (medName && reply.toLowerCase().includes(medName.toLowerCase())) {
              unsuitableMedicines.push(medName);
            }
          }
        });
        
        if (unsuitableMedicines.length > 0) {
          console.log('⚠️ WARNING: AI suggested unsuitable medicines:', unsuitableMedicines);
          // Add a safety warning to the response
          reply = `⚠️ SAFETY WARNING: I notice I may have suggested some medicines that aren't suitable for ${member?.name || 'this person'}. Please double-check with a healthcare professional before giving any medicine.

${reply}

IMPORTANT: Always verify medicine suitability for age and health conditions. When in doubt, consult a doctor or pharmacist.`;
        }
        
        if (mentionedMedicines.length === 0) {
          console.log('ℹ️ AI response doesn\'t mention specific medicines from cabinet');
        } else {
          console.log('✅ AI response mentions medicines from cabinet:', mentionedMedicines);
        }
      }
      
      return res.status(200).json({ reply });
    } catch (e) {
      return res.status(200).json({ reply: '' });
    }
  } catch (e) {
    console.log('CHAT server error:', String(e));
    return res.status(200).json({ reply: '' });
  }
}
