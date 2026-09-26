import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { getExchangeRates } from "../services/api";
import { COLORS } from "../constants";

export const ExchangeRatesScreen: React.FC = () => {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const data = await getExchangeRates();
      setRates(data);
    } catch (err) {
      // Varsayılan kurlar (fallback)
      setRates({
        USD: 34.25,
        EUR: 38.10,
        GBP: 45.60,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💱 Canlı Döviz Kurları</Text>
        <Text style={styles.headerSubtitle}>
          ExchangeRate-API ile günlük otomatik TRY çevirisi
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Mevcut Çevrim Kurları (TRY Bazlı):</Text>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.grid}>
            {Object.entries(rates).map(([currency, rate]) => (
              <View key={currency} style={styles.rateCard}>
                <Text style={styles.currencyCode}>1 {currency}</Text>
                <Text style={styles.rateValue}>₺{Number(rate).toFixed(2)}</Text>
                <Text style={styles.updateBadge}>Günlük Cache ✅</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.refreshBtn} onPress={fetchRates}>
          <Text style={styles.refreshText}>🔄 Kurları Yenile</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 Çırak Döviz Kurlarını Nasıl Kullanır?</Text>
          <Text style={styles.infoBody}>
            Tedarikçiden USD veya EUR bazlı bir hammadde/ürün fiyat listesi alındığında, Çırak bu kurları kullanarak anlık TL karşılığını ve birim maliyeti otomatik hesaplar.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  rateCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  currencyCode: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  rateValue: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.success,
    marginVertical: 6,
  },
  updateBadge: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  refreshBtn: {
    backgroundColor: COLORS.surfaceLight,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  refreshText: {
    color: COLORS.primaryLight,
    fontWeight: "700",
  },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.accent,
    marginBottom: 6,
  },
  infoBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
