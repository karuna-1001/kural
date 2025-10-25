const Joi = require('joi');

const coupletSchema = Joi.object({
  number: Joi.number().integer().min(1).max(1330).required(),
  division_number: Joi.number().integer().min(1).max(3).required(),
  section_number: Joi.number().integer().min(1).max(133).required(),
  chapter_number: Joi.number().integer().min(1).max(133).required(),
  
  tamil: Joi.array().items(Joi.string().required()).length(2).required(),
  tamil_explanation: Joi.string().required(),

  division: Joi.object({
    name: Joi.string().required(),
    translation: Joi.string().required(),
    transliteration: Joi.string().required()
  }).required(),

  section: Joi.object({
    name: Joi.string().required(),
    translation: Joi.string().required(),
    transliteration: Joi.string().required()
  }).required(),

  chapter: Joi.object({
    name: Joi.string().required(),
    translation: Joi.string().required(),
    transliteration: Joi.string().required()
  }).required(),

  translations: Joi.object({
    en: Joi.array().items(
      Joi.object({
        text: Joi.string().required(),
        explanation: Joi.string(),
        author: Joi.string().required(),
        year: Joi.number().integer().min(1800).max(2100)
      })
    ),
    hi: Joi.array().items(
      Joi.object({
        text: Joi.string().required(),
        explanation: Joi.string(),
        author: Joi.string().required(),
        year: Joi.number().integer().min(1800).max(2100)
      })
    )
  }).required(),

  tamil_interpretations: Joi.array().items(
    Joi.object({
      text: Joi.string().required(),
      author: Joi.string().required(),
      year: Joi.number().integer().min(1200).max(2100)
    })
  ).required(),

  keywords: Joi.array().items(Joi.string()).min(1).required(),

  metadata: Joi.object({
    last_updated: Joi.string().isoDate().required(),
    contributors: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        github: Joi.string()
      })
    )
  }).required()
});

module.exports = coupletSchema;