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

    // Parse cabinet into structured format for validation
    const cabinetLines = cabinet.split('\n').filter(line => line.trim());
    const availableMedicines = cabinetLines.map(line => {
      const match = line.match(/^([^-]+)/);
      const name = match ? match[1].trim() : '';
      const isSuitable = line.includes('✅ SUITABLE');
      const reason = line.includes('❌ NOT SUITABLE') ? 
        line.split('❌ NOT SUITABLE:')[1]?.trim() || 'Not suitable' : 
        'Suitable for this family member';
      
      return { name, isSuitable, reason, fullLine: line };
    }).filter(med => med.name);

    console.log('=== CABINET PARSING ===');
    console.log('Available medicines:', availableMedicines);
    console.log('Member:', member);

    // Build the system prompt for structured output
    const systemPrompt = `You are Dr. AI, a professional AI physician conducting private medical consultations. You have access to the patient's complete medical profile and medicine cabinet.

CRITICAL SAFETY RULES:
1. Act as a professional doctor - caring but professional, ChatGPT-like conversational style
2. Conduct thorough medical assessments with relevant questions
3. NEVER suggest medicines marked as "❌ NOT SUITABLE"
4. ONLY suggest medicines marked as "✅ SUITABLE" from their cabinet
5. NEVER invent or hallucinate medicines that don't exist in their cabinet
6. For children, be EXTRA cautious about age-appropriate medicines
7. Always prioritize safety over convenience
8. If you don't see a medicine in their cabinet, DO NOT mention it in cabinet_recommendations
9. Document your assessment and provide follow-up plans

PRACTICAL GUIDANCE RULES:
10. Be concise and practical - don't waste time on irrelevant details
11. Only review medicines that are actually useful for the current symptoms
12. If no suitable medicines exist in cabinet, immediately suggest what to buy
13. Focus on actionable advice: what to do now, what to monitor, what to buy
14. Skip verbose cabinet reviews when they're not helpful
15. NEVER mention medicines that exist but won't help the current symptoms
16. Give comprehensive treatment plans - don't just suggest one medicine
17. Act like ChatGPT - practical, helpful, and comprehensive

QUESTION-FIRST BEHAVIOR:
18. If user input lacks basics (duration, temperature, severity, key symptoms, hydration), set need_more_info=true
19. Include 3-5 concise follow_up_questions when need_more_info=true
20. On early turns (1-2 user messages), prioritize questions over recommendations
21. Once sufficient info is gathered, provide full recommendations

CABINET VS SHOPPING RULES:
22. cabinet_recommendations: ONLY medicines present in cabinet AND marked ✅ SUITABLE
23. shopping_recommendations: Safe place for off-cabinet recommendations
24. For children: prefer safe categories (children's paracetamol, ORS, saline nasal, humidifier)
25. Avoid specific branded cough syrups for young kids - suggest "ask pharmacist for age-appropriate option"
26. Never recommend antibiotics without clear bacterial red flags

TONE AND SAFETY:
27. "Doctor, but friendly" voice - natural like ChatGPT, no long essays
28. Temperature 0.2-0.4 for consistent, concise outputs
29. Always include self_care (3-5 bullets), red_flags (3-6 bullets), short disclaimer
30. Do NOT give adult-strength doses to children
31. Keep dosing generic (follow product label for weight) unless absolutely confident
32. Never diagnose - provide supportive guidance + when to seek care

OUTPUT FORMAT: You MUST respond with valid JSON matching this exact schema:
{
  "greeting": "Professional greeting with patient name",
  "assessment": "Brief medical assessment in plain English",
  "need_more_info": false,
  "follow_up_questions": [],
  "cabinet_recommendations": [
    {
      "name": "Medicine name from cabinet",
      "reason": "Why this medicine helps the current symptoms",
      "suitable": true
    }
  ],
  "shopping_recommendations": [
    {
      "name": "Medicine name to buy",
      "reason": "Why this medicine is needed and dosage info"
    }
  ],
  "self_care": ["Hydration", "Rest", "Other self-care tips"],
  "red_flags": ["Danger signs", "When to see doctor"],
  "disclaimer": "Standard disclaimer about AI not replacing a doctor"
}

IMPORTANT: Only include medicines in cabinet_recommendations that are marked as ✅ SUITABLE in the cabinet. If no suitable medicines exist, leave cabinet_recommendations as an empty array.`;

    // Build the user prompt with context
    const userPrompt = `You are consulting with ${member?.name || 'a family member'} who is ${member?.ageYears || 'unknown'} years old, weighs ${member?.weightKg || 'unknown'} kg, and is located in ${member?.location || 'unknown location'}.

Current conversation context:
${messages.map(m => `${m.role}: ${m.text}`).join('\n')}

Conversation analysis:
- This is turn ${messages.filter(m => m.role === 'user').length} of the consultation
- Early consultation (1-2 turns): prioritize gathering information with follow-up questions
- Later consultation (3+ turns): provide comprehensive recommendations

Available medicine cabinet (only use ✅ SUITABLE medicines):
${availableMedicines.filter(med => med.isSuitable).map(med => `- ${med.name}: ${med.fullLine}`).join('\n')}

Based on the conversation context and available medicines, provide a structured medical consultation response. Remember to be conversational like ChatGPT but professional like a doctor.`;

    console.log('=== PROMPT BEING SENT ===');
    console.log('System prompt length:', systemPrompt.length);
    console.log('User prompt length:', userPrompt.length);

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
        temperature: 0.3, // Balanced temperature for natural but consistent output
        max_tokens: 2000
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
        const validCabinetMeds = availableMedicines.filter(med => med.isSuitable);
        const validMedNames = validCabinetMeds.map(med => med.name.toLowerCase());
        
        console.log('=== CABINET VALIDATION ===');
        console.log('Valid cabinet medicines:', validMedNames);
        console.log('AI cabinet recommendations:', parsedResponse.cabinet_recommendations);

        // Filter out any medicines not in the cabinet
        parsedResponse.cabinet_recommendations = parsedResponse.cabinet_recommendations.filter(rec => {
          const isInCabinet = validMedNames.some(validName => 
            rec.name.toLowerCase().includes(validName) || 
            validName.includes(rec.name.toLowerCase())
          );
          
          if (!isInCabinet) {
            console.log(`⚠️ Filtered out non-cabinet medicine: ${rec.name}`);
          }
          
          return isInCabinet;
        });

        console.log('Filtered cabinet recommendations:', parsedResponse.cabinet_recommendations);
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
      console.log('Parsed and validated response:', JSON.stringify(parsedResponse, null, 2));

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
