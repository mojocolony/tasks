# Tasks

A small browser-based to-do app built around Inbox, Today, custom lists, and folders/projects.

## How it is organized
- **Inbox** is the permanent capture list for tasks you have not filed elsewhere.
- **Today** is a focus view, not a storage location. A task can live in any list and also appear in Today.
- Create as many **custom lists** as you want.
- Group lists inside **folders / projects / areas**. The app does not impose a productivity framework on what those containers mean.
- **Completed** is an archive.

## Features
- Add/edit/delete tasks
- **Q** keyboard shortcut for Quick Add: type a task and press Enter to send it straight to Inbox
- Optional Today flag, due date, priority, tags, and notes
- Search and tag filtering
- Drag tasks with a grab handle to reorder them within Inbox, a custom list, or Today
- Create, rename, move, and delete lists
- Create, rename, and delete folders/projects
- Deleting a list moves its tasks safely to Inbox
- Deleting a folder keeps its lists and simply moves them out of the folder
- Local browser saving
- Export/import JSON backups
- Optional Dropbox sync using OAuth 2 + PKCE
- Installable as a PWA when hosted on HTTPS

## Migration from the first prototype
If the earlier prototype exists in the same browser, its tasks are migrated automatically. Old Upcoming and Someday tasks become custom lists; old Today tasks become Inbox tasks marked for Today.

## Try it locally
Open `index.html` in a modern browser. Everything except Dropbox sync will work immediately.

## GitHub Pages
Upload all files in this folder to the root of a GitHub repository, then enable:
Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

## Dropbox sync
You can reuse the Dropbox app you already use for your other personal apps.

1. Host Tasks on GitHub Pages first.
2. In the Dropbox App Console, add the exact Do Me GitHub Pages URL under OAuth 2 → Redirect URIs.
3. Make sure `files.content.read` and `files.content.write` are enabled.
4. In Do Me → Settings, paste the same Dropbox App key and choose Connect Dropbox.

For compatibility with earlier builds, Tasks continues to store its Dropbox data in `/things-to-do.json` inside the Dropbox app folder, separate from your other apps. Tasks, lists, and folders are merged individually during sync, with deletion markers to avoid deleted items reappearing on another device.


Folder headings include a disclosure button; click the chevron or folder name to collapse or expand the lists inside.
