import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message = "", history = [], feedId } = body;

    const trimmed = (message as string).trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const lower = trimmed.toLowerCase();
    let reply = "";
    let suggestions: string[] = [];

    // 1. Inquiries about the Green Line and Vehicle Counting
    if (
      lower.includes("green line") ||
      lower.includes("line") ||
      lower.includes("counter") ||
      lower.includes("cross") ||
      lower.includes("optical") ||
      lower.includes("yolo")
    ) {
      reply =
        "🟢 **The Optical Green Line Explained:**\n\n" +
        "The bright green horizontal line across the road is our **Computer Vision Trigger Zone**. Here is how it operates:\n\n" +
        "1. **Real-time Detection:** As vehicles pass across the live camera feed, our optical AI model (YOLOv8) tracks their bounding trajectories.\n" +
        "2. **Tripwire Increment:** The instant a vehicle intersects and crosses the green threshold, the HUD crossing counter ticks up with an active laser pulse.\n" +
        "3. **Provably Fair Resolution:** Active bets (e.g. OVER 13 or UNDER 10) are resolved based on verified crossing counts during the betting round.\n\n" +
        "Watch the counter at the top of the video stage—it updates live with every crossing!";

      suggestions = [
        "What are the current odds?",
        "Which camera has the heaviest traffic?",
        "How do I place a bet?",
      ];
    }
    // 2. Inquiries about Odds & Markets
    else if (
      lower.includes("odd") ||
      lower.includes("market") ||
      lower.includes("multiplier") ||
      lower.includes("payout") ||
      lower.includes("star pick") ||
      lower.includes("over") ||
      lower.includes("under")
    ) {
      reply =
        "📊 **Current Optical Markets & Odds:**\n\n" +
        "• **UNDER 10 (2.25x Multiplier):** Steady payout if fewer than 10 vehicles cross the green line.\n" +
        "• **OVER 13 (3.60x Multiplier - HOT 🔥):** Most popular wager on high-volume highways like I-405.\n" +
        "• **STAR PICK (18.0x Multiplier 🌟):** High-multiplier precision wager for exactly 7 vehicles.\n" +
        "• **EXACT HIGH (36.0x Multiplier 🚀):** Jackpot tier payout for exactly 20 vehicles.\n\n" +
        "Select your preferred market chip below the video, choose your stake, and tap **PLACE BET** to enter the live round!";

      suggestions = [
        "How does the Green Line work?",
        "Can I bet in my local currency?",
        "Which road has the most traffic?",
      ];
    }
    // 3. Inquiries about Camera Feeds & Locations
    else if (
      lower.includes("camera") ||
      lower.includes("feed") ||
      lower.includes("traffic") ||
      lower.includes("i-405") ||
      lower.includes("los angeles") ||
      lower.includes("chelsea") ||
      lower.includes("london") ||
      lower.includes("amsterdam") ||
      lower.includes("a10")
    ) {
      reply =
        "🛣️ **Verified Live Traffic Streams:**\n\n" +
        "Jungle Bet connects to 3 verified high-speed optical feeds:\n\n" +
        "1. 🇺🇸 **Los Angeles - I-405 (Caltrans Overpass):** 10-lane super-highway with dense flow, ideal for **OVER 13** wagers.\n" +
        "2. 🇬🇧 **London - Chelsea Bridge (TfL Junction):** Famous urban crossing with distinct traffic pulses and light cycles.\n" +
        "3. 🇳🇱 **Amsterdam - A10 (Rijkswaterstaat Ring):** High-velocity highway overpass with steady European corridor traffic.\n\n" +
        "You can switch between streams at any moment using the camera tabs above the video!";

      suggestions = [
        "Explain the Green Line counter",
        "What are the best odds right now?",
        "How do I deposit funds?",
      ];
    }
    // 4. Inquiries about Deposits, Payments & Currencies
    else if (
      lower.includes("deposit") ||
      lower.includes("money") ||
      lower.includes("balance") ||
      lower.includes("withdraw") ||
      lower.includes("currency") ||
      lower.includes("mpesa") ||
      lower.includes("momo") ||
      lower.includes("pay")
    ) {
      reply =
        "💳 **Wallet, Currencies & Instant Payments:**\n\n" +
        "Jungle Bet supports 6 currencies with instant localized rails:\n\n" +
        "• **USD ($), GBP (£), EUR (€):** Instant credit cards (Stripe) & international debit.\n" +
        "• **KES (Kenyan Shilling):** Instant M-Pesa STK Push.\n" +
        "• **UGX (Ugandan Shilling):** MTN MoMo & Airtel Money.\n" +
        "• **NGN (Nigerian Naira):** Paystack & Flutterwave bank rails.\n\n" +
        "To check your balance or fund your account, open the **Settings gear icon (⚙️)** in the top-right header and tap **View Balance/History** or **Deposit**!";

      suggestions = [
        "How do I enable 2-Factor Authentication?",
        "What are the current odds?",
        "Explain the Green Line",
      ];
    }
    // 5. Inquiries about Security, 2FA, or Fraud Protection
    else if (
      lower.includes("security") ||
      lower.includes("2fa") ||
      lower.includes("safe") ||
      lower.includes("fraud") ||
      lower.includes("ban") ||
      lower.includes("flag") ||
      lower.includes("fair")
    ) {
      reply =
        "🛡️ **Jungle Bet Security & Anti-Fraud Shield:**\n\n" +
        "• **Bet Velocity Anomaly:** Users placing >10 bets in 1 minute trigger automated security flags.\n" +
        "• **Jackpot Anomaly:** Instant payouts over $1,000 trigger automated audit verification.\n" +
        "• **Live Alert Stream:** Real-time fraud detection alerts stream directly to this terminal and [/admin/dashboard](/admin/dashboard).\n" +
        "• **Provably Fair Optical AI:** Bet outcomes are determined by verifiable video streams rather than pseudo-random number generators.";

      suggestions = [
        "What are the odds for OVER 13?",
        "How does the Green Line work?",
        "View Admin Dashboard",
      ];
    }
    // 6. Inquiries about Support / Account
    else if (
      lower.includes("support") ||
      lower.includes("help") ||
      lower.includes("delete") ||
      lower.includes("account") ||
      lower.includes("contact")
    ) {
      reply =
        "👑 **Jungle Bet VIP Concierge & Support:**\n\n" +
        "I'm Leo, available 24/7 right here in chat! You can also manage your account details through the **Settings gear (⚙️)** in the top header:\n\n" +
        "• **View Balance/History:** Full ledger of your bets, wins, and deposits.\n" +
        "• **2-Factor Authentication:** Toggle one-click security.\n" +
        "• **Account Settings:** Update your racer profile & details.\n" +
        "• **Email Support:** Direct inquiries to `support@junglebet.io`.\n" +
        "• **Delete Account:** Permanent self-service closure in Settings.";

      suggestions = [
        "Explain the Green Line",
        "What are the current odds?",
        "Which camera is best?",
      ];
    }
    // 7. General friendly / greeting
    else {
      reply =
        `🦁 **Leo here, at your service!**\n\n` +
        `I'm your Jungle Bet AI Strategist. You can ask me about:\n\n` +
        `• 🟢 **The Optical Green Line:** How the vehicle counter works in real-time.\n` +
        `• 📊 **Odds & Multipliers:** Analysis on OVER 13, UNDER 10, or STAR PICK.\n` +
        `• 🛣️ **Live Road Feeds:** Conditions on LA I-405, London Chelsea Bridge, and Amsterdam A10.\n` +
        `• 💳 **Deposits & Wallet:** Multi-currency support and payment methods.\n\n` +
        `What would you like to explore?`;

      suggestions = [
        "How does the Green Line work?",
        "What are the current odds?",
        "Which camera has the heaviest traffic?",
        "How do I deposit funds?",
      ];
    }

    return NextResponse.json({
      reply,
      suggestions,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
