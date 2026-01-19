# Use Python 3.11 image (not slim - need build tools for bcrypt)
FROM python:3.11

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Railway dynamically assigns)
EXPOSE 8000

# Use shell form for environment variable expansion
CMD ["/bin/sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]

