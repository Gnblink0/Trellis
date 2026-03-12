import { colors } from './colors';

export const borders = {
  activeSelected: {
    borderWidth: 3,
    borderColor: colors.primary,
    borderStyle: 'solid' as const,
  },
  simplifiedBlock: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'solid' as const,
  },
  dashed: {
    borderWidth: 3,
    borderColor: colors.primary,
    borderStyle: 'dashed' as const,
  },
} as const;
