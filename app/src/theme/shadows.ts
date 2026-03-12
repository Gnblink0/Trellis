import { ViewStyle } from 'react-native';

export const shadows = {
  modalSheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 16,
  } satisfies ViewStyle,

  floatingToolbar: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  } satisfies ViewStyle,

  fab: {
    shadowColor: '#2DB89A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  } satisfies ViewStyle,
} as const;
