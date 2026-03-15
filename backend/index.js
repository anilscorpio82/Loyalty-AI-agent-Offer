require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');
const { pushQueue } = require('./worker');
const { tokenizePIIMiddleware } = require('./vault');

const prisma = new PrismaClient();
const app = express();
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Apply Secure HTTP Headers (HSTS, CSP, etc.)
app.use(helmet());

// Apply strict CORS origin matching
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    optionsSuccessStatus: 200
}));

// Apply Rate Limiting (DoS Protection)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100,
    message: "Too many requests from this IP, please try again after 15 minutes",
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.use(express.json());

// --- User & Consent Management (GDPR Opt-in/out) ---
app.post('/api/users/consent', async (req, res) => {
  const { anonymousId, trackingOptIn, locationOptIn, aiOptIn } = req.body;
  try {
    const user = await prisma.user.upsert({
      where: { anonymousId: anonymousId || 'temp' },
      update: { trackingOptIn, locationOptIn, aiOptIn },
      create: { anonymousId: anonymousId || `anon_${Date.now()}`, trackingOptIn, locationOptIn, aiOptIn }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:anonymousId', async (req, res) => {
  const { anonymousId } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { anonymousId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Purge User Data (Right To Erasure)
app.delete('/api/users/:anonymousId', async (req, res) => {
    const { anonymousId } = req.params;
    try {
      await prisma.user.delete({ where: { anonymousId } });
      res.json({ success: true, message: "User data completely erased." });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

// --- Analytics Tracking (Behavioral engine) ---
app.post('/api/analytics', async (req, res) => {
  const { userId, eventType, eventData } = req.body;
  try {
    // Check if user has opted in to tracking
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (!user.trackingOptIn && !user.aiOptIn)) {
       return res.status(403).json({ error: 'User has not opted in to tracking' });
    }
    
    const event = await prisma.analyticsEvent.create({
      data: { userId, eventType, eventData }
    });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Offers API ---
app.get('/api/offers', async (req, res) => {
  try {
    const offers = await prisma.offer.findMany();
    res.json(offers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- LLM Orchestration (Phase 5) ---
app.post('/api/chat', tokenizePIIMiddleware, async (req, res) => {
  const { anonymousId, message } = req.body;
  
  try {
    // 1. Fetch User Context (No PII)
    const user = await prisma.user.findUnique({ where: { anonymousId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // 2. Enforce AI Opt-in (GDPR)
    if (!user.aiOptIn) {
      return res.json({ reply: "I cannot provide personalized AI recommendations until you Opt-in to AI Services in your Privacy Settings."});
    }

    // 3. Fetch Applicable Context (Offers) + ML Next Best Offer Predictions
    const offers = await prisma.offer.findMany();
    
    let mlRecommendations = "No ML predictions available at this time.";
    try {
        const mlRes = await fetch(`http://localhost:8000/predict/nbo?anonymousId=${anonymousId}`);
        if (mlRes.ok) {
           const mlData = await mlRes.json();
           if (mlData.recommendations && mlData.recommendations.length > 0) {
               mlRecommendations = `The ML Engine predicts you have a high ${mlData.confidence_score * 100}% probability of converting on these highly recommended Offer IDs: ${mlData.recommendations.join(', ')}`;
           }
        }
    } catch (e) {
        console.warn("ML Service unavailable or timeout", e.message);
    }
    
    // 4. Construct System Prompt (Data Sanitization Layer)
    const systemPrompt = `
      You are the "Loyalty Offers Agent". You help users maximize their points.
      Current User Context:
      - Points Balance: ${user.pointsBalance}
      - Allowed to use Location Context? ${user.locationOptIn ? 'YES' : 'NO'}
      
      Available Offers (JSON): ${JSON.stringify(offers)}
      
      Machine Learning Insights:
      ${mlRecommendations}
      
      RULES:
      1. ONLY recommend offers from the Available Offers JSON.
      2. If you see 'Machine Learning Insights', forcefully suggest those specific Offer IDs as they are mathematically the "Next Best Offer" for this specific user.
      3. If the user asks for Location deals, check the 'Location Context' flag. If NO, refuse to answer based on privacy settings.
      4. Your response MUST be concise and conversational.
      5. DO NOT mention PII (names, emails) even if the user provides it.
    `;

    // 5. Query OpenAI with Tool Calling (Function Calling)
    if (process.env.OPENAI_API_KEY) {
      const tools = [
        {
          type: "function",
          function: {
            name: "get_applicable_offers",
            description: "Fetches live loyalty offers from the secure database based on a user's intent.",
            parameters: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  description: "Optional category filter, e.g., 'TRAVEL', 'DINING', 'HOTEL'."
                }
              }
            }
          }
        }
      ];

      const conversation = [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ];

      let response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: conversation,
        tools: tools,
        tool_choice: "auto",
        temperature: 0.7,
      });

      const responseMessage = response.choices[0].message;

      // Handle Tool Calls (If the LLM decides it needs real-time database data)
      if (responseMessage.tool_calls) {
         conversation.push(responseMessage); // Append the assistant's tool-call request

         for (const toolCall of responseMessage.tool_calls) {
            if (toolCall.function.name === "get_applicable_offers") {
               const args = JSON.parse(toolCall.function.arguments);
               const whereClause = args.category ? { categories: { has: args.category.toUpperCase() } } : {};
               
               // Safely query Prisma DB dynamically based on LLM's request
               const dbOffers = await prisma.offer.findMany({ where: whereClause });
               
               conversation.push({
                 tool_call_id: toolCall.id,
                 role: "tool",
                 name: "get_applicable_offers",
                 content: JSON.stringify(dbOffers)
               });
            }
         }

         // Get final synthesized response from LLM after tools are resolved
         response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: conversation,
            stream: true,
         });
         
         res.setHeader('Content-Type', 'text/event-stream');
         res.setHeader('Cache-Control', 'no-cache');
         res.setHeader('Connection', 'keep-alive');

         for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
               res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
            }
         }
         res.write('data: [DONE]\n\n');
         res.end();
      } else {
         // Standard Streaming Response without tool calls
         const stream = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: conversation,
            stream: true,
         });

         res.setHeader('Content-Type', 'text/event-stream');
         res.setHeader('Cache-Control', 'no-cache');
         res.setHeader('Connection', 'keep-alive');

         for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
               res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
            }
         }
         res.write('data: [DONE]\n\n');
         res.end();
      }

    } else {
       // Mock Fallback if User hasn't provided the API Key yet
       console.warn("OPENAI_API_KEY is missing. Using mocked LLM logic.");
       setTimeout(() => {
          let reply = "Hello! I am your secure Loyalty Offers Agent (Mock Mode). How can I help you maximize your points today?";
          if (message.toLowerCase().includes("compare")) {
             reply = "Comparing your available offers... The Platinum dining deal yields 2.5 cents per point, while the Hotel deal yields 1.8 cents per point.";
          }
          res.json({ reply });
       }, 1000);
    }
    
  } catch (error) {
    console.error("LLM Error:", error);
    res.status(500).json({ error: "Failed to generate AI response. Make sure OPENAI_API_KEY is valid." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
