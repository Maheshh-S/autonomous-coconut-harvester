import sys
import os
import time
import requests
import random
import cv2
from ultralytics import YOLO

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from mapping.coverage_path import generate_lawnmower_path

API_URL_TREE = "http://127.0.0.1:8000/drone/tree_detected"
API_URL_DETECTION = "http://127.0.0.1:8000/drone/detection"

tree_model = YOLO("../models/tree_model/tree_detector.pt")
coconut_model = YOLO("../models/coconut_model/coconut_detector.pt")

IMAGE_POOL = [
    "drone_images/grid_0_0.jpg",
    "drone_images/grid_0_1.jpg",
    "drone_images/grid_0_2.jpg",
    "drone_images/grid_1_0.jpg",
    "drone_images/grid_1_1.jpg"
]

coconut_counter = 1

path = generate_lawnmower_path(
    lat_start=12.9715,
    lon_start=77.5941,
    rows=3,
    cols=3,
    step=0.0001
)

for gps_lat, gps_lon in path:

    print("\nDrone flying to:", gps_lat, gps_lon)

    image_path = random.choice(IMAGE_POOL)
    print("Captured image:", image_path)

    image = cv2.imread(image_path)

    tree_results = tree_model(image)

    for r in tree_results:

        boxes = r.boxes
        print("Trees detected:", len(boxes))

        for box in boxes:

            x1, y1, x2, y2 = map(int, box.xyxy[0])

            tree_crop = image[y1:y2, x1:x2]

            tree_lat = gps_lat + random.uniform(-0.00003, 0.00003)
            tree_lon = gps_lon + random.uniform(-0.00003, 0.00003)

            tree_response = requests.post(
                API_URL_TREE,
                params={
                    "gps_lat": tree_lat,
                    "gps_lon": tree_lon
                }
            )

            tree_data = tree_response.json()
            tree_id = tree_data.get("tree_id")

            print("Tree stored:", tree_data)

            coconut_results = coconut_model(tree_crop)

            for cr in coconut_results:

                c_boxes = cr.boxes

                print("Coconuts detected:", len(c_boxes))

                for cbox in c_boxes:

                    class_id = int(cbox.cls[0])
                    confidence = float(cbox.conf[0])

                    class_name = coconut_model.names[class_id]

                    detection = {
                        "tree_id": tree_id,
                        "coconut_id": coconut_counter,
                        "ripeness": class_name,
                        "confidence": confidence,
                        "harvest_type": "both"
                    }

                    coconut_counter += 1

                    response = requests.post(API_URL_DETECTION, json=detection)

                    print("Coconut stored:", response.json())

    time.sleep(1)

print("\nDrone coverage scan completed")