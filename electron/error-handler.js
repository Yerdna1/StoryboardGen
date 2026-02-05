const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Error categories for classification
const ErrorCategories = {
  NETWORK: 'network',
  API: 'api',
  VALIDATION: 'validation',
  FILE: 'file',
  DATABASE: 'database',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown'
};

// Error severity levels
const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Configuration for retry logic
const RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  exponentialBase: 2
};

// Error log file path
const getLogFilePath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'error-logs.log');
};

/**
 * Categorize an error based on its properties
 * @param {Error} error - The error to categorize
 * @returns {string} - The error category
 */
function categorizeError(error) {
  if (!error) return ErrorCategories.UNKNOWN;

  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toLowerCase() || '';

  // Network errors
  if (code.includes('econnrefused') ||
      code.includes('enotfound') ||
      code.includes('etimedout') ||
      code.includes('econnreset') ||
      message.includes('network') ||
      message.includes('connection')) {
    return ErrorCategories.NETWORK;
  }

  // Timeout errors
  if (message.includes('timeout') || code.includes('timeout')) {
    return ErrorCategories.TIMEOUT;
  }

  // API errors (HTTP status codes)
  if (error.response?.status || error.statusCode) {
    return ErrorCategories.API;
  }

  // File system errors
  if (code.includes('enoent') ||
      code.includes('eacces') ||
      code.includes('eperm') ||
      message.includes('file') ||
      message.includes('directory')) {
    return ErrorCategories.FILE;
  }

  // Database errors
  if (message.includes('database') ||
      message.includes('sql') ||
      message.includes('sqlite')) {
    return ErrorCategories.DATABASE;
  }

  // Validation errors
  if (message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required')) {
    return ErrorCategories.VALIDATION;
  }

  return ErrorCategories.UNKNOWN;
}

/**
 * Determine error severity based on category and impact
 * @param {string} category - The error category
 * @param {Error} error - The error object
 * @returns {string} - The severity level
 */
function getErrorSeverity(category, error) {
  switch (category) {
    case ErrorCategories.NETWORK:
    case ErrorCategories.TIMEOUT:
      return ErrorSeverity.MEDIUM;

    case ErrorCategories.API:
      const status = error.response?.status || error.statusCode;
      if (status >= 500) return ErrorSeverity.HIGH;
      if (status >= 400) return ErrorSeverity.MEDIUM;
      return ErrorSeverity.LOW;

    case ErrorCategories.DATABASE:
      return ErrorSeverity.HIGH;

    case ErrorCategories.FILE:
      const code = error.code?.toLowerCase() || '';
      if (code.includes('eperm') || code.includes('eacces')) {
        return ErrorSeverity.HIGH;
      }
      return ErrorSeverity.MEDIUM;

    case ErrorCategories.VALIDATION:
      return ErrorSeverity.LOW;

    default:
      return ErrorSeverity.MEDIUM;
  }
}

/**
 * Check if an error is retryable based on its category and properties
 * @param {string} category - The error category
 * @param {Error} error - The error object
 * @returns {boolean} - Whether the error is retryable
 */
function isRetryable(category, error) {
  switch (category) {
    case ErrorCategories.NETWORK:
    case ErrorCategories.TIMEOUT:
      return true;

    case ErrorCategories.API:
      const status = error.response?.status || error.statusCode;
      // Retry on 5xx errors, 429 (rate limit), and 408 (timeout)
      return status >= 500 || status === 429 || status === 408;

    case ErrorCategories.FILE:
      const code = error.code?.toLowerCase() || '';
      // Don't retry on permission errors or not found
      return !code.includes('eperm') && !code.includes('eacces') && !code.includes('enoent');

    case ErrorCategories.DATABASE:
      // Database errors are usually not retryable at the application level
      return false;

    case ErrorCategories.VALIDATION:
      // Validation errors should never be retried
      return false;

    default:
      return false;
  }
}

/**
 * Calculate delay with exponential backoff
 * @param {number} attempt - The current attempt number (0-indexed)
 * @returns {number} - The delay in milliseconds
 */
function calculateBackoffDelay(attempt) {
  const delay = RetryConfig.baseDelay * Math.pow(RetryConfig.exponentialBase, attempt);
  // Add some jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay; // Up to 30% jitter
  return Math.min(delay + jitter, RetryConfig.maxDelay);
}

/**
 * Log error to file for debugging
 * @param {Error} error - The error to log
 * @param {string} category - The error category
 * @param {string} severity - The error severity
 * @param {object} context - Additional context information
 */
function logError(error, category, severity, context = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    category,
    severity,
    message: error.message,
    stack: error.stack,
    code: error.code,
    status: error.response?.status || error.statusCode,
    context
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    fs.appendFileSync(getLogFilePath(), logLine);
  } catch (logError) {
    console.error('Failed to write to error log:', logError);
  }

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${severity.toUpperCase()}] ${category}:`, error.message);
    if (Object.keys(context).length > 0) {
      console.error('Context:', context);
    }
  }
}

/**
 * Get user-friendly error message based on error category
 * @param {string} category - The error category
 * @param {Error} error - The error object
 * @returns {object} - Object containing title and message
 */
function getUserFriendlyMessage(category, error) {
  switch (category) {
    case ErrorCategories.NETWORK:
      return {
        title: 'Network Connection Error',
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
        recovery: 'Check your internet connection and ensure the server is accessible.'
      };

    case ErrorCategories.TIMEOUT:
      return {
        title: 'Request Timeout',
        message: 'The request took too long to complete. Please try again.',
        recovery: 'Try again with a slower internet connection or contact support if the issue persists.'
      };

    case ErrorCategories.API:
      const status = error.response?.status || error.statusCode;
      const errorMessage = error.message?.toLowerCase() || '';

      // HuggingFace specific errors
      if (errorMessage.includes('does not have sufficient permissions') ||
          errorMessage.includes('inference providers on behalf of')) {
        return {
          title: 'HuggingFace API Permissions Error',
          message: 'Your API key does not have permission to use the Inference API. This is likely because the token was created without "Inference" permissions.',
          recovery: '1. Go to https://huggingface.co/settings/tokens\n2. Create a new token\n3. Make sure to check "Inference" under "Token permissions"\n4. Copy the new token and update it in the app settings'
        };
      }

      if (errorMessage.includes('no inference provider available')) {
        return {
          title: 'Model Not Available',
          message: 'The selected model is not available on HuggingFace\'s free Inference API. Some models require a paid subscription or specific provider access.',
          recovery: 'Try using "SDXL" (stabilityai/stable-diffusion-xl-base-1.0) which works with the free tier. Alternatively, use a different provider like Replicate.'
        };
      }

      if (status === 401) {
        return {
          title: 'Authentication Error',
          message: 'Your API key appears to be invalid or expired.',
          recovery: 'Please check your API keys in settings and try again.'
        };
      } else if (status === 429) {
        return {
          title: 'Rate Limit Exceeded',
          message: 'Too many requests. Please wait a moment and try again.',
          recovery: 'Wait a few minutes before making another request.'
        };
      } else if (status === 500) {
        return {
          title: 'Server Error',
          message: 'The server encountered an error. Please try again.',
          recovery: 'The issue has been logged. Try again in a few minutes.'
        };
      } else {
        return {
          title: 'API Error',
          message: `An error occurred while communicating with the API (Status: ${status}).`,
          recovery: 'Please try again. If the problem persists, contact support.'
        };
      }

    case ErrorCategories.FILE:
      return {
        title: 'File Operation Error',
        message: `Unable to access file: ${error.message}`,
        recovery: 'Check file permissions and ensure the file exists.'
      };

    case ErrorCategories.DATABASE:
      return {
        title: 'Database Error',
        message: 'An error occurred while accessing the database.',
        recovery: 'Please restart the application. If the issue persists, contact support.'
      };

    case ErrorCategories.VALIDATION:
      return {
        title: 'Validation Error',
        message: error.message || 'The provided data is invalid.',
        recovery: 'Please check your input and try again.'
      };

    default:
      return {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred. Please try again.',
        recovery: 'If the problem persists, please contact support with the error details.'
      };
  }
}

/**
 * Execute a function with retry logic and exponential backoff
 * @param {Function} fn - The function to execute (should return a Promise)
 * @param {object} options - Configuration options
 * @returns {Promise} - The result of the function
 */
async function withRetry(fn, options = {}) {
  const {
    maxAttempts = RetryConfig.maxAttempts,
    context = {},
    onRetry = null
  } = options;

  let lastError;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const category = categorizeError(error);
      const severity = getErrorSeverity(category, error);

      // Log the error
      logError(error, category, severity, {
        ...context,
        attempt: attempt + 1,
        maxAttempts
      });

      // Check if we should retry
      if (attempt < maxAttempts - 1 && isRetryable(category, error)) {
        const delay = calculateBackoffDelay(attempt);

        if (onRetry) {
          onRetry(attempt + 1, maxAttempts, delay, error);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      } else {
        // Not retryable or out of attempts
        const userMessage = getUserFriendlyMessage(category, error);
        throw {
          ...error,
          category,
          severity,
          userMessage,
          isFinal: true
        };
      }
    }
  }

  // Should never reach here, but just in case
  throw lastError;
}

/**
 * Wrap a function with timeout functionality
 * @param {Function} fn - The function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operation - Description of the operation
 * @returns {Promise} - The result of the function
 */
async function withTimeout(fn, timeoutMs, operation = 'Operation') {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => {
        const error = new Error(`${operation} timed out after ${timeoutMs}ms`);
        error.code = 'TIMEOUT';
        reject(error);
      }, timeoutMs)
    )
  ]);
}

/**
 * Handle database operations with error handling
 * @param {Function} fn - Database function to execute
 * @param {string} operation - Description of the operation
 * @returns {Promise} - The result of the database operation
 */
async function handleDatabaseOperation(fn, operation = 'Database operation') {
  try {
    return await fn();
  } catch (error) {
    const category = categorizeError(error);
    const severity = getErrorSeverity(category, error);

    logError(error, category, severity, { operation });

    const userMessage = getUserFriendlyMessage(category, error);
    throw {
      ...error,
      category,
      severity,
      userMessage,
      isFinal: true
    };
  }
}

/**
 * Handle file operations with error handling
 * @param {Function} fn - File function to execute
 * @param {string} operation - Description of the operation
 * @returns {Promise} - The result of the file operation
 */
async function handleFileOperation(fn, operation = 'File operation') {
  try {
    return await fn();
  } catch (error) {
    const category = categorizeError(error);
    const severity = getErrorSeverity(category, error);

    logError(error, category, severity, { operation });

    const userMessage = getUserFriendlyMessage(category, error);
    throw {
      ...error,
      category,
      severity,
      userMessage,
      isFinal: true
    };
  }
}

/**
 * Get recent error logs for debugging
 * @param {number} limit - Maximum number of log entries to return
 * @returns {Array} - Array of recent error log entries
 */
function getRecentErrorLogs(limit = 50) {
  try {
    const logPath = getLogFilePath();
    if (!fs.existsSync(logPath)) {
      return [];
    }

    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const recentLines = lines.slice(-limit);

    return recentLines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  } catch (error) {
    console.error('Failed to read error logs:', error);
    return [];
  }
}

/**
 * Clear error logs (useful for debugging or maintenance)
 */
function clearErrorLogs() {
  try {
    const logPath = getLogFilePath();
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
  } catch (error) {
    console.error('Failed to clear error logs:', error);
  }
}

module.exports = {
  ErrorCategories,
  ErrorSeverity,
  RetryConfig,
  categorizeError,
  getErrorSeverity,
  isRetryable,
  withRetry,
  withTimeout,
  handleDatabaseOperation,
  handleFileOperation,
  getUserFriendlyMessage,
  logError,
  getRecentErrorLogs,
  clearErrorLogs,
  calculateBackoffDelay
};