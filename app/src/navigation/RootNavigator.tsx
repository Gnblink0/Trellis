import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import WorksheetCaptureScreen from '../screens/WorksheetCaptureScreen';
import ScanWorksheetScreen from '../screens/ScanWorksheetScreen';
import OcrLiveTextScreen from '../screens/OcrLiveTextScreen';
import WorksheetViewScreen from '../screens/WorksheetViewScreen';
import ProcessScreen from '../screens/ProcessScreen';
import ReviewScreen from '../screens/ReviewScreen';
import StudentViewScreen from '../screens/StudentViewScreen';
import ExportScreen from '../screens/ExportScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FBF8F4' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="WorksheetCapture" component={WorksheetCaptureScreen} />
      <Stack.Screen name="Process" component={ProcessScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="ScanWorksheet" component={ScanWorksheetScreen} />
      <Stack.Screen name="OcrLiveText" component={OcrLiveTextScreen} />
      <Stack.Screen name="WorksheetView" component={WorksheetViewScreen} />
      <Stack.Screen name="StudentView" component={StudentViewScreen} />
      <Stack.Screen name="Export" component={ExportScreen} />
    </Stack.Navigator>
  );
}
