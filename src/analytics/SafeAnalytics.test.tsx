import React, { type ReactElement } from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { performTrackedAction, SafeAnalyticsImpression, SafeAnalyticsPress } from './SafeAnalytics';

const mockTrack = jest.fn();
let mockContextMissing = false;

jest.mock('@apps-in-toss/framework', () => {
  const mockReact = jest.requireActual<typeof React>('react');
  return {
    Analytics: {
      Press: ({ children, params }: { children: ReactElement<{ onPress?: () => void }>; params: object }) => {
        if (mockContextMissing) throw new Error('useLoggingContext should be used within <LoggingContext.Provider />');
        return mockReact.cloneElement(children, { onPress: async () => {
          await mockTrack(params);
          return children.props.onPress?.();
        } });
      },
      Impression: ({ children, params }: { children: ReactElement; params: object }) => {
        if (mockContextMissing) throw new Error('useLoggingContext should be used within <LoggingContext.Provider />');
        mockReact.useEffect(() => { mockTrack(params); }, []);
        return children;
      },
    },
  };
});

function TestControl({ onPress }: { onPress: () => void }) {
  return <Text onPress={onPress}>Map</Text>;
}

describe('safe Toss analytics', () => {
  let renderer: ReactTestRenderer | undefined;

  beforeEach(() => {
    mockTrack.mockReset();
    mockContextMissing = false;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
    renderer = undefined;
    jest.restoreAllMocks();
  });

  it('logs a click without duplicating the original action or including private data', async () => {
    const action = jest.fn();
    act(() => {
      renderer = create(<SafeAnalyticsPress event="weekend_map_click"><TestControl onPress={action} /></SafeAnalyticsPress>);
    });
    await act(async () => { renderer?.root.findByType(TestControl).props.onPress(); });

    expect(action).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith({ log_name: 'weekend_map_click' });
  });

  it('keeps the button usable when the SDK has no logging context', () => {
    mockContextMissing = true;
    const action = jest.fn();
    act(() => {
      renderer = create(<SafeAnalyticsPress event="weekend_map_click"><TestControl onPress={action} /></SafeAnalyticsPress>);
    });
    act(() => { renderer?.root.findByType(TestControl).props.onPress(); });

    expect(action).toHaveBeenCalledTimes(1);
    expect(mockTrack).not.toHaveBeenCalled();
    expect(renderer?.root.findByType(Text).props.children).toBe('Map');
  });

  it('keeps the result visible when impression logging has no context', () => {
    mockContextMissing = true;
    act(() => {
      renderer = create(<SafeAnalyticsImpression event="weekend_result_view"><Text>Result</Text></SafeAnalyticsImpression>);
    });

    expect(renderer?.root.findByType(Text).props.children).toBe('Result');
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('does not count a result again on a normal rerender', () => {
    act(() => {
      renderer = create(<SafeAnalyticsImpression event="weekend_result_view"><Text>Result</Text></SafeAnalyticsImpression>);
    });
    act(() => {
      renderer?.update(<SafeAnalyticsImpression event="weekend_result_view"><Text>Updated result</Text></SafeAnalyticsImpression>);
    });

    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('runs an action even when click logging rejects', async () => {
    mockTrack.mockRejectedValue(new Error('log unavailable'));
    const action = jest.fn();
    act(() => {
      renderer = create(<SafeAnalyticsPress event="weekend_map_click"><TestControl onPress={action} /></SafeAnalyticsPress>);
    });
    await act(async () => { renderer?.root.findByType(TestControl).props.onPress(); });

    expect(action).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalled();
  });

  it('preserves arguments and return value when logging throws synchronously', () => {
    const action = jest.fn(() => 'opened');
    const track = jest.fn(() => { throw new Error('log unavailable'); });

    expect(performTrackedAction(action, track, ['press'])).toBe('opened');
    expect(action).toHaveBeenCalledWith('press');
    expect(track).toHaveBeenCalledWith('press');
  });
});
