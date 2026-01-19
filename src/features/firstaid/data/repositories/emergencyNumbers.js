const emergencyNumbers = {
    'NG': {
        police: '112',
        fire: '112',
        medical: '112',
        universal: '112',
        notes: '112 is the universal emergency number in Nigeria'
    },
    'US': {
        police: '911',
        fire: '911',
        medical: '911',
        universal: '911'
    },
    'CA': { // Canada
        police: '911',
        fire: '911',
        medical: '911',
        universal: '911'
    },
    'JP': { // Japan
        police: '110',
        fire: '119',
        medical: '119',
        universal: '119'
    },
    'BR': { // Brazil
        police: '190',
        fire: '193',
        medical: '192',
        universal: '190'
    },
    'GB': { // United Kingdom
        police: '999',
        fire: '999',
        medical: '999',
        universal: '999',
        notes: '112 also works as EU standard'
    },
    'EU': {
        police: '112',
        fire: '112',
        medical: '112',
        universal: '112'
    },
    'IN': { // India
        police: '100',
        fire: '101',
        medical: '102',
        universal: '112'
    },
    'AU': { // Australia
        police: '000',
        fire: '000',
        medical: '000',
        universal: '000'
    },
    'ZA': { // South Africa
        police: '10111',
        fire: '10177',
        medical: '10177',
        universal: '112'
    },
    'KE': { // Kenya
        police: '999',
        fire: '999',
        medical: '999',
        universal: '112'
    },
    'GH': { // Ghana
        police: '191',
        fire: '192',
        medical: '193',
        universal: '112'
    },
    'CN': { // China
        police: '110',
        fire: '119',
        medical: '120',
        universal: '110'
    },
    'RU': { // Russia
        police: '102',
        fire: '101',
        medical: '103',
        universal: '112'
    },
    'FR': { // France
        police: '17',
        fire: '18',
        medical: '15',
        universal: '112'
    },
    'DE': { // Germany
        police: '110',
        fire: '112',
        medical: '112',
        universal: '112'
    },
    'IT': { // Italy
        police: '113',
        fire: '115',
        medical: '118',
        universal: '112'
    },
    'ES': { // Spain
        police: '091',
        fire: '080',
        medical: '061',
        universal: '112'
    },
    'MX': { // Mexico
        police: '911',
        fire: '911',
        medical: '911',
        universal: '911'
    },
    'AR': { // Argentina
        police: '911',
        fire: '911',
        medical: '911',
        universal: '911'
    },
    'EG': { // Egypt
        police: '122',
        fire: '180',
        medical: '123',
        universal: '112'
    },
    'SA': { // Saudi Arabia
        police: '999',
        fire: '998',
        medical: '997',
        universal: '112'
    },
    'AE': { // UAE
        police: '999',
        fire: '997',
        medical: '998',
        universal: '112'
    },
    'SG': { // Singapore
        police: '999',
        fire: '995',
        medical: '995',
        universal: '999'
    },
    'MY': { // Malaysia
        police: '999',
        fire: '994',
        medical: '999',
        universal: '999'
    },
    'TH': { // Thailand
        police: '191',
        fire: '199',
        medical: '1669',
        universal: '191'
    },
    'ID': { // Indonesia
        police: '110',
        fire: '113',
        medical: '119',
        universal: '112'
    },
    'PH': { // Philippines
        police: '117',
        fire: '116',
        medical: '117',
        universal: '911'
    },
    'VN': { // Vietnam
        police: '113',
        fire: '114',
        medical: '115',
        universal: '112'
    },
    'KR': { // South Korea
        police: '112',
        fire: '119',
        medical: '119',
        universal: '112'
    },
    'TR': { // Turkey
        police: '155',
        fire: '110',
        medical: '112',
        universal: '112'
    },
    'IL': { // Israel
        police: '100',
        fire: '102',
        medical: '101',
        universal: '112'
    },
    'NZ': { // New Zealand
        police: '111',
        fire: '111',
        medical: '111',
        universal: '111'
    },
    'NO': { // Norway
        police: '112',
        fire: '110',
        medical: '113',
        universal: '112'
    },
    'SE': { // Sweden
        police: '114 14',
        fire: '112',
        medical: '112',
        universal: '112'
    },
    'DK': { // Denmark
        police: '114',
        fire: '112',
        medical: '112',
        universal: '112'
    },
    'NL': { // Netherlands
        police: '112',
        fire: '112',
        medical: '112',
        universal: '112'
    },
    'BE': { // Belgium
        police: '112',
        fire: '112',
        medical: '112',
        universal: '112'
    },
    'CH': { // Switzerland
        police: '117',
        fire: '118',
        medical: '144',
        universal: '112'
    },
    'AT': { // Austria
        police: '133',
        fire: '122',
        medical: '144',
        universal: '112'
    },
    'PL': { // Poland
        police: '997',
        fire: '998',
        medical: '999',
        universal: '112'
    },
    'PT': { // Portugal
        police: '112',
        fire: '112',
        medical: '112',
        universal: '112'
    },
    'GR': { // Greece
        police: '100',
        fire: '199',
        medical: '166',
        universal: '112'
    },
    'FI': { // Finland
        police: '112',
        fire: '112',
        medical: '112',
        universal: '112'
    },
    'IE': { // Ireland
        police: '112',
        fire: '112',
        medical: '112',
        universal: '112'
    },
    'PK': { // Pakistan
        police: '15',
        fire: '16',
        medical: '1122',
        universal: '15'
    },
    'BD': { // Bangladesh
        police: '999',
        fire: '199',
        medical: '199',
        universal: '999'
    },
    'UA': { // Ukraine
        police: '102',
        fire: '101',
        medical: '103',
        universal: '112'
    },
    'DEFAULT': {
        police: '112',
        fire: '112',
        medical: '112',
        universal: '112',
        notes: '112 is the international standard emergency number'
    }
};

const countryCodeMap = {
    'nigeria': 'NG',
    'united states': 'US',
    'usa': 'US',
    'america': 'US',
    'united kingdom': 'GB',
    'uk': 'GB',
    'britain': 'GB',
    'england': 'GB',
    'canada': 'CA',
    'japan': 'JP',
    'brazil': 'BR',
    'india': 'IN',
    'australia': 'AU',
    'south africa': 'ZA',
    'kenya': 'KE',
    'ghana': 'GH',
    'china': 'CN',
    'russia': 'RU',
    'france': 'FR',
    'germany': 'DE',
    'italy': 'IT',
    'spain': 'ES',
    'mexico': 'MX',
    'argentina': 'AR',
    'egypt': 'EG',
    'saudi arabia': 'SA',
    'uae': 'AE',
    'united arab emirates': 'AE',
    'singapore': 'SG',
    'malaysia': 'MY',
    'thailand': 'TH',
    'indonesia': 'ID',
    'philippines': 'PH',
    'vietnam': 'VN',
    'south korea': 'KR',
    'korea': 'KR',
    'turkey': 'TR',
    'israel': 'IL',
    'new zealand': 'NZ',
    'norway': 'NO',
    'sweden': 'SE',
    'denmark': 'DK',
    'netherlands': 'NL',
    'holland': 'NL',
    'belgium': 'BE',
    'switzerland': 'CH',
    'austria': 'AT',
    'poland': 'PL',
    'portugal': 'PT',
    'greece': 'GR',
    'finland': 'FI',
    'ireland': 'IE',
    'pakistan': 'PK',
    'bangladesh': 'BD',
    'ukraine': 'UA'
};

const emergencySafetyTips = {
    police: {
        tips: [
            "Stay calm and speak clearly when calling",
            "Provide your exact location immediately",
            "Describe the situation briefly but accurately",
            "Follow the dispatcher's instructions",
            "Stay on the line until told to hang up",
            "If possible, move to a safe location while on the call",
            "Have identification ready if safe to do so"
        ]
    },
    fire: {
        tips: [
            "Get out immediately - don't stop to collect belongings",
            "Feel doors before opening - if hot, find another exit",
            "Stay low to avoid smoke inhalation",
            "Never use elevators during a fire",
            "Call from a safe location outside the building",
            "Have everyone meet at a designated meeting point",
            "Don't re-enter the building for any reason"
        ]
    },
    medical: {
        tips: [
            "Check if the person is conscious and breathing",
            "Don't move someone with suspected spinal injury",
            "Apply direct pressure to bleeding wounds with clean cloth",
            "For choking: perform Heimlich maneuver if trained",
            "For heart attack: have person sit down, loosen clothing",
            "Stay with the patient until help arrives",
            "Be prepared to provide CPR if trained"
        ]
    },
    general: {
        tips: [
            "Program emergency numbers in your phone beforehand",
            "Know your exact address and nearby landmarks",
            "Keep a first aid kit easily accessible",
            "Have emergency contacts written down separately",
            "Learn basic first aid and CPR",
            "Keep emergency supplies (water, flashlight, batteries)",
            "Inform family members of your emergency plan"
        ]
    }
};

module.exports = {
    emergencyNumbers,
    emergencySafetyTips,
    countryCodeMap
};