# Quizzie - Online Quiz Platform

A modern, full-featured online quiz platform built with React, Firebase, and Tailwind CSS. Teachers can create classes, post lessons with attachments, and create quizzes. Students can join classes, view lessons, and take quizzes.

## Features

### For Teachers
- 📚 Create and manage classes
- 📝 Post lessons with PDF attachments and links
- ✅ Create quizzes with multiple choice and enumeration questions
- 📊 View student results and analytics
- 🗑️ Delete classes with cascade deletion
- 👥 Manage enrolled students

### For Students
- 🎓 Join classes using class codes
- 📖 View lessons and download materials
- 📝 Take quizzes with instant feedback
- 📈 Track grades and progress
- ⏰ See quiz deadlines

### General
- 🔐 Secure authentication with email verification
- 📱 Fully responsive mobile design
- 🎨 Modern, clean UI with Tailwind CSS
- ☁️ Cloud storage for lesson files
- 🔒 Firebase Security Rules protection

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Routing**: React Router
- **State Management**: React Hooks

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- Firebase account

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd quizzie
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add your Firebase configuration:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

4. **Set up Firebase Security Rules**

See [SECURITY_SETUP.md](./SECURITY_SETUP.md) for detailed instructions on:
- Firestore Security Rules
- Storage Security Rules
- API key restrictions
- Additional security measures

5. **Run the development server**
```bash
npm run dev
```

Visit `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The build output will be in the `dist` folder.

## Project Structure

```
quizzie/
├── src/
│   ├── components/
│   │   ├── auth/          # Login, Register, Email Verification
│   │   ├── teacher/       # Teacher Dashboard, Class Details
│   │   └── student/       # Student Dashboard, Class View, Take Quiz
│   ├── config/
│   │   └── firebase.js    # Firebase configuration
│   ├── services/
│   │   ├── api.js         # API service layer
│   │   └── AuthService.js # Authentication service
│   ├── context/
│   │   └── AuthContext.jsx # Auth context provider
│   ├── App.jsx            # Main app component
│   └── main.jsx           # Entry point
├── .env                   # Environment variables (not in git)
├── .env.example           # Environment template
├── SECURITY_SETUP.md      # Security configuration guide
└── FEATURES_ADDED.md      # Feature documentation
```

## Security

⚠️ **Important**: Your Firebase API key being visible in the browser is normal and safe. Firebase uses Security Rules to protect your data, not API key secrecy.

**Read [SECURITY_SETUP.md](./SECURITY_SETUP.md) for:**
- Why API keys are public (and that's OK)
- How to set up Firebase Security Rules
- Additional security measures
- What attackers can and cannot do

## Features Documentation

See [FEATURES_ADDED.md](./FEATURES_ADDED.md) for detailed documentation on:
- Lesson posting with file attachments
- Quiz enumeration questions
- Delete class functionality
- Mobile responsive design

## Deployment

### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

### Vercel
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm install -g netlify-cli
netlify deploy
```

**Remember to add environment variables in your hosting platform!**

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue on GitHub.
