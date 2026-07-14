from ultralytics import YOLO
import requests

# backend API
API_URL = "http://127.0.0.1:8000/drone/detection"

# load YOLO model
model = YOLO("../models/coconut_model/coconut_detector.pt")

# image path
image_path = "test_image.jpg"

# run detection
results = model(image_path)

for r in results:

    boxes = r.boxes

    for i, box in enumerate(boxes):

        # Determine ripeness from the YOLO model's class prediction
        class_id = int(box.cls[0]) if hasattr(box, "cls") else int(box.cls)
        ripeness = model.names[class_id]

        detection = {
            "tree_id": 1,
            "coconut_id": i + 10,
            "ripeness": ripeness,
            "confidence": float(box.conf),
            "harvest_type": "both"
        }

        response = requests.post(API_URL, json=detection)

        print("Sent detection:", detection)
        print("API response:", response.json())