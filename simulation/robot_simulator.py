import requests
import time

BASE_URL = "http://127.0.0.1:8000"


def get_next_task():
    r = requests.get(f"{BASE_URL}/robot/next_task")
    return r.json()


def complete_task(task_id):
    r = requests.post(
        f"{BASE_URL}/robot/complete_task",
        json={"task_id": task_id}
    )
    return r.json()


while True:

    task = get_next_task()

    if "task_id" not in task:
        print("No pending tasks")
        time.sleep(5)
        continue

    print("Robot received task:", task)

    print("Harvesting coconut...")
    time.sleep(5)

    result = complete_task(task["task_id"])

    print("Task completed:", result)

    time.sleep(2)