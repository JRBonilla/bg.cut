# bg.cut

bg.cut is a powerful and intuitive image processing tool designed to simplify background removal from images while providing users with the flexibility to choose specific objects to retain. The application combines YOLO v8 for detecting object bounding boxes that are then passed off to MobileSAM for fast and accurate instance segmentation. Additionally, OpenCV is incorporated for efficient mask data handling and manipulation.

## Features

- **Background Removal**: Easily eliminate backgrounds from images.
- **Selective Object Retention**: Choose specific objects to retain in the image.
- **YOLO v8 Integration**: Utilizes YOLO v8 for robust object detection and bounding box generation.
- **MobileSAM Instance Segmentation**: Implements MobileSAM for fast and accurate instance segmentation, ensuring detailed object boundaries.
- **OpenCV Handling**: OpenCV integrated for efficient mask data processing and manipulation.
- **Modern UI**: Features a modern and user-friendly interface for a easy editing experience.
- **Web Technologies**: Developed using Flask, pywebview (for desktop app functionality), HTML, JavaScript, and CSS.
- **Animations:** Smooth transitions powered by animate.css.

## Installation

To get started with bg.cut, follow these steps:

1. Clone the repository.
```
git clone https://github.com/JRBonilla/bg.cut.git
cd bg.cut
```
2. Install dependencies by running the following command in your terminal:
```
pip install -r requirements.txt
```
This will ensure Flask, pywebview, OpenCV, and Ultralytics are installed on your system.

3. Run the application.
```
python App.py
```
This will launch a new pywebview window with the application.

## Usage

1. Choose an image by selecting or dragging and dropping it onto the application..
2. Select the objects you want to keep in the image and click "Cut".
3. (Optional) Trim any excess background from the image.
4. Save the edited image to your computer.

## License

This project is licensed under the [MIT License](LICENSE.md) - see the [LICENSE.md](LICENSE.md) file for details.

---

Developed by Jonathan Bonilla.
