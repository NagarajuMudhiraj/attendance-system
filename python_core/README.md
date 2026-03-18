# Face Recognition Module

## Workflow

### Step 1 — Install Python dependencies
```bash
cd python_core
pip install -r requirements.txt
```

### Step 2 — Start the Node.js server
```bash
npm run dev
```

### Step 3 — Capture a student's face dataset
```bash
cd python_core
python capture.py <numeric_student_id>
# e.g. python capture.py 1
# A webcam window will open. Face the camera — it captures 30 images automatically.
# Images are saved to: dataset/<student_id>/
```

### Step 4 — Train the model
```bash
cd python_core
python train.py
# Or trigger from the Node.js API:  POST /api/train
# Saves model to: python_core/trainer.yml
```

### Step 5 — Start the Flask recognition API
```bash
cd python_core
python recognize_api.py
# Runs on http://localhost:5000
```

### Step 6 — Use the Staff Dashboard
- Open http://localhost:3000
- Log in as Staff (staff / staff123)
- Start webcam on the Staff Dashboard
- Frames are sent to `/api/recognize` → Flask API → LBPH recognizer
- Recognized students are marked present automatically

---

## API Endpoints (Node.js — port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/login | User login |
| POST | /api/logout | Logout |
| GET | /api/students | Get all students |
| POST | /api/students | Add student |
| DELETE | /api/students/:id | Delete student |
| POST | /api/capture/:studentId | Capture face dataset |
| POST | /api/train | Trigger model training |
| GET | /api/recognize/health | Check if Flask API is running |
| POST | /api/recognize | Send frame for recognition |
| GET | /api/attendance | Get all attendance records |
| POST | /api/attendance/mark | Mark attendance manually |
| GET | /api/attendance/export | Download CSV |

## API Endpoints (Flask — port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| POST | /recognize | Send base64 image, get student_id + confidence |
| POST | /reload-model | Reload trained model |
