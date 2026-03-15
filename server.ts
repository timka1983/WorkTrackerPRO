import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post("/api/payments/create-session", async (req, res) => {
    try {
      const { orgId, planType, amount } = req.body;
      
      // Here you would normally call Stripe or ЮKassa API
      // Example for a mock implementation:
      const sessionId = Math.random().toString(36).substring(7);
      
      // In a real app, this URL would be from the payment provider
      // For demo purposes, we'll redirect to a mock success page or just return success
      const confirmationUrl = `/payment-success?session_id=${sessionId}&orgId=${orgId}&plan=${planType}`;

      res.json({ url: confirmationUrl });
    } catch (error) {
      console.error("Payment session error:", error);
      res.status(500).json({ error: "Failed to create payment session" });
    }
  });

  // Webhook for payment confirmation
  app.post("/api/payments/webhook", async (req, res) => {
    const { type, data } = req.body;
    
    if (type === "payment.succeeded") {
      const { orgId, planType } = data;
      // In a real app, you would update the database here using a service role key
      console.log(`Payment succeeded for org ${orgId}, plan ${planType}`);
    }
    
    res.json({ received: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
