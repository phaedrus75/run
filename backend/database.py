"""
📚 DATABASE.PY - Database Connection & Setup
============================================

This file handles connecting to our database.

🎓 LEARNING NOTES:
- Locally uses SQLite (simple file-based database)
- In production uses PostgreSQL (robust cloud database)
- DATABASE_URL environment variable controls which one
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 📁 Database URL from environment, or use local SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./zenrun.db")

# 🔧 Railway uses postgres:// but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 🔧 Create the database engine based on database type
if DATABASE_URL.startswith("sqlite"):
    # SQLite needs special thread handling
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
else:
    # PostgreSQL - no special args needed
    engine = create_engine(DATABASE_URL)

# 🏭 Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 🏗️ Base class for our models
Base = declarative_base()


def get_db():
    """
    🎯 Dependency Injection for Database Sessions
    
    Creates a database session for each request and closes it when done.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
