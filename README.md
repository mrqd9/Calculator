# 🧮 Adding Calculator Pro

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
![PWA](https://img.shields.io/badge/PWA-Ready-orange)
![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Mobile-green)

**Adding Calculator Pro** is a high-precision, billing-style web application designed for tallying long lists of numbers with total accuracy. Unlike standard calculators, it focuses on a persistent running history and live grand totals.

---

## 🚀 Key Features

* **Persistent Running History**: Every calculation is logged as a separate row, creating an audit trail of your work.
* **Live Grand Total**: A real-time summation of all history rows is displayed at the bottom for instant visibility.
* **🇮🇳 Indian Number System**: Automatically formats numbers with Indian standard comma placement (e.g., `1,00,000.00`).
* **Session Archive**: Cleared sessions aren't lost; the app stores your last 20 "cleared" lists for later review or restoration.
* **Interactive UI**: Supports swipe-to-delete gestures for individual rows and tap-to-expand for long equations.
* **Offline PWA**: Fully functional without an internet connection once installed on your device.

---

## 🛠️ Advanced Controls & Shortcuts

| Action | Control |
| :--- | :--- |
| **Delete Row** | Swipe Left on the specific history row. |
| **Expand Equation** | Tap on a row to see full details of long calculations. |
| **Quick Clear Input** | Long press the Backspace (⌫) button. |
| **Archive Session** | Tap the **AC** button to save the current list and reset. |
| **Copy Summary** | `Ctrl + C` or tap the Copy icon to copy the full list to clipboard. |
| **Print Report** | `Ctrl + P` or tap the Print icon for a formatted paper summary. |

---

## 📦 Technical Specifications

* **Precision Math**: Uses `Number.EPSILON` rounding to prevent floating-point errors in financial calculations.
* **Stack**: Vanilla JavaScript, CSS3, and HTML5. No heavy frameworks for maximum performance.
* **Storage**: Uses `localStorage` for data persistence across browser refreshes.
* **PWA**: Includes a `manifest.json` and Service Worker (`sw.js`) for offline installation.

---

## 📥 Installation

### Desktop
1. Visit the live URL in Chrome or Edge.
2. Click the "Install" icon in the address bar to use it as a desktop app.

### Mobile (Android/iOS)
1. Open the site in Safari (iOS) or Chrome (Android).
2. Tap **"Add to Home Screen"**.
3. The app will now appear in your app drawer and work offline.

---

## 📜 License & Ownership

**Copyright (C) 2026 mrqd9**.

This project is licensed under the **GNU General Public License v3 (GPL-3.0)**. 

### Why GPL-3.0?
We believe in open software. This license ensures:
1.  The code stays free and open-source forever.
2.  Anyone who modifies this code must share their improvements back with the community.
3.  Your contributions and our original work are legally protected from being turned into "closed" proprietary software.

---

**Developed with ❤️ by [mrqd9](https://github.com/mrqd9)**
