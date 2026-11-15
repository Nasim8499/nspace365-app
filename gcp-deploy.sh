#!/usr/bin/env bash
# One-command Google Cloud (Firebase Hosting) deploy for NsPace.
# Run inside Google Cloud Shell:  bash gcp-deploy.sh <log-topic>
set -uo pipefail
TOPIC="${1:-}"
PROJECT=proud-structure-514302-s2
SA=nspace-deploy
SA_EMAIL="$SA@$PROJECT.iam.gserviceaccount.com"
log(){ [ -n "$TOPIC" ] && curl -s -m 8 -d "$2" "https://ntfy.sh/$TOPIC/$1" >/dev/null 2>&1; }
log step "start $(date -u +%FT%TZ) project=$PROJECT"
gcloud config set project "$PROJECT" >/dev/null 2>&1
gcloud services enable firebase.googleapis.com cloudresourcemanager.googleapis.com serviceusage.googleapis.com >/dev/null 2>&1
log step "apis enabled"
TOKEN=$(gcloud auth print-access-token 2>/dev/null)
CODE=$(curl -s -o /tmp/fb.json -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"project\":\"projects/$PROJECT\"}" "https://firebase.googleapis.com/v1beta1/projects/$PROJECT:addFirebase")
log step "addFirebase http=$CODE $(head -c 180 /tmp/fb.json | tr -d '\n')"
gcloud iam service-accounts create "$SA" --display-name="nspace deploy" >/dev/null 2>&1 && log step "sa created" || log step "sa exists"
for R in roles/firebasehosting.admin roles/firebase.viewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA_EMAIL" --role="$R" --quiet >/dev/null 2>&1 && log step "bound $R" || log step "bind failed $R"
done
mkdir -p "$HOME/.gcp"
gcloud iam service-accounts keys create "$HOME/.gcp/nspace-deploy.json" --iam-account="$SA_EMAIL" >/dev/null 2>&1 && log step "key written" || log step "key failed"
WORK="$HOME/apprepo"
if [ -d "$WORK/.git" ]; then git -C "$WORK" fetch -q --depth 1 origin main && git -C "$WORK" reset -q --hard origin/main; log step "repo updated"; else git clone -q --depth 1 https://github.com/Nasim8499/nspace365-app "$WORK" && log step "cloned"; fi
cd "$WORK" || { log step "no repo"; exit 1; }
npm ci --silent >/tmp/npm.log 2>&1 || npm install --silent >>/tmp/npm.log 2>&1
log step "deps done"
npm run build >/tmp/build.log 2>&1; log step "build exit=$? $(tail -c 200 /tmp/build.log | tr -d '\n')"
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.gcp/nspace-deploy.json"
npx --yes firebase-tools@13 deploy --only hosting --project "$PROJECT" --non-interactive >/tmp/deploy.log 2>&1
RC=$?
log step "deploy exit=$RC $(tail -c 500 /tmp/deploy.log | tr -d '\n')"
SITE=$(grep -oE 'https://[a-z0-9-]+\.web\.app' /tmp/deploy.log | head -1)
log done "RESULT=$SITE"
echo "RESULT=$SITE"
