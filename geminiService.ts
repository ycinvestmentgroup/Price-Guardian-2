import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiResponse } from "./types";

// Validate API key exists
if (!import.meta.env.VITE_GEMINI_API_KEY) {
  console.error("VITE_GEMINI_API_KEY is not set in environment variables");
}

// Initialize Gemini AI
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Configuration for the model
const MODEL_NAME = "gemini-1.5-flash";

export const extractInvoiceData = async (
  base64Data: string, 
  mimeType: string = 'application/pdf'
): Promise<GeminiResponse> => {
  try {
    // Check if API key is available
    if (!apiKey) {
      throw new Error("Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your environment variables.");
    }

    // Initialize the model with JSON response format
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1, // Lower temperature for more consistent results
      },
    });

    // Detailed prompt for invoice extraction
    const prompt = `
      You are an expert invoice data extraction system. Extract all relevant data from the provided document.
      
      CRITICAL INSTRUCTIONS:
      1. Return ONLY valid JSON, no other text
      2. Identify the document type exactly as one of: 'invoice', 'credit_note', 'debit_note', 'quote'
      3. Format dates as YYYY-MM-DD
      4. All monetary amounts should be numbers (not strings)
      5. If a field is not found in the document, use null or empty string appropriately
      6. For items array: calculate total = quantity * unitPrice for each item
      
      Required JSON structure:
      {
        "docType": "string",
        "supplierName": "string",
        "date": "string (YYYY-MM-DD)",
        "dueDate": "string (YYYY-MM-DD)",
        "invoiceNumber": "string",
        "bankAccount": "string (or null)",
        "creditTerm": "string (or null)",
        "totalAmount": number,
        "gstAmount": number (or null),
        "abn": "string (or null)",
        "tel": "string (or null)",
        "email": "string (or null)",
        "address": "string (or null)",
        "items": [
          {
            "name": "string",
            "quantity": number,
            "unitPrice": number,
            "total": number
          }
        ]
      }
      
      Document to process:
    `;

    // Generate content from the document
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
      { 
        text: prompt 
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    try {
      // Clean the response text (remove markdown code blocks if present)
      const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
      const parsedData: GeminiResponse = JSON.parse(cleanedText);
      
      // Validate required fields
      if (!parsedData.supplierName || !parsedData.invoiceNumber || !parsedData.date) {
        throw new Error("Missing required fields in AI response");
      }
      
      // Ensure items array exists and calculate totals if missing
      if (!parsedData.items || !Array.isArray(parsedData.items)) {
        parsedData.items = [];
      } else {
        // Recalculate totals to ensure accuracy
        parsedData.items = parsedData.items.map(item => ({
          ...item,
          total: item.quantity * item.unitPrice
        }));
      }
      
      return parsedData;
    } catch (parseError) {
      console.error("Failed to parse AI response:", text);
      console.error("Parse error:", parseError);
      throw new Error(`Invalid JSON response from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Error in extractInvoiceData:", error);
    
    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        throw new Error("Gemini API configuration error: " + error.message);
      } else if (error.message.includes("quota")) {
        throw new Error("API quota exceeded. Please check your Gemini API usage.");
      } else if (error.message.includes("network")) {
        throw new Error("Network error. Please check your internet connection.");
      }
    }
    
    throw new Error(`Failed to extract invoice data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Optional: Helper function to convert file to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Optional: Batch processing multiple files
export const extractMultipleInvoices = async (
  files: File[]
): Promise<GeminiResponse[]> => {
  const results: GeminiResponse[] = [];
  
  for (const file of files) {
    try {
      const base64 = await fileToBase64(file);
      const data = await extractInvoiceData(base64, file.type);
      results.push(data);
    } catch (error) {
      console.error(`Failed to process ${file.name}:`, error);
      // Continue with other files even if one fails
    }
  }
  
  return results;
};

// Optional: Test function to verify API connection
export const testGeminiConnection = async (): Promise<boolean> => {
  try {
    if (!apiKey) {
      return false;
    }
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello");
    await result.response;
    return true;
  } catch (error) {
    console.error("Gemini connection test failed:", error);
    return false;
  }
};

export default {
  extractInvoiceData,
  fileToBase64,
  extractMultipleInvoices,
  testGeminiConnection,
};
