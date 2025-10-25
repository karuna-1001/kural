const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const coupletRoutes = require('./routes/couplets');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Documentation
const swaggerDocument = require('./swagger.json');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/api/couplets', coupletRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;