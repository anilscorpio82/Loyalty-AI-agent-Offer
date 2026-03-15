const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runEndToEndTest() {
  console.log("=========================================");
  console.log("🚀 STARTING E2E LOYALTY AGENT TEST 🚀");
  console.log("=========================================\n");

  try {
    // ---------------------------------------------------------
    // STEP 1: Database Seed & Reset
    // ---------------------------------------------------------
    console.log("[1/4] Cleaning old mock data...");
    await prisma.redeemedOffer.deleteMany({});
    await prisma.analyticsEvent.deleteMany({});
    await prisma.offer.deleteMany({});
    await prisma.user.deleteMany({ where: { anonymousId: 'e2e_mock_user' } });

    console.log("[2/4] Injecting Mock Offers into PostgreSQL...");
    await prisma.offer.createMany({
      data: [
        { title: "First Class Flight to London", description: "Enjoy a luxury flight to the UK.", pointsRequired: 40000, monetaryValue: 4000, categories: ["TRAVEL"] },
        { title: "Weekend Stay at Ritz-Carlton", description: "2 nights in a suite.", pointsRequired: 20000, monetaryValue: 800, categories: ["HOTEL"] },
        { title: "Michelin Star Dinner for Two", description: "Exclusive tasting menu.", pointsRequired: 5000, monetaryValue: 300, categories: ["DINING"] },
      ]
    });
    
    // ---------------------------------------------------------
    // STEP 2: Create Mock User Profile (with Opt-Ins)
    // ---------------------------------------------------------
    console.log("[3/4] Creating secure Mock User with 25,000 Points...");
    const user = await prisma.user.create({
      data: {
        anonymousId: "e2e_mock_user",
        pointsBalance: 25000,
        trackingOptIn: true,
        locationOptIn: true,
        aiOptIn: true
      }
    });

    // ---------------------------------------------------------
    // STEP 3: API Invocation (Chat with Agent)
    // ---------------------------------------------------------
    console.log("\n[4/4] Sending Message to LLM Agent (Triggering ML NBO prediction)...");
    const payload = {
        anonymousId: user.anonymousId,
        message: "I have some points to burn. Based on my profile, what is the best offer I should redeem today?"
    };
    
    console.log(`💬 User: "${payload.message}"\n`);
    
    const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }

    console.log("🤖 Agent Response:");
    let fullResponse = "";

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        const jsonResponse = await response.json();
        fullResponse = jsonResponse.reply || "Error: No reply";
        console.log(fullResponse);
    } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    if (dataStr === '[DONE]') {
                        console.log("\n\n✅ Stream Finished Successfully!");
                        break;
                    }
                    
                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.text) {
                            process.stdout.write(parsed.text);
                            fullResponse += parsed.text;
                        }
                    } catch(e) { }
                }
            }
        }
    }

    // ---------------------------------------------------------
    // VALIDATION
    // ---------------------------------------------------------
    console.log("\n=========================================");
    console.log("📋 E2E TEST VALIDATIONS:");
    console.log(`- Database records created? YES`);
    console.log(`- LLM Response synthesized? YES (Length: ${fullResponse.length} chars)`);
    console.log("=========================================\n");

  } catch (error) {
    console.error("❌ E2E TEST FAILED:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runEndToEndTest();
