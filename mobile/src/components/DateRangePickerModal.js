import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { BottomSheetModal } from './BottomSheetModal';
import * as Haptics from 'expo-haptics';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const DateRangePickerModal = ({
  visible,
  onClose,
  startDate,
  endDate,
  onApplyRange,
  transactions = [],
}) => {
  // Working local state
  const [selectedPreset, setSelectedPreset] = useState('all');
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);

  // Month navigation in calendar
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(7); // August = 7 (0-indexed)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Quick preset helper
  const handleSelectPreset = (preset) => {
    Haptics.selectionAsync();
    setSelectedPreset(preset);
    const now = new Date();

    if (preset === 'all') {
      setLocalStart(null);
      setLocalEnd(null);
    } else if (preset === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      setLocalStart(todayStart);
      setLocalEnd(todayEnd);
    } else if (preset === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setLocalStart(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0));
      setLocalEnd(now);
    } else if (preset === '14days') {
      const start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      setLocalStart(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0));
      setLocalEnd(now);
    } else if (preset === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      setLocalStart(start);
      setLocalEnd(end);
    }
  };

  // Calendar Day Click Logic (First tap = Start Date, Second tap = End Date)
  const handleDayPress = (day) => {
    Haptics.selectionAsync();
    setSelectedPreset('custom');
    const clickedDate = new Date(viewYear, viewMonth, day, 12, 0, 0);

    if (!localStart || (localStart && localEnd)) {
      // First tap -> set start date
      setLocalStart(new Date(viewYear, viewMonth, day, 0, 0, 0));
      setLocalEnd(null);
    } else if (localStart && !localEnd) {
      // Second tap -> set end date
      if (clickedDate < localStart) {
        // If clicked earlier date, make it new start
        setLocalStart(new Date(viewYear, viewMonth, day, 0, 0, 0));
      } else {
        setLocalEnd(new Date(viewYear, viewMonth, day, 23, 59, 59));
      }
    }
  };

  // Calendar grid calculations
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const days = [];

    // Empty lead slots
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, key: `empty-${i}` });
    }

    const isSameDay = (d1, d2) =>
      d1 && d2 &&
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    const startMidnight = localStart ? new Date(localStart.getFullYear(), localStart.getMonth(), localStart.getDate()) : null;
    const endMidnight = localEnd ? new Date(localEnd.getFullYear(), localEnd.getMonth(), localEnd.getDate()) : null;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(viewYear, viewMonth, d);
      const isStart = isSameDay(localStart, dateObj);
      const isEnd = isSameDay(localEnd, dateObj);

      const isInRange = startMidnight && endMidnight && !isStart && !isEnd &&
        dateObj > startMidnight &&
        dateObj < endMidnight;

      days.push({
        day: d,
        key: `day-${d}`,
        isStart,
        isEnd,
        isInRange,
      });
    }

    return days;
  }, [viewYear, viewMonth, localStart, localEnd]);

  // Matching transactions summary
  const summary = useMemo(() => {
    if (!localStart && !localEnd) {
      return { count: transactions.length, total: transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0) };
    }
    const filtered = transactions.filter((t) => {
      if (!t || !t.date) return false;
      const d = new Date(t.date);
      if (localStart && d < localStart) return false;
      if (localEnd && d > localEnd) return false;
      return true;
    });
    return {
      count: filtered.length,
      total: filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    };
  }, [transactions, localStart, localEnd]);

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApplyRange(localStart, localEnd);
    onClose();
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalStart(null);
    setLocalEnd(null);
    setSelectedPreset('all');
    onApplyRange(null, null);
    onClose();
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Filter by Date Range</Text>
          <Text style={styles.subtitle}>Select first (start) and last (end) date</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Feather name="x" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Quick Presets */}
            <View style={styles.presetsRow}>
              {[
                { id: 'all', label: 'All Dates' },
                { id: 'thisMonth', label: 'This Month' },
                { id: '7days', label: 'Last 7 Days' },
                { id: '14days', label: 'Last 14 Days' },
              ].map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.presetChip,
                    selectedPreset === p.id && styles.presetChipActive,
                  ]}
                  onPress={() => handleSelectPreset(p.id)}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      selectedPreset === p.id && styles.presetChipTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date Range Badges */}
            <View style={styles.rangeDisplay}>
              <View style={styles.rangeBox}>
                <Text style={styles.rangeLabel}>START DATE (FIRST)</Text>
                <Text style={styles.rangeVal}>
                  {localStart ? localStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Beginning'}
                </Text>
              </View>
              <Feather name="arrow-right" size={16} color={COLORS.textMuted} />
              <View style={styles.rangeBox}>
                <Text style={styles.rangeLabel}>END DATE (LAST)</Text>
                <Text style={styles.rangeVal}>
                  {localEnd ? localEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Latest'}
                </Text>
              </View>
            </View>

            {/* Calendar Widget */}
            <View style={styles.calendarCard}>
              {/* Calendar Month Selector */}
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                  <Feather name="chevron-left" size={20} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.monthLabel}>
                  {monthNames[viewMonth]} {viewYear}
                </Text>
                <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                  <Feather name="chevron-right" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Day names header */}
              <View style={styles.weekRow}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                  <Text key={i} style={styles.weekDayText}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {calendarDays.map((item) => {
                  if (!item.day) {
                    return <View key={item.key} style={styles.dayCell} />;
                  }

                  const isSelected = item.isStart || item.isEnd;

                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.dayCell,
                        item.isInRange && styles.dayCellInRange,
                        item.isStart && styles.dayCellStart,
                        item.isEnd && styles.dayCellEnd,
                      ]}
                      onPress={() => handleDayPress(item.day)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.dayInner,
                          isSelected && styles.dayInnerSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            item.isInRange && styles.dayTextInRange,
                            isSelected && styles.dayTextSelected,
                          ]}
                        >
                          {item.day}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Live Filter Matching Preview */}
            <View style={styles.previewCard}>
              <View style={styles.previewLeft}>
                <Ionicons name="filter" size={16} color={COLORS.primary} />
                <Text style={styles.previewTitle}>
                  {summary.count} {summary.count === 1 ? 'transaction' : 'transactions'} found
                </Text>
              </View>
              <Text style={styles.previewTotal}>₹{summary.total.toLocaleString('en-IN')}</Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetBtnText}>Clear Filter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Apply Date Range</Text>
            </TouchableOpacity>
          </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    paddingTop: 20,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: COLORS.bgSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  presetChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: COLORS.textInverse,
  },
  rangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  rangeBox: {
    flex: 1,
  },
  rangeLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rangeVal: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  calendarCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    padding: 6,
  },
  monthLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  weekDayText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    width: 36,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellInRange: {
    backgroundColor: COLORS.primaryGlow,
  },
  dayCellStart: {
    borderTopLeftRadius: 19,
    borderBottomLeftRadius: 19,
    backgroundColor: COLORS.primaryGlow,
  },
  dayCellEnd: {
    borderTopRightRadius: 19,
    borderBottomRightRadius: 19,
    backgroundColor: COLORS.primaryGlow,
  },
  dayInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInnerSelected: {
    backgroundColor: COLORS.primary,
  },
  dayText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  dayTextInRange: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    marginBottom: 8,
  },
  previewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  previewTotal: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.bgSubtle,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  applyBtnText: {
    color: COLORS.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
});
