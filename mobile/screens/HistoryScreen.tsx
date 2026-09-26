import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from "react-native";
import { COLORS } from "../constants";

interface CalculationRecord {
  id: string;
  description: string;
  category: string;
  cost: number;
  unit: string;
  confidence: number;
  learnedAt: string;
  learnedBy: string;
}

export const HistoryScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [historyItems] = useState<CalculationRecord[]>([
    {
      id: "1",
      description: "80g Kraft Kağıt Poşet 30x20x10",
      category: "kağıt poşet",
      cost: 8.5,
      unit: "adet",
      confidence: 95,
      learnedAt: "2026-03-15",
      learnedBy: "Usta (Siz)",
    },
    {
      id: "2",
      description: "50cm 17 micron Palet Streç Film",
      category: "streç film",
      cost: 52.0,
      unit: "kg",
      confidence: 88,
      learnedAt: "2026-02-10",
      learnedBy: "Marmara Plastik Fiyat Listesi",
    },
    {
      id: "3",
      description: "Oluklu Karton Koli 40x30x30 Dopplex",
      category: "karton kutu",
      cost: 16.2,
      unit: "adet",
      confidence: 92,
      learnedAt: "2026-01-20",
      learnedBy: "Usta (Siz)",
    },
  ]);

  const filteredItems = historyItems.filter((item) =>
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🧠 Çırağın Öğrenme Hafızası</Text>
        <Text style={styles.headerSubtitle}>
          Supabase pgvector ile saklanan vektör veritabanı hafızası
        </Text>
      </View>

      <View style={styles.content}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Hafızada ara (örn: kraft, streç, koli)..."
          placeholderTextColor={COLORS.textMuted}
        />

        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.productDesc}>{item.description}</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>%{item.confidence} Güven</Text>
                </View>
              </View>

              <Text style={styles.categoryText}>Kategori: {item.category}</Text>

              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Kayıtlı Birim Maliyet:</Text>
                <Text style={styles.costValue}>
                  ₺{item.cost.toFixed(2)} / {item.unit}
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.footerText}>📅 {item.learnedAt}</Text>
                <Text style={styles.footerText}>👤 Kaynak: {item.learnedBy}</Text>
              </View>
            </View>
          )}
        />
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
    flex: 1,
    padding: 16,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 16,
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productDesc: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  confidenceBadge: {
    backgroundColor: `${COLORS.success}25`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  confidenceText: {
    color: COLORS.success,
    fontWeight: "700",
    fontSize: 11,
  },
  categoryText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  costLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  costValue: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.accent,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
