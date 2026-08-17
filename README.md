# Tasks — v1.13

A lightweight personal task manager with optional private Dropbox sync.

## Data and sync

- Browser storage key: `tasks-v13`
- Dropbox data file: `/tasks.json` inside the connected Dropbox app folder
- Older `things-to-do` keys are migration-only fallbacks and do not replace current Tasks data
- Sync merges tasks, lists, folders, ordering, and deletion markers by item/update time

## v1.13

- Changed the app icon to the **circle-check-big** mark
- Kept the corrected Tasks data storage and Dropbox sync behavior from v1.11
- Retained the earlier Tasks tweaks: visible version number, clearer list/folder controls, larger folder headers, and **Delete all** in Completed

## Deployment

Upload the contents of this folder to the existing Tasks GitHub Pages repository root. The service worker cache is versioned as `tasks-v14`, so the new build will replace earlier cached assets.
