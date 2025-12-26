
# 🍟 Crispy Cravings

[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

> A modern, responsive snack ordering web app for students. Order delicious snacks and get them delivered directly to your hostel room!

## ✨ Features

- **🍕 Static Menu**: Browse 10 delicious snack items with emoji displays
- **📱 Mobile-First Design**: Fully responsive, optimized for phones and tablets  
- **🛒 Simple Ordering**: Easy order form with hostel and room number delivery
- **⚡ Real-Time Updates**: Live order status updates for admins
- **🔐 Admin Authentication**: Secure admin login with Firebase Auth
- **📊 Admin Dashboard**: Manage orders, update status, control restaurant availability
- **🎯 Order Management**: Mark orders as delivered or cancelled
- **💫 Modern UI**: Clean design with smooth animations and micro-interactions

## 🚀 Live Demo

**Customer Site**: [https://your-project.web.app](https://your-project.web.app)  
**Admin Login**: [https://your-project.web.app/login.html](https://your-project.web.app/login.html)

### Demo Admin Credentials
- **Email**: `admin1@crispycravings.com`
- **Password**: `admin123`

## 📱 Screenshots

### Customer Experience
![Homepage](https://via.placeholder.com/800x400/FF6B35/FFFFFF?text=Menu+Page)
*Beautiful menu with emoji food items*

![Order Form](https://via.placeholder.com/800x400/FFD23F/333333?text=Order+Form)
*Simple order form with hostel selection*

### Admin Dashboard
![Admin Dashboard](https://via.placeholder.com/800x400/2C1810/FFFFFF?text=Admin+Dashboard)
*Real-time order management and statistics*

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **HTML5** | Structure and markup |
| **CSS3** | Styling with custom properties and animations |
| **Vanilla JavaScript** | Interactive functionality |
| **Firebase Hosting** | Static site hosting |
| **Firebase Firestore** | Real-time database for orders |
| **Firebase Authentication** | Secure admin login |

## 🏗️ Project Structure

```
crispy-cravings/
├── public/
│   ├── index.html          # Main menu page
│   ├── order.html          # Order form
│   ├── admin.html          # Admin dashboard
│   ├── login.html          # Admin login
│   ├── css/
│   │   └── style.css       # Main stylesheet
│   ├── js/
│   │   ├── app.js          # Menu functionality
│   │   ├── order.js        # Order form logic
│   │   ├── admin.js        # Admin dashboard
│   │   └── login.js        # Authentication
│   └── images/
├── firebase.json           # Firebase configuration
├── firestore.rules         # Database security rules
└── README.md
```

## ⚡ Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher)
- [Firebase CLI](https://firebase.google.com/docs/cli)
- A Firebase project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/crispy-cravings.git
   cd crispy-cravings
   ```

2. **Install Firebase CLI** (if not already installed)
   ```bash
   npm install -g firebase-tools
   ```

3. **Login to Firebase**
   ```bash
   firebase login
   ```

4. **Initialize Firebase project**
   ```bash
   firebase init
   # Select Hosting and Firestore
   # Choose your Firebase project
   # Set public directory to 'public'
   ```

5. **Update Firebase configuration**
   - Get your config from Firebase Console → Project Settings
   - Update `firebaseConfig` in all JavaScript files:
     - `public/js/app.js`
     - `public/js/order.js`
     - `public/js/admin.js`
     - `public/js/login.js`

6. **Set up Firestore**
   - Enable Firestore in Firebase Console
   - Create `admins` collection with admin user documents
   - Update security rules (see [Firestore Rules](#firestore-rules))

### Local Development

```bash
# Serve locally
firebase serve --host 0.0.0.0 --port 5000

# Open in browser
open http://localhost:5000
```

### Deployment

```bash
# Deploy to Firebase Hosting
firebase deploy

# Your site will be live at:
# https://your-project-id.web.app
```

## 🔐 Admin Setup

### 1. Enable Firebase Authentication
- Go to Firebase Console → Authentication
- Enable Email/Password sign-in method

### 2. Create Admin Users
In Firebase Console → Authentication → Users, add:
- `admin1@crispycravings.com`
- `admin2@crispycravings.com`
- `admin3@crispycravings.com`

### 3. Create Admins Collection
In Firestore, create collection `admins` with documents:

```
Document ID: admin1@crispycravings.com
{
  role: "admin",
  name: "Admin One"
}
```

### Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read access to settings
    match /settings/{document} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Orders: customers can create, admins can read/update
    match /orders/{document} {
      allow create: if true;
      allow read, update: if isAdmin();
    }
    
    // Admins collection - only admins can read
    match /admins/{document} {
      allow read: if isAdmin();
    }
    
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/admins/$(request.auth.token.email)) &&
             get(/databases/$(database)/documents/admins/$(request.auth.token.email)).data.role == 'admin';
    }
  }
}
```

## 📋 Menu Management

The menu is static and defined in `public/js/app.js`. To update menu items:

1. **Edit the `menuItems` array**:
   ```javascript
   const menuItems = [
     {
       id: 'new-snack',
       name: 'New Delicious Snack',
       description: 'Amazing new snack description',
       price: 12.99,
       emoji: '🥨',
       bgColor: 'linear-gradient(135deg, #ff6b35, #f7931e)'
     }
     // ... other items
   ];
   ```

2. **Deploy changes**:
   ```bash
   firebase deploy
   ```

## 🎨 Customization

### Colors
Update CSS custom properties in `public/css/style.css`:
```css
:root {
  --primary-orange: #FF6B35;
  --secondary-yellow: #FFD23F;
  --accent-red: #FF4444;
  /* ... other colors */
}
```

### Fonts
The app uses:
- **Display**: Fredoka (playful, for headings)
- **Body**: Inter (clean, for text)

## 🔧 Troubleshooting

### Common Issues

**Firebase Config Errors**
- Ensure all placeholder values are replaced with real Firebase config
- Check that project ID matches your Firebase project

**Authentication Issues**
- Verify admin users exist in Firebase Authentication
- Confirm admin documents exist in Firestore `admins` collection
- Check Firestore security rules are deployed

**Orders Not Saving**
- Check browser console for errors
- Verify Firestore rules allow order creation
- Ensure internet connectivity

### Debug Mode
For detailed logging, add to any JavaScript file:
```javascript
// Enable debug mode
console.log('Debug info:', { user, config, database });
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and structure
- Test on both desktop and mobile devices
- Update documentation for new features
- Ensure Firebase security rules remain secure

## 📊 Analytics & Monitoring

### Firebase Analytics
Add Firebase Analytics for insights:
```html
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics-compat.js"></script>
```

### Performance Monitoring
Monitor site performance with Firebase Performance:
```javascript
const perf = firebase.performance();
```

## 🔒 Security

- **Admin Authentication**: Only verified admins can access dashboard
- **Firestore Rules**: Database access strictly controlled
- **Input Validation**: All form inputs validated on client and server
- **HTTPS Only**: Deployed on Firebase Hosting with automatic HTTPS

## 📈 Future Enhancements

- [ ] SMS notifications for order updates
- [ ] Payment integration (Stripe/PayPal)
- [ ] Customer order tracking
- [ ] Inventory management
- [ ] Customer reviews and ratings
- [ ] Delivery time estimates
- [ ] Push notifications
- [ ] Multi-language support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 👨‍💻 Developer

**Godwin Mawulikplim**
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com
- Portfolio: [your-portfolio.com](https://your-portfolio.com)

## 🙏 Acknowledgments

- Firebase team for excellent backend services
- Google Fonts for beautiful typography
- Unsplash for placeholder images
- The open-source community for inspiration

---

<p align="center">
  Made with ❤️ for hungry students everywhere
</p>

<p align="center">
  <a href="#-crispy-cravings">⬆️ Back to top</a>
</p>
>>>>>>> 4fb2fc2 (new readme from Claude)
