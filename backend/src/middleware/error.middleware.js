/**
 * Global error handler — catches thrown errors and returns consistent JSON responses.
 */
export function errorHandler(err, _req, res, _next) {
  console.error('[Error]', err.message);

  // Passport / OAuth errors
  if (err.name === 'AuthenticationError') {
    return res.status(401).json({ error: 'Authentication failed' });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}
