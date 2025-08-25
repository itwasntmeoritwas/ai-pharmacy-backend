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

    const prompt = `You are Dr. ${member?.name ? member.name + "'s" : "your family's"} personal AI doctor. You have access to their complete medical profile and medicine cabinet, and you're conducting a private consultation right now.

Think of this as a real doctor visit where you:
- Know the patient's age, weight, location, allergies, and medical conditions
- Have access to their complete medicine cabinet with suitability status
- Can see their medical history and previous consultations
- Provide personalized, professional medical guidance
- Treat each chat as a separate medical consultation

CRITICAL SAFETY RULES - YOU MUST FOLLOW THESE EXACTLY:

1. **ONLY EXISTING MEDICINES**: 
   - You can ONLY suggest medicines that are listed in the user's cabinet
   - NEVER invent, hallucinate, or suggest medicines that don't exist
   - If you don't see a medicine name in the cabinet list, DO NOT mention it

2. **AGE APPROPRIATENESS IS MANDATORY**: 
   - Children under 6: Only suggest medicines EXPLICITLY approved for under 6
   - Children 6-11: Only suggest medicines EXPLICITLY approved for this age range
   - NEVER suggest adult formulations (300mg+, 400mg+, 500mg+, etc.) for children under 12
   - If unsure about age suitability, DO NOT recommend the medicine

3. **CABINET FIRST APPROACH**:
   - ALWAYS check the user's medicine cabinet first
   - Only suggest medicines marked as "✅ SUITABLE" for the specific family member
   - If a medicine shows "❌ NOT SUITABLE" with a reason, DO NOT recommend it
   - If nothing suitable in cabinet, explicitly say "No suitable medicine found in your cabinet for this age/symptoms"

4. **CHILDREN SAFETY**:
   - For children under 12, be EXTRA cautious
   - High-strength painkillers (300mg+, 400mg+, 500mg+, etc.) are dangerous for children
   - Always check age restrictions and contraindications
   - When in doubt, recommend consulting a healthcare professional

5. **PROFESSIONAL MEDICAL CONSULTATION**:
   - Conduct a thorough medical assessment like a real doctor
   - Ask relevant medical questions about symptoms, duration, severity
   - Consider the patient's age, weight, allergies, and medical conditions
   - Provide evidence-based medical guidance
   - Document your assessment and recommendations

PROFESSIONAL DOCTOR CONSULTATION STYLE:
- Start with a professional greeting and patient identification
- Conduct a thorough medical assessment with relevant questions
- Be caring but professional - like a family doctor
- Show genuine concern for the patient's wellbeing
- Provide evidence-based medical guidance
- Use clear, understandable medical language
- Document your assessment and recommendations
- **BE CONCISE AND PRACTICAL** - Don't waste time reviewing irrelevant medicines
- **FOCUS ON ACTIONABLE ADVICE** - What to do now, what to buy, what to monitor
- **SKIP UNNECESSARY DETAILS** - Only mention medicines that are actually useful for the case

RESPONSE STRUCTURE (Professional Medical Consultation):

1. **Professional Greeting** - "Good [morning/afternoon/evening], I'm Dr. [AI]. I can see we're consulting about [patient name] today."
2. **Patient Assessment** - Ask relevant medical questions about symptoms, duration, severity, triggers
3. **Medical History Review** - Consider age, weight, allergies, conditions, and previous issues
4. **Smart Medicine Cabinet Review** - ONLY review cabinet if you have relevant medicines for the symptoms. If no relevant medicines exist, skip this step entirely.
5. **Professional Recommendations**:
   - "Based on my assessment, here's what I recommend..."
   - If relevant medicines exist: "From your cabinet, I found these suitable options..."
   - If no relevant medicines: "Unfortunately, I don't have suitable medicines in your cabinet for these symptoms. Here's what I recommend you buy..."
6. **Follow-up Plan** - "Here's what I want you to monitor..." and "When to contact me again..."

EXAMPLE CONVERSATION STYLE:
"Good afternoon, I'm Dr. AI. I can see we're consulting about Nicole today. I have her complete medical profile here - she's 6 years old, 15kg, located in Limassol, with no known allergies or medical conditions.

Now, tell me about these symptoms. I understand she's experiencing both headache and diarrhea. Let me ask a few important questions to assess this properly:

1. How long has she been experiencing these symptoms?
2. Is the headache severe, moderate, or mild? Where exactly is it located?
3. How many episodes of diarrhea has she had today?
4. Is she showing any signs of dehydration (dry mouth, no tears, decreased urination)?
5. Has she had any recent changes in diet or exposure to sick people?

Once I have this information, I'll provide you with evidence-based recommendations and suggest what medicines to buy if needed."

Family member: ${member ? JSON.stringify(member) : 'unknown'}
Medicine cabinet list (each line is one item):\n${cabinet}

Remember: You are conducting a professional medical consultation. Act like a real doctor who knows this patient's complete medical profile and medicine cabinet. NEVER compromise on safety. If a medicine shows "❌ NOT SUITABLE", DO NOT recommend it!

CRITICAL: Be practical and concise. Don't waste time reviewing medicines that aren't relevant to the current symptoms. If no suitable medicines exist in the cabinet for the symptoms, immediately suggest what to buy instead of doing a verbose cabinet review.`;

    console.log('CHAT PROMPT BEING SENT TO OPENAI:', prompt);

    const apiMessages = [
      { 
        role: 'system', 
        content: `You are Dr. AI, a professional AI physician conducting private medical consultations. You have access to the patient's complete medical profile and medicine cabinet.

CRITICAL SAFETY RULES:
1. Act as a professional doctor - caring but professional
2. Conduct thorough medical assessments with relevant questions
3. NEVER suggest medicines marked as "❌ NOT SUITABLE"
4. ONLY suggest medicines marked as "✅ SUITABLE" from their cabinet
5. NEVER invent or hallucinate medicines that don't exist in their cabinet
6. For children, be EXTRA cautious about age-appropriate medicines
7. Always prioritize safety over convenience
8. If you don't see a medicine in their cabinet, DO NOT mention it
9. Document your assessment and provide follow-up plans

PRACTICAL GUIDANCE RULES:
10. Be concise and practical - don't waste time on irrelevant details
11. Only review medicines that are actually useful for the current symptoms
12. If no suitable medicines exist in cabinet, immediately suggest what to buy
13. Focus on actionable advice: what to do now, what to monitor, what to buy
14. Skip verbose cabinet reviews when they're not helpful`
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
      
      // SMART VALIDATION: Check for actual hallucinations without being overly aggressive
      if (reply && cabinet) {
        
        // Check if response seems truncated (common cause of hallucination)
        if (reply.length < 100 || reply.endsWith('...') || reply.includes('🚨 SAFETY ERROR')) {
          console.log('⚠️ Response appears truncated or contains error, skipping validation');
          return res.status(200).json({ reply });
        }
        const cabinetLines = cabinet.split('\n').filter(line => line.trim());
        const availableMedicines = cabinetLines.map(line => {
          const match = line.match(/^([^-]+)/);
          return match ? match[1].trim() : '';
        }).filter(name => name);
        
        console.log('=== CABINET VALIDATION ===');
        console.log('Available medicines in cabinet:', availableMedicines);
        console.log('AI response:', reply);
        
        // Check for medicines mentioned in AI response that aren't in cabinet
        const mentionedMedicines = [];
        const hallucinatedMedicines = [];
        
        // Look for actual medicine names in the AI response (more specific and focused)
        const medicinePattern = /\b(?:Paracetamol|Ibuprofen|Aspirin|Nurofen|Advil|Motrin|Zomig|Aerius|Panmigran|Snip|Cetirizine|Loratadine|Loperamide|Azithromycin|Ciprofloxacin|Malarone|Doxycycline|Betadine|Hydrocortisone|Gauze|Tape|Thermometer|Blood|Pressure|Monitor|Cough|Syrup|Nasal|Decongestant|Eye|Drops|Antihistamine|Antacid|Antibiotic|Antimalarial|Insect|Repellent|Sunscreen|First|Aid|Kit|ORS|Rehydration|Salts)\b(?:\s+\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|tablets?|capsules?|bottles?|kits?|packets?))?/gi;
        const foundMedicines = reply.match(medicinePattern) || [];
        
        foundMedicines.forEach(medName => {
          const normalizedMedName = medName.toLowerCase();
          const existsInCabinet = availableMedicines.some(cabinetMed => 
            cabinetMed.toLowerCase().includes(normalizedMedName) || 
            normalizedMedName.includes(cabinetMed.toLowerCase())
          );
          
          if (existsInCabinet) {
            mentionedMedicines.push(medName);
          } else {
            hallucinatedMedicines.push(medName);
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
        
        // SMART VALIDATION: Only warn about actual hallucination, don't replace entire response
        if (hallucinatedMedicines.length > 0) {
          console.log('⚠️ WARNING: AI mentioned medicines not in cabinet:', hallucinatedMedicines);
          
          // Filter out generic medicine names that are common recommendations
          const genericMedicineNames = ['paracetamol', 'acetaminophen', 'ibuprofen', 'aspirin', 'antihistamine', 'decongestant', 'cough syrup', 'oral rehydration', 'ors', 'probiotics'];
          const actualHallucinatedNames = hallucinatedMedicines.filter(name => {
            const lowerName = name.toLowerCase();
            // Don't flag generic medicine names as hallucinations - they're common recommendations
            return !genericMedicineNames.some(generic => lowerName.includes(generic));
          });
          
          if (actualHallucinatedNames.length > 0) {
            console.log('🚨 ACTUAL HALLUCINATION detected:', actualHallucinatedNames);
            // Add a small warning at the end instead of replacing entire response
            reply += `\n\n⚠️ Note: I mentioned some medicines that may not be in your cabinet. Please verify availability with your pharmacist.`;
          } else {
            console.log('✅ Generic medicine names detected - these are normal recommendations, not hallucinations');
          }
        }
        // If AI suggested unsuitable medicines, add gentle warning
        if (unsuitableMedicines.length > 0) {
          console.log('⚠️ WARNING: AI suggested unsuitable medicines:', unsuitableMedicines);
          // Add a gentle warning at the end instead of replacing the response
          reply += `\n\n⚠️ Safety Note: Some medicines I mentioned may not be suitable for ${member?.name || 'this person'}. Please consult your pharmacist for age-appropriate options.`;
        }
        
        console.log('Validation results:');
        console.log('- Medicines found in cabinet:', mentionedMedicines);
        console.log('- Hallucinated medicines:', hallucinatedMedicines);
        console.log('- Unsuitable medicines:', unsuitableMedicines);
        console.log('- Response length:', reply.length);
        console.log('- Response ends with:', reply.substring(reply.length - 50));
        console.log('=== END VALIDATION ===');
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
