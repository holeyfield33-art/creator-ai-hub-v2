#!/usr/bin/env python3
import subprocess
import os

os.chdir('/workspaces/creator-ai-hub-v2')

def run_git(cmd):
    """Run git command and suppress stderr"""
    result = subprocess.run(
        f'git {cmd}',
        shell=True,
        capture_output=True,
        text=True
    )
    return result.stdout

print("===== Git Status =====")
print(run_git('status --short'))

print("\n===== Current Branch =====")
print(run_git('branch --show-current'))

print("\n===== Recent Commits =====")
print(run_git('log --oneline -3'))

print("\n===== Switching to develop =====")
print(run_git('checkout develop'))

print("\n===== Current Branch (after switch) =====")
print(run_git('branch --show-current'))

print("\n===== Creating Phase 10 Branch =====")
print(run_git('checkout -b feature/phase-10-social-integration'))

print("\n===== Final Branch =====")
print(run_git('branch --show-current'))

print("\n===== DONE =====")
