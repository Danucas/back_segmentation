#!/usr/bin/python3
"""
Check the scoring and shows a list of filters to keep
"""

import re
import os

def get_scores(dataset):
    with open('./api/v1/datasets/{}/scoring/scores.txt'.format(dataset), 'r') as file:
        scores = file.read()
        filters_list = set(scores.split('\n'))
        scores_dicts = []
        for filt in filters_list:
            scores_dicts.append(
                {
                    'filter': filt,
                    'score': len([m.start() for m in re.finditer(filt, scores)])
                }
            )
        maxs = []
        for scor in scores_dicts:
            maxs.append(scor['score'])
        mostranked = list(reversed(sorted(maxs)))
        rank = []
        for sco in scores_dicts:
            for ran in mostranked:
                if ran == sco['score']:
                    rank.append(sco['filter'])
        nList = []
        for r in list(set(rank)):
            if r != '':
                nList.append(r)
        return nList

def remove_unused(dataset, ranked):
    """
    Remove the unused filters
    """
    path = './api/v1/datasets/{}'.format(dataset)
    dirs = os.listdir(path)
    for file in dirs:
        if file not in ' '.join(ranked) and '.png' in file:
            try:
                os.remove('{}/{}'.format(path, file))
            except Exception as e:
                pass
    with open('./api/v1/datasets/{}/scoring/scores.txt'.format(dataset), 'w') as file:
        file.write('\n')


