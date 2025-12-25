
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini API with correct parameter name and process.VITE_GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.VITE_GEMINI_API_KEY});

export const extractInvoiceData = async (base64Data: string, mimeType: string = 'application/pdf') => {
  // Using gemini-3-flash-preview for high speed and cost-efficiency (free tier optimization)
  const model = 'gemini-3-flash-preview';
  
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
        {
          text: "Extract all items, quantities, and unit prices from this document. Determine if this is an 'invoice', 'credit_note', 'debit_note', or 'quote'. Also identify: 1. Supplier name, 2. Document date (YYYY-MM-DD), 3. Due date (YYYY-MM-DD), 4. Delivery location, 5. Document/Invoice number, 6. Supplier bank account details, 7. Credit terms, 8. Supplier address, 9. Supplier ABN/Tax ID, 10. Supplier phone, 11. Supplier email, 12. GST amount. If missing, use 'N/A' or 0.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          docType: { 
            type: Type.STRING, 
            description: "One of: 'invoice', 'credit_note', 'debit_note', 'quote'" 
          },
          supplierName: { type: Type.STRING },
          date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
          dueDate: { type: Type.STRING, description: "Due date in YYYY-MM-DD format" },
          deliveryLocation: { type: Type.STRING },
          invoiceNumber: { type: Type.STRING },
          bankAccount: { type: Type.STRING },
          creditTerm: { type: Type.STRING },
          address: { type: Type.STRING },
          abn: { type: Type.STRING },
          tel: { type: Type.STRING },
          email: { type: Type.STRING },
          totalAmount: { type: Type.NUMBER },
          gstAmount: { type: Type.NUMBER },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unitPrice: { type: Type.NUMBER },
                total: { type: Type.NUMBER },
              },
              required: ["name", "quantity", "unitPrice", "total"],
            },
          },
        },
        required: ["docType", "supplierName", "date", "dueDate", "invoiceNumber", "bankAccount", "creditTerm", "totalAmount", "gstAmount", "items", "address", "abn", "tel", "email"],
      },
    },
  });

  const resultText = response.text;
  if (!resultText) {
    throw new Error("Empty response from AI");
  }

  try {
    return JSON.parse(resultText);
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    throw new Error("Could not extract structured data from document");
  }
};
