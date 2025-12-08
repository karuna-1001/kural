const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const rateLimit = require('express-rate-limit');
const coupletRoutes = require('./routes/couplets');
const translatorRoutes = require('./routes/translators');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour per IP
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false // Disable the `X-RateLimit-*` headers
});

// Middleware
app.use(cors());
app.use(express.json());

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// API Documentation
const swaggerDocument = require('./swagger.json');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/api/couplets', coupletRoutes);
app.use('/api/translators', translatorRoutes);

// 404 handler (must be after all routes)
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Rate limit: 100 requests per hour per IP`);
  });
}

module.exports = app;