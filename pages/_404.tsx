import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>404 Not Found</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    color: '#191F28',
    fontSize: 20,
    fontWeight: '700',
  },
});
