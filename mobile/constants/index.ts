// Uygulama genelinde kullanılan sabitler

export const API_BASE_URL = __DEV__
  ? "http://localhost:8000/api"   // Geliştirme
  : "https://your-oracle-server.com/api"; // Prodüksiyon

// Geçici kullanıcı ID (Faz 5'te auth eklenecek)
export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

export const COLORS = {
  primary: "#1E6FD9",
  primaryDark: "#1558B0",
  primaryLight: "#4A90E2",
  secondary: "#0D9488",
  accent: "#F59E0B",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  background: "#0F172A",
  surface: "#1E293B",
  surfaceLight: "#334155",
  text: "#F1F5F9",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  border: "#2D3F55",
  white: "#FFFFFF",
};

export const FONTS = {
  regular: "System",
  medium: "System",
  bold: "System",
};

export const CONFIDENCE_COLORS = {
  high: "#10B981",    // %85+
  medium: "#F59E0B",  // %60-84
  low: "#EF4444",     // %0-59
};

export const getConfidenceColor = (score: number): string => {
  if (score >= 85) return CONFIDENCE_COLORS.high;
  if (score >= 60) return CONFIDENCE_COLORS.medium;
  return CONFIDENCE_COLORS.low;
};

export const getConfidenceLabel = (score: number): string => {
  if (score >= 85) return "Yüksek Güven";
  if (score >= 60) return "Orta Güven";
  if (score >= 30) return "Düşük Güven";
  return "Bilmiyor";
};
