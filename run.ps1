# Smart Attendance System - Unified Start Script

echo "=================================================="
echo "   Starting Smart Attendance System..."
echo "=================================================="

# Flush DNS to ensure fresh resolution
echo "[*] Flushing DNS cache..."
ipconfig /flushdns
echo ""

# Function to clear a port if it's in use
function Stop-ProcessOnPort($port) {
    echo "[*] Checking port $port..."
    $processId = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
    if ($processId) {
        echo "[!] Port $port is in use by PID $processId. Terminating..."
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
}

# Clear any existing processes on ports 3000 and 5000
Stop-ProcessOnPort 3000
Stop-ProcessOnPort 5000

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    echo "[!] node_modules not found. Installing dependencies..."
    npm install
}

# 1. Start Python Recognition API in a new window
echo "[1] Launching Python Recognition API (Flask)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd python_core; python recognize_api.py"

# 2. Wait a few seconds for Python to initialize
Start-Sleep -Seconds 3

# 3. Start Node.js Server in the current terminal logic
echo "[2] Launching Node.js Server..."
npm run dev

echo "=================================================="
echo "   System is running!"
echo "   Frontend: http://localhost:3000"
echo "   Python API: http://localhost:5000"
echo "=================================================="
