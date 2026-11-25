/**
 * calendarExport.js — Google Calendar & RFC 5545 iCalendar (.ics) Export
 *
 * Helper functions to export Mindcraft tutoring sessions to Google Calendar
 * and standard RFC 5545 .ics calendars.
 */

const { google } = require('googleapis');

/**
 * Creates an OAuth2 client with the application's credentials.
 * @returns {import('googleapis').Auth.OAuth2Client}
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

/**
 * Generates the Google OAuth2 authorization URL.
 * @param {string} [state] — Optional state param for CSRF protection
 * @returns {string} Authorization URL
 */
function getAuthUrl(state = '') {
  const oAuth2Client = createOAuth2Client();
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
    prompt: 'consent',
  });
}

/**
 * Exchanges an authorization code for OAuth tokens.
 * @param {string} code — Authorization code from Google callback
 * @returns {Promise<{ access_token: string, refresh_token?: string }>}
 */
async function exchangeCodeForTokens(code) {
  const oAuth2Client = createOAuth2Client();
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
}

/**
 * Exports a tutoring session to the user's Google Calendar.
 * Wraps external calls in a 5-second timeout and gracefully falls back
 * to a static meeting link on expired/unset credentials.
 *
 * @param {object} session   — Session object from Prisma
 * @param {object} tokens    — Google OAuth tokens
 * @param {string} peerName  — Name of the other user
 * @param {string} [peerEmail] — Email of the other user
 * @returns {Promise<{ eventId: string|null, htmlLink: string, meetLink?: string }>}
 */
async function exportSessionToCalendar(session, tokens, peerName = 'Peer', peerEmail = null) {
  const sessionId = session.sessionId || session.id || 'room';
  const fallbackMeetLink = session.meetLink || `https://meet.jit.si/MindCraft-${sessionId}`;

  if (!process.env.GOOGLE_CLIENT_ID || !tokens || !tokens.access_token) {
    console.warn('[CalendarExport] Google OAuth credentials or tokens missing/unset, falling back to static room link');
    return {
      eventId: null,
      htmlLink: '',
      meetLink: fallbackMeetLink,
    };
  }

  try {
    const oAuth2Client = createOAuth2Client();
    oAuth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const startDate = new Date(session.scheduledAt || session.scheduledFor || Date.now());
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const formatAsIST = (d) => {
      const istOffset = 5.5 * 60 * 60 * 1000;
      const local = new Date(d.getTime() + istOffset);
      return local.toISOString().replace('Z', '');
    };

    const isOnline = session.mode === 'Online' || session.mode === 'ONLINE';
    const isInPerson = session.mode === 'In-Person' || session.mode === 'IN_PERSON';

    const event = {
      summary: `🎓 Mindcraft: ${session.skill || session.title || 'Tutoring'} with ${peerName}`,
      description: buildDescription(session, peerName),
      start: {
        dateTime: formatAsIST(startDate),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: formatAsIST(endDate),
        timeZone: 'Asia/Kolkata',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 10 },
        ],
      },
      extendedProperties: {
        private: {
          mindcraft_session_id: sessionId,
          mindcraft_match_id: session.matchId || session.threadId || '',
        },
      },
      attendees: peerEmail ? [{ email: peerEmail }] : [],
    };

    if (isOnline) {
      if (session.meetLink) {
        event.location = session.meetLink;
        event.conferenceData = {
          entryPoints: [
            {
              entryPointType: 'video',
              uri: session.meetLink,
              label: 'Google Meet',
            },
          ],
          conferenceSolution: {
            name: 'Google Meet',
            key: { type: 'hangoutsMeet' },
          },
        };
      } else {
        event.conferenceData = {
          createRequest: {
            requestId: sessionId || Math.random().toString(36).substring(7),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }
    } else if (isInPerson && session.location) {
      event.location = session.location;
    }

    const insertPromise = calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: isOnline ? 1 : 0,
      sendUpdates: 'none',
    });

    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Google Calendar API call timed out after 5 seconds'));
      }, 5000);
      if (typeof timer.unref === 'function') timer.unref();
    });

    const response = await Promise.race([insertPromise, timeoutPromise]);

    let generatedMeetLink = null;
    if (isOnline && !session.meetLink && response?.data?.conferenceData) {
      const entryPoint = response.data.conferenceData.entryPoints?.find((ep) => ep.entryPointType === 'video');
      if (entryPoint && entryPoint.uri) {
        generatedMeetLink = entryPoint.uri;
      }
    }

    return {
      eventId: response?.data?.id || null,
      htmlLink: response?.data?.htmlLink || '',
      meetLink: generatedMeetLink || fallbackMeetLink,
    };
  } catch (err) {
    console.warn('[CalendarExport] Google Calendar API error or timeout, falling back to static room link:', err.message);
    return {
      eventId: null,
      htmlLink: '',
      meetLink: fallbackMeetLink,
    };
  }
}

/**
 * Builds a rich description for the calendar event.
 */
function buildDescription(session, peerName) {
  const lines = [
    `📚 Skill: ${session.skill || session.title || 'Tutoring'}`,
    `👤 Peer: ${peerName}`,
    `📍 Mode: ${session.mode || 'Online'}`,
  ];

  if (session.meetLink) lines.push(`🔗 Meet: ${session.meetLink}`);
  if (session.location) lines.push(`📍 Location: ${session.location}`);
  if (session.notes) lines.push(`\n📝 Notes:\n${session.notes}`);

  lines.push('\n—\nScheduled via Mindcraft 🧠');
  return lines.join('\n');
}

/**
 * Generates an RFC 5545 compliant .ics calendar string.
 * Strictly uses CRLF (\r\n) line terminators.
 *
 * @param {object} session
 * @param {string} [peerName]
 * @returns {string} RFC 5545 formatted .ics payload
 */
function generateIcsCalendar(session, peerName = 'Peer') {
  const pad = (n) => String(n).padStart(2, '0');
  const formatIcsDate = (date) => {
    const d = new Date(date);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };

  const start = session.scheduledAt || session.scheduledFor || Date.now();
  const startDate = new Date(start);
  const durationMins = session.duration || 60;
  const endDate = session.endTime ? new Date(session.endTime) : new Date(startDate.getTime() + durationMins * 60 * 1000);
  const now = new Date();

  const uid = session.sessionId || session.id || `session-${Date.now()}`;
  const skill = session.skill || session.title || 'General';
  const summary = `MindCraft Tutoring: ${skill} with ${peerName}`;
  const meetLink = session.meetLink || `https://meet.jit.si/MindCraft-${uid}`;
  const location = (session.mode === 'In-Person' || session.mode === 'IN_PERSON')
    ? (session.location || 'In-Person')
    : meetLink;
  const description = `MindCraft Tutoring Session\\nSkill: ${skill}\\nPeer: ${peerName}\\nJoin Link: ${meetLink}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MindCraft//Tutoring Session Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@mindcraft.app`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${summary.replace(/\r?\n/g, ' ')}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location.replace(/\r?\n/g, ' ')}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n') + '\r\n';
}

module.exports = {
  createOAuth2Client,
  getAuthUrl,
  exchangeCodeForTokens,
  exportSessionToCalendar,
  generateIcsCalendar,
};
