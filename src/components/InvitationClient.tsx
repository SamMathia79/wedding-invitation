'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  MapPin,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Guest, WeddingSettings } from '@/lib/types';

export type InviteLanguage = 'en' | 'ar';

interface InvitationClientProps {
  initialSettings: WeddingSettings;
  initialGuest: Guest | null;
  initialCode: string;
}

const EN_FONT_MAP: Record<string, string> = {
  ptserif: 'var(--font-ptserif)',
  cormorant: 'var(--font-cormorant)',
  playfair: 'var(--font-playfair)',
  cinzel: 'var(--font-cinzel)'
};

const AR_FONT_MAP: Record<string, string> = {
  amiri: 'var(--font-amiri)',
  notonaskh: 'var(--font-notonaskh)',
  arefruqaa: 'var(--font-arefruqaa)',
  cairo: 'var(--font-cairo)'
};

const BODY_FONT_MAP: Record<string, string> = {
  montserrat: 'var(--font-montserrat)',
  blinker: 'var(--font-blinker)'
};

const STORAGE_CODE_KEY = 'samer_rafca_rsvp_code';

export default function InvitationClient({
  initialSettings,
  initialGuest,
  initialCode
}: InvitationClientProps) {
  const [settings] = useState<WeddingSettings>(initialSettings);
  const [guest, setGuest] = useState<Guest | null>(initialGuest);
  const [guestCode, setGuestCode] = useState<string>(initialCode);

  // Language, Curtain & Music Mute State
  const [lang, setLang] = useState<InviteLanguage>('en');
  const [curtainOpened, setCurtainOpened] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Active Section Tracking
  const [activeSectionIdx, setActiveSectionIdx] = useState<number>(0);

  const sectionIds = useMemo(() => {
    const ids = ['sec-hero', 'sec-welcome', 'sec-location'];
    if (settings.whishEnabled !== 'false') {
      ids.push('sec-gift');
    }
    ids.push('sec-rsvp');
    return ids;
  }, [settings.whishEnabled]);

  // Countdown State
  const [countdown, setCountdown] = useState({
    days: '00',
    hours: '00',
    mins: '00',
    secs: '00'
  });

  const maxPlusGuests = Math.max(
    1,
    Math.min(10, Number(settings.maxPlusGuests) || 4)
  );

  // Deadline & RSVP Form State
  const [isDeadlinePassed, setIsDeadlinePassed] = useState<boolean>(
    () => new Date() > new Date(settings.rsvpDeadlineIso)
  );
  const [guestNameInput, setGuestNameInput] = useState<string>(
    initialGuest?.nameEN || ''
  );
  const [statusChoice, setStatusChoice] = useState<'Confirmed' | 'Declined'>(
    initialGuest?.status === 'Declined' ? 'Declined' : 'Confirmed'
  );
  const [plusCount, setPlusCount] = useState<number>(() => {
    if (initialGuest && initialGuest.attendingSeats > 0) {
      return Math.min(maxPlusGuests, Math.max(0, initialGuest.attendingSeats - 1));
    }
    return 1;
  });
  const [guestMessage, setGuestMessage] = useState<string>(
    initialGuest?.message || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    en: string;
    ar: string;
  } | null>(null);

  const [copiedWhish, setCopiedWhish] = useState(false);

  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const musicActive =
    settings.musicEnabled !== 'false' && Boolean(settings.musicUrl);

  // 60fps GPU Parallax Engine across all slides inside .slides-viewport
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let rafId = 0;

    const updateParallax = () => {
      const vh = viewport.clientHeight || window.innerHeight;
      const slides = viewport.querySelectorAll<HTMLElement>('.evite-slide');

      slides.forEach((slide) => {
        const bg = slide.querySelector<HTMLElement>('.parallax-bg-layer');
        if (!bg) return;
        const rect = slide.getBoundingClientRect();
        // Normalized progress (-1 above viewport .. 0 centered .. +1 below viewport)
        const progress = rect.top / vh;
        const clamped = Math.max(-1.2, Math.min(1.2, progress));
        // Subtle 14% opposite vertical shift creates genuine multi-plane depth parallax on mobile & desktop
        const offsetPx = clamped * -vh * 0.14;
        bg.style.transform = `translate3d(0, ${offsetPx.toFixed(1)}px, 0) scale(1.08)`;
      });
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateParallax);
    };

    updateParallax();
    viewport.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      viewport.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sectionIds]);

  // IntersectionObserver for smooth reveal animations + active slide index
  useEffect(() => {
    const viewport = viewportRef.current;
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements[0]) {
      elements[0].classList.add('in-view');
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            const idx = sectionIds.indexOf(entry.target.id);
            if (idx !== -1) {
              setActiveSectionIdx(idx);
            }
          }
        });
      },
      {
        root: viewport,
        threshold: 0.42
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  const scrollToSectionIndex = useCallback(
    (targetIdx: number) => {
      const clamped = Math.max(0, Math.min(sectionIds.length - 1, targetIdx));
      const el = document.getElementById(sectionIds[clamped]);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveSectionIdx(clamped);
      }
    },
    [sectionIds]
  );

  // Load saved RSVP for returning visitors without ?g=code
  useEffect(() => {
    if (initialCode || initialGuest) return;
    const savedCode = localStorage.getItem(STORAGE_CODE_KEY);
    if (!savedCode) return;

    fetch(`/api/invitation?g=${encodeURIComponent(savedCode)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.guest) {
          setGuest(data.guest);
          setGuestCode(data.guest.code);
          setGuestNameInput(data.guest.nameEN || '');
          setStatusChoice(
            data.guest.status === 'Declined' ? 'Declined' : 'Confirmed'
          );
          if (data.guest.attendingSeats > 0) {
            setPlusCount(
              Math.min(maxPlusGuests, Math.max(0, data.guest.attendingSeats - 1))
            );
          }
          setGuestMessage(data.guest.message || '');
        }
      })
      .catch(() => {});
  }, [initialCode, initialGuest, maxPlusGuests]);

  // Live Countdown Timer to Ceremony (Jan 3, 2027 @ 3:00 PM)
  useEffect(() => {
    const target = new Date(settings.weddingDateIso).getTime();
    const deadlineMs = new Date(settings.rsvpDeadlineIso).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setCountdown({
        days: String(Math.floor(diff / 86400000)).padStart(2, '0'),
        hours: String(Math.floor((diff / 3600000) % 24)).padStart(2, '0'),
        mins: String(Math.floor((diff / 60000) % 60)).padStart(2, '0'),
        secs: String(Math.floor((diff / 1000) % 60)).padStart(2, '0')
      });
      setIsDeadlinePassed(now > deadlineMs);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [settings.weddingDateIso, settings.rsvpDeadlineIso]);

  // Dynamic CMS CSS Variables (Sacramento + PT Serif + Montserrat)
  const cmsThemeStyle = useMemo(() => {
    const accent = settings.accentColor || '#ffffff';
    return {
      '--gold': accent,
      '--overlay-opacity': settings.overlayOpacity || '0.44',
      '--font-en-serif': EN_FONT_MAP[settings.fontEN] || EN_FONT_MAP.ptserif,
      '--font-ar-serif': AR_FONT_MAP[settings.fontAR] || AR_FONT_MAP.amiri,
      '--font-sans': BODY_FONT_MAP[settings.fontBody] || BODY_FONT_MAP.montserrat
    } as React.CSSProperties;
  }, [settings]);

  const handleToggleMute = () => {
    if (!musicActive) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && !isMuted) {
      audio.muted = true;
      audio.pause();
      setIsMuted(true);
      setIsPlaying(false);
    } else {
      audio.muted = false;
      setIsMuted(false);
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleSelectLanguageAndOpen = (chosenLang: InviteLanguage) => {
    setLang(chosenLang);
    setCurtainOpened(true);
    const audio = audioRef.current;
    if (musicActive && audio && !isMuted) {
      audio.muted = false;
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleCopyWhish = async () => {
    try {
      await navigator.clipboard.writeText(settings.whishNumber.trim());
      setCopiedWhish(true);
      setTimeout(() => setCopiedWhish(false), 2500);
    } catch {
      // Ignore clipboard failure
    }
  };

  const totalAttendingSeats = plusCount + 1;

  const handleSubmitRsvp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (new Date() > new Date(settings.rsvpDeadlineIso)) {
      setIsDeadlinePassed(true);
      return;
    }

    const effectiveName = guestNameInput.trim() || guest?.nameEN || '';
    if (!guestCode && !effectiveName) {
      setFeedback({
        type: 'error',
        en: 'Please enter your full name to confirm.',
        ar: 'يرجى إدخال الاسم الكامل لتأكيد الحضور.'
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: guestCode,
          guestName: effectiveName,
          status: statusChoice,
          attendingSeats: statusChoice === 'Confirmed' ? totalAttendingSeats : 0,
          message: guestMessage
        })
      });
      const result = await res.json();

      if (result.ok && result.guest) {
        setGuest(result.guest);
        setGuestCode(result.guest.code);
        if (!initialCode) {
          localStorage.setItem(STORAGE_CODE_KEY, result.guest.code);
        }
        setFeedback({
          type: 'success',
          en: 'Thank you! Your RSVP has been saved.',
          ar: 'شكراً لكم! تم حفظ تأكيدكم بنجاح.'
        });
      } else if (result.error === 'DEADLINE_PASSED') {
        setIsDeadlinePassed(true);
      } else {
        setFeedback({
          type: 'error',
          en: 'Please enter your full name to confirm.',
          ar: 'يرجى إدخال الاسم الكامل لتأكيد الحضور.'
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        en: 'Connection error. Please try again in a moment.',
        ar: 'حدث خطأ في الاتصال، يرجى المحاولة مرة أخرى.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Resolve per-slide background images with graceful fallback
  const bgCurtainUrl = settings.bgCurtain || settings.bgHero || '/assets/bg-hero.jpg';
  const bgSlide1 = settings.bgHero || '/assets/bg-hero.jpg';
  const bgSlide2 = settings.bgWelcome || settings.bgVenue || '/assets/bg-venue.jpg';
  const bgSlide3 = settings.bgLocation || settings.bgHero || '/assets/bg-hero.jpg';
  const bgSlide4 = settings.bgGift || settings.bgVenue || '/assets/bg-venue.jpg';
  const bgSlide5 = settings.bgVenue || settings.bgHero || '/assets/bg-venue.jpg';

  return (
    <div className="invite-root" lang={lang} dir={dir} style={cmsThemeStyle}>
      {/* Background Music Element */}
      {musicActive && (
        <audio
          ref={audioRef}
          src={settings.musicUrl}
          muted={isMuted}
          loop
          preload="auto"
        />
      )}

      {/* Top Floating Controls: Mute/Unmute + Language Switcher */}
      {curtainOpened && (
        <div className="floating-top-controls" dir="ltr">
          {musicActive ? (
            <button
              type="button"
              onClick={handleToggleMute}
              className="music-pill-toggle"
              aria-label={isAr ? 'كتم أو تشغيل الموسيقى' : 'Mute or Unmute Music'}
            >
              {isPlaying && !isMuted ? (
                <>
                  <Volume2 size={16} />
                  <span>{isAr ? 'كتم الموسيقى' : 'Mute Music'}</span>
                </>
              ) : (
                <>
                  <VolumeX size={16} />
                  <span>{isAr ? 'تشغيل الموسيقى' : 'Play Music'}</span>
                </>
              )}
            </button>
          ) : (
            <span />
          )}

          <div className="floating-lang-switch">
            <button
              type="button"
              className={`lang-pill-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
            >
              English
            </button>
            <button
              type="button"
              className={`lang-pill-btn ar-font ${lang === 'ar' ? 'active' : ''}`}
              onClick={() => setLang('ar')}
            >
              العربية
            </button>
          </div>
        </div>
      )}

      {/* Floating Smooth Up & Down Section Navigation Arrows */}
      {curtainOpened && (
        <nav
          className="section-scroll-nav"
          aria-label="Section Navigation"
          dir="ltr"
        >
          <button
            type="button"
            className="scroll-arrow-btn"
            disabled={activeSectionIdx <= 0}
            onClick={() => scrollToSectionIndex(activeSectionIdx - 1)}
            aria-label={isAr ? 'القسم السابق' : 'Previous Section'}
            title={isAr ? 'أعلى' : 'Scroll Up'}
          >
            <ChevronUp size={19} />
          </button>

          <div className="scroll-dots">
            {sectionIds.map((id, i) => (
              <button
                key={id}
                type="button"
                className={`scroll-dot ${activeSectionIdx === i ? 'active' : ''}`}
                onClick={() => scrollToSectionIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            className="scroll-arrow-btn"
            disabled={activeSectionIdx >= sectionIds.length - 1}
            onClick={() => scrollToSectionIndex(activeSectionIdx + 1)}
            aria-label={isAr ? 'القسم التالي' : 'Next Section'}
            title={isAr ? 'أسفل' : 'Scroll Down'}
          >
            <ChevronDown size={19} />
          </button>
        </nav>
      )}

      {/* ==================================================
          LANDING SCREEN (EVITELB WELCOME + SACRAMENTO NAMES)
         ================================================== */}
      <div
        className={`welcome-curtain ${curtainOpened ? 'opened' : ''}`}
        dir="ltr"
        style={{ backgroundImage: `url('${bgCurtainUrl}')` }}
      >
        <div className="welcome-center-box">
          <p className="welcome-dear-guest crisp-shadow">
            {initialCode && guest
              ? `Dear ${guest.nameEN}`
              : settings.guestTitleDefaultEN}
          </p>

          <h1 className="welcome-couple-script">
            {settings.coupleNamesEN}
          </h1>

          <p className="welcome-couple-ar crisp-shadow" dir="rtl">
            {settings.coupleNamesAR}
          </p>

          <p className="welcome-date-caption crisp-shadow">
            {settings.curtainDatePill}
          </p>

          <div className="evite-lang-row">
            <button
              type="button"
              onClick={() => handleSelectLanguageAndOpen('en')}
              className="evite-open-btn"
            >
              Open the invitation
            </button>

            <button
              type="button"
              onClick={() => handleSelectLanguageAndOpen('ar')}
              className="evite-open-btn ar-open"
              dir="rtl"
            >
              افتح الدعوة بالعربية
            </button>
          </div>

          {musicActive && (
            <button
              type="button"
              onClick={() => setIsMuted((prev) => !prev)}
              className="curtain-mute-pill"
            >
              {isMuted ? (
                <>
                  <VolumeX size={14} />
                  <span>Muted • بدون موسيقى</span>
                </>
              ) : (
                <>
                  <Volume2 size={14} />
                  <span>Music On (Tap to Mute) • مع موسيقى</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ==================================================
          DEDICATED SMOOTH SCROLL + PARALLAX CONTAINER
         ================================================== */}
      <div ref={viewportRef} className="slides-viewport">
        {/* ==================================================
            SLIDE 1: HERO & LIVE COUNTDOWN (Matches 111.png)
           ================================================== */}
        <section id="sec-hero" className="evite-slide in-view">
          <div
            className="parallax-bg-layer"
            style={{ backgroundImage: `url('${bgSlide1}')` }}
          />
          <div className="slide-photo-veil" />

          <div className="slide-inner">
            <div className="hero-stack text-focus-overlay">
              <div className="hero-top-quote crisp-shadow">
                <p className="hero-eyebrow-serif">
                  {isAr ? settings.heroEyebrowAR : settings.heroEyebrowEN}
                </p>
              </div>

              <h2 className="sacramento-script hero-couple-script">
                {isAr ? settings.coupleNamesAR : settings.coupleNamesEN}
              </h2>

              <p className="hero-lead-text crisp-shadow">
                {isAr ? settings.heroLeadAR : settings.heroLeadEN}
              </p>

              <p className="hero-date-sans crisp-shadow">
                {isAr ? settings.weddingDateAR : settings.weddingDateEN}
              </p>

              <div className="hero-bottom-group">
                <div className="evite-countdown" dir="ltr">
                  <div className="evite-cd-item">
                    <span>{countdown.days}</span>
                    <small>{isAr ? 'أيام' : 'Days'}</small>
                  </div>
                  <div className="evite-cd-item">
                    <span>{countdown.hours}</span>
                    <small>{isAr ? 'ساعات' : 'Hours'}</small>
                  </div>
                  <div className="evite-cd-item">
                    <span>{countdown.mins}</span>
                    <small>{isAr ? 'دقائق' : 'Mins'}</small>
                  </div>
                  <div className="evite-cd-item">
                    <span>{countdown.secs}</span>
                    <small>{isAr ? 'ثوانٍ' : 'Secs'}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => scrollToSectionIndex(1)}
            className="evite-scroll-cue"
            aria-label="Next Section"
          >
            <div className="evite-chevron-down" />
            <span className="evite-scroll-label">
              {isAr ? 'مرر للأسفل' : 'Scroll'}
            </span>
          </button>
        </section>

        {/* ==================================================
            SLIDE 2: VERSE, FAMILIES & SACRAMENTO NAMES (22.png)
           ================================================== */}
        <section id="sec-welcome" className="evite-slide">
          <div
            className="parallax-bg-layer"
            style={{ backgroundImage: `url('${bgSlide2}')` }}
          />
          <div className="slide-photo-veil" />

          <div className="slide-inner">
            <div className="welcome-verse-stack text-focus-overlay">
              {initialCode && guest && (
                <div className="personal-guest-ribbon crisp-shadow">
                  {isAr ? `عزيزنا ${guest.nameAR}` : `Dear ${guest.nameEN}`}
                </div>
              )}

              <p className="verse-block crisp-shadow">
                {isAr ? settings.verseAR : settings.verseEN}
              </p>

              <p className="families-invite-block crisp-shadow">
                {isAr ? settings.guestBodyAR : settings.guestBodyEN}
              </p>

              <h3 className="sacramento-script slide2-couple-script">
                {isAr ? settings.coupleNamesAR : settings.coupleNamesEN}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => scrollToSectionIndex(2)}
            className="evite-scroll-cue"
            aria-label="Scroll to Celebration Details"
          >
            <div className="evite-chevron-down" />
            <span className="evite-scroll-label">
              {isAr ? 'المكان والموعد' : 'Location'}
            </span>
          </button>
        </section>

        {/* ==================================================
            SLIDE 3: ARCHITECTURAL WHITE FRAME LOCATION (333.png)
           ================================================== */}
        <section id="sec-location" className="evite-slide">
          <div
            className="parallax-bg-layer"
            style={{ backgroundImage: `url('${bgSlide3}')` }}
          />
          <div className="slide-photo-veil" />

          <div className="slide-inner">
            <article className="evite-location-frame crisp-shadow">
              <p className="sacramento-script frame-script-label">
                {isAr ? 'مراسم الزفاف' : 'Wedding Celebration'}
              </p>

              <h3 className="frame-venue-name">
                {isAr ? settings.venueNameAR : settings.venueNameEN}
              </h3>

              <div className="frame-address-date">
                <div>
                  {isAr ? settings.venueAddressAR : settings.venueAddressEN}
                </div>
                <div>
                  {isAr
                    ? 'الأحد ٣ كانون الثاني ٢٠٢٧'
                    : 'Sunday, 03 January 2027'}
                </div>
              </div>

              <div className="frame-times-stack">
                <div>
                  <strong>
                    {isAr ? settings.ceremonyTitleAR : settings.ceremonyTitleEN}:
                  </strong>{' '}
                  {isAr ? settings.ceremonyTimeAR : settings.ceremonyTimeEN}
                </div>

                {settings.showReceptionSchedule !== 'false' && (
                  <div>
                    <strong>
                      {isAr
                        ? settings.receptionTitleAR
                        : settings.receptionTitleEN}
                      :
                    </strong>{' '}
                    {isAr ? settings.receptionTimeAR : settings.receptionTimeEN}
                  </div>
                )}
              </div>

              {settings.locationMapUrl && (
                <a
                  href={settings.locationMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="frame-location-link"
                >
                  <MapPin size={16} />
                  <span>{isAr ? 'الموقع على الخريطة' : 'See Location'}</span>
                </a>
              )}
            </article>
          </div>

          <button
            type="button"
            onClick={() => scrollToSectionIndex(3)}
            className="evite-scroll-cue"
            aria-label="Scroll to Next Slide"
          >
            <div className="evite-chevron-down" />
            <span className="evite-scroll-label">
              {settings.whishEnabled !== 'false'
                ? isAr
                  ? 'هدية الزفاف'
                  : 'Registry'
                : 'RSVP'}
            </span>
          </button>
        </section>

        {/* ==================================================
            SLIDE 4: SACRAMENTO "THANK YOU" & WHISH (44.png)
           ================================================== */}
        {settings.whishEnabled !== 'false' && (
          <section id="sec-gift" className="evite-slide">
            <div
              className="parallax-bg-layer"
              style={{ backgroundImage: `url('${bgSlide4}')` }}
            />
            <div className="slide-photo-veil" />

            <div className="slide-inner">
              <div className="gift-stack text-focus-overlay">
                <h3 className="sacramento-script gift-thankyou-script">
                  {isAr ? settings.whishTitleAR : settings.whishTitleEN}
                </h3>

                <p className="gift-honor-serif crisp-shadow">
                  {isAr ? settings.whishSubtitleAR : settings.whishSubtitleEN}
                </p>

                <p className="gift-body-sans crisp-shadow">
                  {isAr ? settings.whishTextAR : settings.whishTextEN}
                </p>

                <div className="whish-showcase">
                  <div className="whish-number-pill" dir="ltr">
                    {settings.whishNumber}
                  </div>

                  {settings.whishLink ? (
                    <a
                      href={settings.whishLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whish-app-icon-btn"
                      title="Open Whish Money"
                    >
                      W
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCopyWhish}
                      className="whish-app-icon-btn"
                      title="Copy Whish Number"
                    >
                      W
                    </button>
                  )}

                  <div className="whish-mini-actions">
                    <button
                      type="button"
                      onClick={handleCopyWhish}
                      className="frame-location-link"
                      style={{ padding: '9px 22px', fontSize: '0.88rem' }}
                    >
                      {copiedWhish ? <Check size={15} /> : <Copy size={15} />}
                      <span>
                        {copiedWhish
                          ? isAr
                            ? 'تم النسخ ✓'
                            : 'Copied ✓'
                          : isAr
                            ? 'نسخ الرقم'
                            : 'Copy Number'}
                      </span>
                    </button>

                    {settings.whishLink && (
                      <a
                        href={settings.whishLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="frame-location-link"
                        style={{ padding: '9px 22px', fontSize: '0.88rem' }}
                      >
                        <span>{isAr ? 'فتح تطبيق Whish' : 'Open Whish'}</span>
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => scrollToSectionIndex(sectionIds.length - 1)}
              className="evite-scroll-cue"
              aria-label="Scroll to RSVP"
            >
              <div className="evite-chevron-down" />
              <span className="evite-scroll-label">RSVP</span>
            </button>
          </section>
        )}

        {/* ==================================================
            SLIDE 5: SACRAMENTO "PLEASE" + R S V P (55555.png)
           ================================================== */}
        <section id="sec-rsvp" className="evite-slide">
          <div
            className="parallax-bg-layer"
            style={{ backgroundImage: `url('${bgSlide5}')` }}
          />
          <div className="slide-photo-veil" />

          <div className="slide-inner">
            <div className="rsvp-stack text-focus-overlay">
              <p className="sacramento-script rsvp-please-script">
                {isAr ? 'يرجى' : 'Please'}
              </p>

              <h3 className="rsvp-spaced-serif crisp-shadow">
                {isAr ? 'تأكيد الحضور' : 'R S V P'}
              </h3>

              <p className="rsvp-deadline-sans crisp-shadow">
                {isAr ? (
                  <>
                    يرجى تأكيد حضوركم قبل تاريخ{' '}
                    <strong>{settings.rsvpDeadlineAR}</strong>
                  </>
                ) : (
                  <>
                    PLEASE RESPOND WITH YOUR ABILITY TO ATTEND
                    <br />
                    BEFORE THE {settings.rsvpDeadlineEN}
                  </>
                )}
              </p>

              {guest && guest.status !== 'Pending' && (
                <div className="status-pill">
                  {guest.status === 'Confirmed' ? (
                    isAr ? (
                      <>
                        الرد المسجل ({guest.nameAR}):{' '}
                        <strong>
                          مؤكد ({guest.attendingSeats}{' '}
                          {guest.attendingSeats === 1 ? 'شخص' : 'أشخاص'})
                        </strong>
                      </>
                    ) : (
                      <>
                        Saved Response ({guest.nameEN}):{' '}
                        <strong>
                          Confirmed (
                          {guest.attendingSeats === 1
                            ? 'Just Me'
                            : `You +${guest.attendingSeats - 1} — ${guest.attendingSeats} Guests`}
                          )
                        </strong>
                      </>
                    )
                  ) : isAr ? (
                    <>
                      الرد المسجل: <strong>معتذر عن الحضور</strong>
                    </>
                  ) : (
                    <>
                      Saved Response: <strong>Declined</strong>
                    </>
                  )}
                </div>
              )}

              {!isDeadlinePassed ? (
                <form onSubmit={handleSubmitRsvp} className="evite-rsvp-form">
                  {!initialCode && (
                    <input
                      type="text"
                      required
                      className="evite-pill-input"
                      value={guestNameInput}
                      onChange={(e) => setGuestNameInput(e.target.value)}
                      placeholder={
                        isAr ? 'الاسم الكامل...' : 'Your Full Name...'
                      }
                    />
                  )}

                  <div className="evite-radio-row">
                    <label className="evite-radio-label crisp-shadow">
                      <input
                        type="radio"
                        name="status"
                        value="Confirmed"
                        checked={statusChoice === 'Confirmed'}
                        onChange={() => setStatusChoice('Confirmed')}
                      />
                      <span>{isAr ? 'سأحضر بكل سرور' : 'Accept'}</span>
                    </label>

                    <label className="evite-radio-label crisp-shadow">
                      <input
                        type="radio"
                        name="status"
                        value="Declined"
                        checked={statusChoice === 'Declined'}
                        onChange={() => setStatusChoice('Declined')}
                      />
                      <span>{isAr ? 'أعتذر عن الحضور' : 'Decline'}</span>
                    </label>
                  </div>

                  {statusChoice === 'Confirmed' && (
                    <>
                      <div className="plus-guests-pills" dir="ltr">
                        <button
                          type="button"
                          onClick={() => setPlusCount(0)}
                          className={`plus-pill-btn ${plusCount === 0 ? 'active' : ''}`}
                        >
                          {isAr ? 'بمفردي' : 'Just Me'}
                        </button>

                        {Array.from(
                          { length: maxPlusGuests },
                          (_, idx) => idx + 1
                        ).map((plus) => (
                          <button
                            key={plus}
                            type="button"
                            onClick={() => setPlusCount(plus)}
                            className={`plus-pill-btn ${plusCount === plus ? 'active' : ''}`}
                          >
                            +{plus}
                          </button>
                        ))}
                      </div>

                      <p className="plus-total-hint crisp-shadow">
                        {plusCount === 0
                          ? isAr
                            ? 'تأكيد حضور شخص واحد (أنت فقط)'
                            : '1 Guest Attending (Just You)'
                          : isAr
                            ? `إجمالي الحضور: ${totalAttendingSeats} أشخاص (أنت + ${plusCount})`
                            : `Total Attending: ${totalAttendingSeats} Guests (You + ${plusCount})`}
                      </p>
                    </>
                  )}

                  <input
                    type="text"
                    className="evite-pill-input"
                    value={guestMessage}
                    onChange={(e) => setGuestMessage(e.target.value)}
                    placeholder={
                      isAr
                        ? 'كلمة تهنئة للعروسين (اختياري)...'
                        : 'Wishes for the couple (optional)...'
                    }
                  />

                  {feedback && (
                    <div className={`feedback-banner ${feedback.type}`}>
                      {isAr ? feedback.ar : feedback.en}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="evite-submit-btn"
                  >
                    {submitting
                      ? isAr
                        ? 'جارٍ الحفظ...'
                        : 'Submitting...'
                      : isAr
                        ? 'إرسال التأكيد'
                        : 'Submit'}
                  </button>
                </form>
              ) : (
                <div className="feedback-banner error">
                  {isAr
                    ? `أُغلق باب تأكيد الحضور بتاريخ ${settings.rsvpDeadlineAR}`
                    : `RSVP closed on ${settings.rsvpDeadlineEN}`}
                </div>
              )}

              <footer className="inline-footer" dir="ltr">
                <span>{settings.coupleNamesEN}</span>
                <span>•</span>
                <Link href="/admin" className="admin-link">
                  CMS
                </Link>
              </footer>
            </div>
          </div>

          <button
            type="button"
            onClick={() => scrollToSectionIndex(0)}
            className="evite-scroll-cue"
            aria-label="Back to Top"
          >
            <div className="evite-chevron-up" />
            <span className="evite-scroll-label">
              {isAr ? 'الأعلى' : 'Top'}
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}
