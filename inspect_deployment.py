import pexpect
import sys

HOST = "72.61.20.94"
USER = "root"
PASSWORD = "CForgehealthnetne&t2025"
CMD = "cat /root/cosmic-production/.env.production && echo '---DIVIDER---' && docker inspect cosmic_backend_prod --format '{{json .Config.Env}}'"

print(f"Connecting to {USER}@{HOST}...")
child = pexpect.spawn(f"ssh -o StrictHostKeyChecking=no {USER}@{HOST} \"{CMD}\"")
child.expect("password:")
child.sendline(PASSWORD)
child.expect(pexpect.EOF)
print(child.before.decode())
