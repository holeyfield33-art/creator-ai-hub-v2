#!/usr/bin/env python3
import os
import re

# Model name mappings
model_mappings = {
    'prisma.campaign.': 'prisma.campaigns.',
    'prisma.campaign(': 'prisma.campaigns(',
    'prisma.job.': 'prisma.jobs.',
    'prisma.job(': 'prisma.jobs(',
    'prisma.generatedAsset.': 'prisma.generated_assets.',
    'prisma.generatedAsset(': 'prisma.generated_assets(',
}

# Relation field mappings
relation_mappings = {
    "'campaign'": "'campaigns'",
    '"campaign"': '"campaigns"',
    '.campaign ': '.campaigns ',
    'include: { sources:': 'include: { campaign_sources:',
    'include: { generatedAssets:': 'include: { generated_assets:',
    'include: { analyses:': 'include: { campaign_analysis:',
    'include: { scheduledPosts:': 'include: { scheduled_posts:',
    'include: { metrics:': 'include: { post_metrics:',
    'include:{sources:': 'include:{campaign_sources:',
    'include:{generatedAssets:': 'include:{generated_assets:',
    'include:{analyses:': 'include:{campaign_analysis:',
    'include:{scheduledPosts:': 'include:{scheduled_posts:',
    'include:{asset:': 'include:{generated_assets:',
    'include: { asset:': 'include: { generated_assets:',
    'include:{socialConnection:': 'include:{social_connections:',
    'include: { socialConnection:': 'include: { social_connections:',
}

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Apply model mappings
    for old, new in model_mappings.items():
        content = content.replace(old, new)
    
    # Apply relation mappings
    for old, new in relation_mappings.items():
        content = content.replace(old, new)
    
    # Write back if changed
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Walk through src directory
src_dir = '/workspaces/creator-ai-hub-v2/backend/src'
fixed_count = 0

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.ts'):
            filepath = os.path.join(root, file)
            if fix_file(filepath):
                print(f"Fixed: {filepath}")
                fixed_count += 1

print(f"\nTotal files fixed: {fixed_count}")
