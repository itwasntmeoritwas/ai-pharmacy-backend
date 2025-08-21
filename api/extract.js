import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      
      // Test response first to verify the endpoint is working
      if (body.test === true) {
        console.log('Test request received, returning test response');
        return res.status(200).json({
          essentialMedicines: [
            {
              name: "Test Medicine (Test Generic)",
              category: "Test Category",
              reason: "Test reason",
              priority: "high",
              ageGroup: "All ages",
              dosage: "Test dosage",
              notes: "Test notes"
            }
          ],
          test: true,
          generatedAt: new Date().toISOString()
        });
      }
      
      const { familyMembers = [], memberSummary = '', medicineSummary = '', availableMedicines = [] } = body;
      const openaiKey = process.env.OPENAI_API_KEY;

      if (!openaiKey) {
        console.error('OpenAI API key not configured');
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }

      try {
        console.log('Generating essential medicines with OpenAI...');
        const prompt = `You are an AI pharmacist creating a COMPREHENSIVE essential medicines list for a family. This should be a FULL list covering ALL possible health needs.

FAMILY INFORMATION:
${memberSummary}

CURRENT MEDICINE CABINET:
${medicineSummary}

Generate a COMPREHENSIVE list of 40-50 essential medicines that this family should have, covering EVERY possible health scenario. This should be the most complete medicine cabinet possible.

REQUIRED RESPONSE FORMAT - Return ONLY a JSON array with this exact structure:
[
  {
    "name": "Medicine brand name (Generic name)",
    "category": "Category name",
    "reason": "Why this medicine is essential",
    "priority": "high|medium|low",
    "ageGroup": "Age group this is suitable for",
    "dosage": "Recommended dosage",
    "notes": "Important safety notes or instructions"
  }
]

COMPREHENSIVE CATEGORIES TO COVER (MUST INCLUDE ALL):

1. FEVER & PAIN RELIEF (8-10 medicines):
   - Children's painkillers (different ages)
   - Adult painkillers (various strengths)
   - Fever reducers, Migraine specific, Period pain, Muscle pain, Joint pain

2. FIRST AID & WOUND CARE (10-12 medicines):
   - Antiseptics (Betadine, Hydrogen peroxide, Alcohol wipes)
   - Bandages, Gauze, Medical tape, Sterile saline
   - Antibiotic ointments, Burn treatment, Blister treatment
   - Medical scissors and tweezers

3. ALLERGY & SKIN CARE (6-8 medicines):
   - Antihistamines (children and adult versions)
   - Hydrocortisone cream, Calamine lotion, Anti-itch creams
   - Eczema treatment, Sunburn relief, Insect bite treatment

4. DIGESTIVE HEALTH (8-10 medicines):
   - Antacids, Anti-diarrheal (Loperamide, Bismuth)
   - Anti-nausea, Laxatives, Stool softeners
   - Probiotics, Oral rehydration salts, Anti-gas, Heartburn relief

5. RESPIRATORY HEALTH (6-8 medicines):
   - Decongestants (children and adult), Saline nasal sprays
   - Cough suppressants, Expectorants, Throat lozenges
   - Steam inhalation products, Honey for natural relief

6. VIRAL & BACTERIAL INFECTIONS (6-8 medicines):
   - Antiviral medications, Antibacterial creams
   - Throat antiseptics, Cold sore treatment
   - Yeast infection treatment, UTI relief, Eye infection treatment

7. HEADACHE & MIGRAINE (4-6 medicines):
   - Tension headache, Migraine specific, Sinus headache
   - Cluster headache relief, Natural alternatives

8. CHILDREN'S SPECIFIC (6-8 medicines):
   - Teething relief, Colic relief, Diaper rash treatment
   - Children's vitamins, Fever monitoring, Growth supplements

9. WOMEN'S HEALTH (4-6 medicines):
   - Period pain relief, Menstrual cramp relief
   - Pregnancy-safe options, Menopause relief, Yeast infection treatment

10. MEN'S HEALTH (3-4 medicines):
    - Prostate health, Hair loss treatment, Energy supplements

11. ELDERLY HEALTH (4-6 medicines):
    - Joint pain relief, Memory supplements, Heart health, Bone health, Sleep aids

12. TRAVEL & PREVENTION (6-8 medicines):
    - Motion sickness, Sun protection, Insect repellent
    - Altitude sickness, Jet lag relief, Travel vaccines info

13. EMERGENCY & MONITORING (6-8 items):
    - Digital thermometer, Blood pressure monitor, Pulse oximeter
    - First aid manual, Emergency contacts, Medical ID bracelet info

14. SPECIALTY CONDITIONS (4-6 medicines):
    - Asthma relief, Diabetes supplies, Blood pressure, Thyroid (if applicable)

15. NATURAL & ALTERNATIVE (4-6 medicines):
    - Herbal remedies, Essential oils, Homeopathic options, Vitamin supplements

IMPORTANT RULES:
- Show brand names prominently (e.g., "Nurofen 400mg (Ibuprofen)")
- Include generic names in parentheses
- Consider age restrictions and safety
- Suggest medicines appropriate for the family's location
- Prioritize medicines not already in their cabinet
- Be specific about dosages and age groups
- Include both prescription and OTC medicines where appropriate
- Cover ALL the categories above - this should be a COMPLETE medicine cabinet
- Think of EVERY possible health issue a family might face

EXAMPLE ITEMS:
- "Nurofen 400mg (Ibuprofen)" for pain relief
- "Betadine Antiseptic (Povidone-iodine)" for wound care
- "Zyrtec (Cetirizine)" for allergies
- "Pepto-Bismol (Bismuth subsalicylate)" for digestive issues
- "Sudafed (Pseudoephedrine)" for congestion
- "Imodium (Loperamide)" for diarrhea
- "Senokot (Senna)" for constipation
- "Calpol (Paracetamol)" for children's fever

This should be the MOST COMPREHENSIVE essential medicines list possible - think of EVERYTHING a family might need for ANY health situation.`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2000
        });

        const response = completion.choices[0]?.message?.content;
        console.log('OpenAI response received, length:', response?.length || 0);
        console.log('OpenAI response preview:', response?.substring(0, 200) + '...');
        
        if (!response) {
          console.error('No response from OpenAI');
          throw new Error('No response from OpenAI');
        }

        // Try to extract JSON from the response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error('No valid JSON array found in OpenAI response');
          console.error('Full OpenAI response:', response);
          throw new Error('No valid JSON array found in response');
        }

        console.log('JSON extracted, length:', jsonMatch[0].length);
        const essentialMedicines = JSON.parse(jsonMatch[0]);
        console.log('Essential medicines parsed successfully, count:', essentialMedicines.length);
        
        return res.status(200).json({
          essentialMedicines,
          generatedAt: new Date().toISOString()
        });

      } catch (error) {
        console.error('Essential medicines generation error:', error);
        
        // Return a fallback response instead of error
        console.log('Returning fallback essential medicines list due to OpenAI error');
        return res.status(200).json({
          essentialMedicines: [
            {
              name: "Paracetamol 500mg (Acetaminophen)",
              category: "Fever & Pain Relief",
              reason: "Basic pain relief and fever reduction",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "500-1000mg every 4-6 hours",
              notes: "Safe for most people, good for headaches and fever"
            },
            {
              name: "Ibuprofen 400mg (Advil/Motrin)",
              category: "Fever & Pain Relief",
              reason: "Anti-inflammatory pain relief",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "200-400mg every 4-6 hours",
              notes: "Good for muscle pain, inflammation, and period pain"
            },
            {
              name: "Betadine Antiseptic (Povidone-iodine)",
              category: "First Aid & Wounds",
              reason: "Clean wounds and prevent infection",
              priority: "high",
              ageGroup: "All ages",
              dosage: "Apply directly to wound",
              notes: "Essential for treating cuts and scrapes"
            }
          ],
          fallback: true,
          error: error.message,
          generatedAt: new Date().toISOString()
        });
      }
    }

    // Branch: travel pack suggestions
    if (body && body.type === 'travel-pack') {
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

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1000
        });

        const response = completion.choices[0]?.message?.content;
        if (!response) {
          throw new Error('No response from OpenAI');
        }

        // Try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No valid JSON object found in response');
        }

        const suggestions = JSON.parse(jsonMatch[0]);
        
        return res.status(200).json({
          fromCabinet: suggestions.fromCabinet || [],
          toBuy: suggestions.toBuy || [],
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

    // Default branch: medicine extraction from images + optional text
    // If no specific type is specified, return essential medicines as fallback
    console.log('No specific request type, returning essential medicines fallback');
    return res.status(200).json({
      essentialMedicines: [
        {
          name: "Paracetamol 500mg (Acetaminophen)",
          category: "Fever & Pain Relief",
          reason: "Basic pain relief and fever reduction",
          priority: "high",
          ageGroup: "Adults 18+ years",
          dosage: "500-1000mg every 4-6 hours",
          notes: "Safe for most people, good for headaches and fever"
        },
        {
          name: "Ibuprofen 400mg (Advil/Motrin)",
          category: "Fever & Pain Relief",
          reason: "Anti-inflammatory pain relief",
          priority: "high",
          ageGroup: "Adults 18+ years",
          dosage: "200-400mg every 4-6 hours",
          notes: "Good for muscle pain, inflammation, and period pain"
        },
        {
          name: "Betadine Antiseptic (Povidone-iodine)",
          category: "First Aid & Wounds",
          reason: "Clean wounds and prevent infection",
          priority: "high",
          ageGroup: "All ages",
          dosage: "Apply directly to wound",
          notes: "Essential for treating cuts and scrapes"
        },
        {
          name: "Children's Paracetamol Syrup (Acetaminophen)",
          category: "Fever & Pain Relief",
          reason: "Safe pain relief for children",
          priority: "high",
          ageGroup: "Children 2-12 years",
          dosage: "Based on weight and age",
          notes: "Liquid form, consult dosing chart"
        },
        {
          name: "Antihistamine (Cetirizine)",
          category: "Allergy & Skin",
          reason: "Allergy relief for adults",
          priority: "medium",
          ageGroup: "Adults 18+ years",
          dosage: "10mg once daily",
          notes: "Non-drowsy formula preferred"
        }
      ],
      fallback: true,
      message: "Essential medicines fallback list (no specific request type)",
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('General API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
