#!/usr/bon/python3
"""
Handle the JS modules and ServiceWorkers
requests
"""

import os
from api.v1.framework import framework
from flask import send_from_directory, jsonify

@framework.route('/front-end/<file_name>')
def get_module(file_name):
    path = os.getcwd() + '/api/v1/framework/static'
    print(path)
    try:
        obj = send_from_directory(path, file_name)
        print(obj)
    except Exception as e:
        # print(os.listdir('./api/v1/framework/static/'))
        # print(e)
        return jsonify(error='404'), 404
    return obj

