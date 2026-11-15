#!/usr/bin/env bash
# Google Cloud deploy for NsPace (Firebase Hosting, same Google Cloud project as the OAuth client).
# Needs ONE of these in the sandbox environment:
#   FIREBASE_TOKEN     -> from `firebase login:ci`
#   GOOGLE_APPLICATION_CREDENTIALS -> path to a service-account key with role "Firebase Hosting Admin"
set -euo pipefail
cd "$(dirname "$0")"

if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  AUTH_HEAD=""
  echo "auth: service account ($GOOGLE_APPLICATION_CREDENTIALS)"
elif [ -n "${FIREBASE_TOKEN:-}" ]; then
  AUTH_HEAD="--token ${FIREBASE_TOKEN}"
  echo "auth: FIREBASE_TOKEN"
else
  echo "No Google credential found. Add FIREBASE_TOKEN or GOOGLE_APPLICATION_CREDENTIALS." >&2
  exit 2
fi

npm run build
# make sure the Google Cloud project actually has Firebase enabled (idempotent)
npx --yes firebase-tools@13 projects:addfirebase proud-structure-514302-s2 ${AUTH_HEAD} || true
npx --yes firebase-tools@13 deploy --only hosting --project proud-structure-514302-s2 --non-interactive ${AUTH_HEAD}
