import smtplib
import socket
import time
import os
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

# 🎯 USING THE EXACT SERVER FROM YOUR MICROSOFT DOCUMENTATION
# SMTP_SERVER = "smtp-mail.outlook.com"
# SMTP_PORT = 587

def send_notification_email(to_email: str, subject: str, message_body: str = "", html_content: str = None):
    # 🎯 Securely load from .env, stripping any accidental whitespace
    SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp-mail.outlook.com").strip()
    SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER = os.getenv("SMTP_USERNAME", "").strip()
    SMTP_PASS = os.getenv("SMTP_PASSWORD", "").strip()

    # ... the rest of your robust retry logic below ...

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = to_email
    
    if html_content:
        msg.set_content(html_content, subtype="html")
    else:
        msg.set_content(message_body)

    max_retries = 3
    backoff_times = [3, 7, 12] 

    for attempt in range(max_retries):
        try:
            # 1.5s buffer prevents us from hitting Microsoft's concurrent connection limit
            time.sleep(1.5) 
            
            print(f"🌍 [DEBUG] Attempting to connect to {SMTP_SERVER}:{SMTP_PORT}...")
            
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=20) as server:
                server.ehlo() 
                server.starttls() # Matches the STARTTLS from your screenshot
                server.ehlo() 
                server.login(SMTP_USER, SMTP_PASS)
                server.send_message(msg)
            
            print(f"✅ [SUCCESS] Email sent to {to_email} on attempt {attempt + 1}")
            return  
            
        except (socket.gaierror, smtplib.SMTPConnectError) as e:
            print(f"⚠️ [NETWORK ERROR] Attempt {attempt + 1} failed for {to_email}. Error: {e}")
        except smtplib.SMTPResponseException as e:
            print(f"⚠️ [OUTLOOK ERROR] Attempt {attempt + 1} failed for {to_email}. Code: {e.smtp_code}")
        except Exception as e:
            print(f"⚠️ [UNKNOWN ERROR] Attempt {attempt + 1} failed for {to_email}. Error: {e}")
        
        # Retry loop
        if attempt < max_retries - 1:
            wait_time = backoff_times[attempt]
            print(f"🔄 Retrying {to_email} in {wait_time} seconds...")
            time.sleep(wait_time)
        else:
            print(f"❌ [CRITICAL FAILURE] Could not send email to {to_email}.")