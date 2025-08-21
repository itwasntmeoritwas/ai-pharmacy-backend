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
    
    console.log('Request received:', {
      method: req.method,
      url: req.url,
      bodyType: body.type,
      bodyKeys: Object.keys(body),
      bodySize: JSON.stringify(body).length
    });

    // Debug endpoint - always return a test response
    if (body.debug === true) {
      console.log('Debug request received');
      return res.status(200).json({
        message: 'Backend is working!',
        timestamp: new Date().toISOString(),
        requestBody: body
      });
    }

    // Branch: essential medicines generation
    if (body && body.type === 'essential-medicines') {
      console.log('Essential medicines request received:', {
        familyMembers: body.familyMembers?.length || 0,
        memberSummary: body.memberSummary?.substring(0, 100) + '...',
        medicineSummary: body.medicineSummary?.substring(0, 100) + '...',
        availableMedicines: body.availableMedicines?.length || 0
      });
      
      const { familyMembers = [], memberSummary = '', medicineSummary = '', availableMedicines = [] } = body;
      
      // Check if we have OpenAI API key
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        console.error('OpenAI API key not configured');
        return res.status(500).json({ 
          error: 'OpenAI API key not configured',
          message: 'Please configure OpenAI API key in Vercel environment variables'
        });
      }

      try {
        console.log('Generating AI-powered essential medicines list...');
        
        // Create dynamic prompt based on family composition
        const prompt = `You are an AI pharmacist creating a COMPREHENSIVE essential medicines list for a family. This should be a FULL list covering ALL possible health needs.

FAMILY INFORMATION:
${memberSummary}

CURRENT MEDICINE CABINET:
${medicineSummary}

Generate a COMPREHENSIVE list of 40-50 essential medicines that this family should have, covering EVERY possible health scenario. This should be the most complete medicine cabinet possible.

IMPORTANT: Analyze the family composition and tailor recommendations accordingly:
- If ONLY ADULTS: Focus on adult formulations, no children's medicines
- If MIXED AGES: Include age-appropriate medicines for each group
- If ELDERLY: Include joint health, heart health, memory supplements
- If CHILDREN: Include child-safe formulations and dosages
- Consider LOCATION: Some medicines may not be available in certain countries/regions
- Consider ALLERGIES: Avoid medicines that family members are allergic to
- Consider CONDITIONS: Include medicines for existing health conditions

REQUIRED RESPONSE FORMAT - Return ONLY a JSON array with this exact structure:
[
  {
    "name": "Medicine brand name (Generic name)",
    "category": "Category name",
    "reason": "Why this medicine is essential for THIS family",
    "priority": "high|medium|low",
    "ageGroup": "Age group this is suitable for",
    "dosage": "Recommended dosage",
    "notes": "Important safety notes or instructions"
  }
]

COMPREHENSIVE CATEGORIES TO COVER (MUST INCLUDE ALL):

1. FEVER & PAIN RELIEF (8-10 medicines):
   - Age-appropriate painkillers based on family composition
   - Fever reducers, Migraine specific, Period pain, Muscle pain, Joint pain
   - Consider existing pain medicines in cabinet

2. FIRST AID & WOUND CARE (10-12 medicines):
   - Antiseptics, Bandages, Gauze, Medical tape, Sterile saline
   - Antibiotic ointments, Burn treatment, Blister treatment
   - Medical scissors and tweezers

3. ALLERGY & SKIN CARE (6-8 medicines):
   - Antihistamines appropriate for family ages
   - Hydrocortisone cream, Calamine lotion, Anti-itch creams
   - Eczema treatment, Sunburn relief, Insect bite treatment

4. DIGESTIVE HEALTH (8-10 medicines):
   - Antacids, Anti-diarrheal, Anti-nausea, Laxatives
   - Stool softeners, Probiotics, Oral rehydration salts
   - Anti-gas medication, Heartburn relief

5. RESPIRATORY HEALTH (6-8 medicines):
   - Decongestants, Saline nasal sprays, Cough suppressants
   - Expectorants, Throat lozenges, Steam inhalation products
   - Honey for natural relief

6. VIRAL & BACTERIAL INFECTIONS (6-8 medicines):
   - Antiviral medications, Antibacterial creams
   - Throat antiseptics, Cold sore treatment
   - Yeast infection treatment, UTI relief, Eye infection treatment

7. HEADACHE & MIGRAINE (4-6 medicines):
   - Tension headache, Migraine specific, Sinus headache
   - Cluster headache relief, Natural alternatives

8. CHILDREN'S SPECIFIC (ONLY if family has children):
   - Teething relief, Colic relief, Diaper rash treatment
   - Children's vitamins, Fever monitoring, Growth supplements

9. WOMEN'S HEALTH (ONLY if family has women):
   - Period pain relief, Menstrual cramp relief
   - Pregnancy-safe options, Menopause relief, Yeast infection treatment

10. MEN'S HEALTH (ONLY if family has men):
    - Prostate health, Hair loss treatment, Energy supplements

11. ELDERLY HEALTH (ONLY if family has elderly members):
    - Joint pain relief, Memory supplements, Heart health, Bone health, Sleep aids

12. TRAVEL & PREVENTION (6-8 medicines):
    - Motion sickness, Sun protection, Insect repellent
    - Altitude sickness, Jet lag relief, Travel vaccines info

13. EMERGENCY & MONITORING (6-8 items):
    - Digital thermometer, Blood pressure monitor, Pulse oximeter
    - First aid manual, Emergency contacts, Medical ID bracelet info

14. SPECIALTY CONDITIONS (4-6 medicines based on family needs):
    - Asthma relief (if applicable), Diabetes supplies (if applicable)
    - Blood pressure (if applicable), Thyroid (if applicable)

15. NATURAL & ALTERNATIVE (4-6 medicines):
    - Herbal remedies, Essential oils, Homeopathic options, Vitamin supplements

CRITICAL RULES:
- Show brand names prominently (e.g., "Nurofen 400mg (Ibuprofen)")
- Include generic names in parentheses
- Consider age restrictions and safety for THIS family
- Suggest medicines appropriate for the family's location
- Prioritize medicines NOT already in their cabinet
- Be specific about dosages and age groups
- Include both prescription and OTC medicines where appropriate
- Cover ALL the categories above - this should be a COMPLETE medicine cabinet
- Think of EVERY possible health issue THIS family might face
- Personalize based on family composition, ages, and health conditions

EXAMPLE: If family has only adults, don't suggest children's medicines. If family has elderly members, include joint and heart health medicines. If family has allergies, avoid those specific medicines.

Return ONLY the JSON array, no other text.`;

        // Make OpenAI API call
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 3000
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('OpenAI API error:', response.status, errorData);
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content;
        
        console.log('OpenAI response received, length:', aiResponse?.length || 0);
        console.log('OpenAI response preview:', aiResponse?.substring(0, 200) + '...');
        
        if (!aiResponse) {
          throw new Error('No response from OpenAI');
        }

        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error('No valid JSON array found in OpenAI response');
          console.error('Full OpenAI response:', aiResponse);
          throw new Error('No valid JSON array found in response');
        }

        console.log('JSON extracted, length:', jsonMatch[0].length);
        const essentialMedicines = JSON.parse(jsonMatch[0]);
        console.log('Essential medicines parsed successfully, count:', essentialMedicines.length);
        
        return res.status(200).json({
          essentialMedicines,
          message: `AI-generated essential medicines list for ${familyMembers.length} family member(s)`,
          generatedAt: new Date().toISOString()
        });

      } catch (error) {
        console.error('Essential medicines generation error:', error);
        
        // Return a personalized fallback response based on family composition
        const hasChildren = familyMembers.some(m => m.ageYears < 18);
        const hasAdults = familyMembers.some(m => m.ageYears >= 18);
        const hasElderly = familyMembers.some(m => m.ageYears >= 65);
        
        let fallbackMedicines = [];
        
        if (hasAdults) {
          fallbackMedicines.push(
            {
              name: "Paracetamol 500mg (Acetaminophen)",
              category: "Fever & Pain Relief",
              reason: "Basic pain relief and fever reduction for adults",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "500-1000mg every 4-6 hours",
              notes: "Safe for most people, good for headaches and fever"
            },
            {
              name: "Ibuprofen 400mg (Advil/Motrin)",
              category: "Fever & Pain Relief",
              reason: "Anti-inflammatory pain relief for adults",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "200-400mg every 4-6 hours",
              notes: "Good for muscle pain, inflammation, and period pain"
            }
          );
        }
        
        if (hasChildren) {
          fallbackMedicines.push(
            {
              name: "Children's Paracetamol Syrup (Acetaminophen)",
              category: "Fever & Pain Relief",
              reason: "Safe pain relief for children",
              priority: "high",
              ageGroup: "Children 2-12 years",
              dosage: "Based on weight and age",
              notes: "Liquid form, consult dosing chart"
            }
          );
        }
        
        if (hasElderly) {
          fallbackMedicines.push(
            {
              name: "Aspirin 81mg (Low Dose)",
              category: "Heart Health",
              reason: "Heart health for elderly family members",
              priority: "medium",
              ageGroup: "Adults 65+ years",
              dosage: "81mg daily (consult doctor)",
              notes: "May help prevent heart attacks and strokes"
            }
          );
        }
        
        return res.status(200).json({
          essentialMedicines: fallbackMedicines,
          fallback: true,
          error: error.message,
          message: `Fallback essential medicines list (AI generation failed)`,
          generatedAt: new Date().toISOString()
        });
      }
    }

    // Branch: travel pack suggestions
    if (body && body.type === 'travel-pack') {
      console.log('Travel pack request received');
      
      const { members = [], city = '', startDate = '', durationDays = 0, memberSummary = '', medicineSummary = '', availableMedicines = [] } = body;
      const openaiKey = process.env.OPENAI_API_KEY;

      if (!openaiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }

      try {
        const prompt = `You are an AI travel medicine consultant. Based on the family members traveling, destination, and duration, suggest medicines to pack.

FAMILY MEMBERS:
${memberSummary}

MEDICINE CABINET:
${medicineSummary}

DESTINATION: ${city}
DURATION: ${durationDays} days

Suggest medicines to pack for this trip. Consider:
1. Medicines from their cabinet that are suitable
2. Additional medicines to buy for travel
3. Destination-specific health risks
4. Duration of trip
5. Family member ages and health conditions

Return a JSON object with this structure:
{
  "fromCabinet": [
    {
      "name": "Medicine name",
      "reason": "Why to pack this",
      "qty": "Quantity to pack"
    }
  ],
  "toBuy": [
    {
      "name": "Medicine to buy",
      "reason": "Why needed for travel",
      "qty": "Quantity to buy"
    }
  ]
}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1000
          })
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content;
        
        if (!aiResponse) {
          throw new Error('No response from OpenAI');
        }

        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No valid JSON object found in response');
        }

        const suggestions = JSON.parse(jsonMatch[0]);
        
        return res.status(200).json({
          fromCabinet: suggestions.fromCabinet || [],
          toBuy: suggestions.toBuy || [],
          message: "AI-generated travel pack suggestions",
          generatedAt: new Date().toISOString()
        });

      } catch (error) {
        console.error('Travel pack generation error:', error);
        return res.status(500).json({ 
          error: 'Failed to generate travel pack suggestions',
          details: error.message 
        });
      }
    }

    // Default branch: return error for unsupported requests
    console.log('Unsupported request type, returning error');
    return res.status(400).json({
      error: 'Unsupported request type',
      message: 'Please specify type: essential-medicines or travel-pack',
      supportedTypes: ['essential-medicines', 'travel-pack', 'debug']
    });

  } catch (error) {
    console.error('General API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
