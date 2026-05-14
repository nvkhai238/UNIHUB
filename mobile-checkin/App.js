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
import { getApiBaseUrl, login, logout, preloadCheckins, syncCheckins } from './src/api';
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
  replaceQrRegistry,
  saveTokens,
} from './src/storage';

const todayString = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Dang tai ung dung...');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [date, setDate] = useState(todayString());
  const [stats, setStats] = useState({ registryCount: 0, pendingCount: 0 });
  const [online, setOnline] = useState(true);
  const [lastScan, setLastScan] = useState(null);
  const appState = useRef(AppState.currentState);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    bootstrap();

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const nextOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(nextOnline);
      if (nextOnline) {
        syncPending('Mang da tro lai, dang dong bo...');
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const becameActive = appState.current.match(/inactive|background/) && nextState === 'active';
      appState.current = nextState;
      if (becameActive) {
        syncPending('Ung dung tro lai foreground, dang dong bo...');
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
    setMessage(tokens.accessToken ? 'San sang check-in.' : `Dang nhap bang tai khoan CHECKIN_STAFF. API: ${getApiBaseUrl()}`);
    setLoading(false);
  }

  async function refreshStats() {
    setStats(await getOfflineStats());
  }

  async function handleLogin() {
    setLoading(true);
    try {
      const auth = await login(email.trim(), password);
      if (auth.user?.role !== 'CHECKIN_STAFF') {
        throw new Error('Tai khoan nay khong co quyen CHECKIN_STAFF.');
      }
      await saveTokens(auth.accessToken, auth.refreshToken);
      const deviceId = await getOrCreateDeviceId();
      setSession({ deviceId, accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user });
      setPassword('');
      setMessage('Dang nhap thanh cong. Ban co the preload va quet QR.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreload() {
    if (!session) return;
    setLoading(true);
    try {
      const rows = await preloadCheckins(date);
      await replaceQrRegistry(rows);
      await refreshStats();
      setMessage(`Da tai ${rows.length} QR hop le cho ngay ${date}.`);
    } catch (error) {
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
      await refreshStats();
      setMessage('Da dang xuat va xoa du lieu offline cua phien truoc.');
      setLoading(false);
    }
  }

  async function syncPending(statusMessage) {
    if (!session || syncing) return;
    setSyncing(true);
    try {
      const records = await listPendingCheckins();
      if (records.length === 0) {
        await refreshStats();
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
      setMessage(`Dong bo xong ${response.created}/${response.total} check-in.`);
    } catch (error) {
      setMessage(`Chua the dong bo: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleBarcodeScanned({ data }) {
    if (!session || !data) return;
    const normalizedQr = extractQrCode(data);
    const timestamp = new Date().toISOString();
    const duplicate = await hasLocalDuplicate(normalizedQr);
    if (duplicate) {
      setLastScan({ status: 'DUPLICATE', qrCode: normalizedQr, message: 'QR da duoc luu/check-in tren thiet bi nay.' });
      return;
    }

    if (online) {
      try {
        const response = await syncCheckins([{ qrCode: normalizedQr, timestamp, deviceId: session.deviceId }]);
        const item = response.items?.[0];
        setLastScan(item || { status: 'CREATED', qrCode: normalizedQr, message: 'Check-in thanh cong.' });
        setMessage(item?.message || 'Check-in online thanh cong.');
      } catch (error) {
        setMessage(`Khong the check-in online, chuyen sang offline: ${error.message}`);
        await saveOfflineScan(normalizedQr, timestamp);
      }
      return;
    }

    await saveOfflineScan(normalizedQr, timestamp);
  }

  async function saveOfflineScan(qrCode, timestamp) {
    const registryRow = await findQr(qrCode);
    if (!registryRow) {
      setLastScan({ status: 'INVALID_QR', qrCode, message: 'QR khong nam trong danh sach preload cua hom nay.' });
      return;
    }
    await queueOfflineCheckin({
      qrCode,
      workshopId: registryRow.workshopId,
      deviceId: session.deviceId,
      timestamp,
    });
    await refreshStats();
    setLastScan({
      status: 'PENDING',
      qrCode,
      message: 'Da luu offline. He thong se dong bo lai khi co mang.',
      fullName: registryRow.fullName,
      workshopId: registryRow.workshopId,
    });
    setMessage('Check-in duoc luu offline.');
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
          <Text style={styles.muted}>Dang nhap bang tai khoan co role CHECKIN_STAFF.</Text>
          <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} placeholder="Mat khau" secureTextEntry value={password} onChangeText={setPassword} />
          <Pressable style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>Dang nhap</Text>
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
          <Text style={styles.cardTitle}>Preload du lieu</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          <Pressable style={styles.primaryButton} onPress={handlePreload}>
            <Text style={styles.primaryButtonText}>Tai danh sach QR hom nay</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => syncPending('Dang dong bo thu cong...')}>
            <Text style={styles.secondaryButtonText}>{syncing ? 'Dang dong bo...' : 'Dong bo pending ngay'}</Text>
          </Pressable>
          <Text style={styles.muted}>Registry: {stats.registryCount} QR | Pending: {stats.pendingCount}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quet QR</Text>
          {!cameraPermission?.granted ? (
            <Pressable style={styles.primaryButton} onPress={requestCameraPermission}>
              <Text style={styles.primaryButtonText}>Cap quyen camera</Text>
            </Pressable>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          )}
          <Text style={styles.muted}>App uu tien online; neu mat mang se validate theo du lieu preload va xep hang sync offline.</Text>
        </View>

        {lastScan && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ket qua gan nhat</Text>
            <Text style={styles.resultStatus}>{lastScan.status}</Text>
            <Text style={styles.feedback}>{lastScan.message}</Text>
            <Text style={styles.muted}>QR: {lastScan.qrCode}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phien lam viec</Text>
          <Text style={styles.muted}>Device ID: {session.deviceId}</Text>
          <Text style={styles.feedback}>{message}</Text>
          <Pressable style={styles.dangerButton} onPress={handleLogout}>
            <Text style={styles.primaryButtonText}>Dang xuat va xoa du lieu offline</Text>
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
});
