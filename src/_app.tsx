import { Component, PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Granite, InitialProps } from '@granite-js/react-native';
import { context } from '../require.context';

type AppsInTossFramework = typeof import('@apps-in-toss/framework');

function AppContainer({ children }: PropsWithChildren<InitialProps>) {
  return <RootErrorBoundary>{children}</RootErrorBoundary>;
}

function createApp() {
  try {
    const { AppsInToss } = require('@apps-in-toss/framework') as AppsInTossFramework;
    return AppsInToss.registerApp(AppContainer, { context });
  } catch (_) {
    return Granite.registerApp(AppContainer, {
      appName: 'wherego',
      context,
    });
  }
}

const App = createApp();

export default App;

class RootErrorBoundary extends Component<PropsWithChildren, { hasError: boolean }> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorPage}>
          <Text style={styles.errorTitle}>앱을 다시 열어주세요</Text>
          <Text style={styles.errorBody}>일시적으로 화면을 불러오지 못했어요.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorPage: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: '#191F28',
    fontSize: 22,
    fontWeight: '700',
  },
  errorBody: {
    color: '#6B7684',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
});
