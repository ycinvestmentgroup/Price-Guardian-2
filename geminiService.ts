
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Vite uses import.meta.env instead of process.env
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export const extractInvoiceData = async (base64Data: string, mimeType: string = 'application/pdf') => {
  // Use gemini-1.5-flash for the best balance of speed and extraction accuracy
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          docType: { 
            type: SchemaType.STRING, 
            description: "One of: 'invoice', 'credit_note', 'debit_note', 'quote'" 
          },
          supplierName: { type: SchemaType.STRING },
          date: { type: SchemaType.STRING, description: "Date in YYYY-MM-DD format" },
          dueDate: { type: SchemaType.STRING, description: "Due date in YYYY-MM-DD format" },
          deliveryLocation: { type: SchemaType.STRING },
          invoiceNumber: { type: SchemaType.STRING },
          bankAccount: { type: SchemaType.STRING },
          creditTerm: { type: SchemaType.STRING },
          address: { type: SchemaType.STRING },
          abn: { type: SchemaType.STRING },
          tel: { type: SchemaType.STRING },
          email: { type: SchemaType.STRING },
          totalAmount: { type: SchemaType.NUMBER },
          gstAmount: { type: SchemaType.NUMBER },
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                quantity: { type: SchemaType.NUMBER },
                unitPrice: { type: SchemaType.NUMBER },
                total: { type: SchemaType.NUMBER },
              },
              required: ["name", "quantity", "unitPrice", "total"],
            },
          },
        },
        required: ["docType", "supplierName", "date", "dueDate", "invoiceNumber", "bankAccount", "creditTerm", "totalAmount", "gstAmount", "items", "address", "abn", "tel", "email"],
      },
    },
  });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    },
    {
      text: "Extract all items, quantities, and unit prices from this document. If information is missing, use 'N/A' or 0.",
    },
  ]);

  const response = await result.response;
  const resultText = response.text();
  
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
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    throw new Error("Could not extract structured data from document");
  }
};
