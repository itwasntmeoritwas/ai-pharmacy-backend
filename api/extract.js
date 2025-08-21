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
      console.log('Family members:', body.familyMembers);
      console.log('Medicine cabinet summary:', body.medicineCabinetSummary);
      
      try {
        console.log('Checking OpenAI API key for essential medicines...');
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        console.log('OpenAI API key is configured for essential medicines');
        
        // Use require instead of import for Vercel compatibility
        const OpenAI = require('openai');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const essentialMedicinesPrompt = `You are a pharmacist creating a COMPREHENSIVE essential medicines list for a family. 

FAMILY INFORMATION:
${body.familyMembers ? JSON.stringify(body.familyMembers, null, 2) : 'No family members provided'}

MEDICINE CABINET SUMMARY:
${body.medicineCabinetSummary || 'No existing medicines'}

TASK: Generate a COMPREHENSIVE list of 40-50 essential medicines that should be in every household, considering:
- Family composition (ages, genders, locations)
- Existing medicines (avoid duplicates)
- Common health needs and emergencies
- Age-appropriate formulations
- Location-specific availability

REQUIRED RESPONSE FORMAT (JSON array):
[
  {
    "name": "Medicine name with dosage",
    "category": "EXACT category name from the list below",
    "reason": "Why this medicine is essential",
    "priority": "high/medium/low",
    "ageGroup": "Who this is for (e.g., Adults 18+, Children 2-12, All ages)",
    "dosage": "Recommended dosage information",
    "notes": "Important safety notes or usage instructions"
  }
]

CRITICAL: You MUST use EXACTLY these category names (copy and paste them exactly):

1. "FEVER & PAIN RELIEF"
2. "FIRST AID & WOUND CARE"
3. "ALLERGY & SKIN CARE"
4. "DIGESTIVE HEALTH"
5. "RESPIRATORY HEALTH"
6. "HEADACHE & MIGRAINE"
7. "VIRAL & BACTERIAL INFECTIONS"
8. "ELDERLY HEALTH"
9. "NATURAL & ALTERNATIVE"
10. "EMERGENCY & MONITORING"
11. "TRAVEL & PREVENTION"

CRITICAL REQUIREMENTS:
- Generate EXACTLY 40-50 medicines total (NOT 10, NOT 20, but 40-50)
- Distribute medicines evenly across ALL 11 categories (about 4-5 medicines per category)
- Use EXACT category names from the list above (with quotes and exact capitalization)
- Be comprehensive and thorough
- If you generate fewer than 40 medicines, the response is incomplete and will be rejected`;

        console.log('Sending essential medicines request to OpenAI...');
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a pharmacist creating comprehensive essential medicines lists. You MUST generate EXACTLY 40-50 medicines, no less.' },
            { role: 'user', content: essentialMedicinesPrompt }
          ],
          max_tokens: 8000, // Increased for 40-50 medicines
          temperature: 0.1, // Low temperature for consistency
        });

        const content = response.choices[0]?.message?.content;
        console.log('OpenAI essential medicines response:', content);

        // Try to extract JSON from the response
        let essentialMedicines;
        try {
          // Look for JSON array in the response
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            essentialMedicines = JSON.parse(jsonMatch[0]);
            
            // Validate medicine count
            if (!essentialMedicines || essentialMedicines.length < 40) {
              console.log(`⚠️ AI generated only ${essentialMedicines?.length || 0} medicines, need at least 40. Regenerating...`);
              
              // Try one more time with stronger prompt
              const retryPrompt = `You generated only ${essentialMedicines?.length || 0} medicines, but I need EXACTLY 40-50 medicines. Please generate a COMPLETE list with 40-50 medicines covering all categories.`;
              
              const retryResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: 'You are a pharmacist. You MUST generate EXACTLY 40-50 medicines, no exceptions.' },
                  { role: 'user', content: essentialMedicinesPrompt },
                  { role: 'assistant', content: content },
                  { role: 'user', content: retryPrompt }
                ],
                max_tokens: 8000,
                temperature: 0.0,
              });
              
              const retryContent = retryResponse.choices[0]?.message?.content;
              console.log('OpenAI retry response:', retryContent);
              
              const retryJsonMatch = retryContent.match(/\[[\s\S]*\]/);
              if (retryJsonMatch) {
                essentialMedicines = JSON.parse(retryJsonMatch[0]);
                console.log(`Retry generated ${essentialMedicines?.length || 0} medicines`);
              }
            }
          } else {
            throw new Error('No JSON array found in response');
          }
        } catch (parseError) {
          console.error('Failed to parse OpenAI essential medicines response:', parseError);
          // Fallback to static list if AI fails
          essentialMedicines = [
            {
              name: "Paracetamol 500mg (Acetaminophen)",
              category: "FEVER & PAIN RELIEF",
              reason: "Basic pain relief and fever reduction",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "500-1000mg every 4-6 hours",
              notes: "Safe for most people, good for headaches and fever"
            },
            {
              name: "Ibuprofen 400mg (Advil/Motrin)",
              category: "FEVER & PAIN RELIEF",
              reason: "Anti-inflammatory pain relief",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "200-400mg every 4-6 hours",
              notes: "Good for muscle pain, inflammation, and period pain"
            },
            {
              name: "Betadine Antiseptic (Povidone-iodine)",
              category: "FIRST AID & WOUND CARE",
              reason: "Clean wounds and prevent infection",
              priority: "high",
              ageGroup: "All ages",
              dosage: "Apply directly to wound",
              notes: "Essential for treating cuts and scrapes"
            },
            {
              name: "Children's Paracetamol Syrup (Acetaminophen)",
              category: "FEVER & PAIN RELIEF",
              reason: "Safe pain relief for children",
              priority: "high",
              ageGroup: "Children 2-12 years",
              dosage: "Based on weight and age",
              notes: "Liquid form, consult dosing chart"
            },
            {
              name: "Antihistamine (Cetirizine)",
              category: "ALLERGY & SKIN CARE",
              reason: "Allergy relief for adults",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "10mg once daily",
              notes: "Non-drowsy formula preferred"
            },
            {
              name: "Loperamide (Imodium)",
              category: "DIGESTIVE HEALTH",
              reason: "Treat acute diarrhea",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "2mg initially, then 1mg after each loose stool",
              notes: "Maximum 8mg per day"
            },
            {
              name: "Antacid (Calcium Carbonate)",
              category: "DIGESTIVE HEALTH",
              reason: "Relieve heartburn and indigestion",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "500-1000mg as needed",
              notes: "Chewable tablets for quick relief"
            },
            {
              name: "Hydrocortisone Cream 1%",
              category: "ALLERGY & SKIN CARE",
              reason: "Relieve itching and skin irritation",
              priority: "medium",
              ageGroup: "All ages",
              dosage: "Apply directly to affected area",
              notes: "For insect bites, rashes, and minor skin conditions"
            },
            {
              name: "Sterile Gauze Pads (Various sizes)",
              category: "FIRST AID & WOUND CARE",
              reason: "Cover and protect wounds",
              priority: "high",
              ageGroup: "All ages",
              dosage: "2x2\", 4x4\", and 4x6\" sizes",
              notes: "Various sizes for different wound types"
            },
            {
              name: "Medical Tape (Hypoallergenic)",
              category: "FIRST AID & WOUND CARE",
              reason: "Secure bandages and dressings",
              priority: "high",
              ageGroup: "All ages",
              dosage: "Paper tape for sensitive skin",
              notes: "Hypoallergenic preferred"
            },
            {
              name: "Aspirin 300mg",
              category: "FEVER & PAIN RELIEF",
              reason: "Pain relief and blood thinning",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "300-600mg every 4-6 hours",
              notes: "Not recommended for children under 16"
            },
            {
              name: "Cough Syrup (Dextromethorphan)",
              category: "RESPIRATORY HEALTH",
              reason: "Relieve dry cough",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "15ml every 4-6 hours",
              notes: "Non-drowsy formula preferred"
            },
            {
              name: "Nasal Decongestant (Xylometazoline)",
              category: "RESPIRATORY HEALTH",
              reason: "Relieve blocked nose",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "2 sprays in each nostril up to 3 times daily",
              notes: "Use for maximum 7 days only"
            },
            {
              name: "Eye Drops (Sodium Chloride)",
              category: "FIRST AID & WOUND CARE",
              reason: "Rinse irritated eyes",
              priority: "medium",
              ageGroup: "All ages",
              dosage: "1-2 drops as needed",
              notes: "Sterile saline solution for eye irrigation"
            },
            {
              name: "Digital Thermometer",
              category: "EMERGENCY & MONITORING",
              reason: "Monitor body temperature",
              priority: "high",
              ageGroup: "All ages",
              dosage: "Oral, underarm, or rectal use",
              notes: "Essential for fever monitoring"
            },
            {
              name: "Blood Pressure Monitor",
              category: "EMERGENCY & MONITORING",
              reason: "Monitor blood pressure",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "Use as directed by healthcare provider",
              notes: "Important for those with hypertension"
            }
          ];
        }

        console.log('Final essential medicines count:', essentialMedicines.length);
        console.log('Categories found:', [...new Set(essentialMedicines.map(m => m.category))]);
        
        if (essentialMedicines.length < 40) {
          console.log(`⚠️ WARNING: Still only ${essentialMedicines.length} medicines generated, using fallback list`);
          // Use the enhanced fallback list instead
          essentialMedicines = [
            {
              name: "Paracetamol 500mg (Acetaminophen)",
              category: "FEVER & PAIN RELIEF",
              reason: "Basic pain relief and fever reduction",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "500-1000mg every 4-6 hours",
              notes: "Safe for most people, good for headaches and fever"
            },
            {
              name: "Ibuprofen 400mg (Advil/Motrin)",
              category: "FEVER & PAIN RELIEF",
              reason: "Anti-inflammatory pain relief",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "200-400mg every 4-6 hours",
              notes: "Good for muscle pain, inflammation, and period pain"
            },
            {
              name: "Betadine Antiseptic (Povidone-iodine)",
              category: "FIRST AID & WOUND CARE",
              reason: "Clean wounds and prevent infection",
              priority: "high",
              ageGroup: "All ages",
              dosage: "Apply directly to wound",
              notes: "Essential for treating cuts and scrapes"
            },
            {
              name: "Children's Paracetamol Syrup (Acetaminophen)",
              category: "FEVER & PAIN RELIEF",
              reason: "Safe pain relief for children",
              priority: "high",
              ageGroup: "Children 2-12 years",
              dosage: "Based on weight and age",
              notes: "Liquid form, consult dosing chart"
            },
            {
              name: "Antihistamine (Cetirizine)",
              category: "ALLERGY & SKIN CARE",
              reason: "Allergy relief for adults",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "10mg once daily",
              notes: "Non-drowsy formula preferred"
            },
            {
              name: "Loperamide (Imodium)",
              category: "DIGESTIVE HEALTH",
              reason: "Treat acute diarrhea",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "2mg initially, then 1mg after each loose stool",
              notes: "Maximum 8mg per day"
            },
            {
              name: "Antacid (Calcium Carbonate)",
              category: "DIGESTIVE HEALTH",
              reason: "Relieve heartburn and indigestion",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "500-1000mg as needed",
              notes: "Chewable tablets for quick relief"
            },
            {
              name: "Hydrocortisone Cream 1%",
              category: "ALLERGY & SKIN CARE",
              reason: "Relieve itching and skin irritation",
              priority: "medium",
              ageGroup: "All ages",
              dosage: "Apply directly to affected area",
              notes: "For insect bites, rashes, and minor skin conditions"
            },
            {
              name: "Sterile Gauze Pads (Various sizes)",
              category: "FIRST AID & WOUND CARE",
              reason: "Cover and protect wounds",
              priority: "high",
              ageGroup: "All ages",
              dosage: "2x2\", 4x4\", and 4x6\" sizes",
              notes: "Various sizes for different wound types"
            },
            {
              name: "Medical Tape (Hypoallergenic)",
              category: "FIRST AID & WOUND CARE",
              reason: "Secure bandages and dressings",
              priority: "high",
              ageGroup: "All ages",
              dosage: "Paper tape for sensitive skin",
              notes: "Hypoallergenic preferred"
            },
            {
              name: "Aspirin 300mg",
              category: "FEVER & PAIN RELIEF",
              reason: "Pain relief and blood thinning",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "300-600mg every 4-6 hours",
              notes: "Not recommended for children under 16"
            },
            {
              name: "Cough Syrup (Dextromethorphan)",
              category: "RESPIRATORY HEALTH",
              reason: "Relieve dry cough",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "15ml every 4-6 hours",
              notes: "Non-drowsy formula preferred"
            },
            {
              name: "Nasal Decongestant (Xylometazoline)",
              category: "RESPIRATORY HEALTH",
              reason: "Relieve blocked nose",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "2 sprays in each nostril up to 3 times daily",
              notes: "Use for maximum 7 days only"
            },
            {
              name: "Eye Drops (Sodium Chloride)",
              category: "FIRST AID & WOUND CARE",
              reason: "Rinse irritated eyes",
              priority: "medium",
              ageGroup: "All ages",
              dosage: "1-2 drops as needed",
              notes: "Sterile saline solution for eye irrigation"
            },
            {
              name: "Digital Thermometer",
              category: "EMERGENCY & MONITORING",
              reason: "Monitor body temperature",
              priority: "high",
              ageGroup: "All ages",
              dosage: "Oral, underarm, or rectal use",
              notes: "Essential for fever monitoring"
            },
            {
              name: "Blood Pressure Monitor",
              category: "EMERGENCY & MONITORING",
              reason: "Monitor blood pressure",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "Use as directed by healthcare provider",
              notes: "Important for those with hypertension"
            }
          ];
        }
        
        return res.status(200).json({
          essentialMedicines,
          message: `AI-generated essential medicines list (${essentialMedicines.length} medicines)`,
          generatedAt: new Date().toISOString()
        });

      } catch (error) {
        console.error('Essential medicines generation failed:', error);
        // Return fallback static list if AI fails
        return res.status(200).json({
          essentialMedicines: [
            {
              name: "Paracetamol 500mg (Acetaminophen)",
              category: "FEVER & PAIN RELIEF",
              reason: "Basic pain relief and fever reduction",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "500-1000mg every 4-6 hours",
              notes: "Safe for most people, good for headaches and fever"
            },
            {
              name: "Ibuprofen 400mg (Advil/Motrin)",
              category: "FEVER & PAIN RELIEF",
              reason: "Anti-inflammatory pain relief",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "200-400mg every 4-6 hours",
              notes: "Good for muscle pain, inflammation, and period pain"
            },
            {
              name: "Betadine Antiseptic (Povidone-iodine)",
              category: "FIRST AID & WOUND CARE",
              reason: "Clean wounds and prevent infection",
              priority: "high",
              ageGroup: "All ages",
              dosage: "Apply directly to wound",
              notes: "Essential for treating cuts and scrapes"
            },
            {
              name: "Children's Paracetamol Syrup (Acetaminophen)",
              category: "FEVER & PAIN RELIEF",
              reason: "Safe pain relief for children",
              priority: "high",
              ageGroup: "Children 2-12 years",
              dosage: "Based on weight and age",
              notes: "Liquid form, consult dosing chart"
            },
            {
              name: "Antihistamine (Cetirizine)",
              category: "ALLERGY & SKIN CARE",
              reason: "Allergy relief for adults",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "10mg once daily",
              notes: "Non-drowsy formula preferred"
            },
            {
              name: "Loperamide (Imodium)",
              category: "DIGESTIVE HEALTH",
              reason: "Treat acute diarrhea",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "2mg initially, then 1mg after each loose stool",
              notes: "Maximum 8mg per day"
            },
            {
              name: "Antacid (Calcium Carbonate)",
              category: "DIGESTIVE HEALTH",
              reason: "Relieve heartburn and indigestion",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "500-1000mg as needed",
              notes: "Chewable tablets for quick relief"
            },
            {
              name: "Hydrocortisone Cream 1%",
              category: "ALLERGY & SKIN CARE",
              reason: "Relieve itching and skin irritation",
              priority: "medium",
              ageGroup: "All ages",
              dosage: "Apply directly to affected area",
              notes: "For insect bites, rashes, and minor skin conditions"
            },
            {
              name: "Sterile Gauze Pads (Various sizes)",
              category: "FIRST AID & WOUND CARE",
              reason: "Cover and protect wounds",
              priority: "high",
              ageGroup: "All ages",
              dosage: "2x2\", 4x4\", and 4x6\" sizes",
              notes: "Various sizes for different wound types"
            },
            {
              name: "Medical Tape (Hypoallergenic)",
              category: "FIRST AID & WOUND CARE",
              reason: "Secure bandages and dressings",
              priority: "high",
              ageGroup: "All ages",
              dosage: "Paper tape for sensitive skin",
              notes: "Hypoallergenic preferred"
            },
            {
              name: "Antibiotic for traveler's diarrhea (e.g., Azithromycin)",
              category: "DIGESTIVE HEALTH",
              reason: "To treat bacterial infections if diarrhea persists.",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "6 tablets",
              notes: "To treat bacterial infections if diarrhea persists."
            },
            {
              name: "Insect repellent (DEET-based)",
              category: "DIGESTIVE HEALTH",
              reason: "To protect against mosquito bites and reduce the risk of dengue and other mosquito-borne diseases.",
              priority: "high",
              ageGroup: "Adults 18+ years",
              dosage: "1 bottle",
              notes: "To protect against mosquito bites and reduce the risk of dengue and other mosquito-borne diseases."
            },
            {
              name: "Sunscreen (SPF 30 or higher)",
              category: "DIGESTIVE HEALTH",
              reason: "To protect against sunburn, especially in outdoor settings.",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "1 bottle",
              notes: "To protect against sunburn, especially in outdoor settings."
            },
            {
              name: "First aid kit (band-aids, antiseptic wipes, etc.)",
              category: "DIGESTIVE HEALTH",
              reason: "For minor injuries and cuts that may occur during travel.",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "1 kit",
              notes: "For minor injuries and cuts that may occur during travel."
            },
            {
              name: "Hepatitis A",
              category: "DIGESTIVE HEALTH",
              reason: "Check with your doctor for destination-specific requirements",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "Check with your doctor for destination-specific requirements",
              notes: "Check with your doctor for destination-specific requirements"
            },
            {
              name: "Hepatitis B",
              category: "DIGESTIVE HEALTH",
              reason: "Check with your doctor for destination-specific requirements",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "Check with your doctor for destination-specific requirements",
              notes: "Check with your doctor for destination-specific requirements"
            },
            {
              name: "Typhoid",
              category: "DIGESTIVE HEALTH",
              reason: "Check with your doctor for destination-specific requirements",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "Check with your doctor for destination-specific requirements",
              notes: "Check with your doctor for destination-specific requirements"
            },
            {
              name: "Japanese Encephalitis (if traveling to rural areas)",
              category: "DIGESTIVE HEALTH",
              reason: "Check with your doctor for destination-specific requirements",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "Check with your doctor for destination-specific requirements",
              notes: "Check with your doctor for destination-specific requirements"
            },
            {
              name: "Tetanus-Diphtheria-Pertussis (Tdap) booster if not up to date",
              category: "DIGESTIVE HEALTH",
              reason: "Check with your doctor for destination-specific requirements",
              priority: "medium",
              ageGroup: "Adults 18+ years",
              dosage: "Check with your doctor for destination-specific requirements",
              notes: "Check with your doctor for destination-specific requirements"
            }
          ],
          message: "Fallback essential medicines list (AI generation failed) - 20 medicines",
          generatedAt: new Date().toISOString()
        });
      }
    }

    // Branch: medicine extraction from images
    if (body && body.images && body.images.length > 0) {
      console.log('Medicine extraction request received with', body.images.length, 'images');
      console.log('Request body keys:', Object.keys(body));
      console.log('Images array length:', body.images?.length);
      console.log('First image preview:', body.images[0]?.substring(0, 100) + '...');
      console.log('Image data type:', typeof body.images[0]);
      
      try {
        console.log('Checking OpenAI API key...');
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        console.log('OpenAI API key is configured');
        
        // Use require instead of import for Vercel compatibility
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
  "prescriptionOnly": true/false if stated, otherwise null",
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

        console.log('Sending request to OpenAI...');
        
        // Format images for OpenAI Vision API
        const formattedImages = body.images.map(imageData => ({
          type: "image_url",
          image_url: {
            url: imageData
          }
        }));
        
        console.log('Formatted images for OpenAI:', formattedImages.length);
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: [
                { type: 'text', text: userPrompt },
                ...formattedImages
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.0, // Zero temperature for maximum consistency
        });
        console.log('OpenAI request completed successfully');

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
          console.log('⚠️ WARNING: AI may be hallucinating common medicine patterns instead of reading actual text');
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
      console.log('Full request body:', JSON.stringify(body, null, 2));
      console.log('Travel details:', {
        destination: body.city,
        duration: body.durationDays,
        startDate: body.startDate,
        familyMembers: body.members,
        medicineCabinet: body.medicineSummary,
        allBodyKeys: Object.keys(body)
      });
      
      try {
        console.log('Checking OpenAI API key for travel pack...');
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        console.log('OpenAI API key is configured for travel pack');
        
        // Use require instead of import for Vercel compatibility
        const OpenAI = require('openai');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const travelPackPrompt = `You are a travel medicine specialist creating a PERSONALIZED travel pack for a family traveling to a specific destination.

TRAVEL DETAILS:
Destination: ${body.city || 'Destination not specified'}
Duration: ${body.durationDays || 'Duration not specified'}
Start Date: ${body.startDate || 'Start date not specified'}

FAMILY MEMBERS TRAVELING:
${body.members ? JSON.stringify(body.members, null, 2) : 'No family members specified'}

EXISTING MEDICINE CABINET:
${body.medicineSummary || 'No existing medicines'}

TASK: Create a COMPREHENSIVE and PERSONALIZED travel pack considering:

1. DESTINATION-SPECIFIC HEALTH RISKS:
   - Local food and water safety
   - Tropical diseases (malaria, dengue, etc.)
   - Climate and altitude considerations
   - Local healthcare availability
   - Required vaccinations

2. FAMILY MEMBER CONSIDERATIONS:
   - Ages and health conditions
   - Allergies and sensitivities
   - Existing medications
   - Special needs (pregnancy, chronic conditions)

3. TRAVEL DURATION:
   - Short vs. long-term needs
   - Refill requirements
   - Emergency supplies

REQUIRED RESPONSE FORMAT (JSON):
{
  "fromCabinet": [
    {
      "name": "Medicine name with dosage",
      "reason": "Why to take this from existing supply",
      "qty": "Quantity to pack",
      "priority": "high/medium/low"
    }
  ],
  "toBuy": [
    {
      "name": "Medicine name with dosage",
      "reason": "Why to buy this for the trip",
      "qty": "Quantity to buy",
      "priority": "high/medium/low"
    }
  ],
  "healthAdvice": "Specific health advice for this destination",
  "vaccinations": ["List of recommended vaccinations"],
  "precautions": ["List of health precautions for this destination"]
}

IMPORTANT: 
- Be SPECIFIC to the destination (e.g., Sri Lanka = tropical diseases, water safety)
- Consider family member ages and health conditions
- Prioritize destination-specific risks
- Include both preventive and treatment medications
- Be comprehensive but practical`;

        console.log('Sending travel pack request to OpenAI...');
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a travel medicine specialist with expertise in destination-specific health risks and personalized travel medicine recommendations.' },
            { role: 'user', content: travelPackPrompt }
          ],
          max_tokens: 2000,
          temperature: 0.1,
        });

        const content = response.choices[0]?.message?.content;
        console.log('OpenAI travel pack response:', content);

        // Try to extract JSON from the response
        let travelPackData;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            travelPackData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch (parseError) {
          console.error('Failed to parse OpenAI travel pack response:', parseError);
          // Fallback to generic suggestions
          travelPackData = generateGenericFallback();
        }

        console.log('Travel pack generated:', travelPackData);
        return res.status(200).json({
          ...travelPackData,
          message: `AI-generated personalized travel pack for ${body.city || 'your destination'}`,
          generatedAt: new Date().toISOString()
        });

      } catch (error) {
        console.error('Travel pack generation failed:', error);
        // Return generic fallback if AI fails
        return res.status(200).json({
          ...generateGenericFallback(),
          message: `Generic travel pack suggestions (AI generation failed) - consult your doctor for destination-specific advice`,
          generatedAt: new Date().toISOString()
        });
      }
    }

    // Generic fallback for when AI fails
    function generateGenericFallback() {
      return {
        fromCabinet: [
          {
            name: "Paracetamol 500mg",
            reason: "Pain relief and fever reduction",
            qty: 1,
            priority: "high"
          }
        ],
        toBuy: [
          {
            name: "Motion sickness tablets",
            reason: "Travel comfort",
            qty: 1,
            priority: "medium"
          },
          {
            name: "Sunscreen SPF 30+",
            reason: "Sun protection",
            qty: 1,
            priority: "medium"
          }
        ],
        healthAdvice: "General travel health recommendations - consult your doctor for destination-specific advice",
        vaccinations: ["Check with your doctor for destination-specific requirements"],
        precautions: ["Practice good hygiene", "Stay hydrated", "Protect against sun exposure"]
      };
    }

    // Default branch: return essential medicines as fallback
    console.log('No specific request type, returning essential medicines fallback');
    return res.status(200).json({
      essentialMedicines: [
        {
          name: "Paracetamol 500mg (Acetaminophen)",
          category: "FEVER & PAIN RELIEF",
          reason: "Basic pain relief and fever reduction",
          priority: "high",
          ageGroup: "Adults 18+ years",
          dosage: "500-1000mg every 4-6 hours",
          notes: "Safe for most people, good for headaches and fever"
        },
        {
          name: "Ibuprofen 400mg (Advil/Motrin)",
          category: "FEVER & PAIN RELIEF",
          reason: "Anti-inflammatory pain relief",
          priority: "high",
          ageGroup: "Adults 18+ years",
          dosage: "200-400mg every 4-6 hours",
              notes: "Good for muscle pain, inflammation, and period pain"
        },
        {
          name: "Betadine Antiseptic (Povidone-iodine)",
          category: "FIRST AID & WOUND CARE",
          reason: "Clean wounds and prevent infection",
          priority: "high",
          ageGroup: "All ages",
          dosage: "Apply directly to wound",
          notes: "Essential for treating cuts and scrapes"
        },
        {
          name: "Antihistamine (Cetirizine)",
          category: "ALLERGY & SKIN CARE",
          reason: "Allergy relief for adults",
          priority: "medium",
          ageGroup: "Adults 18+ years",
          dosage: "10mg once daily",
          notes: "Non-drowsy formula preferred"
        },
        {
          name: "Digital Thermometer",
          category: "EMERGENCY & MONITORING",
          reason: "Monitor body temperature",
          priority: "high",
          ageGroup: "All ages",
          dosage: "Oral, underarm, or rectal use",
          notes: "Essential for fever monitoring"
        }
      ],
      fallback: true,
      message: "Essential medicines fallback list (no specific request type) - 5 medicines",
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
