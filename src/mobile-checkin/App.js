import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getApiBaseUrl, login, logout, lookupCheckinQr, preloadCheckins, syncCheckins } from './src/api';
import {
  clearOfflineData,
  clearSession,
  findQr,
  getOfflineStats,
  getOrCreateDeviceId,
  getTokens,
  hasLocalDuplicate,
  listPendingCheckins,
  markCheckinsSyncResult,
  queueOfflineCheckin,
  recordSyncedCheckin,
  replaceQrRegistry,
  saveTokens,
} from './src/storage';

function dateString(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Đang tải ứng dụng...');
  const [preloadMessage, setPreloadMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [date, setDate] = useState(dateString());
  const [stats, setStats] = useState({ registryCount: 0, pendingCount: 0 });
  const [online, setOnline] = useState(true);
  const [lastScan, setLastScan] = useState(null);
  const appState = useRef(AppState.currentState);
  const sessionRef = useRef(null);
  const syncingRef = useRef(false);
  const scanningRef = useRef(false);
  const recentScanRef = useRef({ qrCode: null, scannedAt: 0 });
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    syncingRef.current = syncing;
  }, [syncing]);

  useEffect(() => {
    bootstrap();

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const nextOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(nextOnline);
      if (nextOnline) {
        syncPending('Mạng đã trở lại, đang đồng bộ...');
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const becameActive = appState.current.match(/inactive|background/) && nextState === 'active';
      appState.current = nextState;
      if (becameActive) {
        syncPending('Ứng dụng trở lại foreground, đang đồng bộ...');
      }
    });

    return () => {
      unsubscribeNetInfo();
      appStateSubscription.remove();
    };
  }, []);

  async function bootstrap() {
    const tokens = await getTokens();
    const deviceId = await getOrCreateDeviceId();
    setSession(tokens.accessToken ? { deviceId, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } : null);
    await refreshStats();
    setMessage(tokens.accessToken ? 'Sẵn sàng check-in.' : `Đăng nhập bằng tài khoản CHECKIN_STAFF. API: ${getApiBaseUrl()}`);
    setLoading(false);
  }

  async function refreshStats() {
    setStats(await getOfflineStats());
  }

  async function handleLogin() {
    setLoading(true);
    setPreloadMessage('');
    try {
      const auth = await login(email.trim(), password);
      if (auth.user?.role !== 'CHECKIN_STAFF') {
        throw new Error('Tài khoản này không có quyền CHECKIN_STAFF.');
      }
      await saveTokens(auth.accessToken, auth.refreshToken);
      const deviceId = await getOrCreateDeviceId();
      setSession({ deviceId, accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user });
      setPassword('');
      setMessage('Đăng nhập thành công. Bạn có thể preload và quét QR.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreload() {
    if (!session) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setPreloadMessage('Ngày workshop phải đúng định dạng YYYY-MM-DD.');
      return;
    }
    setLoading(true);
    setPreloadMessage('Đang tải danh sách QR...');
    try {
      const selectedDate = date.trim();
      const rows = await preloadCheckins(selectedDate);
      await replaceQrRegistry(rows);
      await refreshStats();
      const nextMessage = rows.length === 0
        ? 'Không có QR confirmed cho ngày bắt đầu workshop này. Kiểm tra ngày bắt đầu workshop, trạng thái đăng ký/thanh toán, hoặc quét QR khi online để xem lý do.'
        : `Đã tải ${rows.length} QR hợp lệ cho ngày bắt đầu workshop.`;
      setPreloadMessage(nextMessage);
      setMessage(nextMessage);
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
      setPreloadMessage('');
      await refreshStats();
      setMessage('Đã đăng xuất và xóa dữ liệu offline của phiên trước.');
      setLoading(false);
    }
  }

  async function syncPending(statusMessage) {
    if (!sessionRef.current || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    if (statusMessage) {
      setPreloadMessage(statusMessage);
    }
    try {
      const records = await listPendingCheckins();
      if (records.length === 0) {
        await refreshStats();
        if (statusMessage) {
          setPreloadMessage('Không có check-in pending nào cần đồng bộ.');
          setMessage('Không có check-in pending nào cần đồng bộ.');
        }
        return;
      }
      if (statusMessage) {
        setMessage(statusMessage);
      }
      const response = await syncCheckins(
        records.map((item) => ({
          qrCode: item.qrCode,
          timestamp: item.timestamp,
          deviceId: item.deviceId,
        }))
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

  async function handleBarcodeScanned({ data }) {
    if (!session || !data) return;
    const normalizedQr = extractQrCode(data);
    const now = Date.now();
    if (scanningRef.current) return;
    if (recentScanRef.current.qrCode === normalizedQr && now - recentScanRef.current.scannedAt < 3500) {
      return;
    }

    scanningRef.current = true;
    recentScanRef.current = { qrCode: normalizedQr, scannedAt: now };
    const timestamp = new Date().toISOString();
    try {
      const registryRow = await findQr(normalizedQr);
      if (!registryRow) {
        await handleQrMissingFromRegistry(normalizedQr, timestamp);
        return;
      }

      const duplicate = await hasLocalDuplicate(normalizedQr);
      if (duplicate) {
        setLastScan({
          status: 'DUPLICATE',
          qrCode: normalizedQr,
          message: 'QR đã được lưu/check-in trên thiết bị này.',
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
          if (item?.status === 'CREATED') {
            await recordSyncedCheckin({
              qrCode: normalizedQr,
              workshopId: registryRow.workshopId,
              deviceId: session.deviceId,
              timestamp,
              serverStatus: item.status,
              serverMessage: item.message,
            });
            await refreshStats();
          }
          setLastScan({
            ...(item || { status: 'CREATED', qrCode: normalizedQr, message: 'Check-in thành công.' }),
            fullName: registryRow.fullName,
            workshopId: registryRow.workshopId,
            workshopTitle: registryRow.workshopTitle,
          });
          setMessage(item?.message || 'Check-in online thành công.');
        } catch (error) {
          setMessage(`Không thể check-in online, chuyển sang offline: ${error.message}`);
          await saveOfflineScan(registryRow, timestamp);
        }
        return;
      }

      await saveOfflineScan(registryRow, timestamp);
    } finally {
      setTimeout(() => {
        scanningRef.current = false;
      }, 1200);
    }
  }

  async function saveOfflineScan(registryRow, timestamp) {
    await queueOfflineCheckin({
      qrCode: registryRow.qrCode,
      workshopId: registryRow.workshopId,
      deviceId: session.deviceId,
      timestamp,
    });
    await refreshStats();
    setLastScan({
      status: 'PENDING',
      qrCode: registryRow.qrCode,
      message: 'Đã lưu offline. Hệ thống sẽ đồng bộ lại khi có mạng.',
      fullName: registryRow.fullName,
      workshopId: registryRow.workshopId,
      workshopTitle: registryRow.workshopTitle,
    });
    setMessage('Check-in được lưu offline.');
  }

  async function handleQrMissingFromRegistry(qrCode, timestamp) {
    if (!online) {
      setLastScan({ status: 'INVALID_QR', qrCode, message: 'QR không nằm trong danh sách preload của ngày đã chọn.' });
      setMessage('Đang offline nên chỉ check-in được QR đã preload.');
      return;
    }

    try {
      const lookup = await lookupCheckinQr(qrCode, date.trim());
      const lookupResult = {
        status: lookup.status || 'LOOKUP',
        qrCode,
        message: lookup.message || 'QR không nằm trong danh sách preload.',
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
      if (item?.status === 'CREATED') {
        await recordSyncedCheckin({
          qrCode,
          workshopId: lookup.workshopId,
          deviceId: session.deviceId,
          timestamp,
          serverStatus: item.status,
          serverMessage: item.message,
        });
        await refreshStats();
      }
      setLastScan({
        ...(item || { status: 'CREATED', qrCode, message: 'Check-in thành công.' }),
        fullName: lookup.fullName,
        workshopId: lookup.workshopId,
        workshopTitle: lookup.workshopTitle,
      });
      setMessage(item?.message || 'Check-in online thành công.');
    } catch (error) {
      setLastScan({ status: 'LOOKUP_FAILED', qrCode, message: error.message });
      setMessage(`Không kiểm tra được QR trên server: ${error.message}`);
    }
  }

  const statusChip = useMemo(() => (online ? 'Online' : 'Offline'), [online]);

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
        <View style={styles.row}>
          <Text style={styles.heading}>Check-in Staff</Text>
          <View style={[styles.badge, online ? styles.badgeOnline : styles.badgeOffline]}>
            <Text style={styles.badgeText}>{statusChip}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preload dữ liệu</Text>
          <Text style={styles.muted}>Ngày bắt đầu workshop</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          <Pressable style={styles.primaryButton} onPress={handlePreload}>
            <Text style={styles.primaryButtonText}>Tải QR theo ngày workshop</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => syncPending('Đang đồng bộ thủ công...')}>
            <Text style={styles.secondaryButtonText}>{syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</Text>
          </Pressable>
          <Text style={styles.muted}>Registry: {stats.registryCount} QR | Pending: {stats.pendingCount}</Text>
          {preloadMessage ? <Text style={styles.preloadFeedback}>{preloadMessage}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quét QR</Text>
          {!cameraPermission?.granted ? (
            <Pressable style={styles.primaryButton} onPress={requestCameraPermission}>
              <Text style={styles.primaryButtonText}>Cấp quyền camera</Text>
            </Pressable>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
              autofocus="on"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onCameraReady={() => setMessage('Camera sẵn sàng quét QR.')}
              onMountError={(error) => setMessage(`Camera lỗi: ${error.message || 'không khởi động được camera'}`)}
              onBarcodeScanned={handleBarcodeScanned}
            />
          )}
          <Text style={styles.muted}>App ưu tiên online; nếu mất mạng sẽ validate theo dữ liệu preload và xếp hàng sync offline.</Text>
        </View>

        {lastScan && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Kết quả gần nhất</Text>
            <Text style={styles.resultStatus}>{lastScan.status}</Text>
            {lastScan.fullName ? <Text style={styles.attendeeName}>{lastScan.fullName}</Text> : null}
            {lastScan.workshopTitle ? <Text style={styles.feedback}>{lastScan.workshopTitle}</Text> : null}
            {lastScan.workshopId ? <Text style={styles.muted}>Workshop ID: {lastScan.workshopId}</Text> : null}
            <Text style={styles.feedback}>{lastScan.message}</Text>
            <Text style={styles.muted}>QR: {lastScan.qrCode}</Text>
          </View>
        )}

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
  const trimmed = String(value || '').trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.qrCode) {
      return parsed.qrCode;
    }
  } catch {}

  if (trimmed.startsWith('http')) {
    try {
      const url = new URL(trimmed);
      const id = url.searchParams.get('id');
      if (id) {
        return id;
      }
    } catch {}
  }

  const uuidMatch = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return uuidMatch ? uuidMatch[0] : trimmed;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ecfdf5',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    padding: 24,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  muted: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  feedback: {
    color: '#1e293b',
    fontSize: 14,
    lineHeight: 20,
  },
  preloadFeedback: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeOnline: {
    backgroundColor: '#dcfce7',
  },
  badgeOffline: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButton: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#b91c1c',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  camera: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  resultStatus: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  attendeeName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#047857',
  },
});
