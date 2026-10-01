import { Analytics } from '@apps-in-toss/framework';
import React, { cloneElement, Component, type PropsWithChildren, type ReactElement } from 'react';

export type WeekendEvent =
  | 'weekend_result_view'
  | 'weekend_map_click'
  | 'weekend_card_save_click'
  | 'weekend_place_share_click'
  | 'weekend_place_bookmark_click'
  | 'weekend_saved_places_view'
  | 'weekend_saved_place_map_click'
  | 'weekend_shared_place_view'
  | 'weekend_shared_place_map_click';

type Action = (...args: unknown[]) => unknown;
type Control = ReactElement<{ onPress?: Action }>;

function reportUnavailable() {
  console.warn('[wherego:analytics] tracking unavailable');
}

export function performTrackedAction(action: Action | undefined, track: Action | undefined, args: unknown[]) {
  const result = action?.(...args);
  // SDK logging runs separately so a rejected event cannot block the user's action.
  try {
    void Promise.resolve(track?.(...args)).catch(reportUnavailable);
  } catch {
    reportUnavailable();
  }
  return result;
}

function PressTarget({ control, onPress }: { control: Control; onPress?: Action }) {
  return cloneElement(control, {
    onPress: (...args: unknown[]) => performTrackedAction(control.props.onPress, onPress, args),
  });
}

export function SafeAnalyticsPress({ event, children }: { event: WeekendEvent; children: Control }) {
  return (
    <TrackingBoundary fallback={children}>
      <Analytics.Press params={{ log_name: event }}>
        <PressTarget control={children} />
      </Analytics.Press>
    </TrackingBoundary>
  );
}

export function SafeAnalyticsImpression({ event, children }: { event: WeekendEvent; children: ReactElement }) {
  return (
    <TrackingBoundary fallback={children}>
      <Analytics.Impression impression="on-mount" params={{ log_name: event }}>
        {children}
      </Analytics.Impression>
    </TrackingBoundary>
  );
}

class TrackingBoundary extends Component<PropsWithChildren<{ fallback: ReactElement }>, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    reportUnavailable();
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
