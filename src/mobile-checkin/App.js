import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { CameraView, useCameraPermissions } from "expo-camera";
import { getApiBaseUrl, getWorkshopsByDate, login, logout, lookupCheckinQr, preloadCheckins, syncCheckins } from "./src/api";
import { clearOfflineData, clearSession, findQr, getOfflineStats, getOrCreateDeviceId, getTokens, hasLocalDuplicate, listPendingCheckins, markCheckinsSyncResult, queueOfflineCheckin, recordSyncedCheckin, replaceQrRegistry, saveTokens } from "./src/storage";

function dateString(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoString;
  }
}

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Đang tải ứng dụng...");
  const [preloadMessage, setPreloadMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [date, setDate] = useState(dateString());

  // Workshop selection state
  const [workshops, setWorkshops] = useState([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState(null); // { id, title, room, startTime }
  const [loadingWorkshops, setLoadingWorkshops] = useState(false);

  const [stats, setStats] = useState({ registryCount: 0, pendingCount: 0 });
  const [online, setOnline] = useState(true);
  const [lastScan, setLastScan] = useState(null);
  const [cameraState, setCameraState] = useState("cameraReady");
  const appState = useRef(AppState.currentState);
  const sessionRef = useRef(null);
  const syncingRef = useRef(false);
  const scanningRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { syncingRef.current = syncing; }, [syncing]);

  useEffect(() => {
    bootstrap();
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const nextOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(nextOnline);
      if (nextOnline) syncPending("Mạng đã trở lại, đang đồng bộ...");
    });
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      const becameActive = appState.current.match(/inactive|background/) && nextState === "active";
      appState.current = nextState;
      if (becameActive) syncPending("Ứng dụng trở lại foreground, đang đồng bộ...");
    });
    return () => { unsubscribeNetInfo(); appStateSubscription.remove(); };
  }, []);

  async function bootstrap() {
    const tokens = await getTokens();
    const deviceId = await getOrCreateDeviceId();
    setSession(tokens.accessToken ? { deviceId, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } : null);
    await refreshStats();
    setMessage(tokens.accessToken ? "Sẵn sàng check-in." : `Đăng nhập bằng tài khoản CHECKIN_STAFF. API: ${getApiBaseUrl()}`);
    setLoading(false);
  }

  async function refreshStats() { setStats(await getOfflineStats()); }

  async function handleLogin() {
    setLoading(true);
    setPreloadMessage("");
    try {
      const auth = await login(email.trim(), password);
      if (auth.user?.role !== "CHECKIN_STAFF") throw new Error("Tài khoản này không có quyền CHECKIN_STAFF.");
      await saveTokens(auth.accessToken, auth.refreshToken);
      const deviceId = await getOrCreateDeviceId();
      setSession({ deviceId, accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user });
      setPassword("");
      setMessage("Đăng nhập thành công. Chọn ngày và ca để bắt đầu.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  // Bước 1: Tải danh sách workshops theo ngày
  async function handleLoadWorkshops() {
    if (!session) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setPreloadMessage("Ngày workshop phải đúng định dạng YYYY-MM-DD.");
      return;
    }
    setLoadingWorkshops(true);
    setWorkshops([]);
    setSelectedWorkshop(null);
    setPreloadMessage("Đang tải danh sách workshop...");
    try {
      const list = await getWorkshopsByDate(date.trim());
      setWorkshops(list);
      if (list.length === 0) {
        setPreloadMessage("Không có workshop nào diễn ra trong ngày này.");
      } else {
        setPreloadMessage(`Tìm thấy ${list.length} workshop. Chọn workshop để tiếp tục.`);
      }
    } catch (error) {
      setPreloadMessage(error.message);
    } finally {
      setLoadingWorkshops(false);
    }
  }

  // Bước 2: Preload QR theo workshop đã chọn
  async function handlePreload() {
    if (!session || !selectedWorkshop) return;
    setLoading(true);
    setPreloadMessage("Đang tải danh sách QR...");
    try {
      const rows = await preloadCheckins(date.trim(), selectedWorkshop.id);
      await replaceQrRegistry(rows);
      await refreshStats();
      const msg = rows.length === 0
        ? "Không có QR confirmed cho ca này. Kiểm tra trạng thái đăng ký/thanh toán."
        : `Đã tải ${rows.length} QR hợp lệ cho: ${selectedWorkshop.title}`;
      setPreloadMessage(msg);
      setMessage(msg);
    } catch (error) {
      setPreloadMessage(error.message);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    if (!session) return;
    setLoading(true);
    try {
      await logout(session.refreshToken);
    } finally {
      await clearSession();
      await clearOfflineData();
      setSession(null);
      setLastScan(null);
      setPreloadMessage("");
      setWorkshops([]);
      setSelectedWorkshop(null);
      await refreshStats();
      setMessage("Đã đăng xuất và xóa dữ liệu offline của phiên trước.");
      setLoading(false);
    }
  }

  async function syncPending(statusMessage) {
    if (!sessionRef.current || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    if (statusMessage) setPreloadMessage(statusMessage);
    try {
      const records = await listPendingCheckins();
      if (records.length === 0) {
        await refreshStats();
        if (statusMessage) {
          setPreloadMessage("Không có check-in pending nào cần đồng bộ.");
          setMessage("Không có check-in pending nào cần đồng bộ.");
        }
        return;
      }
      if (statusMessage) setMessage(statusMessage);
      const response = await syncCheckins(
        records.map((item) => ({ qrCode: item.qrCode, timestamp: item.timestamp, deviceId: item.deviceId }))
      );
      await markCheckinsSyncResult(response.items || []);
      await refreshStats();
      setPreloadMessage(`Đồng bộ xong ${response.created}/${response.total} check-in.`);
      setMessage(`Đồng bộ xong ${response.created}/${response.total} check-in.`);
    } catch (error) {
      setPreloadMessage(`Chưa thể đồng bộ: ${error.message}`);
      setMessage(`Chưa thể đồng bộ: ${error.message}`);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  function handleReadyToScan() {
    setCameraState("cameraReady");
    scanningRef.current = false;
  }

  async function handleBarcodeScanned({ data }) {
    if (!session || !data) return;
    if (scanningRef.current) return;
    scanningRef.current = true;
    setCameraState("processing");

    const normalizedQr = extractQrCode(data);
    const timestamp = new Date().toISOString();
    const workshopId = selectedWorkshop?.id || null;

    try {
      // Tìm trong local registry, có filter theo workshopId nếu đã chọn ca
      const registryRow = await findQr(normalizedQr, workshopId);
      if (!registryRow) {
        await handleQrMissingFromRegistry(normalizedQr, timestamp, workshopId);
        return;
      }

      const duplicate = await hasLocalDuplicate(normalizedQr);
      if (duplicate) {
        setLastScan({
          status: "DUPLICATE",
          qrCode: normalizedQr,
          message: "QR đã được lưu/check-in trên thiết bị này.",
          fullName: registryRow.fullName,
          workshopId: registryRow.workshopId,
          workshopTitle: registryRow.workshopTitle,
        });
        return;
      }

      if (online) {
        try {
          const response = await syncCheckins([{ qrCode: normalizedQr, timestamp, deviceId: session.deviceId }]);
          const item = response.items?.[0];
          if (item?.status === "CREATED") {
            await recordSyncedCheckin({ qrCode: normalizedQr, workshopId: registryRow.workshopId, deviceId: session.deviceId, timestamp, serverStatus: item.status, serverMessage: item.message });
            await refreshStats();
          }
          setLastScan({
            ...(item || { status: "CREATED", qrCode: normalizedQr, message: "Check-in thành công." }),
            fullName: registryRow.fullName,
            workshopId: registryRow.workshopId,
            workshopTitle: registryRow.workshopTitle,
          });
          setMessage(item?.message || "Check-in online thành công.");
        } catch (error) {
          setMessage(`Không thể check-in online, chuyển sang offline: ${error.message}`);
          await saveOfflineScan(registryRow, timestamp);
        }
        return;
      }

      await saveOfflineScan(registryRow, timestamp);
    } finally {
      setCameraState("done");
    }
  }

  async function saveOfflineScan(registryRow, timestamp) {
    await queueOfflineCheckin({ qrCode: registryRow.qrCode, workshopId: registryRow.workshopId, deviceId: session.deviceId, timestamp });
    await refreshStats();
    setLastScan({
      status: "PENDING",
      qrCode: registryRow.qrCode,
      message: "Đã lưu offline. Hệ thống sẽ đồng bộ lại khi có mạng.",
      fullName: registryRow.fullName,
      workshopId: registryRow.workshopId,
      workshopTitle: registryRow.workshopTitle,
    });
    setMessage("Check-in được lưu offline.");
  }

  async function handleQrMissingFromRegistry(qrCode, timestamp, workshopId) {
    if (!online) {
      setLastScan({ status: "INVALID_QR", qrCode, message: "QR không nằm trong danh sách preload của ca đã chọn." });
      setMessage("Đang offline nên chỉ check-in được QR đã preload.");
      return;
    }
    try {
      const lookup = await lookupCheckinQr(qrCode, date.trim(), workshopId);
      const lookupResult = {
        status: lookup.status || "LOOKUP",
        qrCode,
        message: lookup.message || "QR không hợp lệ cho ca này.",
        fullName: lookup.fullName,
        workshopId: lookup.workshopId,
        workshopTitle: lookup.workshopTitle,
      };
      if (!lookup.eligible) {
        setLastScan(lookupResult);
        setMessage(lookupResult.message);
        return;
      }
      const response = await syncCheckins([{ qrCode, timestamp, deviceId: session.deviceId }]);
      const item = response.items?.[0];
      if (item?.status === "CREATED") {
        await recordSyncedCheckin({ qrCode, workshopId: lookup.workshopId, deviceId: session.deviceId, timestamp, serverStatus: item.status, serverMessage: item.message });
        await refreshStats();
      }
      setLastScan({
        ...(item || { status: "CREATED", qrCode, message: "Check-in thành công." }),
        fullName: lookup.fullName,
        workshopId: lookup.workshopId,
        workshopTitle: lookup.workshopTitle,
      });
      setMessage(item?.message || "Check-in online thành công.");
    } catch (error) {
      setLastScan({ status: "LOOKUP_FAILED", qrCode, message: error.message });
      setMessage(`Không kiểm tra được QR trên server: ${error.message}`);
    }
  }

  const statusChip = useMemo(() => (online ? "Online" : "Offline"), [online]);

  const scanStatusColor = useMemo(() => {
    if (!lastScan) return "#0f172a";
    if (lastScan.status === "CREATED") return "#047857";
    if (lastScan.status === "PENDING") return "#b45309";
    if (lastScan.status === "DUPLICATE") return "#1d4ed8";
    return "#b91c1c";
  }, [lastScan]);

  if (loading && !session) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.heading}>UniHub Check-in Mobile</Text>
        <Text style={styles.muted}>{message}</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>UniHub Check-in Mobile</Text>
          <Text style={styles.muted}>Đăng nhập bằng tài khoản có role CHECKIN_STAFF.</Text>
          <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} placeholder="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} />
          <Pressable style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>
          <Text style={styles.feedback}>{message}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.row}>
          <Text style={styles.heading}>Check-in Staff</Text>
          <View style={[styles.badge, online ? styles.badgeOnline : styles.badgeOffline]}>
            <Text style={styles.badgeText}>{statusChip}</Text>
          </View>
        </View>

        {/* Bước 1 & 2: Chọn ngày → Chọn ca → Preload */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chọn ca check-in</Text>

          {/* Chọn ngày */}
          <Text style={styles.label}>Ngày diễn ra</Text>
          <TextInput style={styles.input} value={date} onChangeText={(v) => { setDate(v); setWorkshops([]); setSelectedWorkshop(null); }} placeholder="YYYY-MM-DD" />
          <Pressable style={[styles.primaryButton, loadingWorkshops && styles.disabledButton]} onPress={handleLoadWorkshops} disabled={loadingWorkshops}>
            <Text style={styles.primaryButtonText}>{loadingWorkshops ? "Đang tải..." : "Tìm workshop theo ngày"}</Text>
          </Pressable>

          {/* Danh sách workshops để chọn */}
          {workshops.length > 0 && (
            <View style={styles.workshopList}>
              <Text style={styles.label}>Chọn workshop:</Text>
              {workshops.map((ws) => {
                const isSelected = selectedWorkshop?.id === ws.id;
                return (
                  <Pressable
                    key={ws.id}
                    style={[styles.workshopItem, isSelected && styles.workshopItemSelected]}
                    onPress={() => setSelectedWorkshop(ws)}
                  >
                    <View style={styles.workshopItemRow}>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]} />
                      <View style={styles.workshopItemInfo}>
                        <Text style={[styles.workshopItemTitle, isSelected && styles.workshopItemTitleSelected]}>
                          {ws.title}
                        </Text>
                        <Text style={styles.workshopItemMeta}>
                          🕐 {formatTime(ws.startTime)} – {formatTime(ws.endTime)}  📍 {ws.room}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Nút preload – chỉ kích hoạt khi đã chọn workshop */}
          {selectedWorkshop && (
            <View style={styles.selectedBanner}>
              <Text style={styles.selectedBannerText}>✅ Đang check-in: {selectedWorkshop.title}</Text>
            </View>
          )}
          <Pressable
            style={[styles.primaryButton, !selectedWorkshop && styles.disabledButton]}
            onPress={handlePreload}
            disabled={!selectedWorkshop || loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Đang tải QR..." : "Tải QR cho workshop này"}
            </Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => syncPending("Đang đồng bộ thủ công...")}>
            <Text style={styles.secondaryButtonText}>{syncing ? "Đang đồng bộ..." : "Đồng bộ ngay"}</Text>
          </Pressable>

          <Text style={styles.muted}>
            Registry: {stats.registryCount} QR | Pending: {stats.pendingCount}
          </Text>
          {preloadMessage ? <Text style={styles.preloadFeedback}>{preloadMessage}</Text> : null}
        </View>

        {/* Camera quét QR */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quét QR</Text>
          {!selectedWorkshop && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningBannerText}>⚠️ Vui lòng chọn ca check-in trước khi quét QR.</Text>
            </View>
          )}
          {!cameraPermission?.granted ? (
            <Pressable style={styles.primaryButton} onPress={requestCameraPermission}>
              <Text style={styles.primaryButtonText}>Cấp quyền camera</Text>
            </Pressable>
          ) : (
            <View style={styles.cameraWrapper}>
              <CameraView
                style={styles.camera}
                facing="back"
                autofocus="on"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onCameraReady={() => setMessage("Camera sẵn sàng quét QR.")}
                onMountError={(error) => setMessage(`Camera lỗi: ${error.message || "không khởi động được camera"}`)}
                onBarcodeScanned={cameraState === "cameraReady" && selectedWorkshop ? handleBarcodeScanned : undefined}
              />
              {cameraState === "processing" && (
                <View style={styles.cameraOverlay}>
                  <Text style={styles.cameraOverlayText}>Đang xử lý...</Text>
                </View>
              )}
              {cameraState === "done" && (
                <View style={styles.cameraOverlay}>
                  <Text style={styles.cameraOverlayText}>Đã quét xong</Text>
                  <Pressable style={styles.scanAgainButton} onPress={handleReadyToScan}>
                    <Text style={styles.scanAgainButtonText}>Quét tiếp</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
          <Text style={styles.muted}>App ưu tiên online; nếu mất mạng sẽ validate theo dữ liệu preload và xếp hàng sync offline.</Text>
        </View>

        {/* Kết quả quét gần nhất */}
        {lastScan && (
          <View style={[styles.card, styles.resultCard]}>
            <Text style={styles.cardTitle}>Kết quả gần nhất</Text>
            <Text style={[styles.resultStatus, { color: scanStatusColor }]}>{lastScan.status}</Text>
            {lastScan.fullName ? <Text style={styles.attendeeName}>{lastScan.fullName}</Text> : null}
            {lastScan.workshopTitle ? <Text style={styles.feedback}>{lastScan.workshopTitle}</Text> : null}
            <Text style={styles.feedback}>{lastScan.message}</Text>
            <Text style={styles.muted}>QR: {lastScan.qrCode}</Text>
          </View>
        )}

        {/* Phiên làm việc */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phiên làm việc</Text>
          <Text style={styles.muted}>Device ID: {session.deviceId}</Text>
          <Text style={styles.feedback}>{message}</Text>
          <Pressable style={styles.dangerButton} onPress={handleLogout}>
            <Text style={styles.primaryButtonText}>Đăng xuất và xóa dữ liệu offline</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function extractQrCode(value) {
  const trimmed = String(value || "").trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.qrCode) return parsed.qrCode;
  } catch {}
  if (trimmed.startsWith("http")) {
    try {
      const url = new URL(trimmed);
      const id = url.searchParams.get("id");
      if (id) return id;
    } catch {}
  }
  const uuidMatch = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return uuidMatch ? uuidMatch[0] : trimmed;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ecfdf5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ecfdf5", padding: 24 },
  content: { padding: 20, gap: 16 },
  heading: { fontSize: 28, fontWeight: "700", color: "#0f172a" },
  label: { fontSize: 13, fontWeight: "600", color: "#374151" },
  muted: { color: "#475569", fontSize: 14, lineHeight: 20 },
  feedback: { color: "#1e293b", fontSize: 14, lineHeight: 20 },
  preloadFeedback: { color: "#047857", fontSize: 14, fontWeight: "700", lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeOnline: { backgroundColor: "#dcfce7" },
  badgeOffline: { backgroundColor: "#fee2e2" },
  badgeText: { fontWeight: "700", color: "#0f172a" },
  card: { backgroundColor: "#ffffff", borderRadius: 20, padding: 16, gap: 12, borderWidth: 1, borderColor: "#a7f3d0" },
  resultCard: { borderColor: "#bfdbfe" },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#ffffff", paddingHorizontal: 14, paddingVertical: 12 },
  primaryButton: { backgroundColor: "#059669", borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  secondaryButton: { backgroundColor: "#f1f5f9", borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  dangerButton: { backgroundColor: "#b91c1c", borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  disabledButton: { backgroundColor: "#9ca3af" },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  secondaryButtonText: { color: "#0f172a", fontWeight: "700" },
  // Workshop selection
  workshopList: { gap: 8 },
  workshopItem: { borderWidth: 1.5, borderColor: "#d1d5db", borderRadius: 14, padding: 12, backgroundColor: "#f9fafb" },
  workshopItemSelected: { borderColor: "#059669", backgroundColor: "#ecfdf5" },
  workshopItemRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#9ca3af", backgroundColor: "#fff" },
  radioCircleSelected: { borderColor: "#059669", backgroundColor: "#059669" },
  workshopItemInfo: { flex: 1 },
  workshopItemTitle: { fontSize: 14, fontWeight: "700", color: "#1f2937" },
  workshopItemTitleSelected: { color: "#065f46" },
  workshopItemMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  selectedBanner: { backgroundColor: "#d1fae5", borderRadius: 12, padding: 10 },
  selectedBannerText: { color: "#065f46", fontWeight: "700", fontSize: 13 },
  warningBanner: { backgroundColor: "#fef3c7", borderRadius: 12, padding: 10 },
  warningBannerText: { color: "#92400e", fontWeight: "600", fontSize: 13 },
  // Camera
  cameraWrapper: { width: "100%", aspectRatio: 1, borderRadius: 20, overflow: "hidden", position: "relative" },
  camera: { width: "100%", height: "100%" },
  cameraOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", gap: 16 },
  cameraOverlayText: { color: "#ffffff", fontSize: 20, fontWeight: "700" },
  scanAgainButton: { backgroundColor: "#059669", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  scanAgainButtonText: { color: "#ffffff", fontSize: 18, fontWeight: "800" },
  // Result
  resultStatus: { fontSize: 22, fontWeight: "800" },
  attendeeName: { fontSize: 18, fontWeight: "800", color: "#047857" },
});
