#!/usr/bin/python3
"""
Entrypoint to API app
"""

from api.v1.framework import framework
from eventlet import event
from eventlet.timeout import Timeout
import multiprocessing
from flask_socketio import SocketIO, emit, send
from flask import Flask, jsonify, Response, request
from flask_cors import CORS
from PIL import Image
import time
import json
import math
import os
import uuid

app = Flask(__name__)
app.register_blueprint(framework)
app.config['SECRET_KEY'] = 'secret!'

CORS(app)
socketio = SocketIO(app, cors_allowed_origins='*', path='streaming')

active_sockets = {}
events = {}


@app.route('/filters/<dataset>/<filtername>',
            methods=['GET'], strict_slashes=False)
def get_filter(dataset, filtername):
    """
    return a filter from datasets
    """
    filters = []
    if filtername == 'all':
        for dset in os.listdir('./api/v1/datasets/{}'.format(dataset.replace('-', '/'))):
            if '.png' in dset:
                filterSet = {}
                filterSet['name'] = dset;
                img = Image.open('./api/v1/datasets/{}/{}'.format(dataset.replace('-', '/'), dset))
                data = list(img.getdata())
                # print(data)
                loPixels = []
                for pixel in data:
                    loPixels.extend([pix for pix in pixel])
                width, height = img.size
                filterSet['data'] = loPixels
                filterSet['width'] = width
                filters.append(filterSet)
    return Response(json.dumps(filters), mimetype='application/json')

@app.route('/filters/<dataset>',
            methods=['POST'], strict_slashes=False)
def post_filter(dataset):
    """
    create filters from training
    """
    filters = request.get_json()
    for filter in filters:
        tupArray = []
        for i in range(0, len(filter), 4):
            tupArray.append((
                filter[i],
                filter[i + 1],
                filter[i + 2],
                filter[i + 3],
            ))
        length = int(math.sqrt(len(filter) / 4))
        # print(length)
        im = Image.new('RGBA', (length, length))
        try:
            im.putdata(tupArray)
            path = os.path.abspath(os.getcwd())
            filename = '{}/api/v1/datasets/{}/{}.png'.format(
                path,
                dataset.replace('-', '/'),
                str(uuid.uuid4())
            )
            im.save(filename)
        except Exception as e:
            pass
    return Response(json.dumps({'sucess': 200}), mimetype='application/json')

@app.route('/filters/<dataset>/scores',
            methods=['POST'], strict_slashes=False)
def set_scores(dataset):
    """
    Receive a list of features ids to generate a preference score
    higher scores will be retain as learned information an keep it throught training
    """
    filters = request.get_json()
    with open('./api/v1/datasets/{}/scoring/scores.txt'.format(
            dataset.replace('-', '/')),
            'a+'
        ) as file:
        for filter in filters:
            file.write(filter + '\n')
    return Response(json.dumps({}), mimetype='application/json')

@app.route('/processes/train/files',
            methods=['GET'],
            strict_slashes=False)
def list_training_files():
    """
    return a list of labeled data
    """
    # source_path = './training_data/sources/{}'.format(file_name)
    # dirs = sorted(os.listdir('./training_data/sources'))
    dirs = os.listdir('./training_data/sources')
    return Response(json.dumps(list(dirs)), mimetype='application/json')

@app.route('/processes/train/<file_name>',
            methods=['GET'],
            strict_slashes=False)
def get_train_data(file_name):
    res = {}
    source_path = './training_data/sources/{}'.format(file_name)
    mask_path = './training_data/masked/{}'.format(file_name)
    img = Image.open(source_path)
    data = list(img.getdata())
    # print(data)
    loPixels = []
    for pixel in data:
        loPixels.extend([pix for pix in pixel])
    width, height = img.size
    res['source'] = {
        'data': loPixels,
        'size': [width, height]
    }
    mask = Image.open(mask_path)
    mask_data = list(mask.getdata())
    # print(data)
    loPixelsMask = []
    for pixel in mask_data:
        loPixelsMask.extend([pix for pix in pixel])
    mask_width, mask_height = mask.size
    res['mask'] = {
        'data': loPixelsMask,
        'size': [mask_width, mask_height]
    }
    return Response(json.dumps(res), mimetype='application/json')

@app.route('/processes/extracted',
            methods=['GET'],
            strict_slashes=False)
def get_extracted_sources():
    """
    Return the list of extracted sources
    """
    with open('./api/v1/datasets/learned/scoring/extracted.json', 'r') as file:
        return Response(file.read(), mimetype='application/json')

@app.route('/processes/extracted',
            methods=['POST'],
            strict_slashes=False)
def set_extracted_sources():
    """
    Return the list of extracted sources
    """
    source = request.get_json()
    extracted = None
    with open('./api/v1/datasets/learned/scoring/extracted.json', 'r') as file:
        extracted = json.loads(file.read())
        extracted.append(source['extracted'])
    if extracted:
        with open('./api/v1/datasets/learned/scoring/extracted.json', 'w') as file:
            file.write(json.dumps(extracted))
        return Response('{"success": "200"}', mimetype='application/json')

@socketio.on('connect')
def connect_user():
    """
    Receive a user request and add it to the active_sockets dict
    """
    print('Connecting')
    print(request.sid)
    active_sockets[request.sid] = {}

@socketio.on('video-input')
def remove_background(frame):
    """
    Apply segmentation for the frame
    """
    with open('./test.png', 'wb') as bytes_file:
        bytes_file.write(frame)

@app.errorhandler(404)
def error404(err):
    """
    404 error Teardown
    """
    print(err)
    return jsonify(error=404)


if __name__ == '__main__':
    # socketio.run(app=app, host="0.0.0.0", port="6089")
    app.run(host="0.0.0.0", port="6089")