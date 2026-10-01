import { createRoute } from '@granite-js/react-native';
import React from 'react';

import { WheregoApp } from '../src/WheregoApp';
import { parseSharedPlace } from '../src/discovery/places';

export const Route = createRoute('/', {
  validateParams: params => ({ sharedPlace: parseSharedPlace(params) }),
  component: Index,
});

function Index() {
  return <WheregoApp entryMode="general" initialSharedPlace={Route.useParams().sharedPlace} />;
}
