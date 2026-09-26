import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ChatScreen } from "./screens/ChatScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { SuppliersScreen } from "./screens/SuppliersScreen";
import { ExchangeRatesScreen } from "./screens/ExchangeRatesScreen";
import { COLORS } from "./constants";

export default function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "history" | "suppliers" | "rates">("chat");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Ekranlar */}
      <View style={styles.screenContainer}>
        {activeTab === "chat" && <ChatScreen />}
        {activeTab === "history" && <HistoryScreen />}
        {activeTab === "suppliers" && <SuppliersScreen />}
        {activeTab === "rates" && <ExchangeRatesScreen />}
      </View>

      {/* Alt Gezinme Sekmesi (Bottom Navigation Bar) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "chat" && styles.activeTabItem]}
          onPress={() => setActiveTab("chat")}
        >
          <Text style={styles.tabIcon}>💬</Text>
          <Text style={[styles.tabLabel, activeTab === "chat" && styles.activeTabLabel]}>
            Çırak Sohbet
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "history" && styles.activeTabItem]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={styles.tabIcon}>🧠</Text>
          <Text style={[styles.tabLabel, activeTab === "history" && styles.activeTabLabel]}>
            Hafıza
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "suppliers" && styles.activeTabItem]}
          onPress={() => setActiveTab("suppliers")}
        >
          <Text style={styles.tabIcon}>🏭</Text>
          <Text style={[styles.tabLabel, activeTab === "suppliers" && styles.activeTabLabel]}>
            Tedarikçiler
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "rates" && styles.activeTabItem]}
          onPress={() => setActiveTab("rates")}
        >
          <Text style={styles.tabIcon}>💱</Text>
          <Text style={[styles.tabLabel, activeTab === "rates" && styles.activeTabLabel]}>
            Kurlar
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 8,
    paddingBottom: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  activeTabItem: {
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
    marginTop: -2,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  activeTabLabel: {
    color: COLORS.primaryLight,
    fontWeight: "700",
  },
});
