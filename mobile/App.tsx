import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Platform, Dimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ChatScreen } from "./screens/ChatScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { SuppliersScreen } from "./screens/SuppliersScreen";
import { ExchangeRatesScreen } from "./screens/ExchangeRatesScreen";
import { COLORS, TAB_BAR_HEIGHT } from "./constants";

export default function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "history" | "suppliers" | "rates">("chat");

  return (
    <SafeAreaView style={styles.outerContainer}>
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Ekranlar */}
      <View style={styles.screenContainer}>
        {activeTab === "chat" && <ChatScreen />}
        {activeTab === "history" && <HistoryScreen />}
        {activeTab === "suppliers" && <SuppliersScreen />}
        {activeTab === "rates" && <ExchangeRatesScreen />}
      </View>

      {/* Alt Gezinme Sekmesi (Sabit Taban Menüsü) */}
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
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    overflow: "hidden" as any,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    position: "relative",
    width: "100%",
    maxWidth: Platform.OS === "web" ? 480 : undefined,
    overflow: "hidden" as any,
  } as any,
  screenContainer: {
    flex: 1,
    overflow: "hidden" as any,
  } as any,
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: TAB_BAR_HEIGHT,
    position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
    bottom: 0,
    left: Platform.OS === "web" ? "50%" : 0,
    transform: Platform.OS === "web" ? [{ translateX: "-50%" }] : undefined,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 480 : undefined,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 20,
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
