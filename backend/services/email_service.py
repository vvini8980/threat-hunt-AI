import os
import smtplib
from email.message import EmailMessage

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.example.com")
SMTP_USER = os.getenv("SMTP_USER", "user@example.com")
SMTP_PASS = os.getenv("SMTP_PASS", "")

def send_report_email(to_email: str, subject: str, body: str, attachment_path: str = None):
    """
    Sends an email with an optional PDF attachment.
    """
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = SMTP_USER
    msg['To'] = to_email
    msg.set_content(body)
    
    if attachment_path and os.path.exists(attachment_path):
        with open(attachment_path, 'rb') as f:
            pdf_data = f.read()
        msg.add_attachment(pdf_data, maintype='application', subtype='pdf', filename=os.path.basename(attachment_path))
        
    if not SMTP_PASS:
        print(f"Mock sending email to {to_email} with subject '{subject}'")
        return True
        
    try:
        with smtplib.SMTP(SMTP_HOST, 587) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
