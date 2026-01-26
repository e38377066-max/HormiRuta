# Flask Web Application

## Overview
A Flask web application with PostgreSQL database, using Flask-SQLAlchemy for ORM and configured for autoscale deployment.

## Project Structure
```
├── app.py           # Flask application initialization and database setup
├── main.py          # Application entry point
├── models.py        # Database models (User model with Flask-Login)
├── routes.py        # Application routes
├── templates/       # HTML templates
│   └── index.html   # Main page template
└── static/          # Static assets
    └── css/
        └── style.css
```

## Recent Changes
- 2026-01-26: Initial migration from Replit Agent to Replit environment
- Set up Flask with SQLAlchemy and PostgreSQL
- Configured autoscale deployment with gunicorn

## Technology Stack
- **Backend**: Flask with Python 3.11
- **Database**: PostgreSQL with Flask-SQLAlchemy ORM
- **Authentication**: Flask-Login (ready for implementation)
- **WSGI Server**: Gunicorn
- **Frontend**: Bootstrap 5

## Development
- Run workflow "Start application" to start the development server
- Server runs on port 5000 with auto-reload enabled

## Deployment
- Configured for autoscale deployment
- Uses gunicorn as production WSGI server
