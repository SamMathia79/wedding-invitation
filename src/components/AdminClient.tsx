'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { upload as vercelBlobUpload } from '@vercel/blob/client';
import * as XLSX from 'xlsx';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LogOut,
  Music,
  Palette,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Users
} from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  Guest,
  RsvpStatus,
  StorageInfo,
  WeddingSettings
} from '@/lib/types';

interface AdminClientProps {
  initialAuthenticated: boolean;
  initialGuests?: Guest[];
  initialSettings?: WeddingSettings;
  initialStorageInfo?: StorageInfo;
}

type AdminTab = 'guests' | 'media' | 'design' | 'content';

type MediaSlot =
  | 'bgCurtain'
  | 'bgHero'
  | 'bgWelcome'
  | 'bgLocation'
  | 'bgGift'
  | 'bgVenue'
  | 'ogImage'
  | 'musicUrl';

const ACCENT_SWATCHES = [
  { label: 'Pure White (Evite Classic)', hex: '#ffffff' },
  { label: 'Champagne Gold', hex: '#c5a059' },
  { label: 'Rose Gold', hex: '#b76e79' },
  { label: 'Olive Sage', hex: '#768968' },
  { label: 'Warm Sand', hex: '#e6d3b3' }
];

const BG_SWATCHES = [
  { label: 'Espresso Dark', hex: '#161412' },
  { label: 'Warm Ivory', hex: '#faf7f2' },
  { label: 'Charcoal Velvet', hex: '#221f1c' }
];

const EN_FONT_CSS: Record<string, string> = {
  ptserif: 'var(--font-ptserif), Georgia, serif',
  cormorant: 'var(--font-cormorant), Georgia, serif',
  playfair: 'var(--font-playfair), Georgia, serif',
  cinzel: 'var(--font-cinzel), Georgia, serif'
};

const AR_FONT_CSS: Record<string, string> = {
  amiri: 'var(--font-amiri), Georgia, serif',
  notonaskh: 'var(--font-notonaskh), serif',
  arefruqaa: 'var(--font-arefruqaa), serif',
  cairo: 'var(--font-cairo), sans-serif'
};

function generateRandomCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function AdminClient({
  initialAuthenticated,
  initialGuests = [],
  initialSettings = DEFAULT_SETTINGS,
  initialStorageInfo
}: AdminClientProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('media');
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [settings, setSettings] = useState<WeddingSettings>(initialSettings);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | undefined>(
    initialStorageInfo
  );

  // CMS upload & save states
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [cmsNotice, setCmsNotice] = useState<string>('');
  const [cmsError, setCmsError] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Add/Edit Guest form state
  const [gCode, setGCode] = useState('');
  const [gNameEN, setGNameEN] = useState('');
  const [gNameAR, setGNameAR] = useState('');
  const [gSeats, setGSeats] = useState<number>(5);
  const [editingExisting, setEditingExisting] = useState(false);
  const [savingGuest, setSavingGuest] = useState(false);

  // Table filter & copy feedback
  const [filterStatus, setFilterStatus] = useState<'ALL' | RsvpStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const updateField = <K extends keyof WeddingSettings>(
    key: K,
    val: WeddingSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAuthenticated(true);
        setGuests(data.guests || []);
        setSettings(data.settings || DEFAULT_SETTINGS);
        setStorageInfo(data.storageInfo);
      } else {
        setLoginError(data.error || 'Invalid username or password.');
      }
    } catch {
      setLoginError('Failed to connect to server.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setAuthenticated(false);
    setUsername('');
    setPassword('');
  };

  const refreshDashboard = async () => {
    const res = await fetch('/api/admin/session');
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        setGuests(data.guests || []);
        setSettings(data.settings || DEFAULT_SETTINGS);
        setStorageInfo(data.storageInfo);
      }
    }
  };

  // Statistics computation
  const stats = useMemo(() => {
    let confirmedFamilies = 0;
    let confirmedSeats = 0;
    let declinedFamilies = 0;
    let pendingFamilies = 0;

    for (const g of guests) {
      if (g.status === 'Confirmed') {
        confirmedFamilies++;
        confirmedSeats += g.attendingSeats;
      } else if (g.status === 'Declined') {
        declinedFamilies++;
      } else {
        pendingFamilies++;
      }
    }

    return {
      totalEntries: guests.length,
      confirmedFamilies,
      confirmedSeats,
      declinedFamilies,
      pendingFamilies
    };
  }, [guests]);

  const filteredGuests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return guests.filter((g) => {
      if (filterStatus !== 'ALL' && g.status !== filterStatus) return false;
      if (!q) return true;
      return (
        g.code.toLowerCase().includes(q) ||
        g.nameEN.toLowerCase().includes(q) ||
        g.nameAR.toLowerCase().includes(q)
      );
    });
  }, [guests, filterStatus, searchQuery]);

  // Upload media file (Vercel Blob client upload in prod, multipart locally)
  const handleFileUpload = async (slot: MediaSlot, file: File | undefined) => {
    if (!file) return;
    setUploadingSlot(slot);
    setCmsError('');
    setCmsNotice('');

    try {
      let uploadedUrl = '';

      if (storageInfo?.media === 'vercel-blob') {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
        const blob = await vercelBlobUpload(
          `wedding/${Date.now()}-${cleanName}`,
          file,
          {
            access: 'public',
            handleUploadUrl: '/api/admin/blob-upload'
          }
        );
        uploadedUrl = blob.url;

        const saveRes = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: { [slot]: uploadedUrl } })
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok || !saveData.ok) {
          throw new Error(saveData.error || 'Failed to save uploaded media URL');
        }
        setSettings(saveData.settings);
      } else {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('slot', slot);
        formData.append('autoSave', 'true');

        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Upload failed');
        }
        uploadedUrl = data.url;
        if (data.settings) {
          setSettings(data.settings);
        } else {
          setSettings((prev) => ({ ...prev, [slot]: uploadedUrl }));
        }
      }

      setCmsNotice(`Uploaded & activated ${file.name} ✓`);
      setTimeout(() => setCmsNotice(''), 4000);
    } catch (err) {
      setCmsError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setCmsError('');
    setCmsNotice('');

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSettings(data.settings);
        setCmsNotice('All CMS changes saved & live ✓');
        setTimeout(() => setCmsNotice(''), 3500);
      } else {
        setCmsError(data.error || 'Failed to save settings');
      }
    } catch {
      setCmsError('Network error while saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSlot = async (slot: MediaSlot) => {
    const defaultVal = DEFAULT_SETTINGS[slot];
    setSettings((prev) => ({ ...prev, [slot]: defaultVal }));
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { [slot]: defaultVal } })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setSettings(data.settings);
      setCmsNotice('Reset to default ✓');
      setTimeout(() => setCmsNotice(''), 3000);
    }
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gCode.trim() || !gNameEN.trim() || !gNameAR.trim()) return;
    setSavingGuest(true);

    try {
      const res = await fetch('/api/admin/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest: {
            code: gCode.trim(),
            nameEN: gNameEN.trim(),
            nameAR: gNameAR.trim(),
            maxSeats: Number(gSeats) || 5
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setGCode('');
        setGNameEN('');
        setGNameAR('');
        setGSeats(5);
        setEditingExisting(false);
        await refreshDashboard();
      }
    } finally {
      setSavingGuest(false);
    }
  };

  const handleEditRow = (g: Guest) => {
    setGCode(g.code);
    setGNameEN(g.nameEN);
    setGNameAR(g.nameAR);
    setGSeats(g.maxSeats);
    setEditingExisting(true);
    window.scrollTo({ top: 220, behavior: 'smooth' });
  };

  const handleDeleteRow = async (code: string) => {
    if (!window.confirm(`Delete RSVP / invitation "${code}"?`)) return;
    const res = await fetch(
      `/api/admin/guests?code=${encodeURIComponent(code)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      await refreshDashboard();
    }
  };

  const getSiteOrigin = () =>
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://samer-and-rafca.vercel.app';

  const buildInviteUrl = (code?: string) => {
    const base = getSiteOrigin();
    return code ? `${base}/?g=${encodeURIComponent(code)}` : `${base}/`;
  };

  const buildWhatsAppShareUrl = (guest?: Guest) => {
    const inviteUrl = guest ? buildInviteUrl(guest.code) : buildInviteUrl();
    const message = guest
      ? [
          `💍 *${settings.coupleNamesEN} — Wedding Invitation*`,
          `Dear *${guest.nameEN}*,`,
          `We joyfully invite you to celebrate our wedding on *${settings.weddingDateEN}* at *${settings.venueNameEN}*.`,
          ``,
          `✨ *دعوة زفاف ${settings.coupleNamesAR}*`,
          `عزيزنا *${guest.nameAR}*،`,
          `يسرّنا دعوتكم لمشاركتنا فرحة زفافنا يوم *${settings.weddingDateAR}* في *${settings.venueNameAR}*.`,
          ``,
          `🔗 Open your invitation & confirm before *${settings.rsvpDeadlineEN}* / لمشاهدة الدعوة وتأكيد الحضور:`,
          inviteUrl
        ].join('\n')
      : [
          `💍 *${settings.coupleNamesEN} — Wedding Invitation*`,
          `We joyfully invite you to celebrate our wedding on *${settings.weddingDateEN}* at *${settings.venueNameEN}*.`,
          ``,
          `✨ *دعوة زفاف ${settings.coupleNamesAR}*`,
          `يسرّنا دعوتكم لمشاركتنا فرحة زفافنا يوم *${settings.weddingDateAR}* في *${settings.venueNameAR}*.`,
          ``,
          `🔗 Open invitation & confirm attendance before *${settings.rsvpDeadlineEN}*:`,
          inviteUrl
        ].join('\n');

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const handleCopyLink = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(key);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Ignore
    }
  };

  // Multi-sheet Excel (.xlsx) Export
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const confirmedList = guests.filter((g) => g.status === 'Confirmed');
    const declinedList = guests.filter((g) => g.status === 'Declined');
    const pendingList = guests.filter((g) => g.status === 'Pending');

    const totalConfirmedSeats = confirmedList.reduce(
      (s, g) => s + g.attendingSeats,
      0
    );

    const summaryRows = [
      [`${settings.coupleNamesEN} Wedding — RSVP Statistics`, ''],
      ['Generated On', new Date().toLocaleString()],
      ['RSVP Edit Deadline', settings.rsvpDeadlineEN],
      ['Location', `${settings.venueNameEN} (${settings.locationMapUrl})`],
      ['', ''],
      ['Metric', 'Count'],
      ['Total Guest Entries', guests.length],
      ['Confirmed Parties', confirmedList.length],
      ['Total Confirmed Attending Guests', totalConfirmedSeats],
      ['Declined Parties', declinedList.length],
      ['Pending Invites', pendingList.length]
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(summaryRows),
      'Summary Stats'
    );

    const formatGuest = (g: Guest) => ({
      Code: g.code,
      'Guest Name (EN)': g.nameEN,
      'Guest Name (AR)': g.nameAR,
      Status: g.status,
      'Total Attending': g.attendingSeats,
      'Plus Guests':
        g.status === 'Confirmed' && g.attendingSeats > 1
          ? `+${g.attendingSeats - 1}`
          : g.status === 'Confirmed'
            ? 'Just Me'
            : '-',
      Message: g.message,
      'Last Updated': g.updatedAt
    });

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(guests.map(formatGuest)),
      'All Guests'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(confirmedList.map(formatGuest)),
      'Confirmed'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(declinedList.concat(pendingList).map(formatGuest)),
      'Declined & Pending'
    );

    XLSX.writeFile(
      wb,
      `Samer_Rafca_Wedding_RSVPs_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  if (!authenticated) {
    return (
      <div className="admin-shell">
        <div className="admin-login-wrap">
          <form onSubmit={handleLogin} className="glass-light admin-card">
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), Georgia, serif',
                fontSize: '2rem',
                textAlign: 'center'
              }}
            >
              Samer &amp; Rafca — CMS
            </h2>
            <p className="muted" style={{ textAlign: 'center' }}>
              Sign in to customize background images, music, fonts, colors,
              venue details, and manage WhatsApp RSVPs.
            </p>
            <div className="form-group">
              <label htmlFor="adminUser">Username</label>
              <input
                id="adminUser"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="adminPass">Password</label>
              <input
                id="adminPass"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {loginError && <p className="error-text">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn}
              className="btn-primary full-width"
            >
              {loggingIn ? 'Signing In...' : 'Sign In'}
            </button>
            <p style={{ marginTop: '0.5rem', textAlign: 'center' }}>
              <Link href="/" className="muted" style={{ textDecoration: 'none' }}>
                ← Back to Invitation
              </Link>
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="container admin-dashboard">
        {/* Header */}
        <div className="admin-header">
          <div>
            <h1>Wedding Invitation CMS &amp; RSVP Manager</h1>
            <p className="muted">
              Customize images, music, fonts, colors, venue &amp; track live
              confirmations
            </p>
            {storageInfo && (
              <div className="storage-pills">
                <span
                  className={`storage-pill ${
                    storageInfo.database === 'postgres' ||
                    storageInfo.database === 'vercel-blob'
                      ? 'cloud'
                      : storageInfo.database === 'ephemeral-tmp'
                        ? 'warn'
                        : ''
                  }`}
                >
                  DB:{' '}
                  {storageInfo.database === 'postgres'
                    ? 'Vercel Postgres / Neon ✓'
                    : storageInfo.database === 'vercel-blob'
                      ? 'Vercel Cloud Store ✓'
                      : storageInfo.database === 'local-file'
                        ? 'Local File (Dev)'
                        : 'Temp Memory'}
                </span>
                <span
                  className={`storage-pill ${
                    storageInfo.media === 'vercel-blob'
                      ? 'cloud'
                      : storageInfo.media === 'url-only'
                        ? 'warn'
                        : ''
                  }`}
                >
                  Media:{' '}
                  {storageInfo.media === 'vercel-blob'
                    ? 'Vercel Blob Uploads ✓'
                    : storageInfo.media === 'local-public'
                      ? 'Local Uploads (public/uploads)'
                      : 'URL Mode (Connect BLOB_READ_WRITE_TOKEN for file uploads)'}
                </span>
              </div>
            )}
          </div>

          <div className="admin-actions">
            <a
              href={buildWhatsAppShareUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline-dark"
              style={{ borderColor: '#25d366', color: '#15803d' }}
            >
              <Send size={15} /> Share General Link on WhatsApp
            </a>
            <Link href="/" target="_blank" className="btn-outline-dark">
              <ExternalLink size={15} /> View Live Page
            </Link>
            <button
              type="button"
              onClick={handleExportExcel}
              className="btn-primary"
            >
              <Download size={16} /> Export Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-outline-dark"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>

        {/* Live Statistics Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <span>Total Entries / Invites</span>
            <strong>{stats.totalEntries}</strong>
          </div>
          <div className="stat-card confirmed">
            <span>Confirmed Parties</span>
            <strong>{stats.confirmedFamilies}</strong>
          </div>
          <div className="stat-card confirmed">
            <span>Total Confirmed Guests</span>
            <strong>{stats.confirmedSeats}</strong>
          </div>
          <div className="stat-card declined">
            <span>Declined</span>
            <strong>{stats.declinedFamilies}</strong>
          </div>
          <div className="stat-card pending">
            <span>Pending</span>
            <strong>{stats.pendingFamilies}</strong>
          </div>
        </div>

        {/* CMS Navigation Tabs */}
        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
          >
            <ImageIcon size={16} /> Images &amp; Music
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'design' ? 'active' : ''}`}
            onClick={() => setActiveTab('design')}
          >
            <Palette size={16} /> Fonts &amp; Theme
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            <FileText size={16} /> Text, Location &amp; Whish
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'guests' ? 'active' : ''}`}
            onClick={() => setActiveTab('guests')}
          >
            <Users size={16} /> RSVPs &amp; Guest List ({guests.length})
          </button>
        </div>

        {/* Global Save Status Bar */}
        {(cmsNotice || cmsError) && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1.1rem',
              borderRadius: '12px',
              background: cmsError ? '#ffebe9' : '#dafbe1',
              color: cmsError ? '#cf222e' : '#1a7f37',
              fontWeight: 600
            }}
          >
            {cmsError || cmsNotice}
          </div>
        )}

        {/* ====================================================
            TAB 1: IMAGES & BACKGROUND MUSIC CMS
           ==================================================== */}
        {activeTab === 'media' && (
          <section className="admin-panel">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              <div>
                <h3>Background Images &amp; Wedding Audio</h3>
                <p className="muted">
                  Upload photos and MP3/WAV audio directly from your device
                  (activates immediately), or paste any external URL.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="btn-primary"
              >
                {savingSettings ? 'Saving...' : 'Save Media Settings'}
              </button>
            </div>

            <div className="media-grid">
              {/* Slot 1: Hero Background Image */}
              <div className="media-slot-card">
                <div className="media-slot-header">
                  <h4>1. Hero Background Image</h4>
                  <button
                    type="button"
                    onClick={() => handleResetSlot('bgHero')}
                    className="btn-ghost"
                  >
                    Reset
                  </button>
                </div>
                <div className="media-preview-box">
                  {settings.bgHero ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.bgHero} alt="Hero background preview" />
                  ) : (
                    <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                      No image set
                    </span>
                  )}
                </div>
                <div className="upload-row">
                  <label className="btn-upload">
                    <Upload size={14} />
                    {uploadingSlot === 'bgHero'
                      ? 'Uploading...'
                      : 'Upload Hero Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingSlot !== null}
                      onChange={(e) =>
                        handleFileUpload('bgHero', e.target.files?.[0])
                      }
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label>Image URL / Path</label>
                  <input
                    type="text"
                    value={settings.bgHero}
                    onChange={(e) => updateField('bgHero', e.target.value)}
                    placeholder="/assets/bg-hero.jpg or https://..."
                  />
                </div>
              </div>

              {/* Slot 2: RSVP Background Image */}
              <div className="media-slot-card">
                <div className="media-slot-header">
                  <h4>2. RSVP Section Background</h4>
                  <button
                    type="button"
                    onClick={() => handleResetSlot('bgVenue')}
                    className="btn-ghost"
                  >
                    Reset
                  </button>
                </div>
                <div className="media-preview-box">
                  {settings.bgVenue ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.bgVenue} alt="RSVP background preview" />
                  ) : (
                    <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                      No image set
                    </span>
                  )}
                </div>
                <div className="upload-row">
                  <label className="btn-upload">
                    <Upload size={14} />
                    {uploadingSlot === 'bgVenue'
                      ? 'Uploading...'
                      : 'Upload RSVP Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingSlot !== null}
                      onChange={(e) =>
                        handleFileUpload('bgVenue', e.target.files?.[0])
                      }
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label>Image URL / Path</label>
                  <input
                    type="text"
                    value={settings.bgVenue}
                    onChange={(e) => updateField('bgVenue', e.target.value)}
                    placeholder="/assets/bg-venue.jpg or https://..."
                  />
                </div>
              </div>

              {/* Slot 3: Slide 2 (Verse & Families) Background */}
              <div className="media-slot-card">
                <div className="media-slot-header">
                  <h4>3. Slide 2 (Verse &amp; Names) Photo</h4>
                  <button
                    type="button"
                    onClick={() => handleResetSlot('bgWelcome')}
                    className="btn-ghost"
                  >
                    Reset
                  </button>
                </div>
                <div className="media-preview-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.bgWelcome || settings.bgVenue || '/assets/bg-venue.jpg'}
                    alt="Slide 2 preview"
                  />
                </div>
                <div className="upload-row">
                  <label className="btn-upload">
                    <Upload size={14} />
                    {uploadingSlot === 'bgWelcome'
                      ? 'Uploading...'
                      : 'Upload Slide 2 Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingSlot !== null}
                      onChange={(e) =>
                        handleFileUpload('bgWelcome', e.target.files?.[0])
                      }
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label>Image URL / Path</label>
                  <input
                    type="text"
                    value={settings.bgWelcome}
                    onChange={(e) => updateField('bgWelcome', e.target.value)}
                    placeholder="/assets/bg-venue.jpg or https://..."
                  />
                </div>
              </div>

              {/* Slot 4: Slide 3 (Location Frame) Background */}
              <div className="media-slot-card">
                <div className="media-slot-header">
                  <h4>4. Slide 3 (Location) Photo</h4>
                  <button
                    type="button"
                    onClick={() => handleResetSlot('bgLocation')}
                    className="btn-ghost"
                  >
                    Reset
                  </button>
                </div>
                <div className="media-preview-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.bgLocation || settings.bgHero || '/assets/bg-hero.jpg'}
                    alt="Slide 3 preview"
                  />
                </div>
                <div className="upload-row">
                  <label className="btn-upload">
                    <Upload size={14} />
                    {uploadingSlot === 'bgLocation'
                      ? 'Uploading...'
                      : 'Upload Slide 3 Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingSlot !== null}
                      onChange={(e) =>
                        handleFileUpload('bgLocation', e.target.files?.[0])
                      }
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label>Image URL / Path</label>
                  <input
                    type="text"
                    value={settings.bgLocation}
                    onChange={(e) => updateField('bgLocation', e.target.value)}
                    placeholder="/assets/bg-hero.jpg or https://..."
                  />
                </div>
              </div>

              {/* Slot 5: Slide 4 (Whish Registry) Background */}
              <div className="media-slot-card">
                <div className="media-slot-header">
                  <h4>5. Slide 4 (Thank You / Whish) Photo</h4>
                  <button
                    type="button"
                    onClick={() => handleResetSlot('bgGift')}
                    className="btn-ghost"
                  >
                    Reset
                  </button>
                </div>
                <div className="media-preview-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.bgGift || settings.bgVenue || '/assets/bg-venue.jpg'}
                    alt="Slide 4 preview"
                  />
                </div>
                <div className="upload-row">
                  <label className="btn-upload">
                    <Upload size={14} />
                    {uploadingSlot === 'bgGift'
                      ? 'Uploading...'
                      : 'Upload Slide 4 Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingSlot !== null}
                      onChange={(e) =>
                        handleFileUpload('bgGift', e.target.files?.[0])
                      }
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label>Image URL / Path</label>
                  <input
                    type="text"
                    value={settings.bgGift}
                    onChange={(e) => updateField('bgGift', e.target.value)}
                    placeholder="/assets/bg-venue.jpg or https://..."
                  />
                </div>
              </div>

              {/* Slot 6: Landing Curtain Background Image */}
              <div className="media-slot-card">
                <div className="media-slot-header">
                  <h4>6. Landing Screen Photo</h4>
                  <button
                    type="button"
                    onClick={() => handleResetSlot('bgCurtain')}
                    className="btn-ghost"
                  >
                    Reset
                  </button>
                </div>
                <div className="media-preview-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.bgCurtain || settings.bgHero || '/assets/bg-hero.jpg'}
                    alt="Curtain background"
                  />
                </div>
                <div className="upload-row">
                  <label className="btn-upload">
                    <Upload size={14} />
                    {uploadingSlot === 'bgCurtain'
                      ? 'Uploading...'
                      : 'Upload Landing Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingSlot !== null}
                      onChange={(e) =>
                        handleFileUpload('bgCurtain', e.target.files?.[0])
                      }
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label>Landing Photo URL</label>
                  <input
                    type="text"
                    value={settings.bgCurtain}
                    onChange={(e) => updateField('bgCurtain', e.target.value)}
                    placeholder="/assets/bg-hero.jpg or https://..."
                  />
                </div>
              </div>

              {/* Slot 4: WhatsApp Link Preview Image */}
              <div className="media-slot-card">
                <div className="media-slot-header">
                  <h4>4. WhatsApp Preview Card</h4>
                  <button
                    type="button"
                    onClick={() => handleResetSlot('ogImage')}
                    className="btn-ghost"
                  >
                    Auto-Card
                  </button>
                </div>
                <div className="media-preview-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.ogImage || '/api/og'}
                    alt="WhatsApp preview card"
                  />
                </div>
                <div className="upload-row">
                  <label className="btn-upload">
                    <Upload size={14} />
                    {uploadingSlot === 'ogImage'
                      ? 'Uploading...'
                      : 'Upload OG Image'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      disabled={uploadingSlot !== null}
                      onChange={(e) =>
                        handleFileUpload('ogImage', e.target.files?.[0])
                      }
                    />
                  </label>
                </div>
                <div className="form-group">
                  <label>Custom OG Image URL (blank = dynamic card)</label>
                  <input
                    type="text"
                    value={settings.ogImage}
                    onChange={(e) => updateField('ogImage', e.target.value)}
                    placeholder="Leave blank for automatic S&R crest card"
                  />
                </div>
              </div>

              {/* Slot 5: Background Wedding Audio */}
              <div className="media-slot-card" style={{ gridColumn: '1 / -1' }}>
                <div className="media-slot-header">
                  <h4>
                    <Music
                      size={16}
                      style={{ verticalAlign: 'middle', marginRight: '0.4rem' }}
                    />
                    5. Background Wedding Music
                  </h4>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      value={settings.musicEnabled}
                      onChange={(e) =>
                        updateField('musicEnabled', e.target.value)
                      }
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.84rem' }}
                    >
                      <option value="true">Music Enabled</option>
                      <option value="false">Music Disabled</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleResetSlot('musicUrl')}
                      className="btn-ghost"
                    >
                      Reset Default Audio
                    </button>
                  </div>
                </div>

                <div className="audio-preview-box">
                  <span className="muted" style={{ fontSize: '0.82rem' }}>
                    Current Track Preview (starts automatically when guest selects
                    English or Arabic on landing screen):
                  </span>
                  {settings.musicUrl ? (
                    <audio
                      key={settings.musicUrl}
                      controls
                      src={settings.musicUrl}
                    />
                  ) : (
                    <span className="muted">No audio URL configured</span>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '0.85rem',
                    alignItems: 'center'
                  }}
                >
                  <label className="btn-upload" style={{ height: '44px' }}>
                    <Upload size={14} />
                    {uploadingSlot === 'musicUrl'
                      ? 'Uploading Audio...'
                      : 'Upload Song (MP3 / WAV / M4A)'}
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                      hidden
                      disabled={uploadingSlot !== null}
                      onChange={(e) =>
                        handleFileUpload('musicUrl', e.target.files?.[0])
                      }
                    />
                  </label>
                  <input
                    type="text"
                    value={settings.musicUrl}
                    onChange={(e) => updateField('musicUrl', e.target.value)}
                    placeholder="/assets/wedding.wav or https://..."
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================
            TAB 2: FONTS, COLORS & VISUAL THEME CMS
           ==================================================== */}
        {activeTab === 'design' && (
          <section className="admin-panel">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              <div>
                <h3>Fonts, Colors &amp; Theme Styling</h3>
                <p className="muted">
                  Choose English &amp; Arabic typography, accent color palette,
                  and photo overlay darkness.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="btn-primary"
              >
                {savingSettings ? 'Saving...' : 'Save Theme & Fonts'}
              </button>
            </div>

            <div className="settings-grid" style={{ marginTop: '1.25rem' }}>
              <div className="form-group">
                <label>English Serif Display Font (+ Sacramento Script for Names)</label>
                <select
                  value={settings.fontEN}
                  onChange={(e) => updateField('fontEN', e.target.value)}
                >
                  <option value="ptserif">
                    PT Serif + Sacramento Script (Evite Classic)
                  </option>
                  <option value="cormorant">
                    Cormorant Garamond + Sacramento Script
                  </option>
                  <option value="playfair">
                    Playfair Display + Sacramento Script
                  </option>
                  <option value="cinzel">
                    Cinzel + Sacramento Script
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label>Arabic Font (الخط العربي)</label>
                <select
                  value={settings.fontAR}
                  onChange={(e) => updateField('fontAR', e.target.value)}
                >
                  <option value="amiri">Amiri — أميري (Classic Naskh)</option>
                  <option value="notonaskh">
                    Noto Naskh — نوتو نسخ (Refined Formal)
                  </option>
                  <option value="arefruqaa">
                    Aref Ruqaa — عارف رقعة (Calligraphic)
                  </option>
                  <option value="cairo">Cairo — القاهرة (Modern Clean)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Body / Uppercase Sans Font</label>
                <select
                  value={settings.fontBody}
                  onChange={(e) => updateField('fontBody', e.target.value)}
                >
                  <option value="montserrat">Montserrat (Clean Modern Sans)</option>
                  <option value="blinker">Blinker (Evite Geometric Sans)</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Photo Overlay Darkness (
                  {Math.round(Number(settings.overlayOpacity || 0.65) * 100)}%)
                </label>
                <input
                  type="range"
                  min="0.30"
                  max="0.85"
                  step="0.05"
                  value={settings.overlayOpacity || '0.65'}
                  onChange={(e) => updateField('overlayOpacity', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Primary Accent Color</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={settings.accentColor || '#c5a059'}
                    onChange={(e) => updateField('accentColor', e.target.value)}
                    style={{ width: '54px', height: '42px', padding: '4px' }}
                  />
                  <input
                    type="text"
                    value={settings.accentColor}
                    onChange={(e) => updateField('accentColor', e.target.value)}
                    style={{ width: '120px' }}
                  />
                </div>
                <div className="swatch-row">
                  {ACCENT_SWATCHES.map((s) => (
                    <button
                      key={s.hex}
                      type="button"
                      title={s.label}
                      onClick={() => updateField('accentColor', s.hex)}
                      className={`color-swatch ${
                        settings.accentColor.toLowerCase() === s.hex
                          ? 'selected'
                          : ''
                      }`}
                      style={{ background: s.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Page Background Color</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={settings.bgCreamColor || '#faf7f2'}
                    onChange={(e) => updateField('bgCreamColor', e.target.value)}
                    style={{ width: '54px', height: '42px', padding: '4px' }}
                  />
                  <input
                    type="text"
                    value={settings.bgCreamColor}
                    onChange={(e) => updateField('bgCreamColor', e.target.value)}
                    style={{ width: '120px' }}
                  />
                </div>
                <div className="swatch-row">
                  {BG_SWATCHES.map((s) => (
                    <button
                      key={s.hex}
                      type="button"
                      title={s.label}
                      onClick={() => updateField('bgCreamColor', s.hex)}
                      className={`color-swatch ${
                        settings.bgCreamColor.toLowerCase() === s.hex
                          ? 'selected'
                          : ''
                      }`}
                      style={{ background: s.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Live Typography & Theme Preview */}
            <div className="cms-live-preview">
              <span
                style={{
                  display: 'inline-block',
                  border: '1px solid rgba(255,255,255,0.45)',
                  color: '#fff',
                  padding: '0.24rem 0.95rem',
                  borderRadius: '99px',
                  fontSize: '0.72rem',
                  letterSpacing: '0.14em',
                  marginBottom: '0.9rem'
                }}
              >
                LIVE SACRAMENTO + SERIF PREVIEW
              </span>
              <h2
                style={{
                  fontFamily: 'var(--font-sacramento), cursive',
                  fontSize: '3.6rem',
                  fontWeight: 400,
                  color: '#ffffff',
                  lineHeight: 1.1,
                  marginBottom: '0.35rem'
                }}
              >
                {settings.coupleNamesEN}
              </h2>
              <h3
                style={{
                  fontFamily: EN_FONT_CSS[settings.fontEN] || EN_FONT_CSS.ptserif,
                  fontSize: '1.65rem',
                  fontWeight: 400,
                  letterSpacing: '0.08em',
                  color: '#ffffff',
                  marginBottom: '0.35rem'
                }}
              >
                WE ARE TYING THE KNOT
              </h3>
              <h2
                dir="rtl"
                style={{
                  fontFamily: AR_FONT_CSS[settings.fontAR] || AR_FONT_CSS.amiri,
                  fontSize: '2rem',
                  color: '#ebd5a7',
                  marginBottom: '0.5rem'
                }}
              >
                {settings.coupleNamesAR}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>
                {settings.venueNameEN} • {settings.weddingDateEN}
              </p>
            </div>
          </section>
        )}

        {/* ====================================================
            TAB 3: TEXT COPY, UNIFIED VENUE & WHISH MONEY CMS
           ==================================================== */}
        {activeTab === 'content' && (
          <section className="admin-panel">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}
            >
              <div>
                <h3>Invitation Copy, Unified Location &amp; Whish Registry</h3>
                <p className="muted">
                  Edit every heading, date, unified ceremony/reception schedule,
                  Google Maps coordinates, and Whish details.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="btn-primary"
              >
                {savingSettings ? 'Saving...' : 'Save All Content'}
              </button>
            </div>

            {/* 1. Couple, Dates & RSVP Options */}
            <h4 style={{ color: 'var(--gold-dark)', marginTop: '0.5rem' }}>
              1. Couple Names, Dates &amp; Attendance Limit
            </h4>
            <div className="settings-grid">
              <div className="form-group">
                <label>Crest Monogram</label>
                <input
                  type="text"
                  value={settings.monogram}
                  onChange={(e) => updateField('monogram', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Couple Names (EN)</label>
                <input
                  type="text"
                  value={settings.coupleNamesEN}
                  onChange={(e) => updateField('coupleNamesEN', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>أسماء العروسين (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.coupleNamesAR}
                  onChange={(e) => updateField('coupleNamesAR', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Curtain Date Pill</label>
                <input
                  type="text"
                  value={settings.curtainDatePill}
                  onChange={(e) =>
                    updateField('curtainDatePill', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>Wedding Date Display (EN)</label>
                <input
                  type="text"
                  value={settings.weddingDateEN}
                  onChange={(e) => updateField('weddingDateEN', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>تاريخ الزفاف (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.weddingDateAR}
                  onChange={(e) => updateField('weddingDateAR', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Countdown Target ISO (Beirut +02:00)</label>
                <input
                  type="text"
                  value={settings.weddingDateIso}
                  onChange={(e) =>
                    updateField('weddingDateIso', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>RSVP Cutoff ISO</label>
                <input
                  type="text"
                  value={settings.rsvpDeadlineIso}
                  onChange={(e) =>
                    updateField('rsvpDeadlineIso', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>Deadline Text (EN)</label>
                <input
                  type="text"
                  value={settings.rsvpDeadlineEN}
                  onChange={(e) =>
                    updateField('rsvpDeadlineEN', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>نص آخر مهلة (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.rsvpDeadlineAR}
                  onChange={(e) =>
                    updateField('rsvpDeadlineAR', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>Max Additional Guests (+1 up to +N)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.maxPlusGuests}
                  onChange={(e) => updateField('maxPlusGuests', e.target.value)}
                />
              </div>
            </div>

            <hr
              style={{
                border: 'none',
                borderTop: '1px solid #eee7da',
                margin: '1.4rem 0'
              }}
            />

            {/* 2. Hero & Personal Invitation Copy */}
            <h4 style={{ color: 'var(--gold-dark)' }}>
              2. Hero &amp; Personal Invitation Welcome Copy
            </h4>
            <div className="settings-grid">
              <div className="form-group">
                <label>Hero Eyebrow (EN)</label>
                <input
                  type="text"
                  value={settings.heroEyebrowEN}
                  onChange={(e) => updateField('heroEyebrowEN', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>مقدمة الدعوة (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.heroEyebrowAR}
                  onChange={(e) => updateField('heroEyebrowAR', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Hero Invitation Sentence (EN)</label>
                <textarea
                  rows={2}
                  value={settings.heroLeadEN}
                  onChange={(e) => updateField('heroLeadEN', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>نص الدعوة الرئيسي (AR)</label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={settings.heroLeadAR}
                  onChange={(e) => updateField('heroLeadAR', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Personal Greeting Heading (EN)</label>
                <input
                  type="text"
                  value={settings.guestTitleDefaultEN}
                  onChange={(e) =>
                    updateField('guestTitleDefaultEN', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>عنوان الترحيب بالضيف (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.guestTitleDefaultAR}
                  onChange={(e) =>
                    updateField('guestTitleDefaultAR', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>Personal Greeting Text (EN)</label>
                <textarea
                  rows={2}
                  value={settings.guestBodyEN}
                  onChange={(e) => updateField('guestBodyEN', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>رسالة الترحيب (AR)</label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={settings.guestBodyAR}
                  onChange={(e) => updateField('guestBodyAR', e.target.value)}
                />
              </div>
            </div>

            <hr
              style={{
                border: 'none',
                borderTop: '1px solid #eee7da',
                margin: '1.4rem 0'
              }}
            />

            {/* 3. Unified Ceremony & Reception Location */}
            <h4 style={{ color: 'var(--gold-dark)' }}>
              3. Unified Ceremony &amp; Reception Location
            </h4>
            <div className="settings-grid">
              <div className="form-group">
                <label>Venue Name (EN)</label>
                <input
                  type="text"
                  value={settings.venueNameEN}
                  onChange={(e) => updateField('venueNameEN', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>اسم المكان / الكنيسة (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.venueNameAR}
                  onChange={(e) => updateField('venueNameAR', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Address / Subtitle (EN)</label>
                <input
                  type="text"
                  value={settings.venueAddressEN}
                  onChange={(e) =>
                    updateField('venueAddressEN', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>العنوان / المنطقة (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.venueAddressAR}
                  onChange={(e) =>
                    updateField('venueAddressAR', e.target.value)
                  }
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Google Maps Share Link</label>
                <input
                  type="url"
                  value={settings.locationMapUrl}
                  onChange={(e) =>
                    updateField('locationMapUrl', e.target.value)
                  }
                  placeholder="https://maps.app.goo.gl/..."
                />
              </div>
              <div className="form-group">
                <label>Latitude (for Embedded Map)</label>
                <input
                  type="text"
                  value={settings.locationLat}
                  onChange={(e) => updateField('locationLat', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Longitude (for Embedded Map)</label>
                <input
                  type="text"
                  value={settings.locationLng}
                  onChange={(e) => updateField('locationLng', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Interactive Embedded Map</label>
                <select
                  value={settings.showEmbeddedMap}
                  onChange={(e) =>
                    updateField('showEmbeddedMap', e.target.value)
                  }
                >
                  <option value="true">Shown inside Location Card</option>
                  <option value="false">Hidden (Button Only)</option>
                </select>
              </div>
            </div>

            <div className="settings-grid">
              <div className="form-group">
                <label>Ceremony Label (EN)</label>
                <input
                  type="text"
                  value={settings.ceremonyTitleEN}
                  onChange={(e) =>
                    updateField('ceremonyTitleEN', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>عنوان الإكليل (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.ceremonyTitleAR}
                  onChange={(e) =>
                    updateField('ceremonyTitleAR', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>Ceremony Time (EN)</label>
                <input
                  type="text"
                  value={settings.ceremonyTimeEN}
                  onChange={(e) =>
                    updateField('ceremonyTimeEN', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>وقت الإكليل (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.ceremonyTimeAR}
                  onChange={(e) =>
                    updateField('ceremonyTimeAR', e.target.value)
                  }
                />
              </div>

              <div className="form-group">
                <label>Show Reception Time Slot</label>
                <select
                  value={settings.showReceptionSchedule}
                  onChange={(e) =>
                    updateField('showReceptionSchedule', e.target.value)
                  }
                >
                  <option value="true">Visible</option>
                  <option value="false">Hidden</option>
                </select>
              </div>
              <div className="form-group">
                <label>Reception Label (EN)</label>
                <input
                  type="text"
                  value={settings.receptionTitleEN}
                  onChange={(e) =>
                    updateField('receptionTitleEN', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>عنوان الاستقبال (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.receptionTitleAR}
                  onChange={(e) =>
                    updateField('receptionTitleAR', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>Reception Time (EN)</label>
                <input
                  type="text"
                  value={settings.receptionTimeEN}
                  onChange={(e) =>
                    updateField('receptionTimeEN', e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label>وقت الاستقبال (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.receptionTimeAR}
                  onChange={(e) =>
                    updateField('receptionTimeAR', e.target.value)
                  }
                />
              </div>
            </div>

            <hr
              style={{
                border: 'none',
                borderTop: '1px solid #eee7da',
                margin: '1.4rem 0'
              }}
            />

            {/* 4. Whish Money Gift Registry */}
            <h4 style={{ color: '#e31c3d' }}>4. Whish Money Gift Registry</h4>
            <div className="settings-grid">
              <div className="form-group">
                <label>Whish Registry Card</label>
                <select
                  value={settings.whishEnabled}
                  onChange={(e) => updateField('whishEnabled', e.target.value)}
                >
                  <option value="true">Visible on Invitation</option>
                  <option value="false">Hidden</option>
                </select>
              </div>
              <div className="form-group">
                <label>Whish Account Number</label>
                <input
                  type="text"
                  value={settings.whishNumber}
                  onChange={(e) => updateField('whishNumber', e.target.value)}
                  placeholder="+961 70 123 456"
                />
              </div>
              <div className="form-group">
                <label>Whish Payment Link</label>
                <input
                  type="url"
                  value={settings.whishLink}
                  onChange={(e) => updateField('whishLink', e.target.value)}
                  placeholder="https://whish.money/..."
                />
              </div>
              <div className="form-group">
                <label>Gift Title (EN)</label>
                <input
                  type="text"
                  value={settings.whishTitleEN}
                  onChange={(e) => updateField('whishTitleEN', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>عنوان الهدية (AR)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={settings.whishTitleAR}
                  onChange={(e) => updateField('whishTitleAR', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Gift Message (EN)</label>
                <textarea
                  rows={2}
                  value={settings.whishTextEN}
                  onChange={(e) => updateField('whishTextEN', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>رسالة هدية الزفاف (AR)</label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={settings.whishTextAR}
                  onChange={(e) => updateField('whishTextAR', e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="btn-primary"
              style={{ marginTop: '0.5rem' }}
            >
              {savingSettings ? 'Saving...' : 'Save All Content'}
            </button>
          </section>
        )}

        {/* ====================================================
            TAB 4: GUEST LIST, RSVPS & WHATSAPP INVITES
           ==================================================== */}
        {activeTab === 'guests' && (
          <>
            <section className="admin-panel">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}
              >
                <div>
                  <h3>
                    {editingExisting
                      ? `Editing Guest (${gCode})`
                      : 'Optional: Pre-Create Named Guest Link'}
                  </h3>
                  <p className="muted">
                    Guests can RSVP directly via your general WhatsApp link (
                    <code>{buildInviteUrl()}</code>), or you can create
                    named VIP links below.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => handleCopyLink('general', buildInviteUrl())}
                  >
                    {copiedCode === 'general'
                      ? 'General Link Copied ✓'
                      : 'Copy General Invite Link'}
                  </button>
                  {editingExisting && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setEditingExisting(false);
                        setGCode('');
                        setGNameEN('');
                        setGNameAR('');
                        setGSeats(5);
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={handleSaveGuest} className="guest-form-grid">
                <div className="form-group">
                  <label>Code</label>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <input
                      type="text"
                      value={gCode}
                      onChange={(e) => setGCode(e.target.value)}
                      placeholder="e.g. 9j3"
                      required
                      style={{ width: '100%' }}
                    />
                    <button
                      type="button"
                      title="Generate random code"
                      className="btn-ghost"
                      onClick={() => setGCode(generateRandomCode())}
                    >
                      <Sparkles size={15} />
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Guest Name (English)</label>
                  <input
                    type="text"
                    value={gNameEN}
                    onChange={(e) => setGNameEN(e.target.value)}
                    placeholder="e.g. Sako & Aimee"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>الاسم بالعربي (Arabic)</label>
                  <input
                    type="text"
                    dir="rtl"
                    value={gNameAR}
                    onChange={(e) => setGNameAR(e.target.value)}
                    placeholder="مثال: ساكو وإيمي"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Max Seats</label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={gSeats}
                    onChange={(e) => setGSeats(Number(e.target.value))}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingGuest}
                  className="btn-primary"
                  style={{ height: '44px' }}
                >
                  {savingGuest
                    ? 'Saving...'
                    : editingExisting
                      ? 'Update Guest'
                      : 'Save Guest'}
                </button>
              </form>
            </section>

            <section className="admin-panel">
              <div className="table-toolbar">
                <h3>RSVPs &amp; Guest List</h3>
                <div className="toolbar-controls">
                  <input
                    type="search"
                    placeholder="Search name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <select
                    value={filterStatus}
                    onChange={(e) =>
                      setFilterStatus(e.target.value as 'ALL' | RsvpStatus)
                    }
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Confirmed">Confirmed Only</option>
                    <option value="Declined">Declined Only</option>
                    <option value="Pending">Pending Only</option>
                  </select>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={refreshDashboard}
                    title="Refresh RSVPs"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Guest Name</th>
                      <th>الاسم</th>
                      <th>Status</th>
                      <th>Attending</th>
                      <th>Share</th>
                      <th>Wishes</th>
                      <th>Updated</th>
                      <th>Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGuests.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          style={{ textAlign: 'center', padding: '2rem' }}
                          className="muted"
                        >
                          No entries match the current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredGuests.map((g) => (
                        <tr key={g.code}>
                          <td>
                            <strong>{g.code}</strong>
                          </td>
                          <td>{g.nameEN}</td>
                          <td
                            dir="rtl"
                            style={{
                              fontFamily: 'var(--font-amiri), serif',
                              fontSize: '1.05rem'
                            }}
                          >
                            {g.nameAR}
                          </td>
                          <td>
                            <span className={`status-tag ${g.status}`}>
                              {g.status}
                            </span>
                          </td>
                          <td>
                            {g.status === 'Confirmed' ? (
                              <strong>
                                {g.attendingSeats}{' '}
                                {g.attendingSeats > 1
                                  ? `(You +${g.attendingSeats - 1})`
                                  : '(Solo)'}
                              </strong>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td>
                            <div className="action-cell">
                              <a
                                href={buildWhatsAppShareUrl(g)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-sm btn-whatsapp"
                              >
                                <Send size={12} /> WhatsApp
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyLink(g.code, buildInviteUrl(g.code))
                                }
                                className="btn-sm btn-link"
                              >
                                {copiedCode === g.code ? (
                                  <>
                                    <Check size={12} /> Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} /> Link
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                          <td style={{ maxWidth: '220px' }}>
                            {g.message || '—'}
                          </td>
                          <td>
                            {g.updatedAt ? g.updatedAt.slice(0, 10) : '—'}
                          </td>
                          <td>
                            <div className="action-cell">
                              <button
                                type="button"
                                onClick={() => handleEditRow(g)}
                                className="btn-sm btn-link"
                                title="Edit guest"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(g.code)}
                                className="btn-sm btn-danger-sm"
                                title="Delete guest"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
