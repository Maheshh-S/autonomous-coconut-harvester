from fastapi import FastAPI
from api.detection_api import router as detection_router
from api.planner_api import router as planner_router
from api.robot_api import router as robot_router
from api.tree_api import router as tree_router
from api.drone_api import router as drone_router

app = FastAPI()

app.include_router(detection_router)
app.include_router(planner_router)
app.include_router(robot_router)
app.include_router(tree_router)
app.include_router(drone_router)

@app.get("/")
def root():
    return {"message": "Autonomous Coconut Harvesting System API running"}