const { query, param, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Couplet number validator
const validateCoupletNumber = [
  param('number')
    .isInt({ min: 1, max: 1330 })
    .withMessage('Couplet number must be between 1 and 1330'),
  handleValidationErrors
];

// Pagination validators
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  handleValidationErrors
];

// Chapter/Section/Division validators
const validateFilters = [
  query('chapter')
    .optional()
    .isInt({ min: 1, max: 133 })
    .withMessage('Chapter must be between 1 and 133')
    .toInt(),
  query('section')
    .optional()
    .isInt({ min: 1, max: 9 })
    .withMessage('Section must be between 1 and 9')
    .toInt(),
  query('division')
    .optional()
    .isInt({ min: 1, max: 3 })
    .withMessage('Division must be between 1 and 3')
    .toInt(),
  handleValidationErrors
];

// Translator validator
const validateTranslators = [
  query('translators')
    .optional()
    .isString()
    .customSanitizer(value => {
      // Split by comma, trim, remove empty strings
      return value.split(',').map(t => t.trim()).filter(t => t.length > 0);
    })
    .custom((value) => {
      // Check if it's an array after sanitization
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('Translators must be a comma-separated list');
      }
      // Validate each translator ID (alphanumeric + underscore)
      const validPattern = /^[a-z0-9_]+$/;
      if (!value.every(t => validPattern.test(t))) {
        throw new Error('Invalid translator ID format. Use lowercase alphanumeric characters only');
      }
      return true;
    }),
  handleValidationErrors
];

// Search query validator
const validateSearch = [
  query('q')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  handleValidationErrors
];

// Language validator
const validateLanguage = [
  query('lang')
    .optional()
    .isIn(['en', 'hi', 'ta'])
    .withMessage('Language must be one of: en, hi, ta'),
  handleValidationErrors
];

module.exports = {
  validateCoupletNumber,
  validatePagination,
  validateFilters,
  validateTranslators,
  validateSearch,
  validateLanguage,
  handleValidationErrors
};
