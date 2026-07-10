import { register } from '@granite-js/react-native';
import { LogBox } from 'react-native';
import App from './src/_app';

LogBox.ignoreLogs(["Codegen didn't run for", 'SafeAreaView has been deprecated']);

register(App);
