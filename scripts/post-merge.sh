#!/bin/bash
# Runs after a merge from the agent's environment back to the main app.
# Standalone mode: no backend / database migrations to apply.
set -e
npm install
