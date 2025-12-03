# WarmPaws - Pet Adoption Platform

WarmPaws is a comprehensive pet adoption platform connecting loving homes with pets in need. The platform features a modern web interface and a robust backend API built with Node.js, Express, and Supabase.

## Project Structure

```
warmpaws-capstone/
├── frontend/           # Frontend HTML/CSS files
│   ├── index.html
│   ├── browse.html
│   ├── gallery.html
│   ├── detail.html
│   ├── sell.html
│   ├── contact.html
│   ├── login.html
│   ├── project.css
│   └── images/
└── backend/            # Backend API
    ├── src/
    │   ├── config/         # Configuration files
    │   ├── controllers/    # Request handlers
    │   ├── routes/         # API routes
    │   ├── middleware/     # Express middleware
    │   ├── database/       # SQL schemas and migrations
    │   └── server.js       # Main server file
    ├── package.json
    └── .env.example
```

## Backend Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your:
   - Project URL
   - Anon/Public Key
   - Service Role Key (keep this secret!)

### 3. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
PORT=3000
NODE_ENV=development

SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

CORS_ORIGIN=http://localhost:5173
```

### 4. Set Up Database Schema

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `backend/src/database/schema.sql`
4. Paste and run it in the SQL Editor

This will create:
- Users table (extends Supabase Auth)
- Pets table
- Adoption applications table
- Favorites table
- Row Level Security (RLS) policies
- Database triggers and functions

### 5. (Optional) Seed Sample Data

To add sample pet data for testing:

1. First create a user account through Supabase Auth
2. Copy your user ID from the Authentication section
3. Edit `backend/src/database/seed.sql` and update the owner_id values
4. Run the seed.sql in Supabase SQL Editor

### 6. Start the Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

Health check: `http://localhost:3000/health`

## API Documentation

### Authentication Endpoints

#### Sign Up
```
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "John Doe"
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Get Profile
```
GET /api/auth/profile
Authorization: Bearer <access_token>
```

#### Logout
```
POST /api/auth/logout
```

### Pets Endpoints

#### Get All Pets
```
GET /api/pets?species=dog&status=available&limit=50&offset=0
```

Query parameters:
- `species`: Filter by species (dog, cat, bird, rabbit, other)
- `breed`: Filter by breed (partial match)
- `age_min`: Minimum age in years
- `age_max`: Maximum age in years
- `status`: Filter by status (available, pending, adopted, unavailable)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

#### Get Pet by ID
```
GET /api/pets/:id
```

#### Create Pet Listing (Authenticated)
```
POST /api/pets
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Max",
  "species": "dog",
  "breed": "Golden Retriever",
  "age_years": 3,
  "age_months": 0,
  "gender": "male",
  "size": "large",
  "color": "Golden",
  "description": "Friendly dog looking for a loving home",
  "health_status": "Healthy",
  "vaccination_status": "Up to date",
  "spayed_neutered": true,
  "good_with_kids": true,
  "good_with_dogs": true,
  "good_with_cats": true,
  "energy_level": "high",
  "adoption_fee": 250.00,
  "location_city": "San Francisco",
  "location_state": "CA"
}
```

#### Update Pet (Authenticated - Owner Only)
```
PUT /api/pets/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "description": "Updated description",
  "status": "adopted"
}
```

#### Delete Pet (Authenticated - Owner Only)
```
DELETE /api/pets/:id
Authorization: Bearer <access_token>
```

### Users Endpoints

#### Get User
```
GET /api/users/:id
```

#### Update User (Authenticated - Own Profile Only)
```
PUT /api/users/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "full_name": "John Doe",
  "phone": "555-1234",
  "city": "San Francisco",
  "state": "CA"
}
```

#### Get User's Pets
```
GET /api/users/:id/pets
```

## Security Features

- **Helmet.js**: Security headers
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: API rate limiting to prevent abuse
- **Row Level Security**: Database-level access control via Supabase RLS
- **Authentication**: JWT-based auth via Supabase Auth

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Server port | No (default: 3000) |
| NODE_ENV | Environment (development/production) | No (default: development) |
| SUPABASE_URL | Supabase project URL | Yes |
| SUPABASE_ANON_KEY | Supabase anonymous key | Yes |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key | Yes |
| CORS_ORIGIN | Allowed CORS origin | No (default: http://localhost:5173) |
| RATE_LIMIT_WINDOW_MS | Rate limit window in ms | No (default: 900000) |
| RATE_LIMIT_MAX_REQUESTS | Max requests per window | No (default: 100) |

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon for automatic server restarts on file changes.

### Running in Production Mode

```bash
npm start
```

## Database Schema

### Tables

- **users**: Extended user profiles (linked to Supabase Auth)
- **pets**: Pet listings with detailed information
- **adoption_applications**: Adoption application submissions
- **favorites**: User's favorite pets

### Key Features

- Automatic timestamp management (created_at, updated_at)
- Row Level Security policies for data protection
- Foreign key constraints for data integrity
- Indexes for optimized query performance
- Trigger-based user profile creation

## Frontend

The frontend consists of static HTML/CSS files located in the `frontend/` directory. To serve them:

1. Use a simple HTTP server:
```bash
cd frontend
python -m http.server 5173
```

2. Or use VS Code Live Server extension

3. Or integrate with a frontend framework (React, Vue, etc.)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC

## Support

For issues and questions, please open an issue in the repository.
