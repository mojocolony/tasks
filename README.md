# Tasks — v1.11

A lightweight personal task manager with optional private Dropbox sync.

## Data and sync

- Browser storage key: `tasks-v2`
- Dropbox data file: `/tasks.json` inside the connected Dropbox app folder
- Older `things-to-do` keys are migration-only fallbacks and do not replace current Tasks data
- Sync merges tasks, lists, folders, ordering, and deletion markers by item/update time

## v1.11

- Corrected the v1.10 source regression so the app remains **Tasks** and uses the current Tasks data store
- Added a visible version number
- Standardized interface icons with Lucide
- Made New List and New Folder controls clearer
- Increased folder-header prominence relative to task-list names
- Added **Delete all** in Completed, with confirmation and deletion markers for Dropbox sync
- Preserved current sorting, appearance controls, sidebar drag ordering, and Dropbox migration behavior

## Deployment

Upload the contents of this folder to the existing Tasks GitHub Pages repository root. The service worker cache is versioned as `tasks-v11`, so the new build will replace earlier cached assets.
