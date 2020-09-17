#!/usr/bin/python3
"""
Defines the Blueprint for the Framework endpoints
"""

from flask import Blueprint

framework = Blueprint(
    'framework',
    __name__,
    url_prefix='/tool',
    static_folder='static',
    static_url_path='static/framework'
)

from api.v1.framework.modules import *