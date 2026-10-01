export type FlowStep = 'intro' | 'origin' | 'question' | 'rewardGate' | 'quota' | 'result';

export function backDestination(step: FlowStep, questionIndex: number, hasSubmittedAnswers: boolean) {
  if (step === 'intro' || step === 'rewardGate' || (step === 'question' && hasSubmittedAnswers)) {
    return 'exit' as const;
  }
  if (step === 'question') return questionIndex > 0 ? 'previousQuestion' as const : 'origin' as const;
  return 'intro' as const;
}
