const Joi = require('joi');

const joinWaitlistSchema = Joi.object({
    fullName: Joi.string().required().min(2).max(255),
    email: Joi.string().email().required().max(255),
    facilityName: Joi.string().required().min(2).max(255),
    role: Joi.string().valid('lab', 'pharmarcy').required(),
    phone: Joi.string().optional().allow('', null).min(7).max(20),
    facilityType: Joi.string().optional().allow('', null).max(100),
    city: Joi.string().optional().allow('', null).max(100),
    state: Joi.string().optional().allow('', null).max(100)
});

const validateLabWaitlistJoin = (req, res, next) => {
    const { error } = joinWaitlistSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const errorMessages = error.details.map((detail) => detail.message).join(', ');
        return res.status(400).json({
            success: false,
            error: errorMessages
        });
    }
    next();
};

module.exports = { validateLabWaitlistJoin };
