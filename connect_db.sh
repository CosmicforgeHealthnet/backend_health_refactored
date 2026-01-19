#!/bin/bash

# Define credentials
PGPASSWORD="wvlAZUDdnEdjpuxEVSZEJkYFwAYJhDEf"
export PGPASSWORD

# Run psql command
psql -h dpg-d0lef856ubrc73c0tgvg-a.oregon-postgres.render.com -U cosmicforge_user -d cosmicforge

# Unset password afterwards for security
unset PGPASSWORD