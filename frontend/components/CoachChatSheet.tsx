/**
 * 💬 COACH CHAT SHEET
 * ====================
 *
 * Bottom-sheet style modal for "Ask the coach" — a lightweight back-and-forth
 * with the AI companion. The coach knows the user's recent runs and walks
 * (the backend bundles context on every turn) so the user can ask things
 * like "what should I do today?", "why did that 8k feel heavy?", "what
 * shoes for an evening drizzle".
 *
 * Behaviour:
 * - Mounted at the screen level (not navigation) so the user keeps their
 *   place when dismissing.
 * - Loads chat history on first open (not on every visibility flip).
 * - Sends a message → server stores it + the assistant reply, returns the
 *   full tail. We optimistically render the user's message so the input
 *   feels fast.
 * - Quietly degrades when the coach is opted out (CTA to opt-in screen).
 * - Empty state seeds a tiny prompt list to lower the cold-start friction.
 *
 * Brand voice on the empty state matters: short, low-pressure, written like
 * a friend, not an FAQ.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { coachApi, CoachChatTurn } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onOptInPress?: () => void;
}

const SUGGESTIONS = [
  'What should I do today?',
  "Why did yesterday's run feel heavy?",
  'How do I build up to a longer one?',
];

export function CoachChatSheet({ visible, onClose, onOptInPress }: Props) {
  const [history, setHistory] = useState<CoachChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [optedOut, setOptedOut] = useState(false);
  const [stub, setStub] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      try {
        scrollRef.current?.scrollToEnd({ animated: true });
      } catch {}
    });
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const turns = await coachApi.getChatHistory();
      setHistory(turns);
      setOptedOut(false);
      setHasLoadedOnce(true);
      scrollToBottom();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/Coach is not enabled/i.test(msg) || /403/.test(msg)) {
        setOptedOut(true);
      }
      setHasLoadedOnce(true);
    } finally {
      setLoading(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    if (visible && !hasLoadedOnce) {
      void loadHistory();
    }
    if (visible) scrollToBottom();
  }, [visible, hasLoadedOnce, loadHistory, scrollToBottom]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setDraft('');
      setSending(true);

      const optimisticUser: CoachChatTurn = {
        role: 'user',
        content: trimmed,
        created_at: null,
      };
      setHistory((prev) => [...prev, optimisticUser]);
      scrollToBottom();

      try {
        const res = await coachApi.sendChat(trimmed);
        setHistory(res.history);
        setStub(res.is_stub);
        scrollToBottom();
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (/Coach is not enabled/i.test(msg) || /403/.test(msg)) {
          setOptedOut(true);
        }
        // Pop the optimistic user message — the request didn't land. We
        // re-seed the draft so the user can try again without retyping.
        setHistory((prev) => prev.slice(0, -1));
        setDraft(trimmed);
      } finally {
        setSending(false);
      }
    },
    [sending, scrollToBottom],
  );

  const onClear = useCallback(async () => {
    try {
      await coachApi.clearChat();
      setHistory([]);
    } catch {}
  }, []);

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.textLight} />
        </View>
      );
    }

    if (optedOut) {
      return (
        <View style={styles.emptyBlock}>
          <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.textLight} />
          <Text style={styles.emptyTitle}>The coach is off.</Text>
          <Text style={styles.emptySubtitle}>
            Turn it on to chat about today's run, ask why something felt off, or build up to
            something longer.
          </Text>
          <Pressable style={styles.optInBtn} onPress={onOptInPress}>
            <Text style={styles.optInBtnText}>Set up the coach</Text>
          </Pressable>
        </View>
      );
    }

    if (history.length === 0) {
      return (
        <View style={styles.emptyBlock}>
          <Ionicons name="sparkles-outline" size={26} color={colors.primary} />
          <Text style={styles.emptyTitle}>Ask anything.</Text>
          <Text style={styles.emptySubtitle}>
            The coach knows your recent runs and walks. Short questions work best.
          </Text>
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => void send(s)}
              >
                <Text style={styles.suggestionChipText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    return (
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToBottom}
      >
        {history.map((turn, idx) => (
          <View
            key={`${turn.role}-${idx}-${turn.created_at ?? ''}`}
            style={[
              styles.bubble,
              turn.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                turn.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
              ]}
            >
              {turn.content}
            </Text>
          </View>
        ))}
        {sending ? (
          <View style={[styles.bubble, styles.bubbleAssistant, styles.bubbleTyping]}>
            <ActivityIndicator color={colors.textLight} size="small" />
          </View>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                <Text style={styles.headerTitle}>Ask the coach</Text>
                {stub ? (
                  <View style={styles.stubBadge}>
                    <Text style={styles.stubBadgeText}>preview</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.headerRight}>
                {history.length > 0 && !optedOut ? (
                  <Pressable hitSlop={8} onPress={onClear}>
                    <Text style={styles.clearText}>Clear</Text>
                  </Pressable>
                ) : null}
                <Pressable hitSlop={8} onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.body}>{renderBody()}</View>

            {!optedOut ? (
              <View style={styles.composer}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="A short question…"
                  placeholderTextColor={colors.textLight}
                  style={styles.input}
                  multiline
                  maxLength={500}
                  editable={!sending}
                  returnKeyType="send"
                  onSubmitEditing={() => void send(draft)}
                  blurOnSubmit
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.sendBtn,
                    (sending || !draft.trim()) && styles.sendBtnDisabled,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  disabled={sending || !draft.trim()}
                  onPress={() => void send(draft)}
                >
                  {sending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="arrow-up" size={18} color="#fff" />
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheetWrap: { flexShrink: 0 },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
    minHeight: '60%',
    maxHeight: '90%',
    ...shadows.medium,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  clearText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  body: {
    flex: 1,
    minHeight: 200,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    maxWidth: '85%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.sm,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleTyping: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  bubbleText: {
    fontSize: typography.sizes.md,
    lineHeight: 22,
  },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAssistant: { color: colors.text },
  loadingBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyBlock: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  suggestions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    width: '100%',
  },
  suggestionChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionChipText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  optInBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  optInBtnText: {
    color: '#fff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.sizes.md,
    color: colors.text,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.textLight,
  },
  stubBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  stubBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
