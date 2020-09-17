#!/usr/bin/python3
"""
.PNG correcter
"""
from PIL import Image
import os
import math

def to_rgba(file_path):
    """
    transform rgb png based to rgba
    """
    print(file_path)
    img = Image.open(file_path).convert('RGBA')
    img.save(file_path)
    data = list(img.getdata())

def list_to_image(filt, name='test', file_format='RGB'):
    tupArray = []
    for i in range(0, len(filt)):
        tupArray.append((
            filt[i],
            filt[i],
            filt[i],
            255
        ))
    length = int(math.sqrt(len(filt)))
    im = Image.new('RGBA', (length, length))
    im.putdata(tupArray)
    path = os.path.abspath(os.getcwd())
    filename = '{}/{}.png'.format(
        path,
        name
    )
    im.save(filename)

def list_files(path):
    """
    list available .png files to transform
    """
    for image in os.listdir(path):
        if '.png' in image:
            print(image)
            to_rgba(path + '/' + image)