import { createRoute } from '@granite-js/react-native';
import React from 'react';

import { WheregoApp } from '../src/WheregoApp';

export const Route = createRoute('/promotion', {
  component: PromotionEntry,
});

function PromotionEntry() {
  return <WheregoApp entryMode="promotion" />;
}
