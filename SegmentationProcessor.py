# Import necessary libraries
from ultralytics import YOLO
import numpy as np

# Define a class for image segmentation using YOLO model
class SegmentationProcessor(object):
    def __init__(self) -> None:
        # Initialize the YOLO model with the specified weights file
        self.model = YOLO('Assets/Models/yolov8l-seg.pt')

    def detect(self, image):
        # Use the YOLO model to predict segmentation masks for the input image
        results_container = self.model.predict(image)

        # Extract the inner array containing the actual results (boxes and masks)
        results = results_container[0]

        # Extract masks and bounding boxes from the segmentation results
        contours = [np.int32([mask]) for mask, box in zip(results.masks.xy, results.boxes)]

        # Extract bounding boxes, classes, and confidence scores
        bboxes = np.array(results.boxes.xyxy.cpu(), dtype="int")
        classes = np.array(results.boxes.cls.cpu(), dtype="int")
        scores = np.array(results.boxes.conf.cpu(), dtype="float").round(2)

        # Return the segmentation results
        return bboxes, classes, contours, scores
