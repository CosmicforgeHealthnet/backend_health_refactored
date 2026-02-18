import pexpect
import sys

HOST = "72.61.20.94"
USER = "root"
PASSWORD = "CForgehealthnetne&t2025"
CMD = "grep -E 'your_key|your_secret|your_webhook_secret' /root/cosmic-production/.env.production"

print(f"Checking for placeholders in .env.production on {HOST}...")
child = pexpect.spawn(f"ssh -o StrictHostKeyChecking=no {USER}@{HOST} \"{CMD}\"")
child.expect("password:")
child.sendline(PASSWORD)
child.expect(pexpect.EOF)
print(child.before.decode())
