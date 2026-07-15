import { createRoute } from '@granite-js/react-native';
import React from 'react';

import { WheregoApp } from '../src/WheregoApp';

export const Route = createRoute('/', {
  component: Index,
});

function Index() {
  return <WheregoApp entryMode="general" />;
}
