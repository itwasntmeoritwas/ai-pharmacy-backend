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
    const systemPrompt = `You are Dr. AI, a caring family doctor conducting natural medical consultations.

CRITICAL SAFETY RULES:
• NEVER suggest medicines marked ❌ NOT SUITABLE
• NEVER invent or hallucinate medicines in the cabinet
• Only recommend cabinet medicines if BOTH: ✅ SUITABLE AND directly relevant to current symptoms
• If nothing relevant is in cabinet, leave cabinet_recommendations empty and use shopping_recommendations instead

CONSULTATION FLOW:
Turn 1: Greet by name + brief assessment + 3-5 focused follow-up questions (need_more_info=true)
Turn 2+: NO greeting, NO repeating symptoms. Give tailored advice based on answers + cabinet + shopping + self-care + red flags

RECOMMENDATION REQUIREMENTS:
• cabinet_recommendations: Only ✅ items relevant to current symptoms (empty if none relevant)
• shopping_recommendations: 2-5 practical items (paracetamol/acetaminophen for fever, saline spray for congestion, honey if ≥1 year for cough, ORS for dehydration)
• self_care: 3-5 clear, practical tips
• red_flags: 3-6 warning signs when to see doctor
• Always include disclaimer

TONE: Natural, caring, professional - like a trusted family doctor, not a rigid script.

OUTPUT FORMAT (valid JSON only):
{
  "greeting": "Professional greeting (only Turn 1)",
  "assessment": "Brief assessment in plain English",
  "need_more_info": true/false,
  "follow_up_questions": ["..."],
  "cabinet_recommendations": [{"name": "Medicine from cabinet", "reason": "Why it helps", "suitable": true}],
  "shopping_recommendations": [{"name": "Item to buy", "reason": "Why it helps and usage"}],
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

Act like a caring family doctor. If nothing relevant is in the cabinet, focus on shopping recommendations and self-care.`;

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
        temperature: 0.3, // Natural, caring doctor-like responses
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

      // Turn-based logic: enforce natural flow
      if (turnCount > 1) {
        parsedResponse.greeting = "";
        console.log('Turn > 1: removed greeting for natural flow');
        
        // Ensure assessment doesn't just repeat user's symptoms
        if (parsedResponse.assessment && parsedResponse.assessment.toLowerCase().includes('experiencing') && turnCount > 1) {
          console.log('Turn > 1: detected symptom repetition, may need refinement');
        }
      }

      // Ensure all required fields exist with natural flow validation
      const requiredFields = ['greeting', 'assessment', 'need_more_info', 'follow_up_questions', 'cabinet_recommendations', 'shopping_recommendations', 'self_care', 'red_flags', 'disclaimer'];
      requiredFields.forEach(field => {
        if (parsedResponse[field] === undefined || parsedResponse[field] === null) {
          if (field === 'cabinet_recommendations' || field === 'shopping_recommendations' || field === 'follow_up_questions') {
            parsedResponse[field] = [];
          } else if (field === 'self_care' || field === 'red_flags') {
            parsedResponse[field] = [];
          } else if (field === 'need_more_info') {
            parsedResponse[field] = false;
          } else if (field === 'greeting') {
            parsedResponse[field] = '';
          } else {
            parsedResponse[field] = 'Information not available';
          }
        }
      });

      // Validate natural flow requirements
      if (turnCount === 1) {
        // Turn 1: Must have greeting and follow-up questions
        if (!parsedResponse.greeting || parsedResponse.greeting.trim() === '') {
          parsedResponse.greeting = `Hello ${member?.name || 'there'}, I'm Dr. AI. I can see you need medical assistance.`;
        }
        if (!parsedResponse.need_more_info || parsedResponse.follow_up_questions.length === 0) {
          parsedResponse.need_more_info = true;
          parsedResponse.follow_up_questions = ['Please provide more details about the symptoms.'];
        }
      } else {
        // Turn 2+: No greeting, focus on recommendations
        parsedResponse.greeting = '';
        if (parsedResponse.need_more_info && parsedResponse.follow_up_questions.length === 0) {
          parsedResponse.need_more_info = false;
        }
      }

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
