# AirDraw — Beyond The Brush

A gesture-based drawing application with user authentication and personal galleries.

## Features

- **Hand Gesture Drawing**: Use hand tracking to draw with index finger
- **Multiple Tools**: Drawing, text, shapes, and eraser modes
- **User Authentication**: Login system with personal galleries
- **Gallery Management**: Save, load, and export artwork
- **Export Options**: PDF, PowerPoint, and ZIP formats

## Setup

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp env.example .env
```

4. Update the `.env` file with your MongoDB URI and JWT secret.

5. Start the backend server:
```bash
npm start
```

The backend will run on `http://localhost:5000`.

### Frontend Setup

1. Open `index.html` in your browser or serve with a web server:
```bash
# Using Python
python -m http.server 8000

# Or using Node.js
npx serve .
```

2. Navigate to `http://localhost:8000` (or your server address).

## User Authentication

The application uses MongoDB for user management. Users can log in with:
- Email or username
- Password

Each user has their own personal gallery that's isolated from other users.

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Gallery
- `GET /api/gallery` - Get user's gallery
- `POST /api/gallery` - Save artwork
- `DELETE /api/gallery/:id` - Delete artwork

## Hand Gestures

- **Index Finger**: Draw
- **Open Hand**: Erase/Drag text and shapes
- **Peace Sign**: Place shapes/Stop editing

## File Structure

```
├── index.html          # Login page
├── airdraw.html        # Main application
├── script-auth.js      # Authentication logic
├── script-main.js      # Main application logic
├── script-handling.js  # Hand tracking and gestures
├── script-gallery.js   # Gallery management
├── style.css           # Styles
└── backend/            # Node.js backend
    ├── server.js       # Express server
    ├── models/         # Mongoose models
    ├── routes/         # API routes
    └── package.json    # Dependencies
```

## Dependencies

### Backend
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- bcryptjs for password hashing

### Frontend
- MediaPipe for hand tracking
- jsPDF for PDF export
- JSZip for ZIP export

## Development

To start development:
1. Start the backend server: `npm run dev` (in backend directory)
2. Open the frontend in your browser
3. Login with existing user credentials or create new users directly in MongoDB

## Notes

- The application requires camera permissions for hand tracking
- Artwork is stored per-user in MongoDB
- Local storage fallback available if server is unreachable
