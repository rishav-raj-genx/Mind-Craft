import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, InteractionManager, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LOW_MEMORY_LIST_PROPS } from '@/constants/list';
import { palette, radii } from '@/constants/theme';
import { fetchWallet, type TokenTransaction, type WalletSummary } from '@/services/mindcraft';

const reasonLabel = (reason: string) => reason
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const TransactionRow = memo(function TransactionRow({ transaction }: { transaction: TokenTransaction }) {
  const positive = transaction.amount >= 0;
  return (
    <View style={styles.transaction}>
      <View style={[styles.transactionIcon, positive ? styles.positiveIcon : styles.negativeIcon]}>
        <Text style={styles.transactionGlyph}>{positive ? '+' : '-'}</Text>
      </View>
      <View style={styles.transactionText}>
        <Text style={styles.transactionTitle}>{reasonLabel(transaction.reason)}</Text>
        <Text style={styles.transactionTime}>
          {transaction.timestamp ? new Date(transaction.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently'}
        </Text>
      </View>
      <Text style={[styles.transactionAmount, positive ? styles.positiveAmount : styles.negativeAmount]}>
        {positive ? '+' : ''}{transaction.amount}
      </Text>
    </View>
  );
});

export default function WalletScreen() {
  const [wallet, setWallet] = useState<WalletSummary>({ balance: 0, transactions: [] });

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchWallet().then(setWallet).catch(() => setWallet({ balance: 0, transactions: [] }));
    });
    return () => task.cancel();
  }, []);

  const transactions = useMemo(() => wallet.transactions, [wallet.transactions]);
  const renderTransaction = useCallback(({ item }: { item: TokenTransaction }) => <TransactionRow transaction={item} />, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={(
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.kicker}>Wallet</Text>
              <Text style={styles.balance}>{wallet.balance.toLocaleString('en-IN')}</Text>
              <Text style={styles.balanceLabel}>Mind Tokens</Text>
            </View>
            <Text style={styles.sectionTitle}>Recent Earnings</Text>
          </>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No token transactions yet. Answer doubts and complete sessions to earn.</Text>}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...LOW_MEMORY_LIST_PROPS}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.surface },
  content: { padding: 20, paddingBottom: 120, gap: 12 },
  balanceCard: { backgroundColor: palette.ink, borderRadius: 36, padding: 26, overflow: 'hidden' },
  kicker: { color: palette.lime, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  balance: { color: '#FFFFFF', fontSize: 56, fontWeight: '900', marginTop: 10 },
  balanceLabel: { color: '#D9D1E4', fontSize: 18, fontWeight: '800' },
  sectionTitle: { color: palette.ink, fontSize: 22, fontWeight: '900', marginTop: 10 },
  transaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.card,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
  },
  transactionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  positiveIcon: { backgroundColor: palette.lime },
  negativeIcon: { backgroundColor: '#FFE9E2' },
  transactionGlyph: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  transactionText: { flex: 1 },
  transactionTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  transactionTime: { color: palette.muted, fontWeight: '700', marginTop: 3 },
  transactionAmount: { fontSize: 18, fontWeight: '900' },
  positiveAmount: { color: '#598700' },
  negativeAmount: { color: '#E44D35' },
  empty: { color: palette.muted, textAlign: 'center', fontWeight: '800', marginTop: 22 },
});
