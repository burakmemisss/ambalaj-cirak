import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  StyleSheet,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { sendChatMessage, analyzeProductImage, submitFeedback, ChatMessage } from "../services/api";
import { ChatMessageItem } from "../components/ChatMessageItem";
import { LearnModal } from "../components/LearnModal";
import { COLORS } from "../constants";

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Merhaba Usta! 👋 Ben senin ambalaj maliyet çırağınım.\n\nFotoğraf gönderebilir, ürün ismi verebilir veya fiyat sorabilirsin. Bilmediğim bir ambalaj türü olursa bana bir kez nasıl hesaplandığını öğret, hemen öğreneyim!",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [learnModalVisible, setLearnModalVisible] = useState(false);
  const [learnInitialDesc, setLearnInitialDesc] = useState("");

  const flatListRef = useRef<FlatList>(null);

  // Fotoğraf Seçme (Kamera veya Galeri)
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("İzin Gerekli", "Fotoğraf yükleyebilmek için galeri izni gereklidir.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].uri) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage) return;

    const userMsgText = inputText.trim();
    const currentImage = selectedImage;

    // Arayüzü temizle
    setInputText("");
    setSelectedImage(null);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userMsgText || "📷 [Görsel Yüklendi]",
      timestamp: new Date(),
      imageUri: currentImage || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      let imageBase64: string | undefined = undefined;

      // Görsel varsa analiz et
      if (currentImage) {
        const visionResult = await analyzeProductImage(currentImage);
        imageBase64 = visionResult.image_base64;
      }

      const res = await sendChatMessage(
        userMsgText || "Bu ambalaj görselinin maliyetini hesaplayabilir misin?",
        sessionId,
        messages,
        imageBase64
      );

      setSessionId(res.session_id);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.message,
        timestamp: new Date(),
        confidence: res.confidence,
        similarItems: res.similar_items,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      Alert.alert("Bağlantı Hatası", "Çırağa ulaşılamadı. Backend servisinizin çalıştığından emin olun.");
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (isCorrect: boolean) => {
    try {
      await submitFeedback("last_calc", isCorrect);
      Alert.alert(
        isCorrect ? "Teşekkürler! 🎉" : "Kaydedildi 📝",
        isCorrect
          ? "Geri bildiriminiz kaydedildi. Çırak bu hesaplamaya daha çok güvenecek."
          : "Geri bildiriminiz kaydedildi. Nasıl yapıldığını öğretmek ister misiniz?"
      );
    } catch (err) {
      // sessizce geç
    }
  };

  const handleOpenLearn = () => {
    setLearnInitialDesc(inputText || "Yeni Ambalaj Ürünü");
    setLearnModalVisible(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Üst Başlık */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎓 AI Ambalaj Çırağı</Text>
        <Text style={styles.headerSubtitle}>Öğrenen Maliyet Asistanı</Text>
      </View>

      {/* Mesaj Listesi */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatMessageItem
            message={item}
            onFeedback={handleFeedback}
            onLearnMore={handleOpenLearn}
          />
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={styles.listContainer}
      />

      {/* Yükleniyor Göstergesi */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primaryLight} size="small" />
          <Text style={styles.loadingText}>Çırak düşünüyor ve hafızasını tarıyor...</Text>
        </View>
      )}

      {/* Önizleme Fotoğrafı */}
      {selectedImage && (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: selectedImage }} style={styles.selectedImageThumb} />
          <TouchableOpacity style={styles.removeImgBtn} onPress={() => setSelectedImage(null)}>
            <Text style={styles.removeImgText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Alt Girdi Çubuğu */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
          <Text style={styles.attachIcon}>📷</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ambalaj adı, ölçü veya soru yaz..."
          placeholderTextColor={COLORS.textMuted}
          multiline
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() && !selectedImage) && styles.disabledSendBtn]}
          onPress={handleSend}
          disabled={!inputText.trim() && !selectedImage}
        >
          <Text style={styles.sendIcon}>➔</Text>
        </TouchableOpacity>
      </View>

      {/* Öğretme Modalı */}
      <LearnModal
        visible={learnModalVisible}
        onClose={() => setLearnModalVisible(false)}
        initialDescription={learnInitialDesc}
        onLearned={(desc, cost) => {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: `Öğrendim Usta! ✅ "${desc}" için maliyeti ₺${cost.toFixed(
                2
              )} olarak hafızama kaydettim. Benzer bir şey sorulduğunda bu formülü uygulayacağım.`,
              timestamp: new Date(),
              confidence: 95,
            },
          ]);
        }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: "center",
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
  listContainer: {
    paddingVertical: 12,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  imagePreviewContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    flexDirection: "row",
    alignItems: "center",
  },
  selectedImageThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeImgBtn: {
    marginLeft: 10,
    backgroundColor: COLORS.error,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  removeImgText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 12,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attachBtn: {
    padding: 10,
  },
  attachIcon: {
    fontSize: 22,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    color: COLORS.text,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  disabledSendBtn: {
    backgroundColor: COLORS.surfaceLight,
    opacity: 0.5,
  },
  sendIcon: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
  },
});
