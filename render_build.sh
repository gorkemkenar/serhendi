#!/usr/bin/env bash
# Render.com Derleme Betiği (Build Script)
set -o errexit

pip install -r backend/requirements.txt
python backend/manage.py collectstatic --noinput
python backend/manage.py migrate
python backend/manage.py seed_defaults
