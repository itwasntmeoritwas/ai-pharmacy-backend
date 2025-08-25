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
      return res.status(200).json({ 
        reply: 'Server missing OPENAI_API_KEY. Please consult a healthcare professional for medical advice.' 
      });
    }

    // Compute turn count and build cabinet whitelist
    const turnCount = messages.filter(m => m.role === 'user').length;
    
    // Parse cabinet into structured format and build whitelist
    const cabinetLines = cabinet.split('\n').filter(line => line.trim());
    const cabinetWhitelist = cabinetLines
      .filter(line => line.includes('✅ SUITABLE'))
      .map(line => {
        const match = line.match(/^([^-]+)/);
        return match ? match[1].trim().toLowerCase() : '';
      })
      .filter(name => name);

    console.log('=== CONSULTATION CONTEXT ===');
    console.log('Turn count:', turnCount);
    console.log('Cabinet whitelist:', cabinetWhitelist);
    console.log('Member:', member);

    // Build the system prompt for structured output
    const systemPrompt = `You are Dr. AI, a professional physician conducting private medical consultations for families.
You have access to:

The patient's profile (name, age, weight, location).

Their medicine cabinet (with ✅ SUITABLE / ❌ NOT SUITABLE labels).

The live chat history (messages).

Your job: act like a careful family doctor who reasons from symptoms + cabinet + context.
You must always return valid JSON matching the required schema.

CRITICAL SAFETY RULES

Never suggest medicines marked ❌ NOT SUITABLE.

Never invent or hallucinate medicines in the cabinet.

Only recommend a medicine from the cabinet if BOTH:

It is marked ✅ SUITABLE

It is directly relevant to the current symptoms

Ignore irrelevant medicines even if they are ✅ SUITABLE (e.g., antihistamines when only fever/cough is reported).

If no suitable medicines exist in the cabinet for the symptoms, leave cabinet_recommendations empty.

For children, be extremely cautious with dosing and suitability. Avoid adult-strength formulations.

CONSULTATION LOGIC

Turn 1 (first user message):
• Greet the patient by name.
• Provide a brief assessment.
• Ask 3–5 focused follow-up questions (set need_more_info=true).

Turn 2+:
• Do NOT repeat greeting or restate symptoms already given.
• Ask more questions only if critical data is missing (set need_more_info=false).
• Provide updated recommendations and clear next steps.

RECOMMENDATION LOGIC

cabinet_recommendations: only ✅ items relevant to current symptoms.

shopping_recommendations: always include 2–5 safe, practical items for the current case (e.g., children's paracetamol/acetaminophen with label guidance for the child's weight, saline nasal spray/drops, cool-mist humidifier/steam, honey if age ≥ 1 year, oral rehydration solution if dehydration risk, ibuprofen alternative if no contraindications with generic "follow label" wording).

Recommendations must be practical, specific, and age-appropriate.

self_care: hydration, rest, comfort measures (3–5 items).

red_flags: warning signs for doctor visit (3–6 items).

Always include a short disclaimer: "This consultation is not a substitute for professional medical advice…"

OUTPUT FORMAT (must ALWAYS be valid JSON)
{
"greeting": "Professional greeting (only on first turn)",
"assessment": "Brief assessment in plain English",
"need_more_info": true/false,
"follow_up_questions": ["..."],
"cabinet_recommendations": [
{ "name": "Medicine from cabinet", "reason": "Why it helps", "suitable": true }
],
"shopping_recommendations": [
{ "name": "Medicine or item to buy", "reason": "Why it helps and usage guidance" }
],
"self_care": ["..."],
"red_flags": ["..."],
"disclaimer": "..."
}`;

    // Build the user prompt with context
    const userPrompt = `Patient: ${member?.name || 'Unknown'} (${member?.ageYears || 'unknown'} years, ${member?.weightKg || 'unknown'} kg, ${member?.location || 'unknown location'})

Turn: ${turnCount}

CONVERSATION:
${messages.map(m => `${m.role}: ${m.text}`).join('\n')}

CABINET_WHITELIST: ${JSON.stringify(cabinetWhitelist)}

Only include cabinet items in cabinet_recommendations; use shopping_recommendations for anything that is not in the cabinet but would be useful.`;

    console.log('=== PROMPT BEING SENT ===');
    console.log('Status: sending to OpenAI');

    // Use the responses API with structured output
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.25, // Balanced temperature for natural but consistent output
        max_tokens: 800
      }),
    });

    const raw = await resp.text();
    console.log('CHAT OpenAI status:', resp.status);
    console.log('CHAT OpenAI raw:', raw);

    try {
      const data = JSON.parse(raw);
      let aiResponse = data?.choices?.[0]?.message?.content || '';
      
      console.log('=== AI RESPONSE ===');
      console.log('Raw AI response:', aiResponse);

      // Parse the AI's JSON response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (parseError) {
        console.log('❌ Failed to parse AI response as JSON:', parseError);
        // Fallback to structured error response
                 parsedResponse = {
           greeting: `Hello, I'm Dr. AI. I can see we're consulting about ${member?.name || 'your family member'} today.`,
           assessment: "I'm having trouble processing the medical information. Let me provide some general guidance.",
           need_more_info: false,
           follow_up_questions: [],
           cabinet_recommendations: [],
           shopping_recommendations: [
             {
               name: "Consult a healthcare professional",
               reason: "For proper medical assessment and treatment recommendations"
             }
           ],
           self_care: ["Rest", "Stay hydrated", "Monitor symptoms"],
           red_flags: ["High fever", "Severe symptoms", "Worsening condition"],
           disclaimer: "This AI is not a substitute for professional medical advice. Please consult a healthcare provider for proper diagnosis and treatment."
         };
      }

      // VALIDATION: Ensure cabinet_recommendations only contains actual cabinet medicines
      if (parsedResponse.cabinet_recommendations && Array.isArray(parsedResponse.cabinet_recommendations)) {
        console.log('=== CABINET VALIDATION ===');
        console.log('Cabinet whitelist:', cabinetWhitelist);
        console.log('AI cabinet recommendations:', parsedResponse.cabinet_recommendations);

        // Filter out any medicines not in the cabinet whitelist
        parsedResponse.cabinet_recommendations = parsedResponse.cabinet_recommendations.filter(rec => {
          const isInCabinet = cabinetWhitelist.some(whitelistName => 
            rec.name.toLowerCase().includes(whitelistName) || 
            whitelistName.includes(rec.name.toLowerCase())
          );
          
          if (!isInCabinet) {
            console.log(`⚠️ Filtered out non-cabinet medicine: ${rec.name}`);
          }
          
          return isInCabinet;
        });

        console.log('Filtered cabinet recommendations:', parsedResponse.cabinet_recommendations);
      }

      // Turn-based logic: remove greeting on turn 2+
      if (turnCount > 1) {
        parsedResponse.greeting = "";
        console.log('Turn > 1: removed greeting');
      }

      // Ensure all required fields exist
      const requiredFields = ['greeting', 'assessment', 'need_more_info', 'follow_up_questions', 'cabinet_recommendations', 'shopping_recommendations', 'self_care', 'red_flags', 'disclaimer'];
      requiredFields.forEach(field => {
        if (!parsedResponse[field]) {
          if (field === 'cabinet_recommendations' || field === 'shopping_recommendations' || field === 'follow_up_questions') {
            parsedResponse[field] = [];
          } else if (field === 'self_care' || field === 'red_flags') {
            parsedResponse[field] = [];
          } else if (field === 'need_more_info') {
            parsedResponse[field] = false;
          } else {
            parsedResponse[field] = 'Information not available';
          }
        }
      });

      console.log('=== FINAL RESPONSE ===');
      console.log('Status: response ready');

      return res.status(200).json({ 
        reply: parsedResponse,
        success: true 
      });

    } catch (e) {
      console.log('CHAT response processing error:', String(e));
             return res.status(200).json({ 
         reply: {
           greeting: `Hello, I'm Dr. AI. I can see we're consulting about ${member?.name || 'your family member'} today.`,
           assessment: "I encountered an error processing your request. Please try again or consult a healthcare professional.",
           need_more_info: false,
           follow_up_questions: [],
           cabinet_recommendations: [],
           shopping_recommendations: [
             {
               name: "Consult a healthcare professional",
               reason: "For proper medical assessment and treatment recommendations"
             }
           ],
           self_care: ["Rest", "Stay hydrated", "Monitor symptoms"],
           red_flags: ["High fever", "Severe symptoms", "Worsening condition"],
           disclaimer: "This AI is not a substitute for professional medical advice. Please consult a healthcare provider for proper diagnosis and treatment."
         },
         success: false,
         error: String(e)
       });
    }

  } catch (e) {
    console.log('CHAT server error:', String(e));
    return res.status(200).json({ 
      reply: {
        greeting: "Hello, I'm Dr. AI.",
        assessment: "I'm experiencing technical difficulties. Please try again or consult a healthcare professional.",
        need_more_info: false,
        follow_up_questions: [],
        cabinet_recommendations: [],
        shopping_recommendations: [
          {
            name: "Consult a healthcare professional",
            reason: "For proper medical assessment and treatment recommendations"
          }
        ],
        self_care: ["Rest", "Stay hydrated", "Monitor symptoms"],
        red_flags: ["High fever", "Severe symptoms", "Worsening condition"],
        disclaimer: "This AI is not a substitute for professional medical advice. Please consult a healthcare provider for proper diagnosis and treatment."
      },
      success: false,
      error: String(e)
    });
  }
}
