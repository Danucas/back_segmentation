#!/usr/bin/python3
"""
Web Client for the video capture
and socket communication
"""

from flask import Flask, render_template
from flask_cors import CORS
import uuid

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/', 
           methods=['GET'],
           strict_slashes=False)
def index():
    """
    Landing
    """
    return render_template('index.html', id=str(uuid.uuid4()))

if __name__ == '__main__':
    app.run(host='localhost', port='6890')