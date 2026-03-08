import os
import time
import requests
from ultralytics import YOLO

# Backend APIs
API_URL_TREE = "http://127.0.0.1:8000/drone/tree_detected"
API_URL_DETECTION = "http://127.0.0.1:8000/drone/detection"

# Load trained tree detector
model = YOLO("../models/tree_model/tree_detector.pt")

# Coconut counter only (tree_id comes from backend)
coconut_counter = 1

IMAGE_FOLDER = "drone_images"

# Fake GPS grid for simulation
BASE_LAT = 12.9715
BASE_LON = 77.5941
STEP = 0.0001


for image_file in os.listdir(IMAGE_FOLDER):

    if not image_file.startswith("grid"):
        continue

    # Extract grid position
    grid_pos = image_file.replace(".jpg", "").split("_")
    row = int(grid_pos[1])
    col = int(grid_pos[2])

    gps_lat = BASE_LAT + (row * STEP)
    gps_lon = BASE_LON + (col * STEP)

    image_path = os.path.join(IMAGE_FOLDER, image_file)

    print("\nDrone scanning:", image_file)
    print("GPS:", gps_lat, gps_lon)

    # Run tree detection
    results = model(image_path)

    for r in results:
        boxes = r.boxes

        print("Trees detected:", len(boxes))

        for box in boxes:

            # Store tree in backend
            tree_response = requests.post(
                API_URL_TREE,
                params={
                    "gps_lat": gps_lat,
                    "gps_lon": gps_lon
                }
            )

            tree_data = tree_response.json()
            tree_id = tree_data.get("tree_id")

            print("Tree stored:", tree_data)

            # Create coconut detection linked to tree
            detection = {
                "tree_id": tree_id,
                "coconut_id": coconut_counter,
                "ripeness": "mature",  # placeholder until coconut model
                "confidence": float(box.conf[0])
            }

            coconut_counter += 1

            response = requests.post(API_URL_DETECTION, json=detection)

            print("Coconut stored:", response.json())

    time.sleep(2)

print("\nDrone scan completed")