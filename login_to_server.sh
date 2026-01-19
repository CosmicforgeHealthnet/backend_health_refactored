#!/bin/bash

# Server credentials
HOST="72.61.20.94"
USER="root"
PASSWORD="CForgehealthnetne&t2025"

# Connect via SSH using sshpass
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$USER@$HOST"