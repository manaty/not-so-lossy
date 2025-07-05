# Task Management Workflow

## Overview
This document outlines the workflow for managing tasks in the not-so-lossy project using our PROJECT_TODO.md master list and detailed task files.

## Directory Structure
```
/
├── PROJECT_TODO.md          # Master task list with links
└── .todo/                   # Detailed task files
    ├── WORKFLOW.md          # This file
    ├── TASK_TEMPLATE.md     # Template for new tasks
    └── P{phase}-{number}-{name}.md  # Individual task files
```

## Task File Naming Convention
`P{phase}-{number}-{task-name}.md`

## Workflow Steps

### 1. Creating a New Task
1. Add the task to PROJECT_TODO.md under the appropriate phase
2. Create a detailed task file in .todo/ using TASK_TEMPLATE.md
3. Link the task file from PROJECT_TODO.md

### 2. Starting a Task
1. Review the detailed task file
2. Update task status to "In Progress"
3. Follow the implementation steps outlined in the task file

### 3. Completing a Task
1. Check off all implementation steps
2. Verify acceptance criteria are met
3. Update task status to "Completed"
4. Update PROJECT_TODO.md checkbox

### 4. Handling Blockers
1. Document blockers in the task file
2. Update task status to "Blocked"
3. Create or reference blocking tasks
4. Communicate blockers to team

## Best Practices
- Keep task files updated with progress
- Break down complex tasks into smaller subtasks
- Document decisions and rationale
- Update dependencies when tasks are completed
- Review related tasks before starting new work