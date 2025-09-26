/**
 * Standardized logging utility for Anyventure system
 * Provides colorful, consistent error and warning messages
 */

/**
 * Log an error with purple styling and [Anyventure Error] prefix
 * @param {string} message - The error message to display
 * @param {...any} args - Additional arguments to log
 */
export function logError(message, ...args) {
  console.error(
    '%c[Anyventure Error]%c ' + message,
    'color: #8B5CF6; font-weight: bold; background: #2D1B69; padding: 2px 6px; border-radius: 3px;',
    'color: #EF4444; font-weight: normal;',
    ...args
  );
}

/**
 * Log a warning with purple styling and [Anyventure Warning] prefix
 * @param {string} message - The warning message to display
 * @param {...any} args - Additional arguments to log
 */
export function logWarning(message, ...args) {
  console.warn(
    '%c[Anyventure Warning]%c ' + message,
    'color: #8B5CF6; font-weight: bold; background: #2D1B69; padding: 2px 6px; border-radius: 3px;',
    'color: #F59E0B; font-weight: normal;',
    ...args
  );
}

/**
 * Development debug logging (disabled in production)
 * Only use during development - these will be removed
 * @param {string} message - The debug message
 * @param {...any} args - Additional arguments to log
 */
export function logDebug(message, ...args) {
  // Development only - remove all calls to this function
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Anyventure Debug] ${message}`, ...args);
  }
}

/**
 * Log info messages with purple styling and [Anyventure Info] prefix
 * @param {string} message - The info message to display
 * @param {...any} args - Additional arguments to log
 */
export function logInfo(message, ...args) {
  console.log(
    '%c[Anyventure Info]%c ' + message,
    'color: #8B5CF6; font-weight: bold; background: #2D1B69; padding: 2px 6px; border-radius: 3px;',
    'color: #10B981; font-weight: normal;',
    ...args
  );
}