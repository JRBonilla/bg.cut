# Main application file

from flask import Flask, render_template, request, jsonify
import cv2
import numpy as np
import base64
import webview
import threading
import random
from SegmentationProcessor import SegmentationProcessor

# Create a Flask web application
app = Flask(__name__)

# Create an instance of the SegmentationProcessor
processor = SegmentationProcessor()

# Store the uploaded image and the contours of the masks
uploaded_image = None
output_image = None;
contours = []

# Define the route for the main page
@app.route('/')
def index():
    return render_template('index.html')

# Convert RGB color to hexadecimal string
def rgb_to_hex(color):
    return "#{:02x}{:02x}{:02x}".format(color[0], color[1], color[2])

# Encodes an image in base64 for rendering in HTML
def encode_image(image):
    _, img_encoded = cv2.imencode('.png', image)
    img_base64 = base64.b64encode(img_encoded).decode('utf-8')
    return img_base64

# Define the route for handling image uploads
@app.route('/upload', methods=['POST'])
def upload():
    global uploaded_image

    try:
        # Get the uploaded file from the request
        file = request.files['file']

        # Read the uploaded image using OpenCV
        image = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_UNCHANGED)

        # Check if the image is valid
        if image is None:
            return jsonify({'error': 'Invalid file'})

        # Ensure the image has 3 channels (convert if necessary)
        if image.shape[2] == 4:  # Assuming 4 channels (RGBA)
            image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
        elif image.shape[2] != 3:
            return jsonify({'error': 'Image does not have 3 channels'})

        # Update the current uploaded image
        uploaded_image = image

        return jsonify({'image': encode_image(image)})
    except Exception as e:
        return jsonify({ 'error: ', str(e) })

# Define the route for analyzing the uploaded image
@app.route('/analyze', methods=['POST'])
def analyze():
    global contours

    try:
        # Perform segmentation on the uploaded image
        bboxes, contours = processor.detect(uploaded_image)

        # Check if no segments are detected
        if not contours:
            return jsonify({'error': 'No segments detected'})
        
        # Create an empty image with each mask drawn in a unique RGB color
        mask_overlay = np.zeros_like(uploaded_image)
        colors = [(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255)) for _ in contours]
        for contour, color in zip(contours, colors):
            bgr_color = (color[2], color[1], color[0]) # Convert RGB color to BGR for OpenCV
            cv2.fillPoly(mask_overlay, [contour], bgr_color)

        # Return the segmentation results as JSON
        return jsonify({
            'bboxes': bboxes.tolist(),
            'contours': [c.flatten().tolist() for c in contours],
            'mask_overlay': encode_image(mask_overlay),
            'colors': [rgb_to_hex(color) for color in colors]
        })
    except Exception as e:
        return jsonify({ 'error: ', str(e) })

# Define the route for cutting the selected masks and compositing them as one image
@app.route('/cut', methods=['POST'])
def cut():
    global output_image

    try:
        # Check if 'selected_masks' is present and is a list
        if 'selected_masks' not in request.json or not isinstance(request.json['selected_masks'], list):
            raise ValueError('Invalid or missing selected masks data')

        selected_masks = request.json['selected_masks']

        # Create a binary mask for each selected contour and combine them into one mask
        combined_mask = np.zeros_like(uploaded_image)
        for mask_index in selected_masks:
            if 0 <= mask_index < len(contours):
                contour = contours[mask_index]
                mask = np.zeros_like(uploaded_image)
                cv2.fillPoly(mask, [contour], (255, 255, 255))  # White mask where the contour is
                combined_mask = cv2.add(combined_mask, mask)  # Combine masks

        # Convert the combined mask to a single-channel image
        combined_mask = cv2.cvtColor(combined_mask, cv2.COLOR_BGR2GRAY)

        # Create an alpha channel based on the combined mask & set it to 0 for areas outside the mask
        alpha_channel = np.ones_like(combined_mask) * 255 # Initialize channel as fully opaque
        alpha_channel[combined_mask == 0] = 0 # All black pixels in the mask are made transparent
        alpha_channel_blurred = cv2.GaussianBlur(alpha_channel, (0, 0), sigmaX=1, sigmaY=1) # Blur the edges of the alpha channel

        # Add the alpha channel to the original image
        result = cv2.merge((uploaded_image, alpha_channel_blurred))

        # Clear data for transparent areas
        result[alpha_channel_blurred == 0] = 0  # Set all channels to zero where alpha is zero

        # Store the edited image result
        output_image = result

        return jsonify({ 'result': encode_image(result) })

    except Exception as e:
        return jsonify({ 'error': str(e) })

# Function to remove excess background
@app.route('/trim', methods=['POST'])
def trim():
    try:
        # Split the image into channels
        _, _, _, alpha = cv2.split(output_image)

        # Find the coordinates of the non-zero pixels in the alpha channel
        coords = cv2.findNonZero(alpha)

        # Get the bounding box of the non-zero pixels
        x, y, w, h = cv2.boundingRect(coords)
    
        # Crop the image to the bounding box
        trimmed_image = output_image[y:y+h, x:x+w]

        return jsonify({ 'trimmed': encode_image(trimmed_image) })
    except Exception as e:
        return jsonify({ 'error': str(e) })

# Function to run the Flask application in a separate thread
def run_app():
    app.run(port=5000, threaded=True)

# Entry point of the script
if __name__ == '__main__':
    # Create a separate thread to run the Flask application
    t = threading.Thread(target=run_app)
    t.daemon = True
    t.start()

    # Create a webview window and start the application
    webview.create_window("bg.cut", "http://127.0.0.1:5000", width=1440, height=800, resizable=False)
    webview.start()