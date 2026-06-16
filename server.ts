import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for product search
  app.post("/api/search-product", async (req, res) => {
    try {
      const { brand, productType, sortBy, filter } = req.body;
      if (!brand || !productType) {
        return res.status(400).json({ error: "Brand and productType are required" });
      }

      let prompt = `List current or popular products from the brand "${brand}" in the category "${productType}" using your existing knowledge. Provide exactly 2-3 different models to keep it fast.
Return a JSON object with this exact structure:
{
  "products": [
    {
      "model": "Model Number or Name",
      "overview": "Brief overview...",
      "imageUrl": "",
      "specs": ["Spec 1", "Spec 2"],
      "details": "Detailed description for the full view..."
    }
  ]
}`;

      if (sortBy) {
        prompt += `\n\nSort the products by: ${sortBy}.`;
      }
      if (filter) {
        prompt += `\n\nFilter the products to match these criteria: ${filter}.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.7
        }
      });

      let responseText = response.text || "{}";
      let parsedJSON;
      try {
         parsedJSON = JSON.parse(responseText);
      } catch (e) {
         parsedJSON = { products: [{ model: "Result", overview: responseText, imageUrl: "", specs: [], details: "" }] };
      }

      // Add generated image placeholder if missing
      if (parsedJSON && Array.isArray(parsedJSON.products)) {
         parsedJSON.products = parsedJSON.products.map((p: any) => {
            p.imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(brand + ' ' + p.model + ' ' + productType + ' product photography studio lighting')}?width=800&height=600&nologo=true`;
            return p;
         });
      }

      res.json({ result: parsedJSON });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      const brand = req.body.brand || 'Product';
      const productType = req.body.productType || 'Item';
      // Fallback for API limit or similar issues so app doesn't break
      const dummyJSON = {
        products: [
          {
            model: `Sample ${brand} ${productType}`,
            overview: `A great sample product from ${brand}. (Note: using default placeholder because of AI API issues)`,
            imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop",
            specs: ["High Performance", "Energy Efficient", "Sleek Design"],
            details: "Detailed review currently unavailable. This is a placeholder display."
          }
        ]
      };
      res.json({ result: dummyJSON });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
