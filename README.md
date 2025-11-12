# TESA Drone Backend

Backend API server for TESA drone tracking system with PostgreSQL database, MQTT ingestion, and WebSocket support.

## Features

- Drone detection tracking and storage
- Frame-based detection processing
- Mark/Zone management for map annotations
- RESTful API endpoints
- WebSocket real-time updates
- MQTT message ingestion
- PostgreSQL database with Prisma ORM

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up database (PostgreSQL):
```bash
docker-compose up -d db
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your DATABASE_URL
```

4. Run database migrations:
```bash
npm run prisma:migrate
```

## Development

Start development server:
```bash
npm run dev
```

The server will run on `http://localhost:3000`

## API Endpoints

### Marks
- `GET /marks` - Get all marks
- `GET /marks/:id` - Get mark by ID
- `POST /marks` - Create a new mark
- `PUT /marks/:id` - Update a mark
- `DELETE /marks/:id` - Delete a mark

### Drones
- `GET /drone/latest` - Get latest drone detection
- `GET /drone/history` - Get drone detection history
- `GET /drone/path` - Get drone flight path

### Health
- `GET /health` - Health check
- `GET /ready` - Readiness check

## API Documentation

Swagger UI available at: `http://localhost:3000/docs`

## Database Schema

See `prisma/schema.prisma` for the complete database schema.

## WebSocket

Connect to `ws://localhost:3000/ws` for real-time drone updates.

## License

ISC
