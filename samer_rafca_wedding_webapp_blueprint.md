# Project Specification: Samer & Rafca Bilingual Wedding Invitation Webapp

## 1. Overview & Architecture

* **Target Hosting:** Vercel (`https://samer-and-rafca.vercel.app`)
* **Stack:** Zero-dependency static HTML5, CSS3, Vanilla JavaScript + Google Apps Script (`Code.gs`) connected to Google Sheets.
* **Languages:** Simultaneous Bilingual English (`dir="ltr"`, Cormorant Garamond) and Arabic (`dir="rtl"`, Amiri) displayed side-by-side on desktop and cleanly stacked on mobile.
* **Key Features:**
  * Interactive opening envelope curtain that unlocks mobile browser audio autoplay for background wedding music with a floating mute/unmute toggle.
  * Personalized guest invitations via URL parameter `?g=<code>` (e.g., `/?g=9j3`), loading guest names (EN/AR), allotted seats, and prior RSVP responses from Google Sheets.
  * Hard RSVP edit deadline enforced on both client and server: **15-December-2026 (`2026-12-15T23:59:59+02:00`)**, clearly displayed in both languages and automatically locking edits after the deadline.
  * Prominent **Whish Money** gift registry card with one-tap account number copy and direct Whish Money payment link, configurable from the Admin dashboard.
  * Password-protected Admin Dashboard (`admin.html`) using credentials `SamRebecca2027` / `SamRebecca@2027` to manage guests, customize background images/music/Whish settings, send one-click bilingual WhatsApp invitations, and export a multi-sheet `.xlsx` Excel workbook with live stats via SheetJS.

## 2. Directory Structure

Create the following files in the project root:

```text
samer-and-rafca/
├── Code.gs           # Google Apps Script backend (paste into Google Sheets > Extensions > Apps Script)
├── index.html        # Public bilingual wedding invitation page
├── admin.html        # Protected backend dashboard + media customizer + Excel exporter
├── style.css         # Responsive bilingual styling, parallax backgrounds & Whish Money UI
├── app.js            # Front-end logic, Google Sheets sync, deadline lock, WhatsApp share & XLSX export
└── assets/
    ├── bg-hero.jpg   # Default Hero background photo
    ├── bg-venue.jpg  # Default RSVP/Venue background photo
    └── wedding.mp3   # Default romantic instrumental background music
```

## 3. Google Sheets & Apps Script Setup

1. Create a new Google Spreadsheet with two tabs named **`Guests`** and **`Settings`**.
2. In **`Guests`**, set Row 1 headers to:
   `Code` | `GuestNameEN` | `GuestNameAR` | `MaxSeats` | `Status` | `AttendingSeats` | `Message` | `UpdatedAt`
   *(Sample Row 2: `9j3` | `Sako & Aimee` | `ساكو وإيمي` | `2` | `Pending` | `0` | `` | ``)*
3. In **`Settings`**, set Row 1 headers to:
   `Key` | `Value`
   * Row 2: `bgHero` | `assets/bg-hero.jpg`
   * Row 3: `bgVenue` | `assets/bg-venue.jpg`
   * Row 4: `musicUrl` | `assets/wedding.mp3`
   * Row 5: `whishNumber` | `+961 70 123 456`
   * Row 6: `whishLink` | `https://whish.money`
4. Open **Extensions > Apps Script**, paste `Code.gs` below, and click **Deploy > New deployment > Web app** (**Execute as: Me**, **Who has access: Anyone**).
5. Copy the resulting `/exec` Web App URL and set `APPS_SCRIPT_URL` at the top of `app.js`.

## 4. Complete Source Files

### File 1: `Code.gs` (Google Apps Script Backend)

```javascript
const SHEET_GUESTS = 'Guests';
const SHEET_SETTINGS = 'Settings';
const DEADLINE_ISO = '2026-12-15T23:59:59+02:00'; // 15 December 2026 (Beirut Time)

const ADMIN_USER = 'SamRebecca2027';
const ADMIN_PASS = 'SamRebecca@2027';

function doGet(e) {
  const action = (e.parameter.action || 'guest').toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'settings') {
    return jsonResponse({ ok: true, settings: getSettingsMap(ss) });
  }

  if (action === 'guest') {
    const code = (e.parameter.g || '').trim();
    const settings = getSettingsMap(ss);
    if (!code) {
      return jsonResponse({ ok: true, guest: null, settings, deadline: DEADLINE_ISO });
    }
    const guest = findGuestByCode(ss, code);
    return jsonResponse({ ok: true, guest, settings, deadline: DEADLINE_ISO });
  }

  return jsonResponse({ ok: false, error: 'Invalid action' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'rsvp';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Public Guest RSVP Submission / Edit (enforces 15-Dec-2026 deadline)
    if (action === 'rsvp') {
      const now = new Date();
      const deadline = new Date(DEADLINE_ISO);
      if (now > deadline) {
        return jsonResponse({ ok: false, error: 'DEADLINE_PASSED' });
      }

      const sheet = ss.getSheetByName(SHEET_GUESTS);
      const data = sheet.getDataRange().getValues();
      const code = String(body.code || '').trim();

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim().toLowerCase() === code.toLowerCase()) {
          const maxSeats = Number(data[i][3]) || 1;
          const status = body.status === 'Confirmed' ? 'Confirmed' : 'Declined';
          const seats = status === 'Confirmed'
            ? Math.min(Math.max(1, Number(body.attendingSeats) || 1), maxSeats)
            : 0;

          sheet.getRange(i + 1, 5).setValue(status);
          sheet.getRange(i + 1, 6).setValue(seats);
          sheet.getRange(i + 1, 7).setValue(String(body.message || '').slice(0, 500));
          sheet.getRange(i + 1, 8).setValue(now.toISOString());

          return jsonResponse({ ok: true, status, attendingSeats: seats });
        }
      }
      return jsonResponse({ ok: false, error: 'GUEST_NOT_FOUND' });
    }

    // 2. Protected Admin Actions
    if (body.username !== ADMIN_USER || body.password !== ADMIN_PASS) {
      return jsonResponse({ ok: false, error: 'UNAUTHORIZED' });
    }

    if (action === 'admin_dashboard') {
      const sheet = ss.getSheetByName(SHEET_GUESTS);
      const rows = sheet.getDataRange().getValues();
      const guests = [];
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][0]) continue;
        guests.push({
          code: String(rows[i][0]),
          nameEN: String(rows[i][1]),
          nameAR: String(rows[i][2]),
          maxSeats: Number(rows[i][3]) || 1,
          status: String(rows[i][4] || 'Pending'),
          attendingSeats: Number(rows[i][5]) || 0,
          message: String(rows[i][6] || ''),
          updatedAt: String(rows[i][7] || '')
        });
      }
      return jsonResponse({ ok: true, guests, settings: getSettingsMap(ss) });
    }

    if (action === 'admin_upsert_guest') {
      const sheet = ss.getSheetByName(SHEET_GUESTS);
      const rows = sheet.getDataRange().getValues();
      const g = body.guest;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim().toLowerCase() === String(g.code).trim().toLowerCase()) {
          sheet.getRange(i + 1, 2, 1, 5).setValues([[
            g.nameEN, g.nameAR, Number(g.maxSeats) || 1, g.status || 'Pending', Number(g.attendingSeats) || 0
          ]]);
          return jsonResponse({ ok: true });
        }
      }
      sheet.appendRow([
        g.code.trim(), g.nameEN, g.nameAR, Number(g.maxSeats) || 1,
        g.status || 'Pending', Number(g.attendingSeats) || 0, '', new Date().toISOString()
      ]);
      return jsonResponse({ ok: true });
    }

    if (action === 'admin_save_settings') {
      const sheet = ss.getSheetByName(SHEET_SETTINGS);
      const rows = sheet.getDataRange().getValues();
      const updates = body.settings || {};
      Object.keys(updates).forEach(key => {
        let found = false;
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][0] === key) {
            sheet.getRange(i + 1, 2).setValue(updates[key]);
            found = true;
            break;
          }
        }
        if (!found) sheet.appendRow([key, updates[key]]);
      });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function findGuestByCode(ss, code) {
  const rows = ss.getSheetByName(SHEET_GUESTS).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === code.toLowerCase()) {
      return {
        code: String(rows[i][0]),
        nameEN: String(rows[i][1]),
        nameAR: String(rows[i][2]),
        maxSeats: Number(rows[i][3]) || 1,
        status: String(rows[i][4] || 'Pending'),
        attendingSeats: Number(rows[i][5]) || 0,
        message: String(rows[i][6] || '')
      };
    }
  }
  return null;
}

function getSettingsMap(ss) {
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return {};
  const rows = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) map[String(rows[i][0])] = String(rows[i][1] || '');
  }
  return map;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### File 2: `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Samer &amp; Rafca — Wedding Invitation | دعوة زفاف سامر ورفقا</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <!-- Background Music Player -->
  <audio id="bgMusic" loop preload="auto">
    <source id="bgMusicSource" src="assets/wedding.mp3" type="audio/mpeg" />
  </audio>

  <button id="musicToggle" class="music-btn" aria-label="Toggle Wedding Music" title="Music / الموسيقى">
    <span id="musicIcon">♪</span>
  </button>

  <!-- Luxury Envelope Opening Curtain -->
  <div id="curtain" class="curtain">
    <div class="curtain-card glass-card">
      <p class="monogram">S &amp; R</p>
      <p class="bilingual-sub">
        <span class="en">Together with their families</span>
        <span class="divider">•</span>
        <span class="ar" dir="rtl">بمباركة الأهل</span>
      </p>
      <h1 class="couple-names">Samer &amp; Rafca<br /><span class="ar-title" dir="rtl">سامر ورفقا</span></h1>
      <p class="date-pill">03 • 01 • 2027</p>
      <button id="openInviteBtn" class="btn-primary">
        <span>Open Invitation</span>
        <span class="ar" dir="rtl">افتح الدعوة</span>
      </button>
    </div>
  </div>

  <!-- Hero Section with Customizable Background -->
  <header id="heroSection" class="parallax-section hero-bg">
    <div class="overlay"></div>
    <div class="container hero-content">
      <div class="bilingual-grid">
        <div class="lang-col en-col" lang="en" dir="ltr">
          <p class="eyebrow">WE JOYFULLY INVITE YOU</p>
          <h2>Samer &amp; Rafca</h2>
          <p class="lead">To celebrate the beginning of our forever on<br /><strong>Sunday, January 3, 2027</strong></p>
        </div>
        <div class="lang-col ar-col" lang="ar" dir="rtl">
          <p class="eyebrow">يسرّنا دعوتكم لمشاركتنا فرحتنا</p>
          <h2>سامر ورفقا</h2>
          <p class="lead">للاحتفال ببداية حياتنا معاً يوم<br /><strong>الأحد ٣ كانون الثاني ٢٠٢٧</strong></p>
        </div>
      </div>

      <!-- Live Countdown -->
      <div id="countdown" class="countdown-bar glass-card">
        <div class="cd-box"><span id="cdDays">00</span><small>Days / أيام</small></div>
        <div class="cd-box"><span id="cdHours">00</span><small>Hours / ساعات</small></div>
        <div class="cd-box"><span id="cdMins">00</span><small>Mins / دقائق</small></div>
        <div class="cd-box"><span id="cdSecs">00</span><small>Secs / ثوانٍ</small></div>
      </div>
    </div>
  </header>

  <!-- Personalized Guest Welcome, Event Details & Whish Money -->
  <main>
    <section class="section-light">
      <div class="container">
        <div id="guestBanner" class="guest-card glass-light">
          <div class="bilingual-grid">
            <div class="lang-col en-col" lang="en" dir="ltr">
              <span class="badge">Personal Invitation</span>
              <h3 id="guestNameEN">Honored Guest</h3>
              <p id="seatsInfoEN">We have reserved seats in your honor.</p>
            </div>
            <div class="lang-col ar-col" lang="ar" dir="rtl">
              <span class="badge">دعوة خاصة</span>
              <h3 id="guestNameAR">ضيفنا الكريم</h3>
              <p id="seatsInfoAR">يسعدنا تشريفكم وحضوركم.</p>
            </div>
          </div>
        </div>

        <!-- Ceremony & Reception Cards -->
        <div class="events-grid">
          <article class="event-card">
            <div class="bilingual-grid">
              <div class="lang-col en-col" lang="en" dir="ltr">
                <h4>Wedding Ceremony</h4>
                <p class="time">4:00 PM</p>
                <p class="venue">Church / Ceremony Venue, Mount Lebanon</p>
              </div>
              <div class="lang-col ar-col" lang="ar" dir="rtl">
                <h4>إكليل الزواج</h4>
                <p class="time">الساعة ٤:٠٠ بعد الظهر</p>
                <p class="venue">الكنيسة، جبل لبنان</p>
              </div>
            </div>
            <a href="https://maps.google.com" target="_blank" rel="noopener" class="btn-outline">
              <span>View on Google Maps</span> • <span dir="rtl">الموقع على الخريطة</span>
            </a>
          </article>

          <article class="event-card">
            <div class="bilingual-grid">
              <div class="lang-col en-col" lang="en" dir="ltr">
                <h4>Dinner Reception</h4>
                <p class="time">7:30 PM</p>
                <p class="venue">Banquet Venue, Hadath / Baabda</p>
              </div>
              <div class="lang-col ar-col" lang="ar" dir="rtl">
                <h4>حفل العشاء</h4>
                <p class="time">الساعة ٧:٣٠ مساءً</p>
                <p class="venue">صالة الاحتفال، الحدث / بعبدا</p>
              </div>
            </div>
            <a href="https://maps.google.com" target="_blank" rel="noopener" class="btn-outline">
              <span>View on Google Maps</span> • <span dir="rtl">الموقع على الخريطة</span>
            </a>
          </article>
        </div>

        <!-- Wedding Gift / Whish Money Card -->
        <div class="whish-card glass-light">
          <div class="whish-badge-row">
            <span class="whish-pill">WHISH MONEY</span>
          </div>

          <div class="bilingual-grid">
            <div class="lang-col en-col" lang="en" dir="ltr">
              <h4>Wedding Gift Registry</h4>
              <p>Your presence at our wedding is the greatest gift of all. Should you wish to honor us with a contribution, you can send it easily via <strong>Whish Money</strong>:</p>
            </div>
            <div class="lang-col ar-col" lang="ar" dir="rtl">
              <h4>هدية الزفاف</h4>
              <p>حضوركم ومشاركتكم فرحتنا هما أجمل هدية. ولمن يرغب بتقديم هدية نقدية، يمكنكم إرسالها بسهولة عبر تطبيق <strong>Whish Money</strong>:</p>
            </div>
          </div>

          <div class="whish-action-bar">
            <div class="whish-account-box">
              <small>Whish Account Number / رقم حساب ويش</small>
              <strong id="displayWhishNumber" dir="ltr">+961 70 123 456</strong>
            </div>

            <div class="whish-buttons">
              <button type="button" id="copyWhishBtn" class="btn-whish-copy">
                <span id="copyWhishText">Copy Number • نسخ الرقم</span>
              </button>
              <a id="openWhishAppBtn" href="https://whish.money" target="_blank" rel="noopener" class="btn-whish-pay">
                <span>Pay via Whish • الدفع عبر ويش</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- RSVP Section with Second Customizable Background -->
    <section id="venueSection" class="parallax-section venue-bg">
      <div class="overlay"></div>
      <div class="container">
        <div class="rsvp-wrapper glass-card">
          <div class="bilingual-grid">
            <div class="lang-col en-col" lang="en" dir="ltr">
              <h3>Confirm Your Attendance</h3>
              <p class="deadline-notice">
                ⏳ You can submit or edit your response anytime until <strong>15 December 2026</strong>.
              </p>
            </div>
            <div class="lang-col ar-col" lang="ar" dir="rtl">
              <h3>تأكيد الحضور</h3>
              <p class="deadline-notice">
                ⏳ يمكنكم تأكيد أو تعديل ردّكم لغاية <strong>١٥ كانون الأول ٢٠٢٦</strong>.
              </p>
            </div>
          </div>

          <div id="rsvpStatusBanner" class="status-pill hidden"></div>

          <form id="rsvpForm" class="rsvp-form">
            <div class="form-row">
              <label class="radio-card">
                <input type="radio" name="status" value="Confirmed" checked />
                <span>Joyfully Accept • <span dir="rtl">سأحضر بكل سرور</span></span>
              </label>
              <label class="radio-card">
                <input type="radio" name="status" value="Declined" />
                <span>Regretfully Decline • <span dir="rtl">أعتذر عن الحضور</span></span>
              </label>
            </div>

            <div id="seatsSelectGroup" class="form-group">
              <label for="attendingSeats">
                Number of Guests Attending / <span dir="rtl">عدد الأشخاص الحاضرين</span>
              </label>
              <select id="attendingSeats" name="attendingSeats"></select>
            </div>

            <div class="form-group">
              <label for="guestMessage">
                Wishes for the Couple (Optional) / <span dir="rtl">كلمة للعروسين (اختياري)</span>
              </label>
              <textarea id="guestMessage" rows="3" placeholder="Write your wishes... / اكتب تهنئتك هنا..."></textarea>
            </div>

            <button type="submit" id="submitRsvpBtn" class="btn-primary full-width">
              <span>Save Confirmation</span> • <span dir="rtl">حفظ التأكيد</span>
            </button>
          </form>

          <div id="lockedBanner" class="locked-box hidden">
            <p>RSVP editing closed on <strong>15 December 2026</strong>. Please contact the couple directly for changes.</p>
            <p dir="rtl">أُغلق باب تعديل تأكيد الحضور بتاريخ <strong>١٥ كانون الأول ٢٠٢٦</strong>. يرجى التواصل مع العروسين مباشرةً.</p>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <p>Samer &amp; Rafca • 03.01.2027</p>
    <a href="admin.html" class="admin-link">Admin</a>
  </footer>

  <script src="app.js"></script>
</body>
</html>
```

### File 3: `admin.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wedding Admin — Samer &amp; Rafca</title>
  <link rel="stylesheet" href="style.css" />
  <!-- Official SheetJS CDN for Excel (.xlsx) Export -->
  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
</head>
<body class="admin-body">
  <!-- Login Gate -->
  <div id="loginBox" class="admin-login-wrap">
    <form id="adminLoginForm" class="glass-light admin-card">
      <h2>Samer &amp; Rafca — Admin</h2>
      <p class="muted">Sign in to manage RSVPs, backgrounds, Whish Pay, and Excel exports</p>
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="adminUser" required autocomplete="username" />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="adminPass" required autocomplete="current-password" />
      </div>
      <p id="loginError" class="error-text hidden">Invalid username or password.</p>
      <button type="submit" class="btn-primary full-width">Sign In</button>
      <p style="margin-top:1rem;text-align:center;"><a href="index.html">← Back to Invitation</a></p>
    </form>
  </div>

  <!-- Dashboard Content -->
  <div id="dashboard" class="container admin-dashboard hidden">
    <div class="admin-header">
      <div>
        <h1>Wedding RSVP &amp; Media Manager</h1>
        <p class="muted">Edit Cutoff: <strong>15 December 2026</strong></p>
      </div>
      <div class="admin-actions">
        <button id="exportExcelBtn" class="btn-primary">⬇ Download Excel (.xlsx)</button>
        <button id="logoutBtn" class="btn-outline-dark">Logout</button>
      </div>
    </div>

    <!-- Live Statistics Cards -->
    <div class="stats-grid">
      <div class="stat-card"><span>Total Invited Families</span><strong id="statFamilies">0</strong></div>
      <div class="stat-card"><span>Total Allotted Seats</span><strong id="statAllotted">0</strong></div>
      <div class="stat-card confirmed"><span>Confirmed Seats</span><strong id="statConfirmed">0</strong></div>
      <div class="stat-card declined"><span>Declined Families</span><strong id="statDeclined">0</strong></div>
      <div class="stat-card pending"><span>Pending Families</span><strong id="statPending">0</strong></div>
    </div>

    <!-- Customize Background Images, Music & Whish Pay -->
    <section class="admin-panel">
      <h3>Customize Background Images, Music &amp; Whish Money</h3>
      <p class="muted">Paste any direct image URL (or local path like <code>assets/bg-hero.jpg</code>) and Whish Money account details.</p>
      <div class="settings-grid">
        <div class="form-group">
          <label>Hero Background Image URL</label>
          <input type="text" id="setBgHero" placeholder="https://... or assets/bg-hero.jpg" />
        </div>
        <div class="form-group">
          <label>RSVP / Venue Background Image URL</label>
          <input type="text" id="setBgVenue" placeholder="https://... or assets/bg-venue.jpg" />
        </div>
        <div class="form-group">
          <label>Background Music MP3 URL</label>
          <input type="text" id="setMusicUrl" placeholder="assets/wedding.mp3" />
        </div>
        <div class="form-group">
          <label>Whish Money Number</label>
          <input type="text" id="setWhishNumber" placeholder="+961 70 123 456" />
        </div>
        <div class="form-group">
          <label>Whish Direct Payment Link (Optional)</label>
          <input type="text" id="setWhishLink" placeholder="https://whish.money/..." />
        </div>
      </div>
      <button id="saveSettingsBtn" class="btn-primary">Save Settings</button>
      <span id="settingsSavedMsg" class="saved-badge hidden">Saved to Google Sheets ✓</span>
    </section>

    <!-- Add / Update Guest -->
    <section class="admin-panel">
      <h3>Add or Edit Guest Invite</h3>
      <form id="addGuestForm" class="guest-form-grid">
        <input type="text" id="gCode" placeholder="Code (e.g. 9j3)" required />
        <input type="text" id="gNameEN" placeholder="English Name (e.g. Sako & Aimee)" required />
        <input type="text" id="gNameAR" dir="rtl" placeholder="الاسم بالعربي (مثال: ساكو وإيمي)" required />
        <input type="number" id="gSeats" min="1" max="15" value="2" placeholder="Max Seats" required />
        <button type="submit" class="btn-primary">Save Guest</button>
      </form>
    </section>

    <!-- Filterable Confirmation Table -->
    <section class="admin-panel">
      <div class="table-toolbar">
        <h3>Guest List &amp; Confirmations</h3>
        <select id="filterStatus">
          <option value="ALL">All Statuses</option>
          <option value="Confirmed">Confirmed Only</option>
          <option value="Declined">Declined Only</option>
          <option value="Pending">Pending Only</option>
        </select>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name (EN)</th>
              <th>الاسم (AR)</th>
              <th>Status</th>
              <th>Seats</th>
              <th>Actions</th>
              <th>Message</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody id="guestsTableBody"></tbody>
        </table>
      </div>
    </section>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

### File 4: `style.css`

```css
:root {
  --gold: #c5a059;
  --gold-dark: #9e7b38;
  --cream: #faf7f2;
  --charcoal: #1e1d1b;
  --glass-dark: rgba(20, 18, 16, 0.68);
  --glass-light: rgba(255, 255, 255, 0.92);
  --font-en-serif: 'Cormorant Garamond', Georgia, serif;
  --font-ar-serif: 'Amiri', Georgia, serif;
  --font-sans: 'Montserrat', sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  color: var(--charcoal);
  background: var(--cream);
  line-height: 1.6;
  overflow-x: hidden;
}

.container { width: min(1100px, 92%); margin: 0 auto; }

/* Music Toggle Button */
.music-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--gold);
  background: var(--glass-dark);
  color: #fff;
  font-size: 1.3rem;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: transform 0.25s ease;
}
.music-btn.playing { animation: pulseGold 2.5s infinite; background: var(--gold); }
@keyframes pulseGold {
  0%, 100% { box-shadow: 0 0 0 0 rgba(197, 160, 89, 0.6); }
  50% { box-shadow: 0 0 0 12px rgba(197, 160, 89, 0); }
}

/* Opening Envelope Curtain */
.curtain {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: radial-gradient(circle at center, #2d2720 0%, #12100e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  transition: opacity 0.8s ease, visibility 0.8s ease;
}
.curtain.opened { opacity: 0; visibility: hidden; pointer-events: none; }
.curtain-card { text-align: center; max-width: 480px; width: 100%; padding: 2.5rem 2rem; color: #fff; }
.monogram { font-family: var(--font-en-serif); font-size: 1.5rem; letter-spacing: 0.3em; color: var(--gold); }
.couple-names { font-family: var(--font-en-serif); font-size: clamp(2.2rem, 6vw, 3.2rem); margin: 0.8rem 0; font-weight: 600; }
.ar-title { font-family: var(--font-ar-serif); font-size: clamp(2rem, 5vw, 2.8rem); color: var(--gold); }
.date-pill { letter-spacing: 0.25em; margin-bottom: 1.5rem; font-size: 0.95rem; opacity: 0.9; }

/* Parallax Background Sections */
.parallax-section {
  position: relative;
  min-height: 92vh;
  display: flex;
  align-items: center;
  padding: 5rem 0;
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  color: #fff;
}
@media (max-width: 768px) {
  .parallax-section { background-attachment: scroll; min-height: auto; }
}
.hero-bg { background-image: url('assets/bg-hero.jpg'); }
.venue-bg { background-image: url('assets/bg-venue.jpg'); }
.overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(15,13,11,0.55), rgba(15,13,11,0.75)); }
.hero-content, .rsvp-wrapper { position: relative; z-index: 2; }

/* Glass Cards */
.glass-card {
  background: var(--glass-dark);
  border: 1px solid rgba(197, 160, 89, 0.45);
  border-radius: 18px;
  backdrop-filter: blur(12px);
  padding: 2.2rem;
}
.glass-light {
  background: var(--glass-light);
  border: 1px solid rgba(197, 160, 89, 0.35);
  border-radius: 18px;
  padding: 2rem;
  box-shadow: 0 12px 35px rgba(0,0,0,0.06);
}

/* Simultaneous Bilingual Layout */
.bilingual-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: center;
}
.en-col { text-align: left; border-right: 1px solid rgba(197, 160, 89, 0.35); padding-right: 1.5rem; }
.ar-col { text-align: right; font-family: var(--font-ar-serif); font-size: 1.15rem; }
.en-col h2, .en-col h3, .en-col h4 { font-family: var(--font-en-serif); font-size: clamp(1.8rem, 4vw, 2.8rem); }
.ar-col h2, .ar-col h3, .ar-col h4 { font-family: var(--font-ar-serif); font-size: clamp(1.8rem, 4vw, 2.6rem); }
.eyebrow { letter-spacing: 0.18em; font-size: 0.78rem; color: var(--gold); text-transform: uppercase; }

@media (max-width: 768px) {
  .bilingual-grid { grid-template-columns: 1fr; gap: 1.25rem; }
  .en-col { border-right: none; border-bottom: 1px solid rgba(197, 160, 89, 0.35); padding-right: 0; padding-bottom: 1rem; }
}

/* Countdown */
.countdown-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-top: 2.5rem;
  text-align: center;
  padding: 1.2rem;
}
.cd-box span { display: block; font-family: var(--font-en-serif); font-size: 2rem; color: var(--gold); font-weight: 700; }
.cd-box small { font-size: 0.75rem; opacity: 0.85; }

/* Sections & Events */
.section-light { padding: 4.5rem 0; }
.badge { display: inline-block; background: var(--gold); color: #fff; padding: 0.2rem 0.75rem; border-radius: 99px; font-size: 0.78rem; margin-bottom: 0.5rem; }
.events-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 2rem; }
@media (max-width: 768px) { .events-grid { grid-template-columns: 1fr; } }
.event-card { background: #fff; border: 1px solid #eadfce; border-radius: 16px; padding: 1.8rem; display: flex; flex-direction: column; justify-content: space-between; gap: 1.2rem; }
.time { color: var(--gold-dark); font-weight: 600; margin: 0.3rem 0; }

/* Whish Money Gift Registry Card */
.whish-card {
  margin-top: 2rem;
  border: 1.5px solid rgba(227, 28, 61, 0.35);
  background: linear-gradient(135deg, #ffffff 0%, #fff8f8 100%);
}
.whish-badge-row { display: flex; justify-content: center; margin-bottom: 1rem; }
.whish-pill {
  background: #e31c3d;
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.14em;
  font-size: 0.78rem;
  padding: 0.35rem 1.1rem;
  border-radius: 99px;
  box-shadow: 0 4px 12px rgba(227, 28, 61, 0.25);
}
.whish-action-bar {
  margin-top: 1.5rem;
  padding-top: 1.3rem;
  border-top: 1px dashed rgba(197, 160, 89, 0.5);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.whish-account-box small { display: block; font-size: 0.78rem; color: #6e6559; }
.whish-account-box strong { font-size: 1.35rem; color: var(--charcoal); letter-spacing: 0.04em; }
.whish-buttons { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.btn-whish-copy {
  background: #fff;
  color: #e31c3d;
  border: 1.5px solid #e31c3d;
  padding: 0.75rem 1.3rem;
  border-radius: 99px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-whish-copy:hover { background: #fff0f2; }
.btn-whish-pay {
  background: #e31c3d;
  color: #fff;
  text-decoration: none;
  padding: 0.78rem 1.45rem;
  border-radius: 99px;
  font-weight: 600;
  box-shadow: 0 6px 16px rgba(227, 28, 61, 0.28);
  transition: background 0.2s ease;
}
.btn-whish-pay:hover { background: #c41432; }

/* Buttons & Forms */
.btn-primary {
  background: var(--gold);
  color: #fff;
  border: none;
  padding: 0.85rem 1.6rem;
  border-radius: 99px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  transition: background 0.2s ease;
}
.btn-primary:hover { background: var(--gold-dark); }
.full-width { width: 100%; }
.btn-outline {
  text-align: center;
  text-decoration: none;
  color: var(--gold-dark);
  border: 1px solid var(--gold);
  padding: 0.65rem 1rem;
  border-radius: 99px;
  font-size: 0.88rem;
}

.deadline-notice {
  margin-top: 0.6rem;
  padding: 0.65rem 0.9rem;
  background: rgba(197, 160, 89, 0.18);
  border-left: 3px solid var(--gold);
  border-radius: 6px;
  font-size: 0.92rem;
}
.ar-col .deadline-notice { border-left: none; border-right: 3px solid var(--gold); }

.rsvp-form { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }
.radio-card {
  border: 1px solid rgba(255,255,255,0.3);
  padding: 0.85rem 1rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
}
.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
select, input, textarea {
  padding: 0.75rem 0.95rem;
  border-radius: 10px;
  border: 1px solid #d4c8b4;
  font-family: inherit;
  font-size: 0.95rem;
}
.status-pill { margin-top: 1rem; padding: 0.75rem 1rem; border-radius: 10px; background: rgba(46, 160, 67, 0.25); border: 1px solid #3fb950; text-align: center; }
.locked-box { margin-top: 1.5rem; padding: 1.2rem; background: rgba(220, 53, 69, 0.25); border: 1px solid #f85149; border-radius: 12px; text-align: center; }
.hidden { display: none !important; }

.site-footer { text-align: center; padding: 2rem; font-size: 0.85rem; color: #6e6559; }
.admin-link { color: #9c9283; text-decoration: none; font-size: 0.75rem; }

/* Admin Dashboard */
.admin-body { background: #f4f1ea; }
.admin-login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.admin-card { max-width: 400px; width: 100%; display: flex; flex-direction: column; gap: 1rem; }
.admin-dashboard { padding: 2.5rem 0; }
.admin-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.admin-actions { display: flex; gap: 0.75rem; }
.btn-outline-dark { background: transparent; border: 1px solid #888; padding: 0.75rem 1.2rem; border-radius: 99px; cursor: pointer; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { background: #fff; padding: 1.2rem; border-radius: 14px; border: 1px solid #e2d9c8; }
.stat-card span { font-size: 0.82rem; color: #666; display: block; }
.stat-card strong { font-size: 1.8rem; color: var(--charcoal); }
.stat-card.confirmed strong { color: #1a7f37; }
.stat-card.declined strong { color: #cf222e; }
.stat-card.pending strong { color: #9a6700; }
.admin-panel { background: #fff; padding: 1.5rem; border-radius: 14px; border: 1px solid #e2d9c8; margin-bottom: 1.5rem; }
.settings-grid, .guest-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.9rem; margin: 1rem 0; }
.table-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.table-scroll { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.data-table th, .data-table td { padding: 0.75rem; border-bottom: 1px solid #eee; text-align: left; }
.error-text { color: #cf222e; font-size: 0.88rem; }
.saved-badge { color: #1a7f37; font-weight: 600; margin-left: 0.8rem; }

.action-cell { display: flex; align-items: center; gap: 0.45rem; white-space: nowrap; }
.btn-link, .btn-whatsapp { display: inline-block; padding: 0.3rem 0.7rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; text-decoration: none; }
.btn-link { border: 1px solid var(--gold); color: var(--gold-dark); }
.btn-whatsapp { background: #25d366; color: #fff; }
.btn-whatsapp:hover { background: #1ebe5d; }
```

### File 5: `app.js`

```javascript
// Replace with your deployed Google Apps Script Web App URL ending in /exec
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

const WEDDING_DATE = new Date('2027-01-03T16:00:00+02:00');
const EDIT_DEADLINE = new Date('2026-12-15T23:59:59+02:00');

const ADMIN_CREDENTIALS = {
  username: 'SamRebecca2027',
  password: 'SamRebecca@2027'
};

// ==========================================
// 1. PUBLIC INVITATION PAGE LOGIC
// ==========================================
if (document.getElementById('rsvpForm')) {
  const params = new URLSearchParams(window.location.search);
  const guestCode = (params.get('g') || '').trim();

  // Curtain & Music Autoplay Unlock
  const curtain = document.getElementById('curtain');
  const bgMusic = document.getElementById('bgMusic');
  const musicToggle = document.getElementById('musicToggle');
  let isPlaying = false;

  function toggleMusic(forcePlay = false) {
    if (forcePlay || !isPlaying) {
      bgMusic.play().then(() => {
        isPlaying = true;
        musicToggle.classList.add('playing');
      }).catch(() => {});
    } else {
      bgMusic.pause();
      isPlaying = false;
      musicToggle.classList.remove('playing');
    }
  }

  document.getElementById('openInviteBtn').addEventListener('click', () => {
    curtain.classList.add('opened');
    toggleMusic(true);
  });
  musicToggle.addEventListener('click', () => toggleMusic(false));

  // Countdown Timer
  function updateCountdown() {
    const diff = Math.max(0, WEDDING_DATE - new Date());
    document.getElementById('cdDays').textContent = String(Math.floor(diff / 86400000)).padStart(2, '0');
    document.getElementById('cdHours').textContent = String(Math.floor((diff / 3600000) % 24)).padStart(2, '0');
    document.getElementById('cdMins').textContent = String(Math.floor((diff / 60000) % 60)).padStart(2, '0');
    document.getElementById('cdSecs').textContent = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
  }
  setInterval(updateCountdown, 1000);
  updateCountdown();

  // Enforce 15-December-2026 Cutoff
  const isDeadlinePassed = new Date() > EDIT_DEADLINE;
  if (isDeadlinePassed) {
    document.getElementById('rsvpForm').classList.add('hidden');
    document.getElementById('lockedBanner').classList.remove('hidden');
  }

  // Toggle Seats Dropdown when Declining
  document.querySelectorAll('input[name="status"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.getElementById('seatsSelectGroup').style.display =
        e.target.value === 'Confirmed' ? 'flex' : 'none';
    });
  });

  // Load Guest, Custom Background Images & Whish Money Settings
  async function initInvitation() {
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=guest&g=${encodeURIComponent(guestCode)}`);
      const data = await res.json();

      if (data.settings) {
        if (data.settings.bgHero) {
          document.getElementById('heroSection').style.backgroundImage = `url('${data.settings.bgHero}')`;
        }
        if (data.settings.bgVenue) {
          document.getElementById('venueSection').style.backgroundImage = `url('${data.settings.bgVenue}')`;
        }
        if (data.settings.musicUrl) {
          document.getElementById('bgMusicSource').src = data.settings.musicUrl;
          bgMusic.load();
        }
        if (data.settings.whishNumber) {
          document.getElementById('displayWhishNumber').textContent = data.settings.whishNumber;
        }
        if (data.settings.whishLink) {
          document.getElementById('openWhishAppBtn').href = data.settings.whishLink;
        }
      }

      const seatsSelect = document.getElementById('attendingSeats');
      let maxSeats = 2;

      if (data.guest) {
        document.getElementById('guestNameEN').textContent = data.guest.nameEN;
        document.getElementById('guestNameAR').textContent = data.guest.nameAR;
        maxSeats = data.guest.maxSeats || 1;
        document.getElementById('seatsInfoEN').textContent = `We have reserved ${maxSeats} seat(s) in your honor.`;
        document.getElementById('seatsInfoAR').textContent = `لقد خصصنا لكم (${maxSeats}) مقاعد بكل محبة.`;

        if (data.guest.status !== 'Pending') {
          showCurrentStatus(data.guest.status, data.guest.attendingSeats);
          const radio = document.querySelector(`input[name="status"][value="${data.guest.status}"]`);
          if (radio) radio.checked = true;
          document.getElementById('guestMessage').value = data.guest.message || '';
        }
      }

      seatsSelect.innerHTML = '';
      for (let i = 1; i <= maxSeats; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i} ${i === 1 ? 'Guest / شخص' : 'Guests / أشخاص'}`;
        if (data.guest && data.guest.attendingSeats === i) opt.selected = true;
        seatsSelect.appendChild(opt);
      }
    } catch (err) {
      console.error('Failed to load invitation data:', err);
    }
  }

  function showCurrentStatus(status, seats) {
    const banner = document.getElementById('rsvpStatusBanner');
    banner.classList.remove('hidden');
    banner.innerHTML = status === 'Confirmed'
      ? `Current Response: <strong>Confirmed (${seats} seat(s))</strong> • الرد الحالي: <strong>مؤكد (${seats})</strong>`
      : `Current Response: <strong>Declined</strong> • الرد الحالي: <strong>معتذر</strong>`;
  }

  // Submit or Edit RSVP
  document.getElementById('rsvpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (new Date() > EDIT_DEADLINE) return;

    const btn = document.getElementById('submitRsvpBtn');
    btn.disabled = true;
    const status = document.querySelector('input[name="status"]:checked').value;
    const attendingSeats = status === 'Confirmed' ? Number(document.getElementById('attendingSeats').value) : 0;
    const message = document.getElementById('guestMessage').value;

    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'rsvp',
          code: guestCode,
          status,
          attendingSeats,
          message
        })
      });
      const result = await res.json();
      if (result.ok) {
        showCurrentStatus(result.status, result.attendingSeats);
        alert('Thank you! Your confirmation has been saved.\nشكراً لكم! تم حفظ تأكيدكم بنجاح.');
      } else if (result.error === 'DEADLINE_PASSED') {
        alert('Editing deadline (15-Dec-2026) has passed.');
      } else {
        alert('Please open your personalized invitation link (?g=code) to confirm.');
      }
    } finally {
      btn.disabled = false;
    }
  });

  // One-Tap Whish Money Account Copy
  const copyWhishBtn = document.getElementById('copyWhishBtn');
  if (copyWhishBtn) {
    copyWhishBtn.addEventListener('click', () => {
      const num = document.getElementById('displayWhishNumber').textContent.trim();
      navigator.clipboard.writeText(num).then(() => {
        const label = document.getElementById('copyWhishText');
        label.textContent = 'Copied! ✓ • تم النسخ';
        setTimeout(() => {
          label.textContent = 'Copy Number • نسخ الرقم';
        }, 2500);
      });
    });
  }

  initInvitation();
}

// ==========================================
// 2. ADMIN BACKEND & EXCEL EXPORT LOGIC
// ==========================================
if (document.getElementById('adminLoginForm')) {
  let cachedGuests = [];

  function getAuth() {
    const raw = sessionStorage.getItem('wedding_admin_auth');
    return raw ? JSON.parse(raw) : null;
  }

  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value;

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      sessionStorage.setItem('wedding_admin_auth', JSON.stringify({ username, password }));
      document.getElementById('loginError').classList.add('hidden');
      loadDashboard();
    } else {
      document.getElementById('loginError').classList.remove('hidden');
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('wedding_admin_auth');
    location.reload();
  });

  async function loadDashboard() {
    const auth = getAuth();
    if (!auth) return;

    document.getElementById('loginBox').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'admin_dashboard', ...auth })
    });
    const data = await res.json();
    if (!data.ok) return;

    cachedGuests = data.guests || [];
    if (data.settings) {
      document.getElementById('setBgHero').value = data.settings.bgHero || '';
      document.getElementById('setBgVenue').value = data.settings.bgVenue || '';
      document.getElementById('setMusicUrl').value = data.settings.musicUrl || '';
      document.getElementById('setWhishNumber').value = data.settings.whishNumber || '';
      document.getElementById('setWhishLink').value = data.settings.whishLink || '';
    }

    renderStatsAndTable();
  }

  function buildWhatsAppShareUrl(guest, inviteUrl) {
    const seatsTextEN = guest.maxSeats === 1 ? '1 seat' : `${guest.maxSeats} seats`;
    const message = [
      `💍 *Samer & Rafca — Wedding Invitation*`,
      `Dear *${guest.nameEN}*,`,
      `We joyfully invite you to celebrate our wedding on *Sunday, January 3, 2027*.`,
      `We have reserved *${seatsTextEN}* in your honor.`,
      ``,
      `✨ *دعوة زفاف سامر ورفقا*`,
      `عزيزنا *${guest.nameAR}*،`,
      `يسرّنا دعوتكم لمشاركتنا فرحة زفافنا يوم *الأحد ٣ كانون الثاني ٢٠٢٧*.`,
      `لقد خصصنا لكم *(${guest.maxSeats})* مقاعد بكل محبة.`,
      ``,
      `🔗 View your personal invitation & confirm before *15 Dec 2026* / لمشاهدة الدعوة وتأكيد الحضور قبل *١٥ كانون الأول ٢٠٢٦*:`,
      inviteUrl
    ].join('\n');

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  function renderStatsAndTable() {
    const filter = document.getElementById('filterStatus').value;
    let totalAllotted = 0, confirmedSeats = 0, declinedFam = 0, pendingFam = 0;

    cachedGuests.forEach(g => {
      totalAllotted += g.maxSeats;
      if (g.status === 'Confirmed') confirmedSeats += g.attendingSeats;
      else if (g.status === 'Declined') declinedFam++;
      else pendingFam++;
    });

    document.getElementById('statFamilies').textContent = cachedGuests.length;
    document.getElementById('statAllotted').textContent = totalAllotted;
    document.getElementById('statConfirmed').textContent = confirmedSeats;
    document.getElementById('statDeclined').textContent = declinedFam;
    document.getElementById('statPending').textContent = pendingFam;

    const tbody = document.getElementById('guestsTableBody');
    tbody.innerHTML = '';
    const baseUrl = window.location.origin;

    cachedGuests
      .filter(g => filter === 'ALL' || g.status === filter)
      .forEach(g => {
        const inviteUrl = `${baseUrl}/?g=${encodeURIComponent(g.code)}`;
        const waUrl = buildWhatsAppShareUrl(g, inviteUrl);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${g.code}</strong></td>
          <td>${g.nameEN}</td>
          <td dir="rtl">${g.nameAR}</td>
          <td>${g.status}</td>
          <td>${g.attendingSeats} / ${g.maxSeats}</td>
          <td class="action-cell">
            <a href="${inviteUrl}" target="_blank" rel="noopener" class="btn-link">Open</a>
            <a href="${waUrl}" target="_blank" rel="noopener" class="btn-whatsapp">WhatsApp</a>
          </td>
          <td>${g.message || '-'}</td>
          <td>${g.updatedAt ? g.updatedAt.slice(0, 10) : '-'}</td>
        `;
        tbody.appendChild(tr);
      });
  }

  document.getElementById('filterStatus').addEventListener('change', renderStatsAndTable);

  // Save Background Images, Music & Whish Pay Settings
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const auth = getAuth();
    const settings = {
      bgHero: document.getElementById('setBgHero').value.trim(),
      bgVenue: document.getElementById('setBgVenue').value.trim(),
      musicUrl: document.getElementById('setMusicUrl').value.trim(),
      whishNumber: document.getElementById('setWhishNumber').value.trim(),
      whishLink: document.getElementById('setWhishLink').value.trim()
    };
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'admin_save_settings', ...auth, settings })
    });
    const data = await res.json();
    if (data.ok) {
      const badge = document.getElementById('settingsSavedMsg');
      badge.classList.remove('hidden');
      setTimeout(() => badge.classList.add('hidden'), 3000);
    }
  });

  // Add / Update Guest
  document.getElementById('addGuestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const auth = getAuth();
    const guest = {
      code: document.getElementById('gCode').value.trim(),
      nameEN: document.getElementById('gNameEN').value.trim(),
      nameAR: document.getElementById('gNameAR').value.trim(),
      maxSeats: Number(document.getElementById('gSeats').value) || 2
    };
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'admin_upsert_guest', ...auth, guest })
    });
    const data = await res.json();
    if (data.ok) {
      e.target.reset();
      loadDashboard();
    }
  });

  // Download Confirmation List & Stats as Excel (.xlsx)
  document.getElementById('exportExcelBtn').addEventListener('click', () => {
    const wb = XLSX.utils.book_new();

    const confirmedList = cachedGuests.filter(g => g.status === 'Confirmed');
    const declinedList = cachedGuests.filter(g => g.status === 'Declined');
    const pendingList = cachedGuests.filter(g => g.status === 'Pending');

    const totalAllotted = cachedGuests.reduce((s, g) => s + g.maxSeats, 0);
    const totalConfirmedSeats = confirmedList.reduce((s, g) => s + g.attendingSeats, 0);

    // Sheet 1: Summary Statistics
    const summaryRows = [
      ['Samer & Rafca Wedding — RSVP Statistics', ''],
      ['Generated On', new Date().toLocaleString()],
      ['RSVP Edit Deadline', '15-December-2026'],
      ['', ''],
      ['Metric', 'Count'],
      ['Total Invited Families / Codes', cachedGuests.length],
      ['Total Allotted Seats', totalAllotted],
      ['Confirmed Families', confirmedList.length],
      ['Confirmed Attending Seats', totalConfirmedSeats],
      ['Declined Families', declinedList.length],
      ['Pending Families', pendingList.length]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary Stats');

    // Sheet 2: Full Guest List
    const formatGuest = g => ({
      Code: g.code,
      'Guest Name (EN)': g.nameEN,
      'Guest Name (AR)': g.nameAR,
      Status: g.status,
      'Attending Seats': g.attendingSeats,
      'Max Allotted Seats': g.maxSeats,
      Message: g.message,
      'Last Updated': g.updatedAt
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cachedGuests.map(formatGuest)), 'All Guests');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(confirmedList.map(formatGuest)), 'Confirmed');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(declinedList.concat(pendingList).map(formatGuest)), 'Declined & Pending');

    XLSX.writeFile(wb, `Samer_Rafca_Wedding_RSVPs_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });

  if (getAuth()) loadDashboard();
}
```

## 5. Deployment Checklist (`samer-and-rafca.vercel.app`)

1. Place `bg-hero.jpg`, `bg-venue.jpg`, and `wedding.mp3` inside the `assets/` folder.
2. Deploy `Code.gs` as a Google Apps Script Web App (`Anyone` access) and paste the `/exec` URL into `APPS_SCRIPT_URL` in `app.js`.
3. Deploy the folder to Vercel (`npx vercel --prod`) under the project name `samer-and-rafca` so it resolves to `https://samer-and-rafca.vercel.app`.
4. Open `https://samer-and-rafca.vercel.app/admin.html`, log in with `SamRebecca2027` / `SamRebecca@2027`, add guests, configure your Whish Money details and background images, and send personalized WhatsApp invitations.