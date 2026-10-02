// Sends email through Resend (https://resend.com), when it is set up.
//
// Needs two environment variables:
//   RESEND_API_KEY  the key of the Resend account
//   EMAIL_FROM      the sender, e.g. "Personal Life Manager <hello@your-domain.com>"
//
// Without them the app still works: nothing is sent, and the callers offer
// another way (a reset link created by an administrator, for example).

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

// Resolves to whether the message was accepted for sending. It never throws:
// a failed email must not break the page that asked for it.
export async function sendEmail(message: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!isEmailConfigured()) {
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    })

    if (!response.ok) {
      console.error('Email not sent:', response.status, await response.text())
    }

    return response.ok
  } catch (error) {
    console.error('Email not sent:', error)
    return false
  }
}
