// Auth / session
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days
export const SESSION_EXPIRY = '7d' as const;
export const SESSION_REFRESH_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

// Rate limiting
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const RATE_LIMIT_MAX_ATTEMPTS = 5;

// Time tracker validation
export const HOUR_MAX = 23;
export const CATEGORY_MAX = 11;

// Pagination
export const PAGINATION_DEFAULT_LIMIT = 10;
export const PAGINATION_MAX_LIMIT = 100;

// Canvas overlay dimensions (Instagram story ratio)
export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
