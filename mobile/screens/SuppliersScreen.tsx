import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { getSuppliers, createSupplier, deleteSupplier, Supplier } from "../services/api";
import { COLORS } from "../constants";

export const SuppliersScreen: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"self" | "external">("external");
  const [currency, setCurrency] = useState("TRY");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (err) {
      setSuppliers([
        {
          id: "1",
          name: "Biz (Kendi Üretimimiz)",
          type: "self",
          currency: "TRY",
          notes: "Kağıt poşet, koli ve karton kutu üretimi",
        },
        {
          id: "2",
          name: "Marmara Plastik Ltd.",
          type: "external",
          currency: "USD",
          contact: "ahmet@marmaraplastik.com",
          notes: "Streç film, balonlu naylon tedarikçisi",
        },
        {
          id: "3",
          name: "Ege Ambalaj A.Ş.",
          type: "external",
          currency: "EUR",
          contact: "mehmet@egeambalaj.com",
          notes: "PET ambalaj ve şerit tedarikçisi",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleAddSupplier = async () => {
    if (!name.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen tedarikçi / firma adını girin.");
      return;
    }

    setSubmitting(true);
    try {
      const newSup = await createSupplier({
        name: name.trim(),
        type,
        currency,
        contact: contact.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setSuppliers((prev) => [...prev, newSup]);
      Alert.alert("Başarılı! ✅", `"${name}" tedarikçi listesine eklendi.`);
      
      // Formu sıfırla ve kapat
      setName("");
      setContact("");
      setNotes("");
      setModalVisible(false);
    } catch (err) {
      Alert.alert("Hata", "Tedarikçi eklenirken hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string, supplierName: string) => {
    Alert.alert("Tedarikçi Silinsin mi?", `"${supplierName}" tedarikçisini silmek istediğinize emin misiniz?`, [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSupplier(id);
            setSuppliers((prev) => prev.filter((s) => s.id !== id));
          } catch (err) {
            setSuppliers((prev) => prev.filter((s) => s.id !== id));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Üst Başlık ve Yeni Ekle Butonu */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>🏭 Tedarikçi & Üretici Listesi</Text>
          <TouchableOpacity style={styles.addBtnHeader} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnHeaderText}>+ Yeni Ekle</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          Kendi üreticimiz ("Biz") veya dış tedarikçilerin kur bazlı listeleri
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={suppliers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.nameContainer}>
                  <Text style={styles.supplierName}>{item.name}</Text>
                  <View
                    style={[
                      styles.typeBadge,
                      item.type === "self" ? styles.selfBadge : styles.externalBadge,
                    ]}
                  >
                    <Text style={styles.typeBadgeText}>
                      {item.type === "self" ? "Üretici Biziz" : "Dış Tedarikçi"}
                    </Text>
                  </View>
                </View>

                <View style={styles.rightBadgeContainer}>
                  <View style={styles.currencyBadge}>
                    <Text style={styles.currencyText}>{item.currency}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id, item.name)}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {item.contact && <Text style={styles.contactText}>📞 İletişim: {item.contact}</Text>}
              {item.notes && <Text style={styles.notesText}>📝 {item.notes}</Text>}

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    Alert.alert(
                      "Fiyat Listesi Yükleme",
                      `"${item.name}" için Excel/PDF fiyat listenizi backend /api/prices/import-file endpoint'inden yükleyebilirsiniz.`
                    )
                  }
                >
                  <Text style={styles.actionBtnText}>📄 Fiyat Listesi Yükle (Excel/PDF)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* YENİ TEDARİKÇİ EKLEME MODALI */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🏭 Yeni Tedarikçi Ekle</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.label}>Tedarikçi / Firma Adı *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Örn: Kartal Ambalaj Sanayi Ltd."
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Tedarikçi Türü</Text>
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[styles.typeOption, type === "external" && styles.selectedTypeOption]}
                  onPress={() => setType("external")}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      type === "external" && styles.selectedTypeOptionText,
                    ]}
                  >
                    Dış Tedarikçi
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeOption, type === "self" && styles.selectedTypeOption]}
                  onPress={() => setType("self")}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      type === "self" && styles.selectedTypeOptionText,
                    ]}
                  >
                    Üretici Biziz (Kendi Atölyemiz)
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Çalışılan Para Birimi</Text>
              <View style={styles.currencyRow}>
                {["TRY", "USD", "EUR", "GBP"].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.currencyChip, currency === c && styles.selectedCurrencyChip]}
                    onPress={() => setCurrency(c)}
                  >
                    <Text
                      style={[
                        styles.currencyChipText,
                        currency === c && styles.selectedCurrencyChipText,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>İletişim Bilgileri (E-posta / Telefon / Yetkili)</Text>
              <TextInput
                style={styles.input}
                value={contact}
                onChangeText={setContact}
                placeholder="Örn: Ahmet Bey / 0532 000 00 00"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Notlar / Ürün Kategorileri</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder="Örn: Palet streçi ve koli bandı tedarik ediyor."
                placeholderTextColor={COLORS.textMuted}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelModalText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveModalBtn, submitting && styles.disabledBtn]}
                onPress={handleAddSupplier}
                disabled={submitting}
              >
                <Text style={styles.saveModalText}>
                  {submitting ? "Kaydediliyor..." : "Tedarikçiyi Kaydet"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  addBtnHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnHeaderText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 12,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  nameContainer: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  selfBadge: {
    backgroundColor: `${COLORS.success}25`,
  },
  externalBadge: {
    backgroundColor: `${COLORS.primary}25`,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.text,
  },
  rightBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currencyBadge: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currencyText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: 12,
  },
  deleteBtn: {
    backgroundColor: `${COLORS.error}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteBtnText: {
    color: COLORS.error,
    fontWeight: "700",
    fontSize: 12,
  },
  contactText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  cardActions: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  actionBtn: {
    backgroundColor: COLORS.surfaceLight,
    padding: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  actionBtnText: {
    color: COLORS.primaryLight,
    fontWeight: "600",
    fontSize: 12,
  },
  // Modal Stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
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
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  modalCloseText: {
    fontSize: 20,
    color: COLORS.textSecondary,
  },
  modalForm: {
    padding: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 12,
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
    height: 60,
    textAlignVertical: "top",
  },
  typeSelectorRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeOption: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: "center",
  },
  selectedTypeOption: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}25`,
  },
  typeOptionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  selectedTypeOptionText: {
    color: COLORS.white,
    fontWeight: "700",
  },
  currencyRow: {
    flexDirection: "row",
    gap: 8,
  },
  currencyChip: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: "center",
  },
  selectedCurrencyChip: {
    borderColor: COLORS.accent,
    backgroundColor: `${COLORS.accent}25`,
  },
  currencyChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  selectedCurrencyChipText: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  modalFooter: {
    flexDirection: "row",
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelModalBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLight,
    alignItems: "center",
  },
  cancelModalText: {
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  saveModalBtn: {
    flex: 2,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
  },
  disabledBtn: {
    opacity: 0.5,
  },
  saveModalText: {
    color: COLORS.white,
    fontWeight: "700",
  },
});
