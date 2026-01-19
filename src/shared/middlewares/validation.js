// ================================
// 3. VALIDATION MIDDLEWARE
// ================================

// src/middlewares/validation.js
const Joi = require('joi');

class ValidationMiddleware {

 /**
  * Save payment method validation
  */
 static validateSavePaymentMethod() {
   const schema = Joi.object({
     cardLast4: Joi.string().pattern(/^[0-9]{4}$/).required(),
     cardType: Joi.string().valid('Visa', 'Mastercard', 'Verve', 'American Express').required(),
     cardBrand: Joi.string().optional(),
     bankName: Joi.string().optional()
   });

   return this.validate(schema);
 }

 /**
  * Dispute response validation
  */
 static validateDisputeResponse() {
   const schema = Joi.object({
     disputeId: Joi.string().uuid().required(),
     action: Joi.string().valid('approve', 'escalate').required(),
     response: Joi.string().min(10).max(1000).required()
   });

   return this.validate(schema);
 }

 /**
  * Payment options validation
  */
 static validatePaymentOptions() {
   const schema = Joi.object({
     amount: Joi.number().positive().required(),
     currency: Joi.string().length(3).uppercase().required(),
     userId: Joi.string().uuid().required(),
     paymentMethodId: Joi.string().uuid().optional()
   });

   return this.validate(schema);
 }


  /**
   * Validate set wallet passcode request
   */
  static validateSetWalletPassword() {
    const schema = Joi.object({
      password: Joi.string()
        .length(4) // or .min(4).max(6) if you want flexible length
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
          'string.length': 'Passcode must be exactly 4 digits',
          'string.pattern.base': 'Passcode must contain only numbers',
          'any.required': 'Passcode is required'
        })
    });

    return this.validate(schema);
  }

  /**
   * Validate update wallet passcode request
   */
  static validateUpdateWalletPassword() {
    const schema = Joi.object({
      currentPassword: Joi.string()
        .required()
        .messages({
          'any.required': 'Current passcode is required'
        }),
      
      newPassword: Joi.string()
        .length(4) // or .min(4).max(6)
        .pattern(/^[0-9]+$/)
        .invalid(Joi.ref('currentPassword'))
        .required()
        .messages({
          'string.length': 'New passcode must be exactly 4 digits',
          'string.pattern.base': 'New passcode must contain only numbers',
          'any.invalid': 'New passcode must be different from current passcode',
          'any.required': 'New passcode is required'
        })
    });

    return this.validate(schema);
  }

  /**
   * Validate wallet password reset request
   */
  static validateResetWalletPassword() {
    const schema = Joi.object({
      token: Joi.string()
        .min(32)
        .max(64)
        .required()
        .messages({
          'string.min': 'Invalid reset token format',
          'string.max': 'Invalid reset token format',
          'any.required': 'Reset token is required'
        }),
      
      newPassword: Joi.string()
        .min(4)
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
          'string.min': 'New password must be at least 4 characters long',
          'string.pattern.base': 'New password must contain at least one letter and one number',
          'any.required': 'New password is required'
        })
    });

    return this.validate(schema);
  }

  /**
   * Validate OTP verification request
   */
  static validateOtpVerification() {
    const schema = Joi.object({
      otp: Joi.string()
        .length(6)
        .pattern(/^[0-9]{6}$/)
        .required()
        .messages({
          'string.length': 'OTP must be exactly 6 digits',
          'string.pattern.base': 'OTP must contain only numbers',
          'any.required': 'OTP is required'
        }),
      
      walletPassword: Joi.string()
        .min(4)
        .optional()
        .messages({
          'string.min': 'Wallet password must be at least 4 characters long'
        })
    });

    return this.validate(schema);
  }

  /**
   * Validate password verification request
   */
  static validatePasswordVerification() {
    const schema = Joi.object({
      password: Joi.string()
        .required()
        .messages({
          'any.required': 'Password is required'
        })
    });

    return this.validate(schema);
  }

 /**
  * Initiate payment validation
  */
 static validateInitiatePayment() {
   const schema = Joi.object({
     patientId: Joi.string().uuid().required(),
     doctorId: Joi.string().uuid().optional(),
     serviceType: Joi.string().valid(
       'appointment', 'subscription', 'lab_test', 'pharmacy', 
       'document_access', 'verification_fee', 'chat_premium', 'other'
     ).required(),
     serviceId: Joi.string().uuid().optional(),
     planType: Joi.string().valid('free', 'basic', 'medium', 'premium', 'one_time').optional(),
     billingCycle: Joi.string().valid('one_time', 'monthly', 'quarterly', 'yearly').default('one_time'),
     originalAmount: Joi.number().positive().required(),
     originalCurrency: Joi.string().length(3).uppercase().required(),
     paymentProvider: Joi.string().valid('flutterwave', 'paystack').required(),
     paymentMethodId: Joi.string().uuid().optional(),
     appointmentFee: Joi.number().min(0).default(0),
     serviceFee: Joi.number().min(0).default(0),
     vat: Joi.number().min(0).default(0),
     description: Joi.string().max(500).optional()
   });

   return this.validate(schema);
 }

 /**
  * Cancel appointment validation
  */
 static validateCancelAppointment() {
   const schema = Joi.object({
     reason: Joi.string().min(3).max(200).optional(),
     refundToOriginalMethod: Joi.boolean().optional()
   });
   return this.validate(schema);
 }

 /**
  * Reschedule appointment validation
  */
 static validateRescheduleAppointment() {
   const schema = Joi.object({
     newAppointmentDate: Joi.date().iso().required(),
     reason: Joi.string().min(3).max(200).optional()
   });
   return this.validate(schema);
 }

 /**
  * Process payment validation
  */
 static validateProcessPayment() {
   const schema = Joi.object({
     transactionId: Joi.string().uuid().required(),
     paymentProvider: Joi.string().valid('flutterwave', 'paystack').required(),
     paymentData: Joi.object({
       email: Joi.string().email().required(),
       phone: Joi.string().optional(),
       name: Joi.string().required(),
       card: Joi.object({
         number: Joi.string().creditCard().required(),
         cvv: Joi.string().length(3).required(),
         expiryMonth: Joi.string().length(2).required(),
         expiryYear: Joi.string().length(4).required(),
         pin: Joi.string().length(4).optional()
       }).optional()
     }).required()
   });

   return this.validate(schema);
 }

 /**
  * Wallet withdrawal validation
  */
 static validateWalletWithdrawal() {
   const schema = Joi.object({
     amountUsd: Joi.number().positive().min(10).required(),
     requestedCurrency: Joi.string().length(3).uppercase().required(),
     bankDetails: Joi.object({
       bankCode: Joi.string().required(),
       accountNumber: Joi.string().required(),
       accountName: Joi.string().required(),
       bankName: Joi.string().required()
     }).required()
   });

   return this.validate(schema);
 }

 /**
  * Dispute creation validation
  */
 static validateCreateDispute() {
   const schema = Joi.object({
     transactionId: Joi.string().uuid().required(),
     patientId: Joi.string().uuid().required(),
     reason: Joi.string().valid(
       'service_not_provided', 'poor_quality', 'billing_error', 'unauthorized_charge', 'other'
     ).required(),
     description: Joi.string().min(10).max(1000).required()
   });

   return this.validate(schema);
 }

 /**
  * Toggle auto-charging validation
  */
 static validateToggleAutoCharging() {
   const schema = Joi.object({
     canAutoCharge: Joi.boolean().required()
   });

   return this.validate(schema);
 }

 /**
  * Enable auto-billing validation
  */
 static validateEnableAutoBilling() {
   const schema = Joi.object({
     paymentMethodId: Joi.string().uuid().required()
   });

   return this.validate(schema);
 }

 /**
  * Subscription upgrade validation
  */
 static validateUpgradeSubscription() {
   const schema = Joi.object({
     newTier: Joi.string().valid(
       'free', 'basic', 'standard', 'medium', 'premium', 'professional', 'gold_elite'
     ).required(),
     planType: Joi.string().valid('doctor', 'patient').optional()
   });

   return this.validate(schema);
 }

 /**
  * Cancel subscription validation
  */
 static validateCancelSubscription() {
   const schema = Joi.object({
     reason: Joi.string().min(3).max(200).optional()
   });

   return this.validate(schema);
 }

 /**
  * Enhanced appointment date validation
  */
 static validateAppointmentDate() {
   const schema = Joi.object({
     appointmentDate: Joi.date().iso().min('now').required()
   });

   return this.validate(schema);
 }

 /**
  * Payment webhook validation
  */
 static validateWebhookProvider() {
   const schema = Joi.object({
     provider: Joi.string().valid('flutterwave', 'paystack').required()
   });

   return (req, res, next) => {
     const { error, value } = schema.validate(req.params, {
       abortEarly: false,
       stripUnknown: true
     });

     if (error) {
       return res.status(400).json({
         success: false,
         message: 'Invalid payment provider'
       });
     }

     req.validatedParams = value;
     next();
   };
 }

 /**
  * UUID parameter validation
  */
 static validateUuidParam(paramName = 'id') {
   const schema = Joi.object({
     [paramName]: Joi.string().uuid().required()
   });

   return (req, res, next) => {
     const { error, value } = schema.validate(req.params, {
       abortEarly: false,
       stripUnknown: true
     });

     if (error) {
       return res.status(400).json({
         success: false,
         message: `Invalid ${paramName} format`
       });
     }

     req.validatedParams = value;
     next();
   };
 }

 /**
  * Query parameters validation for pagination
  */
 static validatePaginationQuery() {
   const schema = Joi.object({
     page: Joi.number().integer().min(1).default(1),
     limit: Joi.number().integer().min(1).max(100).default(20),
     serviceType: Joi.string().valid(
       'appointment', 'subscription', 'lab_test', 'pharmacy', 
       'document_access', 'verification_fee', 'chat_premium', 'other'
     ).optional(),
     status: Joi.string().valid(
       'pending', 'processing', 'completed', 'failed', 'disputed', 'refunded', 'cancelled'
     ).optional()
   });

   return (req, res, next) => {
     const { error, value } = schema.validate(req.query, {
       abortEarly: false,
       stripUnknown: true
     });

     if (error) {
       const errorDetails = error.details.map(detail => ({
         field: detail.path.join('.'),
         message: detail.message,
         value: detail.context.value
       }));

       return res.status(400).json({
         success: false,
         message: 'Invalid query parameters',
         errors: errorDetails
       });
     }

     req.validatedQuery = value;
     next();
   };
 }

 /**
  * Currency validation
  */
 static validateCurrency() {
   const schema = Joi.object({
     currency: Joi.string().length(3).uppercase().valid('USD', 'NGN', 'GHS', 'KES', 'ZAR').default('USD')
   });

   return (req, res, next) => {
     const { error, value } = schema.validate(req.query, {
       abortEarly: false,
       stripUnknown: true
     });

     if (error) {
       return res.status(400).json({
         success: false,
         message: 'Invalid currency code'
       });
     }

     req.validatedQuery = { ...req.query, ...value };
     next();
   };
 }

 /**
  * Enhanced initiate payment validation with appointment date
  */
 static validateInitiatePaymentEnhanced() {
   const schema = Joi.object({
     patientId: Joi.string().uuid().required(),
     doctorId: Joi.string().uuid().optional(),
     serviceType: Joi.string().valid(
       'appointment', 'subscription', 'lab_test', 'pharmacy', 
       'document_access', 'verification_fee', 'chat_premium', 'other'
     ).required(),
     serviceId: Joi.string().uuid().optional(),
     // Conditional appointment date validation
     appointmentDate: Joi.when('serviceType', {
       is: 'appointment',
       then: Joi.date().iso().min('now').required(),
       otherwise: Joi.date().iso().optional()
     }),
     planType: Joi.string().valid('free', 'basic', 'medium', 'premium', 'one_time').optional(),
     billingCycle: Joi.string().valid('one_time', 'monthly', 'quarterly', 'yearly').default('one_time'),
     originalAmount: Joi.number().positive().required(),
     originalCurrency: Joi.string().length(3).uppercase().required(),
     paymentProvider: Joi.string().valid('flutterwave', 'paystack').required(),
     paymentMethodId: Joi.string().uuid().optional(),
     appointmentFee: Joi.number().min(0).default(0),
     serviceFee: Joi.number().min(0).default(0),
     vat: Joi.number().min(0).default(0),
     description: Joi.string().max(500).optional()
   });

   return this.validate(schema);
 }

 /**
  * Auto-billing payment data validation
  */
 static validateAutoBillingPayment() {
   const schema = Joi.object({
     transactionId: Joi.string().uuid().required(),
     paymentProvider: Joi.string().valid('flutterwave', 'paystack').required(),
     paymentData: Joi.object({
       isTokenPayment: Joi.boolean().default(true),
       email: Joi.string().email().required(),
       paymentMethodId: Joi.string().uuid().required(),
       flutterwaveToken: Joi.string().optional(),
       paystackToken: Joi.string().optional()
     }).required()
   });

   return this.validate(schema);
 }

  // Add these methods to your existing ValidationMiddleware class
  // src/middlewares/validation.js

  // Add these methods to the ValidationMiddleware class

  /**
   * Initialize tokenization validation
   */
  static validateInitializeTokenization() {
    const schema = Joi.object({
      provider: Joi.string().valid('flutterwave', 'paystack').required(),
      currency: Joi.string().length(3).uppercase().valid('NGN', 'GHS', 'USD', 'EUR', 'GBP').required()
    });

    return this.validate(schema);
  }

  /**
   * Tokenization callback validation
   */
  static validateTokenizationCallback() {
    const schema = Joi.object({
      provider: Joi.string().valid('flutterwave', 'paystack').required(),
      reference: Joi.string().min(5).max(100).required(),
      userId: Joi.string().uuid().required()
    });

    return this.validate(schema);
  }

  /**
   * Refresh tokens validation
   */
  static validateRefreshTokens() {
    const schema = Joi.object({
      provider: Joi.string().valid('flutterwave', 'paystack').required()
    });

    return this.validate(schema);
  }

  /**
   * Enhanced process payment validation (supports auto-billing)
   */
  static validateProcessPaymentEnhanced() {
    const schema = Joi.object({
      transactionId: Joi.string().uuid().required(),
      paymentProvider: Joi.string().valid('flutterwave', 'paystack').required(),
      useStoredMethod: Joi.boolean().default(false),
      paymentData: Joi.when('useStoredMethod', {
        is: false,
        then: Joi.object({
          email: Joi.string().email().required(),
          phone: Joi.string().optional(),
          name: Joi.string().required(),
          title: Joi.string().optional()
        }).required(),
        otherwise: Joi.object({
          email: Joi.string().email().required(),
          paymentMethodId: Joi.string().uuid().required()
        }).required()
      })
    });

    return this.validate(schema);
  }

  /**
   * Get payment options validation
   */
  static validateGetPaymentOptions() {
    const schema = Joi.object({
      amount: Joi.number().positive().required(),
      currency: Joi.string().length(3).uppercase().valid('NGN', 'GHS', 'USD', 'EUR', 'GBP').required(),
      paymentMethodId: Joi.string().uuid().optional()
    });

    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context.value
        }));

        return res.status(400).json({
          success: false,
          message: 'Invalid payment options request',
          errors: errorDetails
        });
      }

      // Attach validated data to request
      req.validatedQuery = value;
      next();
    };
  }

  /**
   * Service type validation for all payment services
   */
  static validateServiceType() {
    const schema = Joi.object({
      serviceType: Joi.string().valid(
        'appointment', 'subscription', 'consultation', 'medication', 'lab_test', 
        'document_access', 'verification_fee', 'chat_premium', 'telemedicine'
      ).required()
    });

    return this.validate(schema);
  }

  /**
   * Enhanced initiate payment validation with dynamic currency support
   */
  static validateInitiatePaymentWithCurrency() {
    const schema = Joi.object({
      patientId: Joi.string().uuid().required(),
      doctorId: Joi.string().uuid().optional(),
      serviceType: Joi.string().valid(
        'appointment', 'subscription', 'consultation', 'medication', 'lab_test',
        'document_access', 'verification_fee', 'chat_premium', 'telemedicine'
      ).required(),
      serviceId: Joi.string().uuid().optional(),
      appointmentDate: Joi.when('serviceType', {
        is: 'appointment',
        then: Joi.date().iso().min('now').required(),
        otherwise: Joi.date().iso().optional()
      }),
      planType: Joi.string().valid('free', 'basic', 'standard', 'premium', 'professional', 'one_time').optional(),
      billingCycle: Joi.string().valid('one_time', 'weekly', 'monthly', 'quarterly', 'yearly').default('one_time'),
      originalAmount: Joi.number().positive().required(),
      originalCurrency: Joi.string().length(3).uppercase().valid('NGN', 'GHS', 'USD', 'EUR', 'GBP').required(),
      paymentProvider: Joi.string().valid('flutterwave', 'paystack').required(),
      paymentMethodId: Joi.string().uuid().optional(),
      appointmentFee: Joi.number().min(0).default(0),
      serviceFee: Joi.number().min(0).default(0),
      vat: Joi.number().min(0).default(0),
      discount: Joi.number().min(0).default(0),
      description: Joi.string().max(500).optional(),
      metadata: Joi.object().optional()
    });

    return this.validate(schema);
  }

  /**
   * Auto-billing subscription validation
   */
  static validateAutoBillingSubscription() {
    const schema = Joi.object({
      subscriptionId: Joi.string().uuid().required(),
      paymentMethodId: Joi.string().uuid().required(),
      amount: Joi.number().positive().required(),
      currency: Joi.string().length(3).uppercase().required(),
      billingCycle: Joi.string().valid('monthly', 'quarterly', 'yearly').required(),
      nextBillingDate: Joi.date().iso().min('now').required()
    });

    return this.validate(schema);
  }

  /**
   * Multi-service payment validation
   */
  static validateMultiServicePayment() {
    const schema = Joi.object({
      services: Joi.array().items(
        Joi.object({
          serviceType: Joi.string().valid(
            'appointment', 'subscription', 'consultation', 'medication', 'lab_test'
          ).required(),
          serviceId: Joi.string().uuid().required(),
          amount: Joi.number().positive().required(),
          doctorId: Joi.string().uuid().optional(),
          appointmentDate: Joi.date().iso().optional()
        })
      ).min(1).max(10).required(),
      totalAmount: Joi.number().positive().required(),
      currency: Joi.string().length(3).uppercase().required(),
      paymentProvider: Joi.string().valid('flutterwave', 'paystack').required(),
      paymentMethodId: Joi.string().uuid().optional()
    });

    return this.validate(schema);
  }

  /**
   * Payment method performance validation
   */
  static validatePaymentMethodPerformance() {
    const schema = Joi.object({
      paymentMethodId: Joi.string().uuid().required(),
      provider: Joi.string().valid('flutterwave', 'paystack').required(),
      success: Joi.boolean().required(),
      responseTime: Joi.number().positive().optional(),
      errorCode: Joi.string().optional(),
      errorMessage: Joi.string().optional()
    });

    return this.validate(schema);
  }

  /**
   * Currency exchange validation
   */
  static validateCurrencyExchange() {
    const schema = Joi.object({
      fromCurrency: Joi.string().length(3).uppercase().valid('NGN', 'GHS', 'USD', 'EUR', 'GBP').required(),
      toCurrency: Joi.string().length(3).uppercase().valid('NGN', 'GHS', 'USD', 'EUR', 'GBP').required(),
      amount: Joi.number().positive().required()
    });

    return this.validate(schema);
  }

  /**
   * Webhook validation for payment providers
   */
  static validateWebhookSignature() {
    const schema = Joi.object({
      provider: Joi.string().valid('flutterwave', 'paystack').required(),
      signature: Joi.string().required(),
      timestamp: Joi.date().optional()
    });

    return (req, res, next) => {
      const { error, value } = schema.validate({
        provider: req.params.provider,
        signature: req.headers['x-webhook-signature'] || req.headers['x-paystack-signature'],
        timestamp: req.headers['x-webhook-timestamp']
      }, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }

      req.webhookValidation = value;
      next();
    };
  }

  /**
   * Batch payment validation
   */
  static validateBatchPayment() {
    const schema = Joi.object({
      payments: Joi.array().items(
        Joi.object({
          recipientId: Joi.string().uuid().required(),
          amount: Joi.number().positive().required(),
          currency: Joi.string().length(3).uppercase().required(),
          description: Joi.string().max(200).optional(),
          reference: Joi.string().max(100).optional()
        })
      ).min(1).max(100).required(),
      paymentProvider: Joi.string().valid('flutterwave', 'paystack').required(),
      totalAmount: Joi.number().positive().required(),
      batchReference: Joi.string().max(100).optional()
    });

    return this.validate(schema);
  }

  /**
   * Payment analytics query validation
   */
  static validatePaymentAnalyticsQuery() {
    const schema = Joi.object({
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
      serviceType: Joi.string().valid(
        'appointment', 'subscription', 'consultation', 'medication', 'lab_test'
      ).optional(),
      currency: Joi.string().length(3).uppercase().optional(),
      provider: Joi.string().valid('flutterwave', 'paystack').optional(),
      groupBy: Joi.string().valid('day', 'week', 'month', 'service', 'provider').default('day')
    });

    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context.value
        }));

        return res.status(400).json({
          success: false,
          message: 'Invalid analytics query parameters',
          errors: errorDetails
        });
      }

      req.validatedQuery = value;
      next();
    };
  }

  /**
   * Payment method token validation
   */
  static validatePaymentMethodToken() {
    const schema = Joi.object({
      token: Joi.string().required(),
      provider: Joi.string().valid('flutterwave', 'paystack').required(),
      expiryDate: Joi.date().iso().min('now').required(),
      cardLast4: Joi.string().pattern(/^[0-9]{4}$/).required(),
      cardBrand: Joi.string().valid('visa', 'mastercard', 'amex', 'discover', 'verve').required()
    });

    return this.validate(schema);
  }

  /**
   * Enhanced transaction search validation
   */
  static validateTransactionSearch() {
    const schema = Joi.object({
      q: Joi.string().min(1).max(100).optional(),
      transactionId: Joi.string().uuid().optional(),
      reference: Joi.string().max(100).optional(),
      serviceType: Joi.string().valid(
        'appointment', 'subscription', 'consultation', 'medication', 'lab_test'
      ).optional(),
      status: Joi.string().valid(
        'pending', 'processing', 'completed', 'failed', 'disputed', 'refunded', 'cancelled'
      ).optional(),
      currency: Joi.string().length(3).uppercase().optional(),
      provider: Joi.string().valid('flutterwave', 'paystack').optional(),
      minAmount: Joi.number().positive().optional(),
      maxAmount: Joi.number().positive().min(Joi.ref('minAmount')).optional(),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sortBy: Joi.string().valid('createdAt', 'amount', 'status').default('createdAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    });

    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context.value
        }));

        return res.status(400).json({
          success: false,
          message: 'Invalid transaction search parameters',
          errors: errorDetails
        });
      }

      req.validatedQuery = value;
      next();
    };
  }

  /**
   * Payment retry validation
   */
  static validatePaymentRetry() {
    const schema = Joi.object({
      transactionId: Joi.string().uuid().required(),
      paymentProvider: Joi.string().valid('flutterwave', 'paystack').optional(),
      paymentMethodId: Joi.string().uuid().optional(),
      retryReason: Joi.string().max(200).optional()
    });

    return this.validate(schema);
  }

  /**
   * Payment schedule validation
   */
  static validatePaymentSchedule() {
    const schema = Joi.object({
      serviceType: Joi.string().valid('subscription', 'appointment').required(),
      serviceId: Joi.string().uuid().required(),
      amount: Joi.number().positive().required(),
      currency: Joi.string().length(3).uppercase().required(),
      paymentMethodId: Joi.string().uuid().required(),
      scheduleDate: Joi.date().iso().min('now').required(),
      description: Joi.string().max(500).optional(),
      metadata: Joi.object().optional()
    });

    return this.validate(schema);
  }

  /**
   * Validate and save payment method validation
   */
  static validateAndSavePaymentMethod() {
    const schema = Joi.object({
      cardDetails: Joi.object({
        number: Joi.string().creditCard().required(),
        cvv: Joi.string().pattern(/^[0-9]{3,4}$/).required(),
        expiryMonth: Joi.string().pattern(/^(0[1-9]|1[0-2])$/).required(),
        expiryYear: Joi.string().pattern(/^20[2-9][0-9]$/).required(),
        holderName: Joi.string().min(2).max(50).optional(),
        email: Joi.string().email().optional() // Will be added from req.user.email
      }).required(),
      provider: Joi.string().valid('flutterwave', 'paystack').required(),
      currency: Joi.string().length(3).uppercase().valid('NGN', 'GHS', 'USD', 'EUR', 'GBP').required()
    });

    return this.validate(schema);
  }

  /**
   * Search query validation
   */
  static validateSearchQuery() {
    const schema = Joi.object({
      q: Joi.string().min(2).max(100).required(),
      // 🔧 FIX: Change to singular values to match your search service
      category: Joi.string().valid('user', 'appointment', 'transaction', 'subscription').optional(),
      limit: Joi.number().integer().min(1).max(50).default(10),
      offset: Joi.number().integer().min(0).default(0)
    });

    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context.value
        }));

        return res.status(400).json({
          success: false,
          message: 'Invalid search parameters',
          errors: errorDetails
        });
      }

      req.validatedQuery = value;
      next();
    };
  }

  /**
   * Search suggestions validation
   */
  static validateSearchSuggestions() {
    const schema = Joi.object({
      q: Joi.string().min(1).max(50).required()
    });

    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid suggestion query'
        });
      }

      req.validatedQuery = value;
      next();
    };
  }

 /**
  * Generic validation middleware
  */
 static validate(schema) {
   return (req, res, next) => {
     const { error, value } = schema.validate(req.body, {
       abortEarly: false,
       stripUnknown: true
     });

     if (error) {
       const errorDetails = error.details.map(detail => ({
         field: detail.path.join('.'),
         message: detail.message,
         value: detail.context.value
       }));

       return res.status(400).json({
         success: false,
         message: 'Validation failed',
         errors: errorDetails
       });
     }

     req.validatedData = value;
     next();
   };
 }
}

module.exports = ValidationMiddleware;