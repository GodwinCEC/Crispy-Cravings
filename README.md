# Crispy Cravings 🍟🍪

Crispy Cravings is a small web app for ordering snacks online.  
It’s a static website built with **HTML, CSS, and JavaScript** and hosted on **Firebase Hosting**.  
Orders are stored in **Firebase Firestore**, with a simple admin dashboard for managing orders.

---

## Features

- Browse a menu of 10 snack items with images.
- Place an order by filling in your name, phone number, hostel, room number, and quantity.
- Admin dashboard to view, mark delivered, or cancel orders.
- Live status indicators for items (available / out of stock).
- Smooth "Back to Top" button and responsive mobile-first design.

---

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript  
- **Backend / Database:** Firebase Firestore  
- **Hosting:** Firebase Hosting  
- **Optional Tools:** Live Server (for local development), ngrok (for mobile testing)

---

## Getting Started (Local Development)

1. Clone the repo:

```bash
git clone https://github.com/YourUsername/crispy-cravings.git
cd crispy-cravings

    Install Firebase CLI (if not installed):

npm install -g firebase-tools

    Serve the site locally:

firebase serve --host 0.0.0.0 --port 5000

    Open your browser or mobile device to test (LAN IP or ngrok optional).