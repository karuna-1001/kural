// 404 handler - for routes that don't exist
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Resource not found',
    path: req.originalUrl,
    method: req.method
  });
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Database errors
  if (err.name === 'MongoError' || err.name === 'NedbError') {
    status = 500;
    message = 'Database error';
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation error';
  }

  // Express validator errors
  if (err.array && typeof err.array === 'function') {
    status = 400;
    message = 'Validation failed';
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details || err.message
    })
  });
};

module.exports = { notFound, errorHandler };
