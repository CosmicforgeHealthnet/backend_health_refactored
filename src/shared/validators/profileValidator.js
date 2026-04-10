const Joi = require('joi');

// Base schemas for common fields
const commonProfileSchema = {
  // fullName: Joi.string().trim().min(2).max(100).required().messages({
  //   'string.base': 'fullName must be a string',
  //   'string.empty': 'fullName is required',
  //   'string.min': 'fullName must be at least 2 characters',
  //   'string.max': 'fullName must not exceed 100 characters',
  // }),
  // email: Joi.string().email().required().messages({
  //   'string.email': 'email must be a valid email address',
  //   'string.empty': 'email is required',
  // }),
  gender: Joi.string().valid('male', 'female', 'other').insensitive().messages({
    'any.only': 'gender must be one of male, female, or other (case-insensitive)',
  }),
  dateOfBirth: Joi.date().iso().optional().messages({
    'date.base': 'dateOfBirth must be a valid date (YYYY-MM-DD)',
  }),
  nationality: Joi.string().trim().max(100).optional().messages({
    'string.max': 'nationality must not exceed 100 characters',
  }),
};

// Patient profile specific schemas
const patientProfileSchema = Joi.object({
  ...commonProfileSchema,
  genotype: Joi.string().trim().max(10).optional().messages({
    'string.max': 'genotype must not exceed 10 characters',
  }),
  bloodGroup: Joi.string().trim().max(10).optional().messages({
    'string.max': 'bloodGroup must not exceed 10 characters',
  }),
  language: Joi.string().trim().max(50).optional().messages({
    'string.max': 'language must not exceed 50 characters',
  }),
  mobileNumber: Joi.string().trim().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
    'string.pattern.base': 'mobileNumber must be a valid phone number (e.g., +2341234567890)',
  }),
  address: Joi.string().trim().max(500).optional().messages({
    'string.max': 'address must not exceed 500 characters',
  }),
  emergencyContactFullName: Joi.string().trim().max(100).optional().messages({
    'string.max': 'emergencyContactFullName must not exceed 100 characters',
  }),
  emergencyContactMobile: Joi.string().trim().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
    'string.pattern.base': 'emergencyContactMobile must be a valid phone number',
  }),
  emergencyContactRelationship: Joi.string().trim().max(50).optional().messages({
    'string.max': 'emergencyContactRelationship must not exceed 50 characters',
  }),
  height: Joi.number().positive().optional().messages({
    'number.positive': 'height must be a positive number',
  }),
  weight: Joi.number().positive().optional().messages({
    'number.positive': 'weight must be a positive number',
  }),
  bmi: Joi.number().positive().optional().messages({
    'number.positive': 'bmi must be a positive number',
  }),
  bloodPressure: Joi.string().trim().max(20).optional().messages({
    'string.max': 'bloodPressure must not exceed 20 characters',
  }),
  heartRate: Joi.number().integer().positive().optional().messages({
    'number.integer': 'heartRate must be an integer',
    'number.positive': 'heartRate must be a positive number',
  }),
  respiratoryRate: Joi.number().integer().positive().optional().messages({
    'number.integer': 'respiratoryRate must be an integer',
    'number.positive': 'respiratoryRate must be a positive number',
  }),
  temperature: Joi.number().positive().optional().messages({
    'number.positive': 'temperature must be a positive number',
  }),
  spO2: Joi.number().integer().positive().optional().messages({
    'number.integer': 'spO2 must be an integer',
    'number.positive': 'spO2 must be a positive number',
  }),
  bloodGlucose: Joi.number().positive().optional().messages({
    'number.positive': 'bloodGlucose must be a positive number',
  }),
  smokes: Joi.boolean().optional().messages({
    'boolean.base': 'smokes must be a boolean',
  }),
  drinksAlcohol: Joi.boolean().optional().messages({
    'boolean.base': 'drinksAlcohol must be a boolean',
  }),
  physicalActivityLevel: Joi.string().trim().max(50).optional().messages({
    'string.max': 'physicalActivityLevel must not exceed 50 characters',
  }),
  dietType: Joi.string().trim().max(50).optional().messages({
    'string.max': 'dietType must not exceed 50 characters',
  }),
  sleepDuration: Joi.number().positive().optional().messages({
    'number.positive': 'sleepDuration must be a positive number',
  }),
  profileType: Joi.string().valid('individual', 'family').insensitive().default('individual').optional().messages({
    'any.only': 'profileType must be one of individual or family (case-insensitive)',
  }),
  medicalConditions: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().max(100).required().messages({
        'string.empty': 'name is required for medicalConditions',
      }),
      year: Joi.number().integer().min(1900).optional().messages({
        'number.integer': 'year must be an integer',
        'number.min': 'year must be at least 1900',
      }),
      status: Joi.string().trim().max(50).optional().messages({
        'string.max': 'status must not exceed 50 characters',
      }),
    })
  ).optional(),
  surgeries: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().max(100).required().messages({
        'string.empty': 'name is required for surgeries',
      }),
      date: Joi.date().iso().allow('', null).optional().default(null).messages({
        'date.base': 'date must be a valid date (YYYY-MM-DD)',
      }).custom((value) => value === '' ? null : value),
      location: Joi.string().trim().allow('').optional().messages({
        'string.max': 'location must not exceed 100 characters',
      }),
    })
  ).optional(),
  allergies: Joi.array().items(
    Joi.object({
      type: Joi.string().trim().max(100).optional().messages({
        'string.max': 'type must not exceed 100 characters',
      }),
      allergen: Joi.string().trim().max(100).required().messages({
        'string.empty': 'allergen is required for allergies',
      }),
      description: Joi.string().trim().max(200).optional().messages({
        'string.max': 'description must not exceed 200 characters',
      }),
    })
  ).optional(),
  familyHistories: Joi.array().items(
    Joi.object({
      medicalCondition: Joi.string().trim().max(100).required().messages({
        'string.empty': 'medicalCondition is required for familyHistories',
      }),
      affectedRelative: Joi.string().trim().max(50).optional().messages({
        'string.max': 'affectedRelative must not exceed 50 characters',
      }),
    })
  ).optional(),
  medications: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().max(100).required().messages({
        'string.empty': 'name is required for medications',
      }),
      dose: Joi.string().trim().max(50).optional().messages({
        'string.max': 'dose must not exceed 50 characters',
      }),
      frequency: Joi.string().trim().max(50).optional().messages({
        'string.max': 'frequency must not exceed 50 characters',
      }),
    })
  ).optional(),
  immunizations: Joi.array().items(
    Joi.object({
      vaccine: Joi.string().trim().max(100).required().messages({
        'string.empty': 'vaccine is required for immunizations',
      }),

      certificateUrl: Joi.string().uri().allow('').optional().messages({
        'string.uri': 'certificateUrl must be a valid URL',
      }),
      date: Joi.date().iso().allow('', null).optional().default(null).messages({
        'date.base': 'date must be a valid date (YYYY-MM-DD)',
      }).custom((value) => value === '' ? null : value),
      dose: Joi.string().allow('').trim().max(50).optional().messages({
        'string.max': 'dose must not exceed 50 characters',
      }),
    })
  ).optional(),
  healthInsurance: Joi.object({
    providerName: Joi.string().trim().max(100).allow('').optional().messages({
      'string.empty': 'providerName is required for healthInsurance',
    }),
    validityDate: Joi.date().iso().allow('', null).optional().default(null).messages({
      'date.base': 'validityDate must be a valid date (YYYY-MM-DD)',
    }).custom((value) => value === '' ? null : value),
    policyNo: Joi.string().trim().max(50).allow('').optional().messages({
      'string.max': 'policyNo must not exceed 50 characters',
    }),
    healthCardUrl: Joi.string().uri().optional().allow('').messages({
      'string.uri': 'healthCardUrl must be a valid URL',
    }),
  }).optional(),
  disability: Joi.object({
    hasDisability: Joi.boolean().required().messages({
      'boolean.base': 'hasDisability must be a boolean',
      'any.required': 'hasDisability is required',
    }),
  }).optional(),
  consent: Joi.object({
    telemedicine: Joi.boolean().required().messages({
      'boolean.base': 'telemedicine must be a boolean',
      'any.required': 'telemedicine is required',
    }),
    dataCollection: Joi.boolean().required().messages({
      'boolean.base': 'dataCollection must be a boolean',
      'any.required': 'dataCollection is required',
    }),
    recordSharing: Joi.boolean().required().messages({
      'boolean.base': 'recordSharing must be a boolean',
      'any.required': 'recordSharing is required',
    }),
    emergencyContact: Joi.boolean().required().messages({
      'boolean.base': 'emergencyContact must be a boolean',
      'any.required': 'emergencyContact is required',
    }),
    preferredCommunication: Joi.string().trim().max(50).required().messages({
      'string.empty': 'preferredCommunication is required',
      'string.max': 'preferredCommunication must not exceed 50 characters',
    }),
    languagePreference: Joi.string().trim().max(50).required().messages({
      'string.empty': 'languagePreference is required',
      'string.max': 'languagePreference must not exceed 50 characters',
    }),
    healthTips: Joi.boolean().required().messages({
      'boolean.base': 'healthTips must be a boolean',
      'any.required': 'healthTips is required',
    }),
    familyAccess: Joi.boolean().required().messages({
      'boolean.base': 'familyAccess must be a boolean',
      'any.required': 'familyAccess is required',
    }),
    notificationsAppointments: Joi.boolean().required().messages({
      'boolean.base': 'notificationsAppointments must be a boolean',
      'any.required': 'notificationsAppointments is required',
    }),
    notificationsPrescriptions: Joi.boolean().required().messages({
      'boolean.base': 'notificationsPrescriptions must be a boolean',
      'any.required': 'notificationsPrescriptions is required',
    }),
    notificationsTestResults: Joi.boolean().required().messages({
      'boolean.base': 'notificationsTestResults must be a boolean',
      'any.required': 'notificationsTestResults is required',
    }),
    notificationsPromotions: Joi.boolean().required().messages({
      'boolean.base': 'notificationsPromotions must be a boolean',
      'any.required': 'notificationsPromotions is required',
    }),
    signature: Joi.string().trim().max(100).required().messages({
      'string.empty': 'signature is required',
      'string.max': 'signature must not exceed 100 characters',
    }),
  }).optional(),
})

  // .fork([ 'createdAt', 'updatedAt'], (field) => field.forbidden().messages({
  //   'any.unknown': `${field.id} is not allowed`,
  // }))
  ;

// Doctor profile specific schemas
const professionalLicenseSchema = Joi.object({
  medicalLicenseNumber: Joi.string().trim().max(50).optional().messages({
    'string.empty': 'medicalLicenseNumber is required',
    'string.max': 'medicalLicenseNumber must not exceed 50 characters',
  }),
  countryOfLicense: Joi.string().trim().max(100).optional().messages({
    'string.empty': 'countryOfLicense is required',
    'string.max': 'countryOfLicense must not exceed 100 characters',
  }),
  licenseAuthority: Joi.string().trim().max(100).optional().messages({
    'string.empty': 'licenseAuthority is required',
    'string.max': 'licenseAuthority must not exceed 100 characters',
  }),
  licenseExpiryDate: Joi.date().iso().optional().messages({
    'date.base': 'licenseExpiryDate must be a valid date (YYYY-MM-DD)',
    'any.required': 'licenseExpiryDate is required',
  }),
  licenseDocument: Joi.string().uri().optional().messages({
    'string.uri': 'licenseDocument must be a valid URL',
  }),
  yearsOfExperience: Joi.number().integer().positive().optional().messages({
    'number.integer': 'yearsOfExperience must be an integer',
    'number.positive': 'yearsOfExperience must be a positive number',
  }),
  areasOfSpecialization: Joi.array().items(
    Joi.string().trim().max(100).custom((value, helpers) => {
      return value.toLowerCase(); // Normalize to lowercase
    })
  ).optional().messages({
    'string.max': 'Each area of specialization must not exceed 100 characters',
  }),
  subspecialty: Joi.string().trim().max(100).optional().allow('', null).messages({
    'string.max': 'subspecialty must not exceed 100 characters',
  }),
  medicalInstitution: Joi.string().trim().max(100).optional().messages({
    'string.max': 'medicalInstitution must not exceed 100 characters',
  }),
});

const professionalCertificateSchema = Joi.object({
  institution: Joi.string().trim().max(100).required().messages({
    'string.empty': 'institution is required',
    'string.max': 'institution must not exceed 100 characters',
  }),
  degree: Joi.string().trim().max(50).required().messages({
    'string.empty': 'degree is required',
    'string.max': 'degree must not exceed 50 characters',
  }),
  fieldOfStudy: Joi.string().trim().max(100).required().messages({
    'string.empty': 'fieldOfStudy is required',
    'string.max': 'fieldOfStudy must not exceed 100 characters',
  }),
  startYear: Joi.number().integer().min(1900).required().messages({
    'number.integer': 'startYear must be an integer',
    'number.min': 'startYear must be at least 1900',
    'any.required': 'startYear is required',
  }),
  endYear: Joi.number().integer().min(1900).required().messages({
    'number.integer': 'endYear must be an integer',
    'number.min': 'endYear must be at least 1900',
    'any.required': 'endYear is required',
  }),
  certificateName: Joi.string().trim().max(100).required().messages({
    'string.empty': 'certificateName is required',
    'string.max': 'certificateName must not exceed 100 characters',
  }),
  issuingBody: Joi.string().trim().max(100).required().messages({
    'string.empty': 'issuingBody is required',
    'string.max': 'issuingBody must not exceed 100 characters',
  }),
  issueDate: Joi.date().iso().required().messages({
    'date.base': 'issueDate must be a valid date (YYYY-MM-DD)',
    'any.required': 'issueDate is required',
  }),
  expiryDate: Joi.date().iso().optional().messages({
    'date.base': 'expiryDate must be a valid date (YYYY-MM-DD)',
  }),
  certificateDocument: Joi.string().uri().optional().messages({
    'string.uri': 'certificateDocument must be a valid URL',
  }),
  // verificationLink: Joi.string().uri().optional().messages({
  //   'string.uri': 'verificationLink must be a valid URL',
  // }),
  verificationLink: Joi.alternatives()
    .try(
      Joi.string().uri().messages({
        'string.uri': 'verificationLink must be a valid URL',
      }),
      Joi.string().messages({
        'string.base': 'verificationLink must be text or a valid URL',
      })
    )
    .allow('', null) // top-level allow (extra safety)
    .optional()
});

const clinicalPracticeSchema = Joi.object({
  clinicName: Joi.string().trim().max(100).required().messages({
    'string.empty': 'clinicName is required',
    'string.max': 'clinicName must not exceed 100 characters',
  }),
  location: Joi.string().trim().max(500).required().messages({
    'string.empty': 'location is required',
    'string.max': 'location must not exceed 500 characters',
  }),
  daysAvailableFrom: Joi.string().optional()
    .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    .insensitive()
    .required()
    .messages({
      'any.only': 'daysAvailableFrom must be a valid day of the week (case-insensitive)',
      'any.required': 'daysAvailableFrom is required',
    }),
  daysAvailableTo: Joi.string().optional()
    .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    .insensitive()
    .required()
    .messages({
      'any.only': 'daysAvailableTo must be a valid day of the week (case-insensitive)',
      'any.required': 'daysAvailableTo is required',
    }),
  timeAvailableFrom: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required().optional().messages({
    'string.pattern.base': 'timeAvailableFrom must be in HH:MM:SS format',
    'any.required': 'timeAvailableFrom is required',
  }),
  timeAvailableTo: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required().optional().messages({
    'string.pattern.base': 'timeAvailableTo must be in HH:MM:SS format',
    'any.required': 'timeAvailableTo is required',
  }),
  consultationFee: Joi.number().positive().required().optional().messages({
    'number.positive': 'consultationFee must be a positive number',
    'any.required': 'consultationFee is required',
  }),
});

const digitalHealthToolsSchema = Joi.object({
  consentToUseAITools: Joi.boolean()
    .allow(null, '') // allows null or empty string
    .optional()      // makes it optional instead of required
    .messages({
      'boolean.base': 'consentToUseAITools must be a boolean',
    }),

  usageDescription: Joi.string()
    .trim()
    .max(500)
    .allow('', null) // allows empty string or null
    .optional()
    .messages({
      'string.max': 'usageDescription must not exceed 500 characters',
    }),

  useARVR: Joi.boolean()
    .allow(null, '') // allows null or empty string
    .optional()
    .messages({
      'boolean.base': 'useARVR must be a boolean',
    }),
});

const walletSchema = Joi.object({
  paymentMethod: Joi.string().valid('bank_transfer', 'mobile_money').insensitive().required().messages({
    'any.only': 'paymentMethod must be one of bank_transfer or mobile_money (case-insensitive)',
    'any.required': 'paymentMethod is required',
  }),
  bankName: Joi.string().trim().max(100).required().messages({
    'string.empty': 'bankName is required',
    'string.max': 'bankName must not exceed 100 characters',
  }),
  accountNumber: Joi.string().trim().max(50).required().messages({
    'string.empty': 'accountNumber is required',
    'string.max': 'accountNumber must not exceed 50 characters',
  }),
  accountName: Joi.string().trim().max(100).required().messages({
    'string.empty': 'accountName is required',
    'string.max': 'accountName must not exceed 100 characters',
  }),
  swiftCode: Joi.string().trim().max(20).optional().messages({
    'string.max': 'swiftCode must not exceed 20 characters',
  }),
  sortCode: Joi.string().trim().max(20).optional().messages({
    'string.max': 'sortCode must not exceed 20 characters',
  }),
  frequencyPayout: Joi.string().valid('daily', 'weekly', 'monthly').insensitive().required().messages({
    'any.only': 'frequencyPayout must be one of daily, weekly, or monthly (case-insensitive)',
    'any.required': 'frequencyPayout is required',
  }),
});

const doctorProfileSchema = Joi.object({
  ...commonProfileSchema,
  profilePhoto: Joi.string().uri().optional().messages({
    'string.uri': 'profilePhoto must be a valid URL',
  }),
  contactNumber: Joi.string().trim().pattern(/^\+?[1-9]\d{1,14}([-]?\d+)*$/).optional().messages({
    'string.pattern.base': 'contactNumber must be a valid phone number (e.g., +2341234567890 or +234-123-456-7890)',
  }),
  residentialAddress: Joi.string().trim().max(500).optional().messages({
    'string.max': 'residentialAddress must not exceed 500 characters',
  }),
  professionalLicense: professionalLicenseSchema.optional(),
  professionalCertificate: Joi.array().items(professionalCertificateSchema).optional(),
  clinicalPractice: clinicalPracticeSchema.optional(),
  digitalHealthTools: digitalHealthToolsSchema.optional(),
  wallet: walletSchema.optional(),
})
// .fork(['createdAt', 'updatedAt'], (field) => field.forbidden().messages({
//   'any.unknown': `${field.id} is not allowed`,
// }));

// Update schemas (allow partial updates)
const patientProfileUpdateSchema = Joi.object({
  gender: Joi.string().valid('male', 'female', 'other').insensitive().optional(),
  dateOfBirth: Joi.date().iso().optional(),
  nationality: Joi.string().trim().max(100).optional(),
  genotype: Joi.string().trim().max(10).optional(),
  bloodGroup: Joi.string().trim().max(10).optional(),
  language: Joi.string().trim().max(50).optional(),
  mobileNumber: Joi.string().trim().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  address: Joi.string().trim().max(500).optional(),
  emergencyContactFullName: Joi.string().trim().max(100).optional(),
  emergencyContactMobile: Joi.string().trim().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  emergencyContactRelationship: Joi.string().trim().max(50).optional(),
  height: Joi.number().positive().optional(),
  weight: Joi.number().positive().optional(),
  bmi: Joi.number().positive().optional(),
  bloodPressure: Joi.string().trim().max(20).optional(),
  heartRate: Joi.number().integer().positive().optional(),
  respiratoryRate: Joi.number().integer().positive().optional(),
  temperature: Joi.number().positive().optional(),
  spO2: Joi.number().integer().positive().optional(),
  bloodGlucose: Joi.number().positive().optional(),
  smokes: Joi.boolean().optional(),
  drinksAlcohol: Joi.boolean().optional(),
  physicalActivityLevel: Joi.string().trim().max(50).optional(),
  dietType: Joi.string().trim().max(50).optional(),
  sleepDuration: Joi.number().positive().optional(),
  profileType: Joi.string().valid('individual', 'family').insensitive().optional(),

  medicalConditions: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().optional(),
      name: Joi.string().trim().max(100).optional(),
      year: Joi.number().integer().min(1900).optional(),
      status: Joi.string().trim().max(50).optional(),
    })
  ).optional(),

  surgeries: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().optional(),
      name: Joi.string().trim().max(100).optional(),
      date: Joi.date().iso().allow('', null).optional().default(null).messages({
        'date.base': 'date must be a valid date (YYYY-MM-DD)',
      }).custom((value) => value === '' ? null : value),
      location: Joi.string().trim().max(100).optional(),
    })
  ).optional(),

  allergies: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().optional(),
      type: Joi.string().trim().max(100).optional(),
      allergen: Joi.string().trim().max(100).optional(),
      description: Joi.string().trim().max(200).optional(),
    })
  ).optional(),

  familyHistories: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().optional(),
      medicalCondition: Joi.string().trim().max(100).optional(),
      affectedRelative: Joi.string().trim().max(50).optional(),
    })
  ).optional(),

  medications: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().optional(),
      name: Joi.string().trim().max(100).optional(),
      dose: Joi.string().trim().max(50).optional(),
      frequency: Joi.string().trim().max(50).optional(),
    })
  ).optional(),

  immunizations: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().optional(),
      vaccine: Joi.string().trim().max(100).optional(),
      certificateUrl: Joi.string().uri().allow('').optional(),
      date: Joi.date().iso().allow('', null).optional().default(null).messages({
        'date.base': 'date must be a valid date (YYYY-MM-DD)',
      }).custom((value) => value === '' ? null : value),
      dose: Joi.string().allow('').trim().max(50).optional(),
    })
  ).optional(),

  healthInsurance: Joi.object({
    providerName: Joi.string().trim().max(100).optional(),
    validityDate: Joi.date().iso().allow('', null).optional().default(null).messages({
      'date.base': 'validityDate must be a valid date (YYYY-MM-DD)',
    }).custom((value) => value === '' ? null : value),
    policyNo: Joi.string().trim().max(50).allow('').optional(),
    healthCardUrl: Joi.string().uri().optional().allow(''),
  }).optional(),

  disability: Joi.object({
    hasDisability: Joi.boolean().optional(),
  }).optional(),

  consent: Joi.object({
    telemedicine: Joi.boolean().optional(),
    dataCollection: Joi.boolean().optional(),
    recordSharing: Joi.boolean().optional(),
    emergencyContact: Joi.boolean().optional(),
    preferredCommunication: Joi.string().trim().max(50).optional(),
    languagePreference: Joi.string().trim().max(50).optional(),
    healthTips: Joi.boolean().optional(),
    familyAccess: Joi.boolean().optional(),
    notificationsAppointments: Joi.boolean().optional(),
    notificationsPrescriptions: Joi.boolean().optional(),
    notificationsTestResults: Joi.boolean().optional(),
    notificationsPromotions: Joi.boolean().optional(),
    signature: Joi.string().trim().max(100).optional(),
  }).optional(),
}).unknown(true);


const doctorProfileUpdateSchema = Joi.object({
  profilePhoto: Joi.string().uri().optional(),
  contactNumber: Joi.string().trim().pattern(/^\+?[1-9]\d{1,14}([-]?\d+)*$/).optional(),
  residentialAddress: Joi.string().trim().max(500).optional(),
  professionalLicense: Joi.object({
    medicalLicenseNumber: Joi.string().trim().max(50).optional(),
    countryOfLicense: Joi.string().trim().max(100).optional(),
    licenseAuthority: Joi.string().trim().max(100).optional(),
    licenseExpiryDate: Joi.date().iso().optional(),
    licenseDocument: Joi.string().uri().optional(),
    yearsOfExperience: Joi.number().integer().positive().optional(),
    areasOfSpecialization: Joi.array().items(Joi.string().trim().max(100)).optional(),
    subspecialty: Joi.string().trim().max(100).allow('', null).optional(),
    medicalInstitution: Joi.string().trim().max(100).optional(),
  }).optional(),
  professionalCertificate: Joi.array().items(
    Joi.object({
      institution: Joi.string().trim().max(100).optional(),
      degree: Joi.string().trim().max(50).optional(),
      fieldOfStudy: Joi.string().trim().max(100).optional(),
      startYear: Joi.number().integer().min(1900).optional(),
      endYear: Joi.number().integer().min(1900).optional(),
      certificateName: Joi.string().trim().max(100).optional(),
      issuingBody: Joi.string().trim().max(100).optional(),
      issueDate: Joi.date().iso().optional(),
      expiryDate: Joi.date().iso().optional(),
      certificateDocument: Joi.string().uri().optional(),
      verificationLink: Joi.alternatives()
        .try(Joi.string().uri(), Joi.string())
        .allow('', null)
        .optional(),
    })
  ).optional(),
  clinicalPractice: Joi.object({
    clinicName: Joi.string().trim().max(100).optional(),
    location: Joi.string().trim().max(500).optional(),
    daysAvailableFrom: Joi.string()
      .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
      .insensitive()
      .optional(),
    daysAvailableTo: Joi.string()
      .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
      .insensitive()
      .optional(),
    timeAvailableFrom: Joi.string()
      .pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
      .optional(),
    timeAvailableTo: Joi.string()
      .pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
      .optional(),
    consultationFee: Joi.number().positive().optional(),
  }).optional(),
  digitalHealthTools: Joi.object({
    consentToUseAITools: Joi.boolean().allow(null, '').optional(),
    usageDescription: Joi.string().trim().max(500).allow('', null).optional(),
    useARVR: Joi.boolean().allow(null, '').optional(),
  }).optional(),
  wallet: Joi.object({
    paymentMethod: Joi.string().valid('bank_transfer', 'mobile_money').insensitive().optional(),
    bankName: Joi.string().trim().max(100).optional(),
    accountNumber: Joi.string().trim().max(50).optional(),
    accountName: Joi.string().trim().max(100).optional(),
    swiftCode: Joi.string().trim().max(20).optional(),
    sortCode: Joi.string().trim().max(20).optional(),
    frequencyPayout: Joi.string().valid('daily', 'weekly', 'monthly').insensitive().optional(),
  }).optional(),
  gender: Joi.string().valid('male', 'female', 'other').insensitive().optional(),
  dateOfBirth: Joi.date().iso().optional(),
  nationality: Joi.string().trim().max(100).optional(),
}).unknown(true);

// Middleware to validate request body
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    return res.status(400).json({ errors });
  }
  req.body = value;
  next();
};

// Export validators
module.exports = {
  validatePatientProfile: validate(patientProfileSchema),
  validatePatientProfileUpdate: validate(patientProfileUpdateSchema),
  validateDoctorProfile: validate(doctorProfileSchema),
  validateDoctorProfileUpdate: validate(doctorProfileUpdateSchema),
};