from ultralytics import YOLO

# load trained tree detector
model = YOLO("../models/tree_model/tree_detector.pt")

# test on one of your drone images
results = model("drone_images/grid_0_1.jpg")

for r in results:
    boxes = r.boxes
    print("Trees detected:", len(boxes))