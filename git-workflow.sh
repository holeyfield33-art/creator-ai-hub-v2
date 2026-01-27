#!/bin/bash
cd /workspaces/creator-ai-hub-v2
echo "=== Current status ==="
git status --short
git branch --show-current
echo ""
echo "=== Recent commits ==="
git log --oneline -3
echo ""
echo "=== Switching to develop ==="
git checkout develop
echo "Current branch: $(git branch --show-current)"
echo ""
echo "=== Creating phase 10 branch ==="
git checkout -b feature/phase-10-social-integration
echo "Current branch: $(git branch --show-current)"
echo ""
echo "=== Done ==="
