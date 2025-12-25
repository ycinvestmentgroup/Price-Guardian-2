import { GoogleGenerativeAI } from "@google/generative-ai";

// Vite uses import.meta.env.VITE_... instead of process.env
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export const extractInvoiceData = async (base64Data: string, mimeType: string = 'application/pdf') => {
  // Use gemini-1.5-flash for the best balance of speed and extraction accuracy
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const prompt = `
    Extract data from this document. Identify if it is an 'invoice', 'credit_note', 'debit_note', or 'quote'. 
    Return a JSON object with: docType, supplierName, date (YYYY-MM-DD), dueDate (YYYY-MM-DD), 
    invoiceNumber, bankAccount, creditTerm, totalAmount, gstAmount, abn, tel, email, address,
    and items (array of objects with name, quantity, unitPrice, total).
  `;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    },
    { text: prompt },
  ]);

  const response = await result.response;
  const text = response.text();
  
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse AI response:", text);
    throw new Error("Invalid data format received from AI");
  }
};
