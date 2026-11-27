export type RsvpStatus = 'Pending' | 'Confirmed' | 'Declined';

export interface Guest {
  code: string;
  nameEN: string;
  nameAR: string;
  maxSeats: number;
  status: RsvpStatus;
  attendingSeats: number;
  message: string;
  updatedAt: string;
}

export interface UpsertGuestInput {
  code: string;
  nameEN: string;
  nameAR: string;
  maxSeats: number;
  status?: RsvpStatus;
  attendingSeats?: number;
  message?: string;
}

export interface WeddingSettings {
  // 1. Media Assets (Per-Slide Parallax Images & Audio)
  bgCurtain: string;
  bgHero: string;
  bgWelcome: string;
  bgLocation: string;
  bgGift: string;
  bgVenue: string;
  ogImage: string;
  musicUrl: string;
  musicEnabled: string; // 'true' | 'false'

  // 2. Typography & Visual Theme (CMS)
  fontEN: string; // 'ptserif' | 'cormorant' | 'playfair' | 'cinzel'
  fontAR: string; // 'amiri' | 'notonaskh' | 'arefruqaa' | 'cairo'
  fontBody: string; // 'montserrat' | 'blinker'
  accentColor: string;
  bgCreamColor: string;
  overlayOpacity: string; // '0.30' .. '0.75'

  // 3. Couple, Slide 1 (Hero) & Slide 2 (Verse & Families) Copy
  monogram: string;
  coupleNamesEN: string;
  coupleNamesAR: string;
  heroEyebrowEN: string;
  heroEyebrowAR: string;
  heroLeadEN: string;
  heroLeadAR: string;
  weddingDateEN: string;
  weddingDateAR: string;
  curtainDatePill: string;
  weddingDateIso: string;
  rsvpDeadlineIso: string;
  rsvpDeadlineEN: string;
  rsvpDeadlineAR: string;
  guestTitleDefaultEN: string;
  guestTitleDefaultAR: string;
  verseEN: string;
  verseAR: string;
  guestBodyEN: string;
  guestBodyAR: string;

  // 4. Slide 3: Unified Ceremony & Reception Location Frame
  venueNameEN: string;
  venueNameAR: string;
  venueAddressEN: string;
  venueAddressAR: string;
  locationMapUrl: string;
  locationLat: string;
  locationLng: string;
  showEmbeddedMap: string; // 'true' | 'false'

  ceremonyTitleEN: string;
  ceremonyTitleAR: string;
  ceremonyTimeEN: string;
  ceremonyTimeAR: string;

  showReceptionSchedule: string; // 'true' | 'false'
  receptionTitleEN: string;
  receptionTitleAR: string;
  receptionTimeEN: string;
  receptionTimeAR: string;

  // 5. Slide 5: RSVP Settings (+1 up to +4)
  maxPlusGuests: string;

  // 6. Slide 4: Thank You & Whish Money Gift Registry
  whishEnabled: string; // 'true' | 'false'
  whishTitleEN: string;
  whishTitleAR: string;
  whishSubtitleEN: string;
  whishSubtitleAR: string;
  whishTextEN: string;
  whishTextAR: string;
  whishNumber: string;
  whishLink: string;
}

export interface StorageInfo {
  database: 'postgres' | 'vercel-blob' | 'local-file' | 'ephemeral-tmp';
  media: 'vercel-blob' | 'local-public' | 'url-only';
  isVercel: boolean;
}

export const WEDDING_DATE_ISO = '2027-01-03T15:00:00+02:00';
export const RSVP_DEADLINE_ISO = '2026-12-15T23:59:59+02:00';

export const DEFAULT_SETTINGS: WeddingSettings = {
  // Media (Parallax full-bleed photos on every slide)
  bgCurtain: '/assets/bg-hero.jpg',
  bgHero: '/assets/bg-hero.jpg',
  bgWelcome: '/assets/bg-venue.jpg',
  bgLocation: '/assets/bg-hero.jpg',
  bgGift: '/assets/bg-venue.jpg',
  bgVenue: '/assets/bg-hero.jpg',
  ogImage: '',
  musicUrl: '/assets/wedding.wav',
  musicEnabled: 'true',

  // Typography & Theme (Matches evitelb.com/Sako&Aimee: PT Serif + Montserrat + Pinyon Script)
  fontEN: 'ptserif',
  fontAR: 'amiri',
  fontBody: 'montserrat',
  accentColor: '#ffffff',
  bgCreamColor: '#161412',
  overlayOpacity: '0.48',

  // Couple, Slide 1 & Slide 2 Copy
  monogram: 'S&R',
  coupleNamesEN: 'Samer & Rafca',
  coupleNamesAR: 'سامر ورفقا',
  heroEyebrowEN: 'TOGETHER WITH OUR FAMILIES',
  heroEyebrowAR: 'بمباركة الأهل، يسرّنا دعوتكم',
  heroLeadEN:
    'Joyfully invite you to celebrate our wedding and the beginning of our forever',
  heroLeadAR: 'ندعوكم لمشاركتنا فرحتنا والاحتفال ببداية حياتنا معاً',
  weddingDateEN: 'JANUARY 3, 2027',
  weddingDateAR: '٣ كانون الثاني ٢٠٢٧',
  curtainDatePill: 'JANUARY 3, 2027 • 3:00 PM',
  weddingDateIso: WEDDING_DATE_ISO,
  rsvpDeadlineIso: RSVP_DEADLINE_ISO,
  rsvpDeadlineEN: '15TH OF DECEMBER 2026',
  rsvpDeadlineAR: '١٥ كانون الأول ٢٠٢٦',
  guestTitleDefaultEN: 'Dear Honored Guest',
  guestTitleDefaultAR: 'عزيزنا ضيفنا الكريم',
  verseEN:
    '“SO THEY ARE NO LONGER TWO, BUT ONE FLESH,\nTHEREFORE WHAT GOD HAS JOINED TOGETHER\nLET NO ONE SEPARATE”',
  verseAR:
    '«إِذًا لَيْسَا بَعْدُ اثْنَيْنِ بَلْ جَسَدٌ وَاحِدٌ.\nفَالَّذِي جَمَعَهُ اللهُ لاَ يُفَرِّقْهُ إِنْسَانٌ»',
  guestBodyEN:
    'TOGETHER WITH THEIR FAMILIES\nWOULD LOVE YOU TO JOIN THEM IN CELEBRATING\nTHE UNION OF THEIR CHILDREN',
  guestBodyAR:
    'بِمُبَارَكَةِ العَائِلَتَيْنِ الكَرِيمَتَيْنِ\nيَسُرُّنَا دَعْوَتُكُمْ لِمُشَارَكَتِنَا فَرْحَةَ\nإِكْلِيلِ وَلَدَيْنَا',

  // Slide 3: Unified Ceremony & Reception Location (Nativité du Seigneur - Hadath)
  venueNameEN: 'Church of the Nativity of the Lord',
  venueNameAR: 'كنيسة ميلاد الرب',
  venueAddressEN: 'Hadath, Mount Lebanon',
  venueAddressAR: 'الحدث، جبل لبنان',
  locationMapUrl: 'https://maps.app.goo.gl/6XWJ5e1X8x4NA8ne7',
  locationLat: '33.8315329',
  locationLng: '35.5319218',
  showEmbeddedMap: 'false',

  ceremonyTitleEN: 'Ceremony',
  ceremonyTitleAR: 'الإكليل',
  ceremonyTimeEN: '3:00 PM',
  ceremonyTimeAR: '٣:٠٠ بعد الظهر',

  showReceptionSchedule: 'true',
  receptionTitleEN: 'Reception',
  receptionTitleAR: 'الاستقبال',
  receptionTimeEN: '5:00 PM',
  receptionTimeAR: '٥:٠٠ مساءً',

  // Slide 5: RSVP (+1 up to +4)
  maxPlusGuests: '4',

  // Slide 4: Whish Money Gift Registry (Matches evitelb Slide 4)
  whishEnabled: 'true',
  whishTitleEN: 'Thank you',
  whishTitleAR: 'شكراً لكم',
  whishSubtitleEN:
    'FOR THE HONOR OF YOUR PRESENCE\nTO SHARE THE JOY OF OUR\nMARRIAGE.',
  whishSubtitleAR:
    'لِتَشْرِيفِكُمْ وَمُشَارَكَتِنَا\nفَرْحَةَ زَفَافِنَا المُبَارَك',
  whishTextEN:
    'YOUR WARM WISHES AND COMPANY ON OUR WEDDING DAY IS THE MOST PRECIOUS GIFT OF ALL. HOWEVER, IF YOU WISH, A WEDDING REGISTRY IS SET AT WHISH MONEY ACCOUNT',
  whishTextAR:
    'حُضُورُكُمْ وَمَحَبَّتُكُمْ يَوْمَ زَفَافِنَا هُمَا أَثْمَنُ هَدِيَّةٍ عَلَى الإِطْلاقِ. وَلِمَنْ يَرْغَبُ، تَتَوَفَّرُ لائِحَةُ الهَدَايَا عَبْرَ حِسَابِ WHISH MONEY:',
  whishNumber: '+961 70 123 456',
  whishLink: 'https://whish.money'
};

export const SAMPLE_GUESTS: Guest[] = [
  {
    code: '9j3',
    nameEN: 'Sako & Aimée',
    nameAR: 'ساكو وإيمي',
    maxSeats: 5,
    status: 'Pending',
    attendingSeats: 0,
    message: '',
    updatedAt: ''
  }
];
