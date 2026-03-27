import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';
import type { DrawingTool } from './DrawingCanvas';

type Props = {
  tool: DrawingTool;
  color: string;
  strokeWidth: number;
  onToolChange: (tool: DrawingTool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

const COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Pink', value: '#EC4899' },
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Thick', value: 8 },
  { label: 'Bold', value: 12 },
];

const TOOLS: Array<{ tool: DrawingTool; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { tool: 'pen', icon: 'create-outline', label: 'Pen' },
  { tool: 'highlighter', icon: 'color-fill-outline', label: 'Highlighter' },
  { tool: 'eraser', icon: 'remove-outline', label: 'Eraser' },
  { tool: 'circle', icon: 'ellipse-outline', label: 'Circle' },
  { tool: 'rect', icon: 'square-outline', label: 'Rectangle' },
  { tool: 'arrow', icon: 'arrow-forward-outline', label: 'Arrow' },
  { tool: 'text', icon: 'text-outline', label: 'Text' },
];

export default function DrawingToolbar({
  tool,
  color,
  strokeWidth,
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  onClear,
  canUndo = false,
  canRedo = false,
}: Props) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokePicker, setShowStrokePicker] = useState(false);

  return (
    <>
      <View style={styles.toolbar}>
        {/* Tool buttons */}
        <View style={styles.toolGroup}>
          {TOOLS.map((t) => (
            <Pressable
              key={t.tool}
              style={[styles.toolBtn, tool === t.tool && styles.toolBtnActive]}
              onPress={() => onToolChange(t.tool)}
            >
              <Ionicons
                name={t.icon}
                size={20}
                color={tool === t.tool ? colors.primary : colors.textSecondary}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Color picker */}
        <Pressable
          style={styles.colorBtn}
          onPress={() => setShowColorPicker(true)}
        >
          <View style={[styles.colorPreview, { backgroundColor: color }]} />
        </Pressable>

        {/* Stroke width picker */}
        <Pressable
          style={styles.strokeBtn}
          onPress={() => setShowStrokePicker(true)}
        >
          <View style={[styles.strokePreview, { height: strokeWidth / 2 }]} />
        </Pressable>

        <View style={styles.divider} />

        {/* Undo/Redo/Clear */}
        <Pressable
          style={[styles.actionBtn, !canUndo && styles.actionBtnDisabled]}
          onPress={onUndo}
          disabled={!canUndo}
        >
          <Ionicons name="arrow-undo" size={20} color={canUndo ? colors.textPrimary : colors.surfaceMuted} />
        </Pressable>

        <Pressable
          style={[styles.actionBtn, !canRedo && styles.actionBtnDisabled]}
          onPress={onRedo}
          disabled={!canRedo}
        >
          <Ionicons name="arrow-redo" size={20} color={canRedo ? colors.textPrimary : colors.surfaceMuted} />
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={onClear}
        >
          <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Color picker modal */}
      <Modal
        visible={showColorPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowColorPicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Choose Color</Text>
            <View style={styles.colorGrid}>
              {COLORS.map((c) => (
                <Pressable
                  key={c.value}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c.value },
                    color === c.value && styles.colorOptionSelected,
                  ]}
                  onPress={() => {
                    onColorChange(c.value);
                    setShowColorPicker(false);
                  }}
                >
                  {color === c.value && (
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Stroke width picker modal */}
      <Modal
        visible={showStrokePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStrokePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowStrokePicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Stroke Width</Text>
            <View style={styles.strokeGrid}>
              {STROKE_WIDTHS.map((s) => (
                <Pressable
                  key={s.value}
                  style={[
                    styles.strokeOption,
                    strokeWidth === s.value && styles.strokeOptionSelected,
                  ]}
                  onPress={() => {
                    onStrokeWidthChange(s.value);
                    setShowStrokePicker(false);
                  }}
                >
                  <Text style={styles.strokeLabel}>{s.label}</Text>
                  <View style={[styles.strokeLine, { height: s.value }]} />
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
    gap: spacing.innerGapSmall,
    ...shadows.floatingToolbar,
  },
  toolGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  toolBtnActive: {
    backgroundColor: colors.primaryLight,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.surfaceMuted,
  },
  colorBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  colorPreview: {
    width: 28,
    height: 28,
    borderRadius: radii.circle,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  strokeBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  strokePreview: {
    width: 24,
    backgroundColor: colors.textPrimary,
    borderRadius: 2,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.3,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.pagePadding,
    minWidth: 280,
    ...shadows.modalSheet,
  },
  pickerTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.innerGap,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.innerGap,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: radii.circle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: colors.textSecondary,
  },
  strokeGrid: {
    gap: spacing.innerGapSmall,
  },
  strokeOption: {
    paddingVertical: spacing.innerGap,
    paddingHorizontal: spacing.innerGap,
    borderRadius: radii.chip,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceMuted,
  },
  strokeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  strokeLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.innerGapSmall,
  },
  strokeLine: {
    width: '100%',
    backgroundColor: colors.textPrimary,
    borderRadius: 2,
  },
});
