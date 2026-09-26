import { Platform } from "react-native";
import { API_BASE_URL, DEFAULT_USER_ID } from "../constants";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageUri?: string;
  confidence?: number;
  similarItems?: SimilarItem[];
}

export interface SimilarItem {
  id: string;
  description: string;
  cost: number;
  unit: string;
  similarity: number;
}

export interface SendMessageResponse {
  session_id: string;
  message: string;
  confidence: number;
  similar_count: number;
  similar_items: SimilarItem[];
}

export interface ImageAnalysis {
  analysis: {
    product_category: string;
    material: string;
    estimated_dimensions: string;
    color_print: string;
    description: string;
    confidence: number;
  };
  confidence: number;
  similar_products: SimilarItem[];
  image_base64: string;
}

// ── Chat API ──────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  sessionId: string | null,
  history: ChatMessage[],
  imageBase64?: string
): Promise<SendMessageResponse> {
  const response = await fetch(`${API_BASE_URL}/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      user_id: DEFAULT_USER_ID,
      message,
      image_base64: imageBase64,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API hatası: ${err}`);
  }

  return response.json();
}

export async function submitFeedback(
  calculationId: string,
  isCorrect: boolean,
  correctedCost?: number,
  notes?: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/chat/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      calculation_id: calculationId,
      is_correct: isCorrect,
      corrected_cost: correctedCost,
      correction_notes: notes,
      user_id: DEFAULT_USER_ID,
    }),
  });
  return response.json();
}

export async function learnFromUser(data: {
  productDescription: string;
  productCategory: string;
  inputParameters: Record<string, unknown>;
  reasoningSteps: Array<{ name: string; description: string; formula?: string; result?: number }>;
  finalCost: number;
  unit: string;
  supplierId?: string;
}): Promise<{ calculation_id: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/chat/learn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: DEFAULT_USER_ID,
      product_description: data.productDescription,
      product_category: data.productCategory,
      input_parameters: data.inputParameters,
      reasoning_steps: data.reasoningSteps,
      final_cost: data.finalCost,
      unit: data.unit,
      supplier_id: data.supplierId,
    }),
  });
  return response.json();
}

// ── Vision API (Cross-Platform Görsel Yükleme) ─────────────────

export async function analyzeProductImage(imageUri: string): Promise<ImageAnalysis> {
  const formData = new FormData();

  if (Platform.OS === "web" || imageUri.startsWith("data:") || imageUri.startsWith("blob:")) {
    const res = await fetch(imageUri);
    const blob = await res.blob();
    const file = new File([blob], "product.jpg", { type: "image/jpeg" });
    formData.append("file", file);
  } else {
    formData.append("file", {
      uri: imageUri,
      type: "image/jpeg",
      name: "product.jpg",
    } as unknown as Blob);
  }

  const response = await fetch(`${API_BASE_URL}/vision/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Görsel analiz edilemedi.");
  return response.json();
}

// ── Fiyat Listesi Yükleme (Excel/PDF) ───────────────────────

export async function uploadPriceFile(supplierId: string, file: File | { uri: string; name: string; type: string }): Promise<{ success: boolean; imported?: number; message?: string }> {
  const formData = new FormData();

  if (file instanceof File) {
    formData.append("file", file);
  } else {
    formData.append("file", file as unknown as Blob);
  }

  const isPdf = file.name.toLowerCase().endsWith(".pdf");
  const endpoint = isPdf
    ? `${API_BASE_URL}/prices/import/pdf/${supplierId}`
    : `${API_BASE_URL}/prices/import/excel/${supplierId}`;

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Yükleme hatası: ${errText}`);
  }

  return response.json();
}

// ── Exchange Rates ──────────────────────────────────────

export async function getExchangeRates(): Promise<Record<string, number>> {
  const response = await fetch(`${API_BASE_URL}/exchange-rates/`);
  return response.json();
}

// ── Suppliers ──────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  type: "self" | "external";
  currency: string;
  contact?: string;
  notes?: string;
}

export async function getSuppliers(): Promise<Supplier[]> {
  const response = await fetch(`${API_BASE_URL}/suppliers/`);
  return response.json();
}

export async function createSupplier(data: {
  name: string;
  type: "self" | "external";
  currency: string;
  contact?: string;
  notes?: string;
}): Promise<Supplier> {
  const response = await fetch(`${API_BASE_URL}/suppliers/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Tedarikçi eklenemedi");
  return response.json();
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  await fetch(`${API_BASE_URL}/suppliers/${supplierId}`, {
    method: "DELETE",
  });
}
