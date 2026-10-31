import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dark } from '@journaling/design';
import { connect, refresh, setPicked, snapshot, type Snapshot } from './src/sync';
import { paintAll, tapThenLeave } from './src/widgets/handler';
import type { Action } from './src/logic/api';
import { FACES } from './src/widgets/JournalWidgets';

const MAX_PICKED = 6;
type Route = { screen: 'setup' } | { screen: 'mood'; face: number | null } | { screen: 'weight' };

function routeOf(url: string | null | undefined): Route {
  if (!url) return { screen: 'setup' };
  if (url.includes('://weight')) return { screen: 'weight' };
  if (url.includes('://mood')) {
    const m = url.match(/face=(\d)/);
    return { screen: 'mood', face: m ? Number(m[1]) : null };
  }
  return { screen: 'setup' };
}

function Btn({ label, on, onPress, big }: { label: string; on?: boolean; onPress: () => void; big?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, big && styles.btnBig, (on || pressed) && styles.btnOn]}>
      <Text style={[styles.btnText, big && styles.btnTextBig]}>{label}</Text>
    </Pressable>
  );
}

const saveAndLeave = (action: Action) => tapThenLeave(action, () => BackHandler.exitApp());

function Mood({ start }: { start: number | null }) {
  const [face, setFace] = useState(start);
  if (face === null) {
    return (
      <View style={styles.row}>
        {FACES.map((f, i) => <Btn key={f.emoji} big label={f.emoji} onPress={() => setFace(i)} />)}
      </View>
    );
  }
  return (
    <View style={styles.row}>
      {FACES[face].scores.map((n) => <Btn key={n} big label={String(n)} onPress={() => void saveAndLeave({ action: 'mood', score: n })} />)}
    </View>
  );
}

function Weight({ last }: { last: number | null }) {
  const [text, setText] = useState(last === null ? '' : String(last));
  const value = parseFloat(text.replace(',', '.'));
  const ok = Number.isFinite(value) && value >= 20 && value <= 400;
  return (
    <View style={styles.gap}>
      <TextInput style={styles.input} value={text} onChangeText={setText} keyboardType="decimal-pad" autoFocus selectTextOnFocus placeholder="Weight" placeholderTextColor={dark['text-3']} />
      {ok && <Btn big label="Save" onPress={() => void saveAndLeave({ action: 'weight', weight: value })} />}
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
    <ScrollView contentContainerStyle={styles.setup}>
      <Text style={styles.title}>Journal widget</Text>
      {s.conn && !s.keyBad ? (
        <>
          <Text style={styles.ok}>Connected ✓</Text>
          <Text style={styles.sub}>Pick up to {MAX_PICKED} habits, in order. The small widget shows the first 4.</Text>
          {(s.state?.habits ?? []).map((h) => {
            const n = s.picked.indexOf(h.id);
            return <Btn key={h.id} label={`${n >= 0 ? `${n + 1}. ` : ''}${h.name}`} on={n >= 0} onPress={() => void toggle(h.id)} />;
          })}
          <Btn label="Open Journal" onPress={() => void Linking.openURL(`${s.conn?.url}/quick`)} />
        </>
      ) : (
        <>
          <Text style={styles.sub}>{s.keyBad ? 'Key not valid. ' : ''}In Journal, go to Settings → Devices, make a code and paste it here.</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="Paste code" placeholderTextColor={dark['text-3']} autoCapitalize="none" autoCorrect={false} />
          <Btn big label="Connect" onPress={() => void join()} />
        </>
      )}
      {!!note && <Text style={styles.sub}>{note}</Text>}
    </ScrollView>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route | null>(null);
  const [s, setS] = useState<Snapshot | null>(null);
  const reload = useCallback(async () => setS(await snapshot()), []);

  useEffect(() => {
    void reload();
    void Linking.getInitialURL().then((u) => setRoute(routeOf(u)));
    const sub = Linking.addEventListener('url', (e) => setRoute(routeOf(e.url)));
    return () => sub.remove();
  }, [reload]);

  if (!route || !s) return <View style={styles.page} />;
  if (route.screen === 'setup') return <View style={styles.page}><Setup s={s} reload={reload} /></View>;
  return (
    <View style={[styles.page, styles.center]}>
      {route.screen === 'mood' ? <Mood key={String(route.face)} start={route.face} /> : <Weight last={s.state?.weight ?? null} />}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: dark.bg },
  center: { justifyContent: 'center', padding: 24 },
  setup: { padding: 24, paddingTop: 72, gap: 12 },
  title: { color: dark['text-1'], fontSize: 24, fontWeight: '600' },
  sub: { color: dark['text-2'], fontSize: 14 },
  ok: { color: dark.ok, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  gap: { gap: 12 },
  btn: { minHeight: 48, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: dark['surface-2'] },
  btnBig: { minWidth: 56, minHeight: 56, alignItems: 'center' },
  btnOn: { backgroundColor: dark['accent-fill'] },
  btnText: { color: dark['text-1'], fontSize: 14, fontWeight: '500' },
  btnTextBig: { fontSize: 22 },
  input: { backgroundColor: dark.surface, borderColor: dark.border, borderWidth: 1, borderRadius: 10, color: dark['text-1'], fontSize: 18, minHeight: 56, paddingHorizontal: 16 },
});
