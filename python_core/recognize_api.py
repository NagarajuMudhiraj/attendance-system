"""
recognize_api.py
----------------
A Flask REST API that receives an image frame (base64 encoded),
performs face detection + LBPH recognition, and returns the recognized
student ID and confidence score.

Run this alongside the Node.js server:
    python recognize_api.py

It will start on http://localhost:5000
"""

import cv2
import numpy as np
import base64
import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'trainer.yml')
MAP_PATH = os.path.join(os.path.dirname(__file__), 'label_map.json')

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
)

recognizer = None
label_map = {}

def load_model():
    global recognizer, label_map
    if os.path.exists(MODEL_PATH):
        recognizer = cv2.face.LBPHFaceRecognizer_create()
        recognizer.read(MODEL_PATH)
        print(f"[INFO] Model loaded from: {MODEL_PATH}")
        
        # Load label map if exists
        if os.path.exists(MAP_PATH):
            with open(MAP_PATH, 'r') as f:
                label_map = json.load(f)
            print(f"[INFO] Label map loaded: {len(label_map)} IDs")
    else:
        print(f"[WARNING] No trained model found at {MODEL_PATH}. Please run train.py first.")

def decode_image(base64_str):
    """Decode a base64 image string to a numpy array."""
    if ',' in base64_str:
        base64_str = base64_str.split(',')[1]
    img_bytes = base64.b64decode(base64_str)
    np_arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return img


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    model_loaded = recognizer is not None
    return jsonify({
        'status': 'ok',
        'model_loaded': model_loaded,
        'ids_count': len(label_map)
    })


@app.route('/recognize', methods=['POST'])
def recognize():
    """
    Accepts a JSON body: { "image": "<base64-encoded image>" }
    Returns: { "recognized": true/false, "student_id": string, "confidence": float, "faces_found": int }
    """
    if recognizer is None:
        return jsonify({
            'recognized': False,
            'error': 'Model not loaded. Please train the model first.',
            'faces_found': 0
        }), 503

    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({'error': 'No image provided'}), 400

    try:
        img = decode_image(data['image'])
        if img is None:
            return jsonify({'error': 'Invalid image data'}), 400

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.3,
            minNeighbors=5,
            minSize=(80, 80)
        )

        if len(faces) == 0:
            return jsonify({
                'recognized': False,
                'faces_found': 0,
                'message': 'No face detected in frame'
            })

        # Use the first (largest) detected face
        (x, y, w, h) = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)[0]
        face_roi = gray[y:y+h, x:x+w]
        face_roi = cv2.resize(face_roi, (200, 200))

        label_int, confidence = recognizer.predict(face_roi)

        # Map back to string ID
        student_id = label_map.get(str(label_int), str(label_int))

        # LBPH confidence: lower = better match. < 100 is acceptable
        CONFIDENCE_THRESHOLD = 100
        recognized = confidence < CONFIDENCE_THRESHOLD

        return jsonify({
            'recognized': recognized,
            'student_id': student_id,
            'confidence': round(float(confidence), 2),
            'faces_found': len(faces),
            'face_bounds': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
        })

    except Exception as e:
        print(f"[ERROR] Recognition failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/reload-model', methods=['POST'])
def reload_model():
    """Reload the trained model (call this after training)."""
    load_model()
    return jsonify({'status': 'ok', 'model_loaded': recognizer is not None})


if __name__ == '__main__':
    load_model()
    print("[INFO] Flask recognition API running on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)

