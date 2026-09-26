import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { ChatMessage, SimilarItem } from "../services/api";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { COLORS } from "../constants";

interface ChatMessageItemProps {
  message: ChatMessage;
  onFeedback?: (isCorrect: boolean) => void;
  onLearnMore?: () => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  onFeedback,
  onLearnMore,
}) => {
  const isUser = message.role === "user";

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🎓</Text>
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {/* Fotoğraf Eki */}
        {message.imageUri && (
          <Image source={{ uri: message.imageUri }} style={styles.imagePreview} />
        )}

        {/* Güven Skoru */}
        {!isUser && message.confidence !== undefined && (
          <ConfidenceBadge score={message.confidence} />
        )}

        {/* Mesaj Metni */}
        <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
        </Text>

        {/* Benzer Ürün Kartları */}
        {!isUser && message.similarItems && message.similarItems.length > 0 && (
          <View style={styles.similarSection}>
            <Text style={styles.similarTitle}>🔍 Benzer Geçmiş Hesaplamalar:</Text>
            {message.similarItems.map((item: SimilarItem) => (
              <View key={item.id} style={styles.similarCard}>
                <View style={styles.similarHeader}>
                  <Text style={styles.similarDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={styles.similarityTag}>
                    %{Math.round(item.similarity * 100)} Uyum
                  </Text>
                </View>
                <Text style={styles.similarCost}>
                  Maliyet: ₺{item.cost.toFixed(2)} / {item.unit}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Geri Bildirim Butonları (Asistan Mesajlarında) */}
        {!isUser && message.confidence !== undefined && (
          <View style={styles.feedbackContainer}>
            <Text style={styles.feedbackPrompt}>Bu hesaplama doğru mu?</Text>
            <View style={styles.feedbackButtons}>
              <TouchableOpacity
                style={[styles.feedbackBtn, styles.correctBtn]}
                onPress={() => onFeedback?.(true)}
              >
                <Text style={styles.feedbackBtnText}>✅ Evet, Doğru</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.feedbackBtn, styles.wrongBtn]}
                onPress={() => onFeedback?.(false)}
              >
                <Text style={styles.feedbackBtnText}>❌ Hayır / Düzelt</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Öğretme Butonu (Çırak bilmiyorsa) */}
        {!isUser && message.confidence !== undefined && message.confidence < 30 && (
          <TouchableOpacity style={styles.teachBtn} onPress={onLearnMore}>
            <Text style={styles.teachBtnText}>📖 Nasıl Hesaplandığını Çırağa Öğret</Text>
          </TouchableOpacity>
        )}

        {/* Zaman */}
        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  userContainer: {
    justifyContent: "flex-end",
  },
  assistantContainer: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    alignSelf: "flex-end",
  },
  avatarText: {
    fontSize: 18,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: COLORS.white,
  },
  assistantText: {
    color: COLORS.text,
  },
  imagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginBottom: 8,
  },
  similarSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  similarTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  similarCard: {
    backgroundColor: COLORS.surfaceLight,
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  similarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  similarDesc: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  similarityTag: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: "600",
    marginLeft: 6,
  },
  similarCost: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: "700",
    marginTop: 2,
  },
  feedbackContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  feedbackPrompt: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    textAlign: "center",
  },
  feedbackButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  feedbackBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  correctBtn: {
    backgroundColor: `${COLORS.success}25`,
  },
  wrongBtn: {
    backgroundColor: `${COLORS.error}25`,
  },
  feedbackBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
  },
  teachBtn: {
    marginTop: 10,
    backgroundColor: COLORS.primaryLight,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  teachBtnText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 13,
  },
  timestamp: {
    fontSize: 10,
    color: COLORS.textMuted,
    alignSelf: "flex-end",
    marginTop: 4,
  },
});
