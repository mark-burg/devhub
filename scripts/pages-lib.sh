#!/usr/bin/env bash
# Helpers for writing to the GitHub Pages branch from CI. Source this file, then:
#
#   pages_clone <dir>                         shallow-clone the branch (or start it if missing)
#   pages_commit_retry <dir> <message> cmd…   run cmd, commit, push; if someone else pushed first,
#                                             reset to their commit and run cmd again (up to 6 times)
#
# Environment: HUB_REPO (owner/name), HUB_TOKEN, HUB_BRANCH (default gh-pages), GITHUB_SERVER_URL,
# HUB_REMOTE_URL (optional: full git URL, overrides the others).

pages_remote() {
  if [ -n "${HUB_REMOTE_URL:-}" ]; then echo "$HUB_REMOTE_URL"; return; fi # explicit override (GHES, mirrors, tests)
  local host="${GITHUB_SERVER_URL:-https://github.com}"
  host="${host#https://}"
  if [ -n "${HUB_TOKEN:-}" ]; then
    echo "https://x-access-token:${HUB_TOKEN}@${host}/${HUB_REPO}.git"
  else
    echo "https://${host}/${HUB_REPO}.git"
  fi
}

pages_clone() {
  local dir="$1" branch="${HUB_BRANCH:-gh-pages}" remote
  remote="$(pages_remote)"
  rm -rf "$dir"
  if git ls-remote --exit-code --heads "$remote" "$branch" >/dev/null 2>&1; then
    git clone --quiet --depth 1 --branch "$branch" "$remote" "$dir"
  else
    local where="${HUB_REPO}"
    [ -n "${HUB_REMOTE_URL:-}" ] && where="the configured remote"
    echo "Branch '$branch' does not exist in ${where} yet — it will be created."
    git init --quiet "$dir"
    git -C "$dir" checkout --quiet --orphan "$branch"
    git -C "$dir" remote add origin "$remote"
  fi
  git -C "$dir" config user.name "${HUB_GIT_NAME:-github-actions[bot]}"
  git -C "$dir" config user.email "${HUB_GIT_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
}

pages_commit_retry() {
  local dir="$1" message="$2" branch="${HUB_BRANCH:-gh-pages}" attempt
  shift 2
  for attempt in 1 2 3 4 5 6; do
    "$@" || return 1
    git -C "$dir" add -A
    if git -C "$dir" diff --cached --quiet; then
      echo "Nothing changed on $branch."
      return 0
    fi
    git -C "$dir" commit --quiet -m "$message"
    if git -C "$dir" push --quiet origin "HEAD:refs/heads/$branch" 2>/dev/null; then
      echo "Pushed to $branch (attempt $attempt)."
      return 0
    fi
    echo "Push rejected (attempt $attempt) — rebuilding on top of the latest ${branch}…"
    sleep $((attempt * 2 + RANDOM % 4))
    git -C "$dir" fetch --quiet --depth 1 origin "$branch"
    git -C "$dir" reset --quiet --hard FETCH_HEAD
    git -C "$dir" clean -qfdx
  done
  echo "::error::Could not push to $branch after $attempt attempts."
  return 1
}
