from fastapi import FastAPI
from api.detection_api import router as detection_router
from api.planner_api import router as planner_router
from api.robot_api import router as robot_router
from api.tree_api import router as tree_router
from api.drone_api import router as drone_router
from api.map_api import router as map_router
from api.harvest_planner import router as harvest_router
from fastapi.middleware.cors import CORSMiddleware
from api.coconut_api import router as coconut_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(detection_router)
app.include_router(planner_router)
app.include_router(robot_router)
app.include_router(tree_router)
app.include_router(drone_router)
app.include_router(map_router)
app.include_router(harvest_router)
app.include_router(coconut_router)



@app.get("/")
def root():
    return {"message": "Autonomous Coconut Harvesting System API running"}