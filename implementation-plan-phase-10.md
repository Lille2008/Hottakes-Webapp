# 🎯 Phase 10 – Implementation Plan
## Game Day Features: Lock System, Email, and Hot Takes Lifecycle

---

## Overview

Phase 10 introduces three critical features to manage the game day workflow:

1. **Time-Based Lock System** – Prevent users from submitting/editing picks after game starts
2. **Email System** – Send reminders and handle password resets
3. **Hot Takes Lifecycle** – Organize and archive hot takes after game day completion

---

## 1. Time-Based Strict Block (Game Day Lock)

### Problem
Users should not be able to submit or modify their picks once a game day has started. The current system lacks enforcement of submission deadlines.

### Technical Solution

#### Database Model (Already Exists)
The `AdminEvent` model in `prisma/schema.prisma` supports this feature:
```prisma
model AdminEvent {
  id          Int      @id @default(autoincrement())
  description String
  startTime   DateTime?
  lockTime    DateTime?
  endTime     DateTime?
  activeFlag  Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("admin_events")
}
```

#### API Implementation

**New Routes Required:**
- `POST /api/admin/game-days` – Create a game day with lock/start/end times
- `GET /api/admin/game-days` – List all game days
- `GET /api/admin/game-days/active` – Get the currently active game day
- `PATCH /api/admin/game-days/:id` – Update game day times
- `DELETE /api/admin/game-days/:id` – Remove a game day

**Middleware: Lock Check**
Create `src/middleware/checkGameDayLock.ts`:
```typescript
// Middleware to check if submissions are allowed
export async function checkGameDayLock(req, res, next) {
  const activeGameDay = await prisma.adminEvent.findFirst({
    where: {
      activeFlag: true,
      lockTime: { not: null }
    },
    orderBy: { lockTime: 'desc' }
  });

  if (!activeGameDay) {
    return next(); // No active game day, allow submission
  }

  const now = new Date();
  if (now >= activeGameDay.lockTime) {
    return res.status(403).json({
      error: "Submissions are locked. The game day has started.",
      lockTime: activeGameDay.lockTime
    });
  }

  next(); // Before lock time, allow submission
}
```

**Integration Point:**
Apply middleware to `POST /api/submissions` in `src/routes/submissions.ts`

#### Frontend Changes
- Display countdown timer showing time until lock
- Disable submission form when locked
- Show clear error message if user tries to submit after lock

---

## 2. Email System

### Problem
Need to send two types of emails:
- **Password Reset** – Security-critical, immediate delivery
- **Game Day Reminders** – Scheduled notifications before lock time

### Technical Architecture

#### Email Service Provider
**Recommended:** Resend (https://resend.com)
- Free tier: 3,000 emails/month
- Modern API, excellent Node.js support
- Easy setup with API key

**Alternative:** Brevo (formerly Sendinblue)
- Free tier: 300 emails/day (~9,000/month)
- More generous but slightly older API

#### Dependencies
```bash
npm install nodemailer @types/nodemailer
npm install node-cron @types/node-cron
npm install resend  # or use nodemailer with SMTP
```

#### Environment Variables
Add to `.env`:
```
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@hottakes.app
APP_URL=https://hottakes.app
```

---

### 2.1 Password Reset Flow

#### Step 1: Generate Reset Token
**Extend User Model:**
Add to `prisma/schema.prisma`:
```prisma
model User {
  // ... existing fields
  resetToken       String?   @unique
  resetTokenExpiry DateTime?
}
```

Run migration: `npx prisma migrate dev --name add-password-reset-tokens`

#### Step 2: Request Password Reset
**New Route:** `POST /api/auth/forgot-password`
```typescript
// src/routes/auth.ts
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  // 1. Find user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Return success even if not found (security: don't leak user existence)
    return res.json({ message: "If that email exists, we sent a reset link." });
  }

  // 2. Generate secure token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

  // 3. Save token to database
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiry }
  });

  // 4. Send email
  const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  res.json({ message: "If that email exists, we sent a reset link." });
});
```

#### Step 3: Verify Token and Reset Password
**New Route:** `POST /api/auth/reset-password`
```typescript
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  // 1. Find user with valid token
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() }
    }
  });

  if (!user) {
    return res.status(400).json({ error: "Invalid or expired reset token." });
  }

  // 2. Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // 3. Update password and clear token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null
    }
  });

  res.json({ message: "Password reset successful. You can now login." });
});
```

#### Email Utility (`src/lib/email.ts`)
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Reset Your Hottakes Password',
    html: `
      <h1>Password Reset Request</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  });
}
```

---

### 2.2 Game Day Reminders

#### Scheduled Email System
**Create:** `src/lib/scheduler.ts`
```typescript
import cron from 'node-cron';
import { prisma } from './db';
import { sendReminderEmail } from './email';

export function startReminderScheduler() {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Checking for upcoming game days...');

    // Find game days starting in the next 24 hours
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const upcomingGameDays = await prisma.adminEvent.findMany({
      where: {
        activeFlag: true,
        lockTime: {
          gte: new Date(),
          lte: tomorrow
        }
      }
    });

    if (upcomingGameDays.length === 0) {
      console.log('[Scheduler] No upcoming game days found.');
      return;
    }

    // Find users who haven't submitted picks yet
    const usersWithSubmissions = await prisma.submission.findMany({
      select: { userId: true }
    });
    const submittedUserIds = new Set(usersWithSubmissions.map(s => s.userId));

    const usersWithoutSubmissions = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(submittedUserIds) },
        email: { not: null }
      }
    });

    // Send reminders
    for (const user of usersWithoutSubmissions) {
      for (const gameDay of upcomingGameDays) {
        await sendReminderEmail(user.email!, gameDay);
      }
    }

    console.log(`[Scheduler] Sent ${usersWithoutSubmissions.length} reminders.`);
  });

  console.log('[Scheduler] Started. Reminder job scheduled for 8:00 AM daily.');
}
```

**Integrate in `src/server.ts`:**
```typescript
import { startReminderScheduler } from './lib/scheduler';

// After app initialization
startReminderScheduler();
```

#### Reminder Email Template
**Add to `src/lib/email.ts`:**
```typescript
export async function sendReminderEmail(to: string, gameDay: AdminEvent) {
  const lockTime = gameDay.lockTime!.toLocaleString();
  
  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: '⏰ Reminder: Submit Your Hottakes!',
    html: `
      <h1>Game Day Reminder</h1>
      <p>Don't forget to submit your hottakes before the deadline!</p>
      <p><strong>Lock Time:</strong> ${lockTime}</p>
      <p><a href="${process.env.APP_URL}">Submit your picks now</a></p>
      <p>Good luck! 🔥</p>
    `
  });
}
```

---

## 3. Hot Takes Lifecycle Management

### Problem
After a game day ends:
- Old hot takes become "useless" for future picks
- Users need to see what gave them points (for transparency)
- New hot takes must be created for the next game day
- The UI should show only active/relevant hot takes by default

### Solution: Status-Based Filtering

#### Approach
Instead of deleting or moving hot takes to a separate table, use a **status-based lifecycle** with the existing database structure.

#### Extend Hottake Relation (Optional Enhancement)
Link each hottake to a game day for better organization:
```prisma
model Hottake {
  id          Int            @id @default(autoincrement())
  text        String
  status      HottakeStatus  @default(OFFEN)
  gameDayId   Int?           // Optional: link to specific game day
  gameDay     AdminEvent?    @relation(fields: [gameDayId], references: [id])
  archived    Boolean        @default(false) // Flag for lifecycle
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  @@map("hottakes")
}
```

#### Alternative: Use Status Enum Only
Keep the current schema and use the `status` field:
- `OFFEN` = Active, users can pick
- `WAHR` or `FALSCH` = Game day ended, archived

#### API Changes

**Modify:** `GET /api/hottakes` to accept query parameter
```typescript
// GET /api/hottakes?archived=false (default)
// GET /api/hottakes?archived=true (history view)

router.get('/', async (req, res) => {
  const showArchived = req.query.archived === 'true';
  
  const hottakes = await prisma.hottake.findMany({
    where: showArchived 
      ? { status: { not: 'OFFEN' } }  // Show resolved takes
      : { status: 'OFFEN' },          // Show only open takes
    orderBy: { createdAt: 'asc' }
  });

  res.json(hottakes);
});
```

**New Admin Route:** `POST /api/admin/game-days/:id/finalize`
```typescript
// Finalizes a game day: resolves all open hottakes, calculates scores
router.post('/:id/finalize', requireAdmin, async (req, res) => {
  const gameDayId = parseInt(req.params.id);
  
  // 1. Update game day status
  await prisma.adminEvent.update({
    where: { id: gameDayId },
    data: { activeFlag: false }
  });

  // 2. Admin must manually resolve each hottake status via PATCH /api/hottakes/:id
  // (This is already implemented in the current system)

  // 3. Frontend calculates scores via existing leaderboard logic

  res.json({ message: "Game day finalized. Update hottake statuses individually." });
});
```

#### Frontend Views

**Two Tabs:**
1. **Active Picks** (Default)
   - Shows only `OFFEN` hottakes
   - Submission form enabled (if not locked)
   - Current leaderboard

2. **History**
   - Shows all resolved hottakes (WAHR/FALSCH)
   - Read-only view with user's past picks highlighted
   - Historical leaderboard snapshot

---

## Implementation Checklist

### Phase 10.1 – Game Day Lock System
- [ ] Create `src/middleware/checkGameDayLock.ts`
- [ ] Create `src/routes/admin/game-days.ts` with CRUD endpoints
- [ ] Mount game day routes in `src/app.ts`
- [ ] Apply lock middleware to `POST /api/submissions`
- [ ] Add frontend countdown timer (optional)
- [ ] Add error handling for locked submissions

### Phase 10.2 – Email System Setup
- [ ] Install dependencies: `nodemailer`, `node-cron`, `resend`
- [ ] Add email environment variables to `.env.example`
- [ ] Create `src/lib/email.ts` with email utilities
- [ ] Add `resetToken` and `resetTokenExpiry` to User model
- [ ] Run Prisma migration for password reset tokens
- [ ] Implement `POST /api/auth/forgot-password`
- [ ] Implement `POST /api/auth/reset-password`
- [ ] Create frontend pages: `public/forgot-password.html`, `public/reset-password.html`
- [ ] Test password reset flow end-to-end

### Phase 10.3 – Game Day Reminders
- [ ] Create `src/lib/scheduler.ts` with cron jobs
- [ ] Implement `sendReminderEmail()` in `src/lib/email.ts`
- [ ] Start scheduler in `src/server.ts`
- [ ] Test reminder logic with manual trigger
- [ ] Add opt-out mechanism (optional future enhancement)

### Phase 10.4 – Hot Takes Lifecycle
- [ ] Decide on schema change (add `gameDayId` or keep status-only)
- [ ] If schema change: run migration
- [ ] Modify `GET /api/hottakes` to support `?archived` query
- [ ] Create `POST /api/admin/game-days/:id/finalize` endpoint
- [ ] Add frontend tab/toggle for "Active" vs "History" views
- [ ] Test lifecycle: create → lock → resolve → archive → view history

---

## Testing Strategy

### Unit Tests
- `src/middleware/checkGameDayLock.test.ts` – Test lock logic with various time scenarios
- `src/lib/email.test.ts` – Mock email sending, verify templates

### Integration Tests
- Test password reset flow: request → receive token → reset → login
- Test game day lock: create game day → attempt submission before/after lock
- Test reminder scheduler: mock cron, verify email sent to users without submissions

### Manual Testing
- Set up local email provider (Resend test mode or Ethereal for dev)
- Create a game day with lock time in 5 minutes
- Attempt submission before and after lock
- Request password reset and complete the flow
- Verify emails are received with correct content

---

## Security Considerations

### Password Reset Tokens
- **Token entropy:** Use `crypto.randomBytes(32)` for 256-bit security
- **Expiration:** Tokens must expire (1 hour recommended)
- **Single-use:** Clear token after successful reset
- **Rate limiting:** Limit forgot-password requests to prevent abuse (future enhancement)

### Email Validation
- Verify email format with `zod` before sending
- Don't leak user existence (same response for valid/invalid emails)
- Implement SPF/DKIM records for production domain

### Game Day Lock
- **Server-side enforcement:** Never trust client-side lock checks
- **Atomic operations:** Use database transactions when updating game day state
- **Timezone handling:** Store all times in UTC, convert in frontend

---

## Cost Estimation

### Email Service (Resend Free Tier)
- Password resets: ~10-50/month
- Game day reminders: 1 email × users without submissions × ~4 game days/month
- Example: 100 users, 50% submit late → 50 × 4 = 200 emails/month
- **Total:** ~250-300 emails/month (well within 3,000 free tier)

### Server Resources
- Cron job: Minimal CPU (<1% overhead)
- Database: +2 columns on User table, +game_days table (negligible storage)

---

## Future Enhancements (Phase 11+)

- **Email preferences:** Allow users to opt out of reminders
- **Multi-language emails:** i18n support for email templates
- **Real-time countdown:** WebSocket for live lock timer
- **Push notifications:** Browser notifications as alternative to email
- **SMS reminders:** Twilio integration for critical reminders
- **Advanced scheduling:** Multiple game days with overlapping schedules

---

## References

- **Nodemailer Docs:** https://nodemailer.com/
- **Resend API:** https://resend.com/docs/introduction
- **Node-cron Syntax:** https://github.com/node-cron/node-cron
- **Prisma Relations:** https://www.prisma.io/docs/concepts/components/prisma-schema/relations
- **JWT Best Practices:** https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html

---

**Last Updated:** 2025-12-26  
**Status:** Planning Complete – Ready for Implementation
