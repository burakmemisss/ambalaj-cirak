import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { getSuppliers, createSupplier, deleteSupplier, uploadPriceFile, getSupplierPrices, Supplier, PriceItem } from "../services/api";
import { COLORS } from "../constants";

export const SuppliersScreen: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"self" | "external">("external");
  const [currency, setCurrency] = useState("TRY");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Prices Modal State
  const [pricesModalVisible, setPricesModalVisible] = useState(false);
  const [selectedSupplierName, setSelectedSupplierName] = useState("");
  const [supplierPrices, setSupplierPrices] = useState<PriceItem[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);

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
      if (Platform.OS === "web") {
        window.alert("Lütfen tedarikçi / firma adını girin.");
      } else {
        Alert.alert("Eksik Bilgi", "Lütfen tedarikçi / firma adını girin.");
      }
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

      setSuppliers((prev) => [newSup, ...prev]);
      
      if (Platform.OS === "web") {
        window.alert(`"${name}" tedarikçi listesine eklendi.`);
      } else {
        Alert.alert("Başarılı! ✅", `"${name}" tedarikçi listesine eklendi.`);
      }

      setName("");
      setContact("");
      setNotes("");
      setModalVisible(false);
    } catch (err) {
      if (Platform.OS === "web") {
        window.alert("Tedarikçi eklenirken hata oluştu.");
      } else {
        Alert.alert("Hata", "Tedarikçi eklenirken hata oluştu.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmAndDelete = async (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteSupplier(id);
    } catch (err) {
      // sessizce geç
    }
  };

  const handleDelete = (id: string, supplierName: string) => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(`"${supplierName}" tedarikçisini silmek istediğinize emin misiniz?`);
      if (confirmed) {
        confirmAndDelete(id);
      }
    } else {
      Alert.alert(
        "Tedarikçi Silinsin mi?",
        `"${supplierName}" tedarikçisini silmek istediğinize emin misiniz?`,
        [
          { text: "İptal", style: "cancel" },
          {
            text: "Sil",
            style: "destructive",
            onPress: () => confirmAndDelete(id),
          },
        ]
      );
    }
  };

  // GERÇEK DOSYA SEÇME VE YÜKLEME FONKSİYONU (Excel / PDF)
  const handleUploadFile = (supplierId: string, supplierName: string) => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx,.xls,.pdf";
      input.onchange = async (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          const file = target.files[0];
          setUploadingId(supplierId);
          try {
            const res = await uploadPriceFile(supplierId, file);
            window.alert(`✅ Başarılı! "${file.name}" yüklendi.\n${res.imported || 0} adet ürün fiyatı sisteme kaydedildi.`);
          } catch (err: any) {
            const errMsg = err?.message || "Bilinmeyen hata";
            window.alert(`❌ Dosya yükleme hatası:\n\n${errMsg}\n\nÖnerilen format: Excel (.xlsx) veya CSV (.csv)`);
          } finally {
            setUploadingId(null);
          }
        }
      };
      input.click();
    } else {
      Alert.alert(
        "Fiyat Listesi Yükleme",
        `"${supplierName}" için Excel/PDF dosyanızı cihazınızdan seçip yüklemek için web arayüzünü kullanabilirsiniz.`
      );
    }
  };

  const handleViewPrices = async (supplierId: string, supplierName: string) => {
    setSelectedSupplierName(supplierName);
    setPricesModalVisible(true);
    setLoadingPrices(true);
    try {
      const res = await getSupplierPrices();
      const filtered = res.prices.filter((p) => p.supplier_id === supplierId);
      setSupplierPrices(filtered);
    } catch (err) {
      if (Platform.OS === "web") {
        window.alert("Fiyat listesi yüklenemedi.");
      } else {
        Alert.alert("Hata", "Fiyat listesi yüklenemedi.");
      }
      setSupplierPrices([]);
    } finally {
      setLoadingPrices(false);
    }
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
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {suppliers.map((item) => (
            <View key={item.id} style={styles.card}>
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
                    activeOpacity={0.7}
                  >
                    <Text style={styles.deleteBtnText}>Sil 🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {item.contact && <Text style={styles.contactText}>📞 İletişim: {item.contact}</Text>}
              {item.notes && <Text style={styles.notesText}>📝 {item.notes}</Text>}

              <View style={styles.cardActions}>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, uploadingId === item.id && styles.disabledBtn, { flex: 1, marginRight: 8 }]}
                    onPress={() => handleUploadFile(item.id, item.name)}
                    disabled={uploadingId === item.id}
                  >
                    <Text style={styles.actionBtnText}>
                      {uploadingId === item.id ? "📄 Yükleniyor..." : "📄 Liste Yükle (Excel/PDF)"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.viewBtn, { flex: 1 }]}
                    onPress={() => handleViewPrices(item.id, item.name)}
                  >
                    <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>
                      📋 Listeyi Gör
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
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
                  {submitting ? "Kaydedilizce..." : "Tedarikçiyi Kaydet"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FİYAT LİSTESİ MODALI */}
      <Modal visible={pricesModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "90%", width: "95%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 {selectedSupplierName} Fiyat Listesi</Text>
              <TouchableOpacity onPress={() => setPricesModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingPrices ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 40 }} />
            ) : supplierPrices.length === 0 ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text style={{ color: COLORS.textSecondary }}>Henüz kayıtlı fiyat bulunmuyor.</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }}>
                <View style={{ padding: 16 }}>
                  {supplierPrices.map((item, index) => (
                    <View key={item.id || index.toString()} style={styles.priceRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.priceProductName}>{item.product_name}</Text>
                        <Text style={styles.priceProductCat}>{item.product_category}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.priceMainText}>
                          {item.base_price} {item.currency} / {item.unit}
                        </Text>
                        {item.price_in_try && item.currency !== "TRY" && (
                          <Text style={styles.priceSubText}>≈ {item.price_in_try.toFixed(2)} TL</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
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
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 160,
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
    gap: 8,
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
    backgroundColor: `${COLORS.error}25`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteBtnText: {
    color: COLORS.error,
    fontWeight: "700",
    fontSize: 11,
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
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  viewBtn: {
    backgroundColor: `${COLORS.primary}15`,
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  priceProductName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  priceProductCat: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  priceMainText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.success,
  },
  priceSubText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
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
