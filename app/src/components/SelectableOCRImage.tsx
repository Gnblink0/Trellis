import { requireNativeComponent, type ViewStyle } from 'react-native';

export type SelectionRect = { x: number; y: number; width: number; height: number };

export type SelectionChangePayload = {
  selectedText: string;
  selectionRect: SelectionRect;
};

type NativeSelectionEvent = {
  selectedText: string;
  selectionRect: SelectionRect;
};

type NativeProps = {
  imageUri: string;
  onSelectionChange: (event: { nativeEvent: NativeSelectionEvent }) => void;
  style?: ViewStyle;
};

const NativeSelectableOCRImageView = requireNativeComponent<NativeProps>(
  'SelectableOCRImageView'
);

export default function SelectableOCRImage({
  imageUri,
  onSelectionChange,
  style,
}: {
  imageUri: string;
  onSelectionChange: (payload: SelectionChangePayload) => void;
  style?: ViewStyle;
}) {
  return (
    <NativeSelectableOCRImageView
      imageUri={imageUri}
      style={style}
      onSelectionChange={(event) => {
        const nativeEvent = event.nativeEvent;
        onSelectionChange({
          selectedText: nativeEvent.selectedText,
          selectionRect: nativeEvent.selectionRect,
        });
      }}
    />
  );
}

