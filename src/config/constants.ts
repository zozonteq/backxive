export const CONFIG = {
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 10000,
  },
  WORKER: {
    THREAD_COUNT: 4,
  },
  PATHS: {
    TWEETS_DIR: 'tweets',
  },
  WAYBACK: {
    BASE_URL: 'https://web.archive.org/web',
  },
} as const; 