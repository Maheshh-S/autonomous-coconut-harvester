from fastapi import APIRouter
from database.db import SessionLocal
from database.models import Tree
import time

router = APIRouter()

