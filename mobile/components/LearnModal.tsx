import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { learnFromUser } from "../services/api";
import { COLORS } from "../constants";

interface LearnModalProps {
  visible: boolean;
  onClose: () => void;
  onLearned: (description: string, cost: number) => void;
  initialDescription?: string;
}

export const LearnModal: React.FC<LearnModalProps> = ({
  visible,
  onClose,
  onLearned,
  initialDescription = "",
}) => {
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState("kağıt poşet");
  const [finalCost, setFinalCost] = useState("");
  const [unit, setUnit] = useState("adet");
  const [gramaj, setGramaj] = useState("80");
  const [dimensions, setDimensions] = useState("30x20x10");
  const [wastePercent, setWastePercent] = useState("12");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!description || !finalCost) {
      Alert.alert("Eksik Bilgi", "Lütfen ürün açıklaması ve nihai maliyeti girin.");
      return;
    }

    setLoading(true);
    try {
      const costNum = parseFloat(finalCost.replace(",", "."));

      await learnFromUser({
        productDescription: description,
        productCategory: category,
        inputParameters: {
          gramaj: parseFloat(gramaj) || 0,
          dimensions,
          waste_percent: parseFloat(wastePercent) || 0,
          notes,
        },
        reasoningSteps: [
          {
            name: "Gramaj & Ölçü Al",
            description: `Gramaj: ${gramaj}g/m², Ölçü: ${dimensions}`,
          },
          {
            name: "Fire Oranı Ekle",
            description: `%${wastePercent} üretim firesi eklendi`,
          },
          {
            name: "Nihai Maliyet",
            description: `Birim maliyet ₺${costNum.toFixed(2)} olarak belirlendi`,
            result: costNum,
          },
        ],
        finalCost: costNum,
        unit,
      });

      Alert.alert("Öğrenildi! ✅", "Çırak bu formülü ve maliyeti hafızasına kaydetti.");
      onLearned(description, costNum);
      onClose();
    } catch (error) {
      Alert.alert("Hata", "Öğrenme kaydedilirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>📖 Çırağa Yeni Hesaplama Öğret</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            <Text style={styles.label}>Ürün Tanımı *</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Örn: 80g Kraft Kağıt Poşet 30x20x10"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.label}>Kategori</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="kağıt poşet, streç film, karton kutu..."
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text style={styles.label}>Birim Maliyet (₺) *</Text>
                <TextInput
                  style={styles.input}
                  value={finalCost}
                  onChangeText={setFinalCost}
                  keyboardType="decimal-pad"
                  placeholder="8.50"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.flex1}>
                <Text style={styles.label}>Birim</Text>
                <TextInput
                  style={styles.input}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="adet, kg, rulo"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>

            <Text style={styles.sectionHeader}>Adım Adım Hesaplama Detayları:</Text>

            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text style={styles.label}>Gramaj (g/m²)</Text>
                <TextInput
                  style={styles.input}
                  value={gramaj}
                  onChangeText={setGramaj}
                  keyboardType="numeric"
                  placeholder="80"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={styles.flex1}>
                <Text style={styles.label}>Ölçüler (EnxBoyxYük)</Text>
                <TextInput
                  style={styles.input}
                  value={dimensions}
                  onChangeText={setDimensions}
                  placeholder="30x20x10"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>

            <Text style={styles.label}>Fire Oranı (%)</Text>
            <TextInput
              style={styles.input}
              value={wastePercent}
              onChangeText={setWastePercent}
              keyboardType="numeric"
              placeholder="12"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.label}>Öğrenme Notları / Püf Noktaları</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              placeholder="Örn: Kağıt ton fiyatı yükselirse bu birim maliyet %10 artar."
              placeholderTextColor={COLORS.textMuted}
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.disabledBtn]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveText}>
                {loading ? "Kaydediliyor..." : "Çırağın Hafızasına Kaydet"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  closeText: {
    fontSize: 20,
    color: COLORS.textSecondary,
  },
  form: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primaryLight,
    marginTop: 12,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  flex1: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLight,
    alignItems: "center",
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 2,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
  },
  disabledBtn: {
    opacity: 0.5,
  },
  saveText: {
    color: COLORS.white,
    fontWeight: "700",
  },
});
