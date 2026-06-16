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

      let prompt = `Search the web for current products from the brand "${brand}" in the category "${productType}".
Please provide a catalog list of at least 3-5 different models.

Return the response STRICTLY as a JSON object with this exact structure:
\`\`\`json
{
  "products": [
    {
      "model": "Model Number or Name",
      "overview": "Brief overview...",
      "imageUrl": "Direct, verifiable URL to a real image of the product. Use Search to find a valid image URL (e.g. from official sites or retailers, ending in .jpg or .png). DO NOT make up URLs. If you cannot find a valid image URL, return an empty string.",
      "specs": ["Spec 1", "Spec 2"],
      "details": "Detailed description for the full view..."
    }
  ]
}
\`\`\`
Do NOT use Markdown blocks outside of the JSON payload. Ensure it is valid JSON.`;

      if (sortBy) {
        prompt += `\n\nSort the products by: ${sortBy}.`;
      }
      if (filter) {
        prompt += `\n\nFilter the products to match these criteria: ${filter}.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      let responseText = response.text || "";
      let parsedJSON;
      try {
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
           parsedJSON = JSON.parse(jsonMatch[1]);
        } else {
           parsedJSON = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
        }
      } catch (e) {
         // Fallback if parsing fails, wrap the raw text in our expected structure
         parsedJSON = { products: [{ model: "Result", overview: responseText, imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop", specs: [], details: "" }] };
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
