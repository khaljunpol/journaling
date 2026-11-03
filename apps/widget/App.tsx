import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Dimensions, Easing, Image, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { dark } from '@journaling/design';
import { inkOn } from '@journaling/core/contrast';
import type { Action, DeviceHours } from './src/logic/api';
import { connect, refresh, refreshHours, setPicked, snapshot, type Snapshot } from './src/sync';
import { paintAll, tap, tapThenLeave } from './src/widgets/handler';
import { ICON_IMAGES } from './src/widgets/iconImages';
import type { IconName } from './src/widgets/icons';

const MAX_PICKED = 6;
const OUT = Easing.bezier(0.23, 1, 0.32, 1); // --ease-out
type Route = 'setup' | 'mood' | 'weight' | 'hours' | 'more';

function routeOf(url: string | null | undefined): Route {
  const m = url?.match(/:\/\/(mood|weight|hours|more)/);
  return (m?.[1] as Route | undefined) ?? 'setup';
}

/** A small floating window near the thumb. The dim behind it comes from the Android theme. */
function Win({ children, canDismiss = true, closing }: { children: ReactNode; canDismiss?: boolean; closing: Animated.Value }) {
  const { width, height } = useWindowDimensions();
  // The app draws edge to edge, so the navigation bar sits over the bottom of this view.
  const insets = Math.max(0, Dimensions.get('screen').height - height);
  const open = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(open, { toValue: 1, duration: 180, easing: OUT, useNativeDriver: true }).start();
  }, [open]);
  const dismiss = () => { if (canDismiss) BackHandler.exitApp(); };
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      <View style={[styles.dim, { paddingBottom: 96 + insets }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Close" />
      <Animated.View
        style={[styles.win, {
          width: Math.min(340, width - 32),
          opacity: Animated.multiply(open, closing),
          transform: [
            { translateY: open.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            { scale: open.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
          ],
        }]}
      >
        {children}
      </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

type Leave = (action?: Action) => void;

function Mood({ s, leave }: { s: Snapshot; leave: Leave }) {
  return (
    <View style={styles.gap}>
      <Text style={styles.label}>Mood</Text>
      <View style={styles.wrap}>
        {Array.from({ length: 11 }, (_, n) => {
          const on = s.state?.mood === n;
          return (
            <Pressable key={n} onPress={() => leave({ action: 'mood', score: n })} style={({ pressed }) => [styles.circle, (on || pressed) && styles.on]} accessibilityLabel={`Mood ${n}`}>
              <Text style={[styles.num, on && styles.onText]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Weight({ s, leave }: { s: Snapshot; leave: Leave }) {
  const start = s.state?.weight ?? s.lastWeight;
  const [text, setText] = useState(start === null ? '' : String(start));
  const [typed, setTyped] = useState(false);
  const value = parseFloat(text);
  const ok = Number.isFinite(value) && value >= 20 && value <= 400;

  function press(k: string) {
    if (k === '⌫') { setText((t) => (typed ? t.slice(0, -1) : '')); setTyped(true); return; }
    const base = typed ? text : '';
    if (k === '.' && base.includes('.')) return;
    if (base.replace('.', '').length >= 4) return;
    setText(base + k);
    setTyped(true);
  }

  return (
    <View style={styles.gap}>
      <Text style={[styles.value, !typed && styles.prefill]}>{text || '–'} <Text style={styles.unit}>kg</Text></Text>
      <View style={styles.pad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
          <Pressable key={k} onPress={() => press(k)} style={({ pressed }) => [styles.key, pressed && styles.on]}>
            <Text style={styles.keyText}>{k}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable disabled={!ok} onPress={() => leave({ action: 'weight', weight: value })} style={[styles.primary, !ok && styles.off]}>
        <Text style={styles.primaryText}>Save</Text>
      </Pressable>
    </View>
  );
}

const CELL = { w: 48, h: 44, gap: 4 };

function Hours({ s, leave, onDirty }: { s: Snapshot; leave: Leave; onDirty: (d: boolean) => void }) {
  const [data, setData] = useState<DeviceHours | null>(s.hours);
  const [draft, setDraft] = useState<Array<number | null>>(s.hours?.slots ?? Array.from({ length: 24 }, () => null));
  const [picked, setPicked2] = useState<number | null>(null);
  const [dirty, setDirty] = useState<Record<number, number>>({});

  useEffect(() => {
    void refreshHours().then((h) => {
      if (!h) return;
      setData(h);
      setDraft(h.slots);
    });
  }, []);

  const cats = data?.categories ?? [];
  const active = picked ?? cats[0]?.id ?? null;
  const colorOf = (id: number | null) => cats.find((x) => x.id === id)?.color;

  function paint(x: number, y: number) {
    if (active === null) return;
    const col = Math.floor(x / (CELL.w + CELL.gap));
    const row = Math.floor(y / (CELL.h + CELL.gap));
    if (col < 0 || col > 5 || row < 0 || row > 3) return;
    const hour = row * 6 + col;
    setDraft((d) => (d[hour] === active ? d : d.map((v, i) => (i === hour ? active : v))));
    setDirty((d) => ({ ...d, [hour]: active }));
    onDirty(true);
  }

  const entries = Object.entries(dirty).map(([hour, category]) => ({ hour: Number(hour), category }));
  const filled = draft.filter((v) => v !== null).length;
  const canFill = filled < 24 && !s.noUsualHours && entries.length === 0;

  return (
    <View style={styles.gap}>
      <View style={styles.between}>
        <Text style={styles.label}>Hours</Text>
        <Text style={styles.label}>{filled}/24</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {cats.map((x) => (
          <Pressable key={x.id} onPress={() => setPicked2(x.id)} style={[styles.chip, x.id === active && styles.on]}>
            <View style={[styles.dot, { backgroundColor: x.color }]} />
            <Text style={[styles.chipText, x.id === active && styles.onText]}>{x.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View
        style={styles.grid}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => paint(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        onResponderMove={(e) => paint(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      >
        {draft.map((v, hour) => {
          const bg = colorOf(v);
          return (
            <View key={hour} pointerEvents="none" style={[styles.cell, bg ? { backgroundColor: bg } : null]}>
              <Text style={[styles.cellText, bg ? { color: inkOn(bg) === 'light' ? '#ffffff' : '#000000' } : null]}>{String(hour).padStart(2, '0')}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.buttons}>
        {canFill && (
          <Pressable onPress={() => leave({ action: 'hours' })} style={[styles.secondary, styles.grow]}>
            <Text style={styles.secondaryText}>Fill usual</Text>
          </Pressable>
        )}
        <Pressable disabled={!entries.length} onPress={() => leave({ action: 'hours', entries })} style={[styles.primary, styles.grow, !entries.length && styles.off]}>
          <Text style={styles.primaryText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const Icon = ({ name, color, size }: { name: IconName; color: string; size: number }) => <Image source={ICON_IMAGES[name]} style={{ width: size, height: size, tintColor: color }} />;

function More({ s, leave, reload }: { s: Snapshot; leave: Leave; reload: () => Promise<void> }) {
  const [text, setText] = useState(s.state?.highlight ?? '');
  const url = s.conn?.url ?? '';
  const open = (path: string) => { void Linking.openURL(`${url}${path}`); BackHandler.exitApp(); };
  const saved = (s.state?.highlight ?? '') === text.trim();

  return (
    <View style={styles.gap}>
      <ScrollView style={styles.habits} contentContainerStyle={styles.wrap}>
        {(s.state?.habits ?? []).map((h) => (
          <Pressable
            key={h.id}
            style={styles.habit}
            onPress={() => { void tap({ action: 'habit', activityId: h.id, done: !h.done }).then(reload); void reload(); }}
            accessibilityLabel={`${h.name}, ${h.done ? 'done' : 'not done'}`}
          >
            <View style={[styles.round, h.done && styles.on]}>
              {h.icon ? <Icon name={h.icon} color={h.done ? dark['on-accent-fill'] : dark['text-2']} size={22} /> : <Text style={[styles.num, h.done && styles.onText]}>{h.name.slice(0, 1).toUpperCase()}</Text>}
            </View>
            <Text numberOfLines={1} style={styles.habitName}>{h.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <TextInput style={styles.note} value={text} onChangeText={setText} placeholder="Highlight of the day" placeholderTextColor={dark['text-3']} maxLength={300} multiline />
      {!saved && (
        <Pressable onPress={() => leave({ action: 'highlight', text: text.trim() })} style={styles.primary}>
          <Text style={styles.primaryText}>Save highlight</Text>
        </Pressable>
      )}
      <View style={styles.buttons}>
        <Pressable onPress={() => open('/climbing?tab=log')} style={[styles.secondary, styles.grow]}><Icon name="climb" color={dark['text-2']} size={16} /><Text style={styles.linkText}>Climbing</Text></Pressable>
        <Pressable onPress={() => open('/')} style={[styles.secondary, styles.grow]}><Icon name="overview" color={dark['text-2']} size={16} /><Text style={styles.linkText}>Home</Text></Pressable>
        <Pressable onPress={() => open('/insights')} style={[styles.secondary, styles.grow]}><Icon name="trends" color={dark['text-2']} size={16} /><Text style={styles.linkText}>Insights</Text></Pressable>
      </View>
    </View>
  );
}

function Setup({ s, reload }: { s: Snapshot; reload: () => Promise<void> }) {
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');

  async function join() {
    setNote('Connecting');
    const r = await connect(code);
    setNote({ ok: '', 'bad-code': "That doesn't look like a code.", refused: 'Key not valid. Make a new code in Settings → Devices.', offline: "Couldn't reach Journal. Try again." }[r]);
    if (r === 'ok') {
      setCode('');
      await reload();
      await paintAll(await refresh());
    }
  }

  async function toggle(id: string) {
    const has = s.picked.includes(id);
    if (!has && s.picked.length >= MAX_PICKED) return;
    await setPicked(has ? s.picked.filter((x) => x !== id) : [...s.picked, id]);
    await reload();
    await paintAll(await snapshot());
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.setup}>
      <Text style={styles.title}>Journal widget</Text>
      {s.conn && !s.keyBad ? (
        <>
          <Text style={styles.connected}>Connected ✓</Text>
          <Text style={styles.sub}>Pick up to {MAX_PICKED} habits, in order. The small widget shows the first 4.</Text>
          {(s.state?.habits ?? []).map((h) => {
            const n = s.picked.indexOf(h.id);
            return (
              <Pressable key={h.id} onPress={() => void toggle(h.id)} style={[styles.secondary, n >= 0 && styles.on]}>
                <Text style={[styles.secondaryText, n >= 0 && styles.onText]}>{`${n >= 0 ? `${n + 1}. ` : ''}${h.name}`}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => void Linking.openURL(`${s.conn?.url}/quick`)} style={styles.primary}><Text style={styles.primaryText}>Open Journal</Text></Pressable>
        </>
      ) : (
        <>
          <Text style={styles.sub}>{s.keyBad ? 'Key not valid. ' : ''}In Journal, go to Settings → Devices, make a code and paste it here.</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="Paste code" placeholderTextColor={dark['text-3']} autoCapitalize="none" autoCorrect={false} />
          <Pressable onPress={() => void join()} style={styles.primary}><Text style={styles.primaryText}>Connect</Text></Pressable>
        </>
      )}
      {!!note && <Text style={styles.sub}>{note}</Text>}
    </ScrollView>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route | null>(null);
  const [s, setS] = useState<Snapshot | null>(null);
  const [dirty, setDirty] = useState(false);
  const closing = useRef(new Animated.Value(1)).current;
  const reload = useCallback(async () => setS(await snapshot()), []);

  useEffect(() => {
    void reload();
    void Linking.getInitialURL().then((u) => setRoute(routeOf(u)));
    const sub = Linking.addEventListener('url', (e) => {
      closing.setValue(1);
      void reload();
      setRoute(routeOf(e.url));
    });
    return () => sub.remove();
  }, [reload, closing]);

  // A tap saves at once: the widget repaints, the window fades, the save finishes behind it.
  const leave: Leave = (action) => {
    const exit = () => Animated.timing(closing, { toValue: 0, duration: 120, easing: OUT, useNativeDriver: true }).start(() => BackHandler.exitApp());
    if (action) void tapThenLeave(action, exit);
    else exit();
  };

  if (!route || !s) return null;
  if (route === 'setup') return <Setup s={s} reload={reload} />;
  return (
    <Win closing={closing} canDismiss={!dirty}>
      {route === 'mood' && <Mood s={s} leave={leave} />}
      {route === 'weight' && <Weight s={s} leave={leave} />}
      {route === 'hours' && <Hours s={s} leave={leave} onDirty={setDirty} />}
      {route === 'more' && <More s={s} leave={leave} reload={reload} />}
    </Win>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  win: { backgroundColor: dark.surface, borderRadius: 14, borderWidth: 1, borderColor: dark['border-strong'], padding: 16, elevation: 16 },
  page: { flex: 1, backgroundColor: dark.bg },
  setup: { padding: 24, paddingTop: 72, gap: 12 },
  title: { color: dark['text-1'], fontSize: 24, fontWeight: '600' },
  sub: { color: dark['text-2'], fontSize: 14 },
  connected: { color: dark.ok, fontSize: 16, fontWeight: '600' },
  label: { color: dark['text-2'], fontSize: 13 },
  gap: { gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  circle: { width: 46, height: 46, borderRadius: 23, backgroundColor: dark['surface-2'], alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: dark['accent-fill'] },
  off: { opacity: 0.4 },
  onText: { color: dark['on-accent-fill'] },
  num: { color: dark['text-1'], fontSize: 16, fontWeight: '600' },
  value: { color: dark['text-1'], fontSize: 28, fontWeight: '600', textAlign: 'center' },
  prefill: { color: dark['text-3'] },
  unit: { fontSize: 14, color: dark['text-2'] },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  key: { width: 98, height: 52, borderRadius: 10, backgroundColor: dark['surface-2'], alignItems: 'center', justifyContent: 'center' },
  keyText: { color: dark['text-1'], fontSize: 20 },
  primary: { minHeight: 48, borderRadius: 10, backgroundColor: dark['accent-fill'], alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: dark['on-accent-fill'], fontSize: 14, fontWeight: '600' },
  secondary: { minHeight: 44, borderRadius: 10, backgroundColor: dark['surface-2'], alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  secondaryText: { color: dark['text-1'], fontSize: 14, fontWeight: '500' },
  linkText: { color: dark['text-1'], fontSize: 13 },
  buttons: { flexDirection: 'row', gap: 6 },
  grow: { flex: 1 },
  chips: { gap: 6 },
  chip: { height: 36, borderRadius: 18, paddingHorizontal: 12, backgroundColor: dark['surface-2'], flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: dark['text-2'], fontSize: 13 },
  grid: { width: 6 * CELL.w + 5 * CELL.gap, flexDirection: 'row', flexWrap: 'wrap', gap: CELL.gap, alignSelf: 'center' },
  cell: { width: CELL.w, height: CELL.h, borderRadius: 10, backgroundColor: dark['surface-2'], alignItems: 'center', justifyContent: 'center' },
  cellText: { color: dark['text-3'], fontSize: 12, fontWeight: '600' },
  habits: { maxHeight: 216 },
  habit: { width: 71, height: 68, alignItems: 'center', gap: 4 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: dark['surface-2'], alignItems: 'center', justifyContent: 'center' },
  habitName: { color: dark['text-2'], fontSize: 12, maxWidth: 71 },
  note: { minHeight: 44, maxHeight: 88, borderRadius: 10, backgroundColor: dark['surface-2'], color: dark['text-1'], fontSize: 14, paddingHorizontal: 12, paddingVertical: 10 },
  input: { backgroundColor: dark.surface, borderColor: dark.border, borderWidth: 1, borderRadius: 10, color: dark['text-1'], fontSize: 18, minHeight: 56, paddingHorizontal: 16 },
});
