"""
capture.py
----------
Captures 30 face images for a student and saves them to the dataset folder.
Usage: python capture.py <student_id>
"""

import cv2
import os
import sys

def capture_dataset(student_id):
    dataset_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dataset')
    student_dir = os.path.join(dataset_dir, str(student_id))
    os.makedirs(student_dir, exist_ok=True)

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Cannot open webcam")
        sys.exit(1)

    count = 0
    total = 30
    print(f"[INFO] Starting capture for student ID: {student_id}")
    print("[INFO] Press 'q' to quit early.")

    while count < total:
        ret, frame = cap.read()
        if not ret:
            print("ERROR: Failed to read frame.")
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)

        for (x, y, w, h) in faces:
            count += 1
            face_img = gray[y:y+h, x:x+w]
            face_img = cv2.resize(face_img, (200, 200))
            filename = os.path.join(student_dir, f"{count}.jpg")
            cv2.imwrite(filename, face_img)
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            cv2.putText(frame, f"Captured: {count}/{total}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        cv2.imshow(f"Capturing - Student {student_id}", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print(f"[DONE] Captured {count} images for student {student_id} in '{student_dir}'")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python capture.py <student_id>")
        sys.exit(1)
    capture_dataset(sys.argv[1])
