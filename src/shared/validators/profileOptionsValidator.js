const Joi = require('joi');

const profileOptionOperationSchema = Joi.object({
  action: Joi.string().valid('add', 'update', 'delete').required().messages({
    'any.only': 'action must be one of add, update, or delete',
    'any.required': 'action is required',
  }),
  id: Joi.string().uuid().when('action', {
    is: Joi.valid('update', 'delete'),
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }).messages({
    'any.required': 'id is required for update or delete actions',
    'any.unknown': 'id is not allowed for add action',
    'string.uuid': 'id must be a valid UUID',
  }),
  profileType: Joi.string().valid('patient', 'doctor').insensitive().when('action', {
    is: 'add',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }).messages({
    'any.only': 'profileType must be patient or doctor (case-insensitive)',
    'any.required': 'profileType is required for add action',
  }),
  field: Joi.string().max(50).when('action', {
    is: 'add',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }).messages({
    'string.max': 'field must not exceed 50 characters',
    'any.required': 'field is required for add action',
  }),
  value: Joi.string().max(50).when('action', {
    is: 'add',
    then: Joi.required(),
    otherwise: Joi.when('action', {
      is: 'update',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  }).messages({
    'string.max': 'value must not exceed 50 characters',
    'any.required': 'value is required for add or update actions',
    'any.unknown': 'value is not allowed for delete action',
  }),
});

const manageProfileOptionsSchema = Joi.object({
  operations: Joi.array().items(profileOptionOperationSchema).min(1).required().messages({
    'array.min': 'At least one operation is required',
    'any.required': 'operations array is required',
  }),
});

const validateManageProfileOptions = (req, res, next) => {
  const { error } = manageProfileOptionsSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    return res.status(400).json({ errors });
  }
  next();
};

module.exports = { validateManageProfileOptions };