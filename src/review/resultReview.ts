import { Storage } from '@apps-in-toss/framework';

const RESULT_REVIEW_COMPLETION_COUNT_KEY = 'wherego.result-review.completion-count.v1';
const RESULT_REVIEW_SHOWN_KEY = 'wherego.result-review.shown.v1';
const RESULT_REVIEW_THRESHOLD = 2;

export async function recordSuccessfulResultForReview(): Promise<boolean> {
  const storedCount = await Storage.getItem(RESULT_REVIEW_COMPLETION_COUNT_KEY);
  const nextCount = Math.min(parseCompletionCount(storedCount) + 1, RESULT_REVIEW_THRESHOLD);
  await Storage.setItem(RESULT_REVIEW_COMPLETION_COUNT_KEY, String(nextCount));

  const alreadyShown = await Storage.getItem(RESULT_REVIEW_SHOWN_KEY);
  if (alreadyShown || nextCount < RESULT_REVIEW_THRESHOLD) {
    return false;
  }

  await Storage.setItem(RESULT_REVIEW_SHOWN_KEY, 'shown');
  return true;
}

function parseCompletionCount(value: string | null) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
