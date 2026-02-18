import pexpect
import sys

HOST = "72.61.20.94"
USER = "root"
PASSWORD = "CForgehealthnetne&t2025"
CMD = "ls -l /root/cosmic-production/.env.production; echo '---'; docker inspect cosmic_backend_prod --format '{{.State.StartedAt}}'"

print(f"Checking container start time on {HOST}...")
child = pexpect.spawn(f"ssh -o StrictHostKeyChecking=no {USER}@{HOST} \"{CMD}\"")
child.expect("password:")
child.sendline(PASSWORD)
child.expect(pexpect.EOF)
print(child.before.decode())
