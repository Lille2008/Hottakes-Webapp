import { Resend } from 'resend';
import type { GameDay } from '@prisma/client';

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend || !emailFrom) {
    console.log('[email] Skipped send (missing RESEND_API_KEY or EMAIL_FROM). Preview:', {
      to,
      subject,
      html
    });
    return;
  }

  await resend.emails.send({
    from: emailFrom,
    to,
    subject,
    html
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = `
    <h1>Password Reset Request</h1>
    <p>Click the link below to reset your password:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>This link expires in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  await sendEmail(to, 'Reset Your Hottakes Password', html);
}

export async function sendReminderEmail(to: string, gameDay: GameDay) {
  const lockTime = gameDay.lockTime ? gameDay.lockTime.toISOString() : 'soon';

  const html = `
    <h1>Game Day Reminder</h1>
    <p>Don't forget to submit your hottakes before the deadline!</p>
    <p><strong>Lock Time:</strong> ${lockTime}</p>
    <p><a href="${process.env.APP_URL || 'https://hottakes.app'}">Submit your picks now</a></p>
    <p>Good luck!</p>
  `;

  await sendEmail(to, 'Reminder: Submit Your Hottakes', html);
}
