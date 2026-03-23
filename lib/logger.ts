/**
 * Production-safe logger.
 *
 * In development (__DEV__), logs are printed to the console as usual.
 * In production, all logs are silently suppressed so nothing leaks
 * to the user's device console.
 */

const noop = (..._args: any[]) => {};

export const logger = {
  log: __DEV__ ? console.log.bind(console) : noop,
  warn: __DEV__ ? console.warn.bind(console) : noop,
  error: __DEV__ ? console.error.bind(console) : noop,
  info: __DEV__ ? console.info.bind(console) : noop,
  debug: __DEV__ ? console.debug.bind(console) : noop,
};
