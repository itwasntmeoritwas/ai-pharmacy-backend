import OpenAI from 'openai';

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
      console.log('Essential medicines request received');
      
      // For now, return a static list to test if the endpoint works
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
          },
          {
            name: "Loperamide (Imodium)",
            category: "Digestive Health",
            reason: "Treat acute diarrhea",
            priority: "medium",
            ageGroup: "Adults 18+ years",
            dosage: "2mg initially, then 1mg after each loose stool",
            notes: "Maximum 8mg per day"
          },
          {
            name: "Antacid (Calcium Carbonate)",
            category: "Digestive Health",
            reason: "Relieve heartburn and indigestion",
            priority: "medium",
            ageGroup: "Adults 18+ years",
            dosage: "500-1000mg as needed",
            notes: "Chewable tablets for quick relief"
          },
          {
            name: "Hydrocortisone Cream 1%",
            category: "Allergy & Skin",
            reason: "Relieve itching and skin irritation",
            priority: "medium",
            ageGroup: "All ages",
            dosage: "Apply directly to affected area",
            notes: "For insect bites, rashes, and minor skin conditions"
          },
          {
            name: "Sterile Gauze Pads (Various sizes)",
            category: "First Aid & Wounds",
            reason: "Cover and protect wounds",
            priority: "high",
            ageGroup: "All ages",
            dosage: "2x2\", 4x4\", and 4x6\" sizes",
            notes: "Various sizes for different wound types"
          },
          {
            name: "Medical Tape (Hypoallergenic)",
            category: "First Aid & Wounds",
            reason: "Secure bandages and dressings",
            priority: "high",
            ageGroup: "All ages",
            dosage: "Paper tape for sensitive skin",
            notes: "Hypoallergenic preferred"
          }
        ],
        message: "Static essential medicines list (AI generation disabled for now)",
        generatedAt: new Date().toISOString()
      });
    }

    // Branch: medicine extraction from images
    if (body && body.images && body.images.length > 0) {
      console.log('Medicine extraction request received with', body.images.length, 'images');
      
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const systemPrompt = `You are a pharmacist-grade medicine safety analyzer. Your ONLY job is to read and extract EXACT text visible in the medicine package images. 

CRITICAL INSTRUCTIONS - READ THIS CAREFULLY:
- READ ONLY what is VISIBLY WRITTEN on the package
- DO NOT guess, infer, or hallucinate ANY information
- DO NOT use any medical knowledge to fill in missing information
- If you cannot see a piece of information clearly, mark it as null/undefined
- If text is blurry or unclear, do not attempt to read it
- The medicine name should be the BRAND NAME visible on the package (e.g., "Strepfen", not "Ibuprofen")
- Generic/active ingredient names go in the ingredients field, not the name field
- Only extract expiry dates if they are clearly visible and readable
- Dosage should be exactly as written (e.g., "8.75 mg" not "400mg")
- Type should be exactly what's written (e.g., "Sore Throat Relief" not "Pain Relief")
- Illness should be exactly what's written (e.g., "Sore throat" not "Pain")

ANTI-HALLUCINATION RULES:
- If you see "Strepfen" on the package, the name is "Strepfen" - NOT "Ibuprofen"
- If you see "8.75 mg" on the package, the dosage is "8.75 mg" - NOT "400mg"
- If you see "Sore Throat Relief" on the package, the type is "Sore Throat Relief" - NOT "Pain Relief"
- If you see "Sore throat" on the package, the illness is "Sore throat" - NOT "Pain"
- If you don't see an expiry date clearly written, set expiryDate to null

REQUIRED RESPONSE FORMAT (JSON):
{
  "name": "Exact brand name visible on package (e.g., 'Strepfen')",
  "dosage": "Exact dosage as written (e.g., '8.75 mg')",
  "type": "Exact type/category if visible (e.g., 'Sore Throat Relief')",
  "illness": "Exact indication if stated on package (e.g., 'Sore throat')",
  "expiryDate": "YYYY-MM-DD format ONLY if clearly visible, otherwise null",
  "barcode": "Barcode if visible, otherwise null",
  "dosageForm": "tablet, syrup, cream, etc. if visible",
  "route": "oral, topical, nasal, etc. if visible",
  "ingredientsText": "Active ingredients with strengths if visible, semicolon-separated",
  "manufacturerName": "Manufacturer name if visible",
  "manufacturerCountry": "Country if visible",
  "batchNumber": "Batch number if visible, otherwise null",
  "lotNumber": "Lot number if visible, otherwise null",
  "prescriptionOnly": true/false if stated, otherwise null,
  "contraindications": ["array of contraindications if visible"],
  "minAge": "minimum age if stated, otherwise null",
  "maxAge": "maximum age if stated, otherwise null",
  "storageConditions": "Storage instructions if visible",
  "notes": "Any additional safety notes visible on package",
  "tagsText": "comma-separated tags if visible"
}

SAFETY RULES:
- If you cannot clearly read something, mark it as null
- Do not make assumptions about age restrictions
- Do not infer contraindications not explicitly stated
- Be conservative - when in doubt, mark as null

FINAL CHECK:
- Before responding, verify that every field contains ONLY information you can actually see in the images
- If you're unsure about ANY field, set it to null
- Remember: It's better to return incomplete data than incorrect data`;

        const userPrompt = `IMPORTANT: You are analyzing IMAGES of medicine packages. Look at the actual images carefully.

STEP-BY-STEP ANALYSIS:
1. First, look at the images and identify the BRAND NAME that is clearly visible
2. Look for the DOSAGE information (e.g., mg, ml, etc.)
3. Look for what the medicine TREATS (e.g., sore throat, pain, etc.)
4. Look for the MEDICINE TYPE/CATEGORY if stated
5. Look for EXPIRY DATE only if clearly visible

CRITICAL: 
- If you see "Strepfen" written on the package, the name is "Strepfen" - NOT "Ibuprofen"
- If you see "8.75 mg" written on the package, the dosage is "8.75 mg" - NOT "400mg"
- If you see "Sore Throat Relief" written on the package, the type is "Sore Throat Relief" - NOT "Pain Relief"
- If you see "Sore throat" written on the package, the illness is "Sore throat" - NOT "Pain"

LOOK AT THE IMAGES AND TELL ME EXACTLY WHAT YOU SEE WRITTEN ON THE PACKAGE. DO NOT USE ANY MEDICAL KNOWLEDGE TO FILL IN MISSING INFORMATION.`;

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: 'I understand. I will look at the images carefully and only extract what I can actually see written on the package. I will not guess or use medical knowledge to fill in missing information.' },
            { role: 'user', content: 'Perfect. Now analyze the images and extract ONLY the visible text. Remember: if you see "Strepfen", say "Strepfen" - not "Ibuprofen".' }
          ],
          max_tokens: 1000,
          temperature: 0.0, // Zero temperature for maximum consistency
        });

        const content = response.choices[0]?.message?.content;
        console.log('OpenAI response:', content);
        console.log('Response length:', content?.length);
        console.log('Response contains JSON:', content?.includes('{'));

        // Try to extract JSON from the response
        let extractedData;
        try {
          // Look for JSON in the response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            extractedData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch (parseError) {
          console.error('Failed to parse OpenAI response:', parseError);
          return res.status(500).json({
            error: 'Failed to parse AI response',
            details: parseError.message,
            rawResponse: content
          });
        }

        console.log('Extracted medicine data:', extractedData);
        console.log('Medicine name extracted:', extractedData.name);
        console.log('Medicine dosage extracted:', extractedData.dosage);
        console.log('Medicine type extracted:', extractedData.type);
        console.log('Medicine illness extracted:', extractedData.illness);
        console.log('Medicine expiry extracted:', extractedData.expiryDate);

        // Validation: Check for common hallucination patterns
        const hallucinationChecks = [
          { field: 'name', patterns: ['Ibuprofen', 'Paracetamol', 'Aspirin'], description: 'Common painkiller names' },
          { field: 'dosage', patterns: ['400mg', '500mg', '600mg'], description: 'Common painkiller dosages' },
          { field: 'type', patterns: ['Pain Relief', 'Pain'], description: 'Generic pain relief types' },
          { field: 'illness', patterns: ['Pain', 'Fever'], description: 'Generic pain/fever indications' }
        ];

        let potentialHallucination = false;
        for (const check of hallucinationChecks) {
          if (extractedData[check.field] && check.patterns.some(pattern => 
            extractedData[check.field].toLowerCase().includes(pattern.toLowerCase())
          )) {
            console.log(`⚠️ POTENTIAL HALLUCINATION DETECTED in ${check.field}: "${extractedData[check.field]}" - ${check.description}`);
            potentialHallucination = true;
          }
        }

        if (potentialHallucination) {
          console.log('�� WARNING: AI may be hallucinating common medicine patterns instead of reading actual text');
        }

        return res.status(200).json(extractedData);

      } catch (error) {
        console.error('Medicine extraction failed:', error);
        return res.status(500).json({
          error: 'Medicine extraction failed',
          details: error.message
        });
      }
    }

    // Branch: travel pack suggestions
    if (body && body.type === 'travel-pack') {
      console.log('Travel pack request received');
      
      // Return static travel pack suggestions
      return res.status(200).json({
        fromCabinet: [
          {
            name: "Paracetamol 500mg",
            reason: "Pain relief and fever reduction",
            qty: 1
          }
        ],
        toBuy: [
          {
            name: "Motion sickness tablets",
            reason: "Travel comfort",
            qty: 1
          },
          {
            name: "Sunscreen SPF 30+",
            reason: "Sun protection",
            qty: 1
          }
        ],
        message: "Static travel pack suggestions",
        generatedAt: new Date().toISOString()
      });
    }

    // Default branch: return essential medicines as fallback
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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
