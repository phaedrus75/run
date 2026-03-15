import os
import resend

resend.api_key = os.getenv("RESEND_API_KEY", "")

FROM_EMAIL = os.getenv("FROM_EMAIL", "ZenRun <noreply@zenrun.co>")


def send_password_reset(to_email: str, reset_code: str) -> bool:
    """Send a password reset code via email. Returns True on success."""
    if not resend.api_key:
        print(f"⚠️  RESEND_API_KEY not set — logging code instead: {reset_code}")
        return False

    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": "Your ZenRun password reset code",
            "html": f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0;">ZenRun</h1>
                    <p style="color: #999; font-size: 14px; margin-top: 4px;">Less tracking. More running.</p>
                </div>
                <div style="background: #FFF9F5; border-radius: 16px; padding: 32px; text-align: center;">
                    <p style="color: #666; font-size: 15px; margin: 0 0 24px 0;">
                        Here&rsquo;s your password reset code:
                    </p>
                    <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #E8756F; margin-bottom: 24px;">
                        {reset_code}
                    </div>
                    <p style="color: #999; font-size: 13px; margin: 0;">
                        This code expires in 15 minutes.<br/>
                        If you didn&rsquo;t request this, you can safely ignore it.
                    </p>
                </div>
                <p style="text-align: center; color: #ccc; font-size: 12px; margin-top: 32px;">
                    &copy; ZenRun &middot; A running journal built for consistency.
                </p>
            </div>
            """,
        })
        print(f"✅ Password reset email sent to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")
        return False


def send_welcome_email(to_email: str, name: str) -> bool:
    """Send a welcome email to new users. Returns True on success."""
    if not resend.api_key:
        print(f"⚠️  RESEND_API_KEY not set — skipping welcome email for {to_email}")
        return False

    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [to_email],
            "subject": "Welcome to ZenRun",
            "html": f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0;">ZenRun</h1>
                    <p style="color: #999; font-size: 14px; margin-top: 4px;">Less tracking. More running.</p>
                </div>
                <div style="background: #FFF9F5; border-radius: 16px; padding: 32px;">
                    <h2 style="font-size: 20px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px 0;">
                        Welcome, {name} 🌱
                    </h2>
                    <p style="color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                        You&rsquo;re now a ZenRunner. Here&rsquo;s everything you need to know:
                    </p>
                    <ul style="color: #666; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0 0 16px 0;">
                        <li><strong>Log runs in 2 seconds</strong> &mdash; pick distance, enter time, done.</li>
                        <li><strong>Build your rhythm</strong> &mdash; run twice a week to keep it going.</li>
                        <li><strong>Earn 100 milestones</strong> &mdash; your journey, celebrated.</li>
                        <li><strong>Join a circle</strong> &mdash; share with friends, not strangers.</li>
                    </ul>
                    <p style="color: #999; font-size: 13px; margin: 0;">
                        The only run that matters is the one you do next.
                    </p>
                </div>
                <p style="text-align: center; color: #ccc; font-size: 12px; margin-top: 32px;">
                    &copy; ZenRun &middot; A running journal built for consistency.
                </p>
            </div>
            """,
        })
        print(f"✅ Welcome email sent to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send welcome email to {to_email}: {e}")
        return False
