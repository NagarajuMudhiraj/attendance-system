"""
train.py
--------
Trains an LBPH face recognizer from the dataset folder.
Saves the trained model to python_core/trainer.yml.
Usage: python train.py
"""

import cv2
import numpy as np
import os
import json

def train_model():
    base_dir = os.path.dirname(__file__)
    dataset_dir = os.path.join(os.path.dirname(base_dir), 'dataset')
    
    if not os.path.exists(dataset_dir):
        print(f"ERROR: Dataset directory '{dataset_dir}' not found.")
        print("Please capture images first.")
        return

    recognizer = cv2.face.LBPHFaceRecognizer_create()
    face_samples = []
    labels = []
    
    # Map for non-numeric IDs (like MongoDB ObjectIDs)
    label_map = {}
    current_label = 0

    student_dirs = [d for d in os.listdir(dataset_dir)
                    if os.path.isdir(os.path.join(dataset_dir, d))]

    if not student_dirs:
        print("ERROR: No student folders found in dataset directory.")
        return

    print(f"[INFO] Found {len(student_dirs)} student(s) in dataset.")

    for student_id in student_dirs:
        student_path = os.path.join(dataset_dir, student_id)
        image_files = [f for f in os.listdir(student_path) if f.endswith('.jpg')]

        if len(image_files) == 0:
            continue

        # Create mapping
        label_map[current_label] = student_id
        label = current_label
        current_label += 1

        print(f"  -> Student ID: {student_id}, Label: {label}, Images: {len(image_files)}")

        for img_file in image_files:
            img_path = os.path.join(student_path, img_file)
            img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
            if img is not None:
                img = cv2.resize(img, (200, 200))
                face_samples.append(img)
                labels.append(label)

    if len(face_samples) == 0:
        print("ERROR: No valid face images found. Cannot train.")
        return

    print(f"[INFO] Training on {len(face_samples)} total images...")
    recognizer.train(face_samples, np.array(labels))

    # Save Model
    model_path = os.path.join(base_dir, 'trainer.yml')
    recognizer.write(model_path)
    
    # Save Label Map
    map_path = os.path.join(base_dir, 'label_map.json')
    with open(map_path, 'w') as f:
        json.dump(label_map, f)
        
    print(f"[DONE] Model saved to '{model_path}'")
    print(f"[DONE] Label map saved to '{map_path}'")

if __name__ == '__main__':
    train_model()

