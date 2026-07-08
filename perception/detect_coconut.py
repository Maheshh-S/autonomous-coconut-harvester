from ultralytics import YOLO
import requests

# backend API
API_URL = "http://127.0.0.1:8000/drone/detection"

# load YOLO model
model = YOLO("yolov8n.pt")

# image path
image_path = "test_image.jpg"

# run detection
results = model(image_path)

for r in results:

    boxes = r.boxes

    for i, box in enumerate(boxes):

        detection = {
            "tree_id": 1,
            "coconut_id": i + 10,
            "ripeness": "mature",
            "confidence": float(box.conf),
            "harvest_type": "both"
        }

        response = requests.post(API_URL, json=detection)

        print("Sent detection:", detection)
        print("API response:", response.json())