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
