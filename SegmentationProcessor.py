# Import necessary libraries
from ultralytics import YOLO
from ultralytics import SAM
import numpy as np

# Define a class for image segmentation using YOLO model
class SegmentationProcessor(object):
    def __init__(self) -> None:
        # Initialize the models with the specified weights file
        self.yolo = YOLO('Assets/Models/yolov8l.pt')
        self.msam = SAM('Assets/Models/mobile_sam.pt')

    def detect(self, image):
        # Use the YOLO model to detect objects in the input image
        objects = self.yolo.predict(image, device='cpu')

        # Extract bounding boxes from the objects array
        bboxes = np.array(objects[0].boxes.xyxy.cpu(), dtype="int")

        # Segment image using the MobileSAM model and extract the contours from the segmentation results
        masks = self.segment(image, bboxes)
        contours = [np.int32([mask]) for mask, box in zip(masks.xy, objects[0].boxes)]

        # Return the segmentation results
        return bboxes, contours
    
    def segment(self, image, bboxes):
        results = self.msam.predict(image, bboxes=bboxes)
        print(results)
        return results[0].masks