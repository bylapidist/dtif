# Claude Agent Guidelines

This directory contains structured guidelines for Claude AI agents working on the DTIF repository. These files provide comprehensive context about the project structure, workflows, and best practices.

## Purpose

These guidelines help Claude agents:
- Understand the project architecture and conventions
- Follow consistent development workflows
- Make appropriate decisions about testing and quality
- Navigate the monorepo workspace structure
- Create proper commits and changesets

## File Overview

### `.clauderc` (Root)
Main configuration file with high-level project overview, quick reference commands, and critical reminders. Read this first for context.

### `WORKFLOW.md`
Step-by-step development workflows for common tasks:
- Making code changes
- Running checks and tests
- Creating changesets
- Committing and pushing changes
- Task-specific workflows (adding features, fixing bugs, etc.)

**Use this when:** Starting any development work or unsure about the process

### `TESTING.md`
Comprehensive testing guide covering:
- Test structure and organization
- Running different types of tests
- Writing new tests
- Debugging test failures
- Testing best practices

**Use this when:** Writing tests, debugging failures, or verifying changes

### `WORKSPACES.md`
Monorepo workspace architecture guide:
- Detailed breakdown of each workspace
- Dependencies between workspaces
- When and how to modify each workspace
- Cross-workspace development patterns

**Use this when:** Understanding project structure or making changes across multiple packages

## Quick Start for Claude Agents

1. **Read `.clauderc`** in the repository root for project overview
2. **Identify the task type** (feature, bug fix, docs, etc.)
3. **Reference `WORKFLOW.md`** for the appropriate workflow
4. **Consult `WORKSPACES.md`** to understand affected packages
5. **Use `TESTING.md`** to ensure proper test coverage
6. **Follow pre-commit checklist** before creating commits

## Key Principles

### Always Required
- Run all quality checks before committing
- Create changesets for user-facing changes
- Follow Conventional Commits format
- Test incrementally as you work
- Keep commits atomic and focused

### Never Do
- Commit code that fails tests
- Skip required pre-commit checks
- Disable linting rules
- Bundle unrelated changes
- Create changesets for docs/tests/refactors

## Common Scenarios

### "I need to add a new feature"
1. Read `WORKFLOW.md` → "Adding a New Token Type" or relevant section
2. Check `WORKSPACES.md` → Identify affected packages
3. Follow `TESTING.md` → Write tests for the feature
4. Use `WORKFLOW.md` → Pre-commit validation checklist
5. Create changeset with appropriate semver bump

### "I need to fix a bug"
1. Read `WORKFLOW.md` → "Fixing a Bug" section
2. Write failing test first (see `TESTING.md`)
3. Make the fix
4. Run all required checks
5. Create changeset (patch bump)

### "I'm updating documentation"
1. Read `WORKFLOW.md` → "Updating Documentation" section
2. Check `WORKSPACES.md` → Documentation workspace details
3. Test locally with `npm run docs:dev`
4. No changeset needed for docs-only changes

### "Tests are failing"
1. Read `TESTING.md` → "Debugging Test Failures" section
2. Run tests locally to reproduce
3. Check for environment differences
4. Fix issue and verify all tests pass

## Integration with AGENTS.md

These Claude guidelines expand on `AGENTS.md` (which is oriented toward Codex/human developers):

| AGENTS.md | Claude Guidelines |
|-----------|-------------------|
| High-level rules | Detailed workflows and context |
| What to do | How to do it + why |
| Checklist format | Step-by-step guides |
| Assumes human knowledge | Assumes AI agent learning the codebase |

Both should be kept in sync when project conventions change.

## Maintenance

When updating these guidelines:

### Update `.clauderc` when:
- Project requirements change (Node.js version, etc.)
- New workspaces are added
- Critical workflows change
- Common commands are added/removed

### Update `WORKFLOW.md` when:
- Development processes change
- New task types become common
- Pre-commit requirements change
- Release process evolves

### Update `TESTING.md` when:
- Testing framework changes
- New test types are added
- Testing conventions change
- Common issues are discovered

### Update `WORKSPACES.md` when:
- Workspaces are added/removed/renamed
- Dependencies between workspaces change
- Build processes change
- New conventions are established

## For Human Developers

These files are optimized for AI agents but can be useful for:
- New contributors learning the project
- Reference documentation for workflows
- Understanding monorepo structure
- Onboarding documentation

Human developers should also consult:
- `AGENTS.md` - Concise checklist
- `CONTRIBUTING.md` - Contribution guidelines
- `README.md` - Project overview
- Workspace-specific READMEs

## Version Control

These files are version controlled and should be:
- Updated when processes change
- Reviewed during PRs that change workflows
- Kept consistent with `AGENTS.md`
- Referenced in commit messages when relevant

## Feedback

If these guidelines are unclear or incomplete:
1. Update them with the missing information
2. Include the update in your changeset
3. Document why the change was needed

The goal is continuous improvement of AI agent guidance.
