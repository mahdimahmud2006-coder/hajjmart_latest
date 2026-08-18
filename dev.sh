#!/bin/bash

# Configuration
FRONTEND_PORT=3000
BACKEND_PORT=8000

clear_ports() {
    echo "Clearing ports $FRONTEND_PORT and $BACKEND_PORT..."
    for PORT in $FRONTEND_PORT $BACKEND_PORT; do
        # Try using lsof
        if command -v lsof >/dev/null 2>&1; then
            PIDS=$(lsof -t -i:$PORT 2>/dev/null)
            if [ -n "$PIDS" ]; then
                echo "Killing processes on port $PORT: $PIDS"
                kill -9 $PIDS 2>/dev/null || true
            fi
        fi
        
        # Try using fuser as fallback
        if command -v fuser >/dev/null 2>&1; then
            fuser -k -n tcp $PORT >/dev/null 2>&1 || true
        fi
    done
}

cleanup() {
    echo ""
    echo "Stopping development servers gracefully..."
    
    # Terminate background processes
    if [ -n "$FRONTEND_PID" ]; then
        echo "Terminating frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    if [ -n "$BACKEND_PID" ]; then
        echo "Terminating backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
    fi

    if [ -n "$QUEUE_PID" ]; then
        echo "Terminating queue worker (PID: $QUEUE_PID)..."
        kill $QUEUE_PID 2>/dev/null || true
    fi

    if [ -n "$SCHEDULE_PID" ]; then
        echo "Terminating scheduler (PID: $SCHEDULE_PID)..."
        kill $SCHEDULE_PID 2>/dev/null || true
    fi
    
    sleep 1
    
    # Ensure they are dead
    if [ -n "$FRONTEND_PID" ]; then
        kill -9 $FRONTEND_PID 2>/dev/null || true
    fi
    if [ -n "$BACKEND_PID" ]; then
        kill -9 $BACKEND_PID 2>/dev/null || true
    fi
    if [ -n "$QUEUE_PID" ]; then
        kill -9 $QUEUE_PID 2>/dev/null || true
    fi
    if [ -n "$SCHEDULE_PID" ]; then
        kill -9 $SCHEDULE_PID 2>/dev/null || true
    fi

    # Clear ports again to make absolutely sure nothing is left hanging
    clear_ports
    
    echo "Cleanup complete."
    exit 0
}

# Trap signals for graceful shutdown
trap cleanup SIGINT SIGTERM

# 1. Clear ports before starting
clear_ports

# 2. Start Backend
echo "Starting Laravel backend..."
cd Backend
php artisan serve --port=$BACKEND_PORT &
BACKEND_PID=$!

echo "Starting Laravel queue worker..."
php artisan queue:work &
QUEUE_PID=$!

echo "Starting Laravel scheduler..."
php artisan schedule:work &
SCHEDULE_PID=$!
cd ..

# 3. Start Frontend
echo "Starting Next.js frontend..."
cd Frontend
rm -rf .next
npm run dev -- -p $FRONTEND_PORT &
FRONTEND_PID=$!
cd ..

echo "----------------------------------------"
echo "Development servers are running!"
echo "Backend:         http://127.0.0.1:$BACKEND_PORT"
echo "Frontend:        http://127.0.0.1:$FRONTEND_PORT"
echo "Queue Worker:    php artisan queue:work"
echo "Schedule Worker: php artisan schedule:work"
echo "Press Ctrl+C to stop all processes."
echo "----------------------------------------"

# Wait for background jobs
wait $BACKEND_PID $FRONTEND_PID $QUEUE_PID $SCHEDULE_PID
