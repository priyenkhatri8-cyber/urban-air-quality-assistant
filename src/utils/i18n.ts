import type { LanguageCode } from '../types/environment';

export const UI_STRINGS: Record<
  LanguageCode,
  {
    brandTagline: string;
    navOverview: string;
    navMap: string;
    navHotspots: string;
    navInvestigator: string;
    navRoutes: string;
    navHealth: string;
    navForecast: string;
    navCompare: string;
    navReports: string;
    navAlerts: string;
    navAssistant: string;
    navAwareness: string;
    navSystem: string;
    searchPlaceholder: string;
    locateMe: string;
    generateReport: string;
    measuredVsModelled: string;
    darkMode: string;
    lightMode: string;
  }
> = {
  en: {
    brandTagline: 'Urban Environmental Intelligence',
    navOverview: 'Overview',
    navMap: 'Pollution Map',
    navHotspots: 'Hotspots & Green Zones',
    navInvestigator: 'AI Investigator',
    navRoutes: 'Smart Routes',
    navHealth: 'Health Advisor',
    navForecast: 'Forecast & Analytics',
    navCompare: 'City Comparison',
    navReports: 'Report Generator',
    navAlerts: 'Alert Center',
    navAssistant: 'Multilingual AI',
    navAwareness: 'Awareness Center',
    navSystem: 'System Monitor',
    searchPlaceholder: 'Search city (e.g. Ahmedabad, Surat, Delhi)...',
    locateMe: 'Locate Me',
    generateReport: 'Export Report',
    measuredVsModelled: 'Modelled Atmospheric Estimate · Open-Meteo CAMS',
    darkMode: 'Dark',
    lightMode: 'Light',
  },
  gu: {
    brandTagline: 'શહેરી પર્યાવરણીય બુદ્ધિમત્તા',
    navOverview: 'ઝાંખી (Overview)',
    navMap: 'પ્રદૂષણ નકશો',
    navHotspots: 'હોટસ્પોટ્સ અને ગ્રીન ઝોન',
    navInvestigator: 'AI તપાસનીસ',
    navRoutes: 'સ્માર્ટ રૂટ',
    navHealth: 'આરોગ્ય સલાહકાર',
    navForecast: 'આગાહી અને વિશ્લેષણ',
    navCompare: 'શહેર સરખામણી',
    navReports: 'રિપોર્ટ જનરેટર',
    navAlerts: 'એલર્ટ સેન્ટર',
    navAssistant: 'બહુભાષી AI સહાયક',
    navAwareness: 'જાગૃતિ કેન્દ્ર',
    navSystem: 'સિસ્ટમ મોનિટર',
    searchPlaceholder: 'શહેર શોધો (દા.ત. અમદાવાદ, સુરત, ગાંધીનગર)...',
    locateMe: 'મારું સ્થાન',
    generateReport: 'રિપોર્ટ ડાઉનલોડ',
    measuredVsModelled: 'મોડેલ આધારિત અંદાજ · Open-Meteo CAMS',
    darkMode: 'ડાર્ક',
    lightMode: 'લાઇટ',
  },
  hi: {
    brandTagline: 'शहरी पर्यावरण बुद्धिमत्ता',
    navOverview: 'अवलोकन (Overview)',
    navMap: 'प्रदूषण मानचित्र',
    navHotspots: 'हॉटस्पॉट और ग्रीन ज़ोन',
    navInvestigator: 'AI अन्वेषक',
    navRoutes: 'स्मार्ट रूट',
    navHealth: 'स्वास्थ्य सलाहकार',
    navForecast: 'पूर्वानुमान और विश्लेषण',
    navCompare: 'शहर तुलना',
    navReports: 'रिपोर्ट जनरेटर',
    navAlerts: 'अलर्ट केंद्र',
    navAssistant: 'बहुभाषी AI सहायक',
    navAwareness: 'जागरूकता केंद्र',
    navSystem: 'सिस्टम मॉनिटर',
    searchPlaceholder: 'शहर खोजें (जैसे अहमदाबाद, सूरत, दिल्ली)...',
    locateMe: 'मेरा स्थान',
    generateReport: 'रिपोर्ट निर्यात',
    measuredVsModelled: 'मॉडल-आधारित अनुमान · Open-Meteo CAMS',
    darkMode: 'डार्क',
    lightMode: 'लाइट',
  },
};

export const MULTILINGUAL_SAMPLE_PROMPTS: Record<LanguageCode, string[]> = {
  en: [
    "What is today's AQI in Ahmedabad?",
    'Compare air quality between Ahmedabad and Gandhinagar right now.',
    'Is it safe for senior citizens to exercise outdoors today?',
    'Which pollutant is driving the current AQI level and why?',
  ],
  gu: [
    'શું આજે બહાર ફરવા જવું સુરક્ષિત છે?',
    'દિલ્હી અને અમદાવાદમાં કયા શહેરની હવા સારી છે?',
    'અમદાવાદમાં આજનો AQI અને PM2.5 કેટલો છે?',
    'સંવેદનશીલ લોકોએ આજે કઈ સાવચેતી રાખવી જોઈએ?',
  ],
  hi: [
    'आज बाहर व्यायाम करना सुरक्षित है?',
    'अहमदाबाद और दिल्ली में से किस शहर की हवा बेहतर है?',
    'अहमदाबाद में आज का AQI और मुख्य प्रदूषक क्या है?',
    'बच्चों और बुजुर्गों के लिए आज के स्वास्थ्य सुझाव दें।',
  ],
};
